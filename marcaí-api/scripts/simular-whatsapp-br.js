process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const banco = require('../src/config/banco')
const iaServico = require('../src/modulos/ia/ia.servico')

const tenantId = process.env.TENANT_ID
const stepDelayMs = Number(process.env.STEP_DELAY_MS || 1200)
const scenarioDelayMs = Number(process.env.SCENARIO_DELAY_MS || 2000)

if (!tenantId) {
  console.error('Defina TENANT_ID para rodar a simulacao.')
  process.exit(1)
}

const cenariosBase = [
  { nome: 'split_basico_hoje', passos: ['oi', 'quero corta hj', 'mais tarde tem?'] },
  { nome: 'abreviado_amanha_manha', passos: ['boa tarde', 'corte', 'amanha de manha?'] },
  { nome: 'erro_digitacao_horario', passos: ['qria corta hj', '17h?'] },
  { nome: 'combo_mudanca_ideia', passos: ['quero barba', 'na real corte e barba', 'quanto fica?'] },
  { nome: 'combo_confirma', passos: ['quero corte e barba hoje', 'pode ser'] },
  { nome: 'degrade_pos_18', passos: ['moço', 'qria agenda um degrade amanha', 'depois das 18'] },
  { nome: 'outro_barbeiro', passos: ['quero corte hoje', 'tem com outro barbeiro?'] },
  { nome: 'objeção_preco', passos: ['quanto fica corte e barba?', 'ta caro', 'tem algo melhor?'] },
  { nome: 'mensagens_picadas', passos: ['oi', 'corte', 'hj', '17', 'fechou'] },
  { nome: 'sem_tempo', passos: ['to sem mt tempo hj', 'tem algo rapido?'] },
  { nome: 'indeciso', passos: ['nao sei se faco so corte ou barba tbm'] },
  { nome: 'saudacao_solta_horario_exato', passos: ['slv', 'tem como p amanha 9?'] },
  { nome: 'pedido_humano', passos: ['fala com humano'] },
  { nome: 'primeiro_contato_sem_nome', passos: ['oi sou matheus', 'quero corta amanha 9h'], nomeClienteInicial: '' },
  { nome: 'mesmo_horario_amanha', passos: ['quero corte hoje', 'amanha no mesmo horario consegue?'] },
  { nome: 'muitas_msgs_rapidas', passos: ['oi', 'quero marca', 'corte', 'amanha', 'de tarde', 'se tiver 14h melhor'] },
  { nome: 'mensagem_corrida_brasil_real', passos: ['boa noite irmao queria ver se amanha ce tem um horario pra corte pq saio do trampo 18 e pouco'] },
  { nome: 'mistura_assuntos_mesma_msg', passos: ['tem horario amanha? aceita cartao? queria corte e barba'] },
  { nome: 'negacao_informal', passos: ['quero corte hoje', 'n esse horario', 'mais tarde entao'] },
  { nome: 'sem_pontuacao_objetivo', passos: ['amanha 9 matheus consegue corte'] },
  { nome: 'cancelar_ou_remarcar_confuso', passos: ['acho q vou cancelar', 'na real melhor remarcar pra sexta de tarde'] },
  { nome: 'cliente_pressa_estressado', passos: ['mano responde ai tem horario hj ou n'] },
  { nome: 'servico_com_giria', passos: ['quero dar um trato no visual hoje'] },
  { nome: 'rejeicao_slot_explicita', passos: ['quero corte hoje', 'nao esse ai', 'tem outro horario?'] },
]

const filtros = (process.env.SCENARIO_FILTER || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const cenarios = filtros.length
  ? cenariosBase.filter((cenario) => filtros.some((filtro) => cenario.nome.includes(filtro)))
  : cenariosBase

const frasesRoboticAs = [
  'se precisar de mais alguma coisa',
  'por favor, selecione uma das opções',
  'infelizmente não há disponibilidade',
]

const analisarResposta = (ultimaMensagemCliente, resposta) => {
  const alertas = []
  const linhas = resposta.split('\n').filter(Boolean)

  if (linhas.length > 3) alertas.push('mensagem_longa')

  if (frasesRoboticAs.some((frase) => resposta.toLowerCase().includes(frase))) {
    alertas.push('frase_robotica')
  }

  if (
    /como posso te ajudar/i.test(resposta)
    && /(quero|corte|barba|horario|horário|amanha|amanhã|hoje|17h|16h|mais tarde|agendar)/i.test(ultimaMensagemCliente)
  ) {
    alertas.push('pergunta_desnecessaria')
  }

  return alertas
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function criarCliente(idx, nomeClienteInicial) {
  return banco.cliente.create({
    data: {
      tenantId,
      nome: nomeClienteInicial !== undefined ? nomeClienteInicial : `Cliente Teste Suite ${idx}`,
      telefone: `55110${String(Date.now() + idx).slice(-8)}`,
    },
  })
}

async function rodarCenario(cenario, idx) {
  const cliente = await criarCliente(idx, cenario.nomeClienteInicial)
  const conversa = await banco.conversa.create({
    data: { tenantId, clienteId: cliente.id, canal: 'WHATSAPP', status: 'ATIVA' },
  })

  try {
    const respostas = []
    for (const passo of cenario.passos) {
      const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, passo)
      respostas.push({
        cliente: passo,
        ia: resultado.resposta,
        escalonado: resultado.escalonado,
        encerrado: resultado.encerrado,
        alertas: analisarResposta(passo, resultado.resposta),
      })

      if (stepDelayMs > 0) {
        await esperar(stepDelayMs)
      }
    }

    const mensagens = await banco.mensagem.findMany({ where: { conversaId: conversa.id }, orderBy: { criadoEm: 'asc' } })
    const toolCalls = mensagens
      .filter((m) => m.remetente === 'tool_call')
      .map((m) => JSON.parse(m.conteudo))
      .flatMap((m) => (m.tool_calls || []).map((tc) => ({ nome: tc.function.name, argumentos: tc.function.arguments })))

    return { nome: cenario.nome, respostas, toolCalls }
  } finally {
    await banco.agendamento.deleteMany({ where: { tenantId, clienteId: cliente.id } })
    await banco.mensagem.deleteMany({ where: { conversaId: conversa.id } })
    await banco.conversa.delete({ where: { id: conversa.id } })
    await banco.cliente.delete({ where: { id: cliente.id } })
  }
}

async function main() {
  const resultados = []
  let totalTurnos = 0
  let totalEscalonamentos = 0
  let totalAlertas = 0
  let totalErros = 0

  for (let i = 0; i < cenarios.length; i += 1) {
    try {
      const resultado = await rodarCenario(cenarios[i], i)
      resultados.push(resultado)

      for (const resposta of resultado.respostas) {
        totalTurnos += 1
        if (resposta.escalonado) totalEscalonamentos += 1
        totalAlertas += resposta.alertas.length
      }
    } catch (erro) {
      totalErros += 1
      resultados.push({
        nome: cenarios[i].nome,
        erro: erro?.message || erro?.mensagem || String(erro),
      })
    }

    if (scenarioDelayMs > 0 && i < (cenarios.length - 1)) {
      await esperar(scenarioDelayMs)
    }
  }

  const resumo = {
    tenantId,
    cenariosExecutados: cenarios.length,
    totalTurnos,
    totalEscalonamentos,
    totalAlertas,
    totalErros,
    taxaSucesso: cenarios.length ? Number((((cenarios.length - totalErros) / cenarios.length) * 100).toFixed(1)) : 0,
    taxaErro: cenarios.length ? Number(((totalErros / cenarios.length) * 100).toFixed(1)) : 0,
  }

  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  await banco.$disconnect()
}

main().catch(async (erro) => {
  console.error(erro)
  try { await banco.$disconnect() } catch (_) {}
  process.exit(1)
})

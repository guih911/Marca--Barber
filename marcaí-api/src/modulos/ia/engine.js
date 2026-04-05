/**
 * ENGINE DE DECISÃO v4 — Backend faz tudo que é crítico
 *
 * Princípios:
 * 1. Respostas diretas sem LLM quando possível (0ms, zero erro)
 * 2. Dados reais injetados ANTES da IA (ela não busca, só escreve)
 * 3. Interceptação PÓS IA pra cards de confirmação (horário sempre correto)
 * 4. Fallback pra Sonnet quando a situação é complexa
 */

const banco = require('../../config/banco')

// ═══ Detecção de intenção ═══

const detectar = (msg) => {
  const t = String(msg || '').trim()
  const n = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Respostas diretas (prioridade máxima)
  if (/^\[ÁUDIO\]$|^\[AUDIO\]$/.test(t)) return 'AUDIO'
  if (/^\[FIGURINHA\]$/.test(t)) return 'FIGURINHA'
  if (/^\[DOCUMENTO\]$/.test(t)) return 'DOCUMENTO'
  if (/^[1-5]$/.test(t)) return 'NPS'
  if (/\b(horrivel|pessimo|nao gostei|ficou errado|mal atendid|decepcionad|uma merda)\b/.test(n)) return 'RECLAMACAO'
  if (/\b(falar com (alguem|pessoa|humano|atendente|gerente|dono))\b/.test(n)) return 'HUMANO'

  // Ações sobre agendamento (engine busca dados)
  if (!/\bnao (quero|vou|preciso)\b/.test(n)) {
    if (/\b(remarc|reagend|mudar.{0,8}horario|trocar.{0,8}horario|adiar)\b/.test(n)) return 'REMARCAR'
    if (/\b(cancelar|desmarcar|desist)\b/.test(n)) return 'CANCELAR'
    if (/\b(meu horario|tenho horario|qual.{0,5}horario|quando (eu )?(vou|tenho)|to marcad)\b/.test(n)) return 'CONSULTAR'
  }

  // Preço (engine pode responder direto)
  if (/\bquanto\s*(custa|e|fica|sai)\b|\bpreco\b|\bvalor\b/.test(n)) return 'PRECO'

  // Localização (resposta direta do banco)
  if (/\b(onde\s*fica|endereco|localizacao|como\s*cheg)\b/.test(n)) return 'LOCALIZACAO'

  // Pagamento (resposta direta do banco)
  if (/\b(aceita|cartao|pix|dinheiro|forma.{0,5}pagamento)\b/.test(n)) return 'PAGAMENTO'

  return null
}

// ═══ Respostas diretas sem LLM ═══

const respostaDireta = (intencao, { tenant } = {}) => {
  switch (intencao) {
    case 'AUDIO':
      return { resposta: 'Nao consigo ouvir audios aqui, mas pode digitar que te ajudo na hora! ✍️', pular: true }
    case 'FIGURINHA':
      return { resposta: 'Boa! Posso te ajudar com alguma coisa? 😄', pular: true }
    case 'DOCUMENTO':
      return { resposta: 'Recebi o arquivo, mas nao consigo abrir aqui. Se precisar, e so digitar!', pular: true }
    case 'RECLAMACAO':
      return { resposta: 'Que pena ouvir isso. Vou te conectar com a equipe agora.', tool: 'escalonarParaHumano', pular: true }
    case 'HUMANO':
      return { resposta: 'Claro, vou te passar pra equipe.', tool: 'escalonarParaHumano', pular: true }

    case 'LOCALIZACAO': {
      if (tenant?.endereco) {
        const maps = tenant.linkMaps ? `\nMapa: ${tenant.linkMaps}` : ''
        return { resposta: `Fica em ${tenant.endereco}! 📍${maps}\n\nPosso te ajudar com agendamento? 💈`, pular: true }
      }
      return null
    }

    case 'PAGAMENTO': {
      const tipos = Array.isArray(tenant?.tiposPagamento) ? tenant.tiposPagamento : null
      if (tipos?.length) {
        const map = { PIX: 'PIX', DINHEIRO: 'dinheiro', CARTAO_CREDITO: 'cartao de credito', CARTAO_DEBITO: 'cartao de debito' }
        const lista = tipos.map(t => map[t] || t).join(', ')
        return { resposta: `Aceitamos ${lista}! 👍\n\nVai ser corte, barba ou os dois?`, pular: true }
      }
      return null
    }

    default:
      return null
  }
}

// ═══ Busca dados reais ANTES da IA ═══

const buscarDadosReais = async (intencao, { tenantId, clienteId, timezone, tenant, mensagem }) => {
  if (!clienteId) return ''
  const tz = timezone || 'America/Sao_Paulo'

  // Remarcar/Cancelar/Consultar: busca agendamentos
  if (intencao === 'REMARCAR' || intencao === 'CANCELAR' || intencao === 'CONSULTAR') {
    const ags = await banco.agendamento.findMany({
      where: {
        tenantId, clienteId,
        status: { in: ['AGENDADO', 'CONFIRMADO'] },
        inicioEm: { gte: new Date() },
      },
      include: {
        servico: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
      },
      orderBy: { inicioEm: 'asc' },
      take: 5,
    })

    if (ags.length === 0) {
      return '\n\n🔴 ENGINE: Cliente NAO tem agendamentos futuros. Informe e ofereca agendar.'
    }

    const lista = ags.map(a => {
      const dt = new Date(a.inicioEm).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz })
      return `- agendamentoId: ${a.id} | ${a.servico.nome} com ${a.profissional.nome} | ${dt}`
    }).join('\n')

    let instrucao = `\n\n🔴 ENGINE — DADOS REAIS (nao chame buscarAgendamentosCliente):\n${lista}\n`

    if (intencao === 'CANCELAR') {
      instrucao += ags.length === 1
        ? `\nOBRIGATORIO: Confirme ANTES de cancelar: "Quer cancelar o ${ags[0].servico.nome} de [data] mesmo?". SO cancele apos o cliente confirmar.`
        : '\nTem mais de 1. Pergunte QUAL quer cancelar. SO cancele apos confirmar.'
    }
    if (intencao === 'REMARCAR') {
      instrucao += ags.length === 1
        ? `\nPergunte para qual dia/hora quer mudar o ${ags[0].servico.nome}. NUNCA assuma servico.`
        : '\nTem mais de 1. Pergunte QUAL quer remarcar.'
    }

    return instrucao
  }

  // Preço: busca serviço na mensagem e responde com dados reais
  if (intencao === 'PRECO') {
    const servicos = await banco.servico.findMany({
      where: { tenantId, ativo: true },
      select: { nome: true, precoCentavos: true, duracaoMinutos: true },
    })

    const norm = String(mensagem || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    let servicoEncontrado = null
    for (const s of servicos) {
      const nomeNorm = s.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (norm.includes(nomeNorm)) { servicoEncontrado = s; break }
    }
    if (!servicoEncontrado && /\b(corte|cabelo|visual)\b/.test(norm)) servicoEncontrado = servicos.find(s => /corte/i.test(s.nome))
    if (!servicoEncontrado && /\bbarba\b/.test(norm)) servicoEncontrado = servicos.find(s => /barba/i.test(s.nome))

    if (servicoEncontrado && servicoEncontrado.precoCentavos) {
      const preco = (servicoEncontrado.precoCentavos / 100).toFixed(2).replace('.', ',')
      return `\n\n🔴 ENGINE — PRECO REAL: ${servicoEncontrado.nome} = R$${preco} (${servicoEncontrado.duracaoMinutos}min). Responda com esse valor EXATO e ofereca agendar. NAO invente preco.`
    }

    if (servicos.length > 0) {
      const lista = servicos.map(s => `${s.nome}: R$${((s.precoCentavos || 0) / 100).toFixed(2).replace('.', ',')}`).join(' | ')
      return `\n\n🔴 ENGINE — PRECOS REAIS: ${lista}. Pergunte qual servico o cliente quer.`
    }
  }

  return ''
}

// ═══ Determina se deve usar modelo complexo (Sonnet) ═══

const deveUsarModeloComplexo = (mensagem, intencao) => {
  const n = String(mensagem || '').toLowerCase()

  // Múltiplas intenções na mesma mensagem
  if (/quanto.*cust.*hor[aá]rio|hor[aá]rio.*quanto.*cust/i.test(n)) return true

  // Troca de intenção
  if (/quero agendar.*quanto custa|quanto custa.*agendar/i.test(n)) return true

  // Mensagem muito longa (complexa)
  if (n.length > 150) return true

  // Mudança de contexto ("não pera", "na verdade")
  if (/\bn[aã]o\s*pera|na verdade|mudei|pensando melhor/i.test(n)) return true

  return false
}

module.exports = { detectar, respostaDireta, buscarDadosReais, deveUsarModeloComplexo }

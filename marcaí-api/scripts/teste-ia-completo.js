/**
 * Teste completo da IA - Simula interações reais
 *
 * Executa: TENANT_ID=xxx node scripts/teste-ia-completo.js
 */

require('dotenv').config()
const banco = require('../src/config/banco')
const { processarWebhookInterno } = require('../src/modulos/ia/ia.controlador')
const fidelidadeServico = require('../src/modulos/fidelidade/fidelidade.servico')

const TENANT_ID = process.env.TENANT_ID || '93c72a72-cf4f-4f0b-8423-3f9411a2853c'
const TELEFONE_TESTE = '+5561988887777'

const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  ciano: '\x1b[36m',
  negrito: '\x1b[1m',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const log = {
  titulo: (msg) => console.log(`\n${cores.negrito}${cores.azul}${'═'.repeat(60)}${cores.reset}\n${cores.negrito}${cores.ciano}${msg}${cores.reset}\n${cores.azul}${'═'.repeat(60)}${cores.reset}`),
  cliente: (msg) => console.log(`\n${cores.amarelo}👤 CLIENTE:${cores.reset} ${msg}`),
  ia: (msg) => console.log(`${cores.ciano}🤖 IA:${cores.reset} ${msg}`),
  ok: (msg) => console.log(`${cores.verde}✓ ${msg}${cores.reset}`),
  erro: (msg) => console.log(`${cores.vermelho}✗ ${msg}${cores.reset}`),
  info: (msg) => console.log(`${cores.amarelo}ℹ ${msg}${cores.reset}`),
}

const enviarMensagem = async (telefone, mensagem, nome = '') => {
  log.cliente(mensagem)
  try {
    const resultado = await processarWebhookInterno({
      tenantId: TENANT_ID,
      telefone,
      mensagem,
      nome,
      canal: 'WHATSAPP',
      configWhatsApp: null,
    })
    log.ia(resultado?.resposta || '(sem resposta)')
    return resultado
  } catch (err) {
    log.erro(`Erro: ${err.message}`)
    return { erro: err.message }
  }
}

const limparClienteTeste = async () => {
  const cliente = await banco.cliente.findFirst({
    where: { tenantId: TENANT_ID, telefone: TELEFONE_TESTE },
  })
  if (cliente) {
    await banco.agendamento.deleteMany({ where: { clienteId: cliente.id } })
    await banco.pontosFidelidade.deleteMany({ where: { clienteId: cliente.id } })
    await banco.assinaturaCliente.deleteMany({ where: { clienteId: cliente.id } })
    const conversas = await banco.conversa.findMany({ where: { clienteId: cliente.id } })
    for (const c of conversas) {
      await banco.mensagem.deleteMany({ where: { conversaId: c.id } })
    }
    await banco.conversa.deleteMany({ where: { clienteId: cliente.id } })
    await banco.cliente.delete({ where: { id: cliente.id } })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════════

const testarPrimeiraInteracao = async () => {
  log.titulo('TESTE 1: PRIMEIRA INTERACAO (CLIENTE NOVO)')

  await enviarMensagem(TELEFONE_TESTE, 'Oi, quero agendar um corte')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'Joao Silva')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'pode ser hoje a tarde')
  await sleep(500)
  const resp = await enviarMensagem(TELEFONE_TESTE, 'pode ser esse horario sim')

  // Verifica se agendamento foi criado
  const cliente = await banco.cliente.findFirst({
    where: { tenantId: TENANT_ID, telefone: TELEFONE_TESTE },
  })
  const agendamento = cliente ? await banco.agendamento.findFirst({
    where: { clienteId: cliente.id, status: { in: ['AGENDADO', 'CONFIRMADO'] } },
    include: { servico: true, profissional: true },
  }) : null

  if (agendamento) {
    log.ok(`Agendamento criado: ${agendamento.servico.nome} com ${agendamento.profissional.nome}`)
  } else {
    log.erro('Agendamento NAO foi criado')
  }

  return { cliente, agendamento }
}

const testarClienteRecorrente = async () => {
  log.titulo('TESTE 2: CLIENTE RECORRENTE')

  // Simula nova conversa
  await sleep(1000)
  const resp = await enviarMensagem(TELEFONE_TESTE, 'oi, quero marcar outro corte')

  if (resp?.resposta?.toLowerCase().includes('joao') || resp?.resposta?.toLowerCase().includes('joão')) {
    log.ok('IA reconheceu cliente pelo nome')
  } else {
    log.info('IA nao usou o nome do cliente na resposta')
  }
}

const testarPerguntasInformativas = async () => {
  log.titulo('TESTE 3: PERGUNTAS INFORMATIVAS')

  await enviarMensagem(TELEFONE_TESTE, 'onde fica a barbearia?')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'qual o telefone do dono?')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'aceita cartao?')
}

const testarPlanoMensal = async () => {
  log.titulo('TESTE 4: PLANO MENSAL')

  // Verifica se tem planos
  const planos = await banco.planoAssinatura.findMany({
    where: { tenantId: TENANT_ID, ativo: true },
    include: { creditos: { include: { servico: true } } },
  })

  if (planos.length === 0) {
    log.info('Nenhum plano configurado - pulando teste')
    return
  }

  log.info(`Planos disponiveis: ${planos.map(p => p.nome).join(', ')}`)

  await enviarMensagem(TELEFONE_TESTE, 'tem plano mensal?')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'quero assinar o plano')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'pode confirmar')

  // Verifica assinatura
  const cliente = await banco.cliente.findFirst({
    where: { tenantId: TENANT_ID, telefone: TELEFONE_TESTE },
  })
  const assinatura = cliente ? await banco.assinaturaCliente.findFirst({
    where: { clienteId: cliente.id, status: 'ATIVA' },
    include: { planoAssinatura: true },
  }) : null

  if (assinatura) {
    log.ok(`Plano ativado: ${assinatura.planoAssinatura.nome}`)

    // Tenta agendar pelo plano
    await sleep(500)
    await enviarMensagem(TELEFONE_TESTE, 'quero agendar um corte pelo plano')
    await sleep(500)
    await enviarMensagem(TELEFONE_TESTE, 'pode ser amanha de manha')
  } else {
    log.info('Assinatura nao foi criada (pode ser fluxo diferente)')
  }
}

const testarFidelidade = async () => {
  log.titulo('TESTE 5: PROGRAMA DE FIDELIDADE')

  const tenant = await banco.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { fidelidadeAtivo: true },
  })

  if (!tenant?.fidelidadeAtivo) {
    log.info('Fidelidade nao esta ativa - pulando')
    return
  }

  const config = await fidelidadeServico.obterConfig(TENANT_ID)
  if (!config) {
    log.info('Fidelidade nao configurada - pulando')
    return
  }

  log.info(`Pontos para resgate: ${config.pontosParaResgate}`)
  log.info(`Premio: ${config.descricaoResgate}`)

  await enviarMensagem(TELEFONE_TESTE, 'quantos pontos eu tenho?')

  // Simula pontos suficientes para resgate
  const cliente = await banco.cliente.findFirst({
    where: { tenantId: TENANT_ID, telefone: TELEFONE_TESTE },
  })

  if (cliente) {
    await banco.pontosFidelidade.upsert({
      where: { tenantId_clienteId: { tenantId: TENANT_ID, clienteId: cliente.id } },
      update: { pontos: config.pontosParaResgate, totalGanho: config.pontosParaResgate },
      create: { tenantId: TENANT_ID, clienteId: cliente.id, pontos: config.pontosParaResgate, totalGanho: config.pontosParaResgate },
    })

    log.info(`Pontos adicionados: ${config.pontosParaResgate}`)

    await sleep(500)
    await enviarMensagem(TELEFONE_TESTE, 'RESGATAR')

    // Verifica se resgatou
    const saldo = await banco.pontosFidelidade.findUnique({
      where: { tenantId_clienteId: { tenantId: TENANT_ID, clienteId: cliente.id } },
    })

    if (saldo && saldo.pontos === 0) {
      log.ok('Resgate processado - pontos zerados')
    } else {
      log.info(`Pontos atuais: ${saldo?.pontos || 0}`)
    }
  }
}

const testarRemarcacao = async () => {
  log.titulo('TESTE 6: REMARCACAO')

  await enviarMensagem(TELEFONE_TESTE, 'quero remarcar meu agendamento')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'pode ser amanha as 10h')
}

const testarCancelamento = async () => {
  log.titulo('TESTE 7: CANCELAMENTO')

  await enviarMensagem(TELEFONE_TESTE, 'quero cancelar meu agendamento')
  await sleep(500)
  await enviarMensagem(TELEFONE_TESTE, 'sim, pode cancelar')
}

const verificarLembretes = async () => {
  log.titulo('TESTE 8: SISTEMA DE LEMBRETES')

  const agendamentosComLembrete = await banco.agendamento.count({
    where: {
      tenantId: TENANT_ID,
      lembreteEnviadoEm: { not: null },
      criadoEm: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  })

  const agendamentosPendentesLembrete = await banco.agendamento.count({
    where: {
      tenantId: TENANT_ID,
      status: { in: ['AGENDADO', 'CONFIRMADO'] },
      inicioEm: { gte: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      lembreteEnviadoEm: null,
    },
  })

  log.info(`Lembretes enviados (ultimo mes): ${agendamentosComLembrete}`)
  log.info(`Agendamentos aguardando lembrete (proximas 48h): ${agendamentosPendentesLembrete}`)

  if (agendamentosComLembrete > 0) {
    log.ok('Sistema de lembretes funcionando')
  } else {
    log.info('Nenhum lembrete enviado recentemente (pode ser normal se nao teve agendamentos)')
  }
}

const mostrarConfiguracoes = async () => {
  log.titulo('CONFIGURACOES DO TENANT')

  const tenant = await banco.tenant.findUnique({
    where: { id: TENANT_ID },
    select: {
      nome: true,
      fidelidadeAtivo: true,
      membershipsAtivo: true,
      configWhatsApp: true,
      antecedenciaCancelar: true,
    },
  })

  const servicos = await banco.servico.count({ where: { tenantId: TENANT_ID, ativo: true } })
  const profissionais = await banco.profissional.count({ where: { tenantId: TENANT_ID, ativo: true } })
  const planos = await banco.planoAssinatura.count({ where: { tenantId: TENANT_ID, ativo: true } })

  console.log(`
  Tenant: ${tenant.nome}
  WhatsApp: ${tenant.configWhatsApp?.provedor || 'nao configurado'}
  Fidelidade: ${tenant.fidelidadeAtivo ? 'ATIVO' : 'inativo'}
  Planos mensais: ${tenant.membershipsAtivo ? 'ATIVO' : 'inativo'}
  Antecedencia cancelar: ${tenant.antecedenciaCancelar}h
  Servicos ativos: ${servicos}
  Profissionais ativos: ${profissionais}
  Planos disponiveis: ${planos}
  `)
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUCAO
// ═══════════════════════════════════════════════════════════════════════════

const executar = async () => {
  console.log(`
${cores.negrito}${cores.azul}╔════════════════════════════════════════════════════════════╗
║           TESTE COMPLETO DA IA - MARCAI BARBER             ║
╚════════════════════════════════════════════════════════════╝${cores.reset}
  `)

  try {
    await mostrarConfiguracoes()

    // Limpa dados anteriores
    log.info('Limpando dados de teste anteriores...')
    await limparClienteTeste()

    // Executa testes
    await testarPrimeiraInteracao()
    await testarClienteRecorrente()
    await testarPerguntasInformativas()
    await testarPlanoMensal()
    await testarFidelidade()
    await testarRemarcacao()
    await testarCancelamento()
    await verificarLembretes()

    log.titulo('TESTE FINALIZADO')

    // Limpa
    log.info('Limpando dados de teste...')
    await limparClienteTeste()

  } catch (err) {
    log.erro(`Erro fatal: ${err.message}`)
    console.error(err)
  } finally {
    await banco.$disconnect()
  }
}

executar()

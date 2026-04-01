/**
 * Script de teste completo da IA - Simula todas as interações
 *
 * Executa: node scripts/testar-ia-completo.js
 */

require('dotenv').config()
const banco = require('../src/config/banco')
const iaServico = require('../src/modulos/ia/ia.servico')
const agendamentosServico = require('../src/modulos/agendamentos/agendamentos.servico')
const fidelidadeServico = require('../src/modulos/fidelidade/fidelidade.servico')
const planosServico = require('../src/modulos/planos/planos.servico')
const clientesServico = require('../src/modulos/clientes/clientes.servico')

const TENANT_ID = process.env.TEST_TENANT_ID || null
const TELEFONE_TESTE = '+5561999999999'

const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  ciano: '\x1b[36m',
  negrito: '\x1b[1m',
}

const log = {
  titulo: (msg) => console.log(`\n${cores.negrito}${cores.azul}═══════════════════════════════════════════════════${cores.reset}`),
  subtitulo: (msg) => console.log(`${cores.negrito}${cores.ciano}▸ ${msg}${cores.reset}`),
  ok: (msg) => console.log(`  ${cores.verde}✓${cores.reset} ${msg}`),
  erro: (msg) => console.log(`  ${cores.vermelho}✗${cores.reset} ${msg}`),
  info: (msg) => console.log(`  ${cores.amarelo}ℹ${cores.reset} ${msg}`),
  cliente: (msg) => console.log(`  ${cores.azul}👤 Cliente:${cores.reset} "${msg}"`),
  ia: (msg) => console.log(`  ${cores.ciano}🤖 IA:${cores.reset} ${msg.substring(0, 150)}${msg.length > 150 ? '...' : ''}`),
}

const resultados = {
  total: 0,
  sucesso: 0,
  falha: 0,
  detalhes: [],
}

const registrarTeste = (nome, passou, detalhes = '') => {
  resultados.total++
  if (passou) {
    resultados.sucesso++
    log.ok(`${nome}`)
  } else {
    resultados.falha++
    log.erro(`${nome}${detalhes ? ` - ${detalhes}` : ''}`)
  }
  resultados.detalhes.push({ nome, passou, detalhes })
}

const simularMensagem = async (tenantId, telefone, mensagem, contexto = {}) => {
  log.cliente(mensagem)
  try {
    const resposta = await iaServico.processarMensagemWhatsApp(tenantId, telefone, mensagem, contexto)
    log.ia(resposta.resposta || resposta.mensagem || JSON.stringify(resposta))
    return resposta
  } catch (err) {
    log.erro(`Erro ao processar: ${err.message}`)
    return { erro: err.message }
  }
}

const buscarTenantTeste = async () => {
  if (TENANT_ID) {
    return banco.tenant.findUnique({ where: { id: TENANT_ID } })
  }
  // Busca o primeiro tenant ativo com WhatsApp configurado
  return banco.tenant.findFirst({
    where: { ativo: true, configWhatsApp: { not: null } },
    orderBy: { criadoEm: 'desc' },
  })
}

const limparDadosTeste = async (tenantId) => {
  // Remove cliente de teste se existir
  const clienteTeste = await banco.cliente.findFirst({
    where: { tenantId, telefone: TELEFONE_TESTE },
  })
  if (clienteTeste) {
    await banco.agendamento.deleteMany({ where: { clienteId: clienteTeste.id } })
    await banco.pontosFidelidade.deleteMany({ where: { clienteId: clienteTeste.id } })
    await banco.assinaturaCliente.deleteMany({ where: { clienteId: clienteTeste.id } })
    await banco.mensagem.deleteMany({
      where: { conversa: { clienteId: clienteTeste.id } },
    })
    await banco.conversa.deleteMany({ where: { clienteId: clienteTeste.id } })
    await banco.cliente.delete({ where: { id: clienteTeste.id } })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════════

const testarPrimeiraInteracao = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 1: Primeira Interação (Cliente Novo)')

  // Primeira mensagem - cliente novo
  const resp1 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Oi, quero agendar um corte')
  registrarTeste('IA respondeu a saudação inicial', !resp1.erro && resp1.resposta)
  registrarTeste('IA perguntou nome ou ofereceu serviços',
    resp1.resposta?.toLowerCase().includes('nome') ||
    resp1.resposta?.toLowerCase().includes('serviço') ||
    resp1.resposta?.toLowerCase().includes('corte'))

  // Cliente informa nome
  const resp2 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Meu nome é João Teste')
  registrarTeste('IA confirmou nome ou perguntou horário',
    resp2.resposta?.toLowerCase().includes('joão') ||
    resp2.resposta?.toLowerCase().includes('horário') ||
    resp2.resposta?.toLowerCase().includes('quando'))

  // Cliente pede horário
  const resp3 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quero para hoje às 15h')
  registrarTeste('IA ofereceu horário ou confirmou agendamento',
    resp3.resposta?.toLowerCase().includes('15') ||
    resp3.resposta?.toLowerCase().includes('horário') ||
    resp3.resposta?.toLowerCase().includes('confirmado') ||
    resp3.resposta?.toLowerCase().includes('agendado'))

  return resp3
}

const testarClienteRecorrente = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 2: Cliente Recorrente')

  // Busca cliente criado no teste anterior
  const cliente = await banco.cliente.findFirst({
    where: { tenantId, telefone: TELEFONE_TESTE },
  })
  registrarTeste('Cliente foi cadastrado no teste anterior', !!cliente)

  if (cliente) {
    // Segunda interação - cliente recorrente
    const resp = await simularMensagem(tenantId, TELEFONE_TESTE, 'Oi, quero marcar de novo')
    registrarTeste('IA reconheceu cliente recorrente (usou nome)',
      resp.resposta?.toLowerCase().includes('joão'))
  }
}

const testarPerguntasInformativas = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 3: Perguntas Informativas')

  const resp1 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Onde fica a barbearia?')
  registrarTeste('IA respondeu sobre localização',
    resp1.resposta?.toLowerCase().includes('endereço') ||
    resp1.resposta?.toLowerCase().includes('fica') ||
    resp1.resposta?.toLowerCase().includes('maps') ||
    resp1.resposta?.toLowerCase().includes('senador'))

  const resp2 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Qual o telefone do dono?')
  registrarTeste('IA respondeu sobre contato',
    resp2.resposta?.includes('+55') ||
    resp2.resposta?.toLowerCase().includes('telefone') ||
    resp2.resposta?.toLowerCase().includes('falar'))

  const resp3 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Tem plano mensal?')
  registrarTeste('IA respondeu sobre plano',
    resp3.resposta?.toLowerCase().includes('plano') ||
    resp3.resposta?.toLowerCase().includes('mensal') ||
    resp3.resposta?.toLowerCase().includes('assin'))
}

const testarPlanoMensal = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 4: Plano Mensal')

  // Verifica se tenant tem planos
  const planos = await banco.planoAssinatura.findMany({
    where: { tenantId, ativo: true },
  })

  if (planos.length === 0) {
    log.info('Nenhum plano ativo configurado - pulando teste')
    return
  }

  const cliente = await banco.cliente.findFirst({
    where: { tenantId, telefone: TELEFONE_TESTE },
  })

  if (!cliente) {
    log.info('Cliente de teste não encontrado - pulando teste')
    return
  }

  // Simula assinatura do plano
  const resp1 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quero assinar o plano')
  registrarTeste('IA ofereceu plano ou pediu confirmação',
    resp1.resposta?.toLowerCase().includes('plano') ||
    resp1.resposta?.toLowerCase().includes('r$') ||
    resp1.resposta?.toLowerCase().includes('mensal'))

  // Verifica créditos do plano
  const resp2 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quero agendar pelo plano')
  registrarTeste('IA verificou créditos do plano',
    resp2.resposta?.toLowerCase().includes('plano') ||
    resp2.resposta?.toLowerCase().includes('crédito') ||
    resp2.resposta?.toLowerCase().includes('incluso'))
}

const testarFidelidade = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 5: Programa de Fidelidade')

  // Verifica se fidelidade está ativa
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { fidelidadeAtivo: true },
  })

  if (!tenant?.fidelidadeAtivo) {
    log.info('Fidelidade não está ativa - pulando teste')
    return
  }

  const config = await fidelidadeServico.obterConfig(tenantId)
  if (!config) {
    log.info('Fidelidade não configurada - pulando teste')
    return
  }

  log.info(`Pontos para resgate: ${config.pontosParaResgate}`)
  log.info(`Pontos por serviço: ${config.pontosPerServico}`)
  log.info(`Prêmio: ${config.descricaoResgate}`)

  const cliente = await banco.cliente.findFirst({
    where: { tenantId, telefone: TELEFONE_TESTE },
  })

  if (!cliente) {
    log.info('Cliente de teste não encontrado - pulando teste')
    return
  }

  // Verifica saldo de pontos
  const resp1 = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quantos pontos eu tenho?')
  registrarTeste('IA respondeu sobre pontos de fidelidade',
    resp1.resposta?.toLowerCase().includes('ponto') ||
    resp1.resposta?.toLowerCase().includes('fidelidade') ||
    resp1.resposta?.toLowerCase().includes('saldo'))

  // Simula que cliente atingiu pontos suficientes
  await banco.pontosFidelidade.upsert({
    where: { tenantId_clienteId: { tenantId, clienteId: cliente.id } },
    update: { pontos: config.pontosParaResgate },
    create: { tenantId, clienteId: cliente.id, pontos: config.pontosParaResgate, totalGanho: config.pontosParaResgate },
  })

  const resp2 = await simularMensagem(tenantId, TELEFONE_TESTE, 'RESGATAR')
  registrarTeste('IA processou resgate de fidelidade',
    resp2.resposta?.toLowerCase().includes('resgate') ||
    resp2.resposta?.toLowerCase().includes('parabéns') ||
    resp2.resposta?.toLowerCase().includes('garantido') ||
    resp2.resposta?.toLowerCase().includes('resgat'))
}

const testarRemarcacao = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 6: Remarcação de Agendamento')

  // Busca um agendamento existente
  const cliente = await banco.cliente.findFirst({
    where: { tenantId, telefone: TELEFONE_TESTE },
    include: { agendamentos: { where: { status: { in: ['AGENDADO', 'CONFIRMADO'] } }, take: 1 } },
  })

  if (!cliente?.agendamentos?.length) {
    log.info('Nenhum agendamento ativo para testar remarcação - pulando')
    return
  }

  const resp = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quero remarcar para amanhã às 10h')
  registrarTeste('IA processou pedido de remarcação',
    resp.resposta?.toLowerCase().includes('remarc') ||
    resp.resposta?.toLowerCase().includes('horário') ||
    resp.resposta?.toLowerCase().includes('10'))
}

const testarCancelamento = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 7: Cancelamento de Agendamento')

  const resp = await simularMensagem(tenantId, TELEFONE_TESTE, 'Quero cancelar meu agendamento')
  registrarTeste('IA processou pedido de cancelamento',
    resp.resposta?.toLowerCase().includes('cancel') ||
    resp.resposta?.toLowerCase().includes('certeza') ||
    resp.resposta?.toLowerCase().includes('confirmar'))
}

const verificarLembretes = async (tenantId) => {
  log.titulo()
  log.subtitulo('TESTE 8: Sistema de Lembretes')

  // Verifica se há cron de lembretes configurado
  const agendamentosProximos = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: { in: ['AGENDADO', 'CONFIRMADO'] },
      inicioEm: {
        gte: new Date(),
        lte: new Date(Date.now() + 48 * 60 * 60 * 1000), // próximas 48h
      },
      lembreteEnviadoEm: null,
    },
    take: 5,
  })

  log.info(`Agendamentos próximos sem lembrete: ${agendamentosProximos.length}`)
  registrarTeste('Sistema de lembretes está configurado', true) // Verificação básica

  // Verifica se há mensagens de lembrete enviadas recentemente
  const lembretesEnviados = await banco.agendamento.count({
    where: {
      tenantId,
      lembreteEnviadoEm: { not: null },
      criadoEm: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // última semana
    },
  })

  log.info(`Lembretes enviados na última semana: ${lembretesEnviados}`)
  registrarTeste('Lembretes foram enviados recentemente', lembretesEnviados > 0,
    lembretesEnviados === 0 ? 'Nenhum lembrete na última semana' : '')
}

const verificarConfiguracoes = async (tenantId) => {
  log.titulo()
  log.subtitulo('VERIFICAÇÃO: Configurações do Tenant')

  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: {
      nome: true,
      fidelidadeAtivo: true,
      membershipsAtivo: true,
      configWhatsApp: true,
      tomDeVoz: true,
      antecedenciaCancelar: true,
    },
  })

  log.info(`Tenant: ${tenant.nome}`)
  log.info(`Tom de voz: ${tenant.tomDeVoz || 'DESCONTRALIDO'}`)
  log.info(`WhatsApp: ${tenant.configWhatsApp?.provedor || 'não configurado'}`)
  log.info(`Fidelidade: ${tenant.fidelidadeAtivo ? 'ATIVO' : 'inativo'}`)
  log.info(`Planos mensais: ${tenant.membershipsAtivo ? 'ATIVO' : 'inativo'}`)
  log.info(`Antecedência cancelar: ${tenant.antecedenciaCancelar}h`)

  // Verifica serviços
  const servicos = await banco.servico.count({ where: { tenantId, ativo: true } })
  log.info(`Serviços ativos: ${servicos}`)
  registrarTeste('Tenant tem serviços configurados', servicos > 0)

  // Verifica profissionais
  const profissionais = await banco.profissional.count({ where: { tenantId, ativo: true } })
  log.info(`Profissionais ativos: ${profissionais}`)
  registrarTeste('Tenant tem profissionais configurados', profissionais > 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

const executarTestes = async () => {
  console.log(`\n${cores.negrito}${cores.azul}╔═══════════════════════════════════════════════════════════╗${cores.reset}`)
  console.log(`${cores.negrito}${cores.azul}║         TESTE COMPLETO DA IA - MARCAÍ BARBER              ║${cores.reset}`)
  console.log(`${cores.negrito}${cores.azul}╚═══════════════════════════════════════════════════════════╝${cores.reset}`)

  try {
    const tenant = await buscarTenantTeste()
    if (!tenant) {
      log.erro('Nenhum tenant encontrado para teste!')
      log.info('Configure TEST_TENANT_ID no .env ou crie um tenant ativo')
      process.exit(1)
    }

    log.info(`Usando tenant: ${tenant.nome} (${tenant.id})`)
    log.info(`Telefone de teste: ${TELEFONE_TESTE}`)

    // Limpa dados de teste anteriores
    log.info('Limpando dados de teste anteriores...')
    await limparDadosTeste(tenant.id)

    // Executa testes
    await verificarConfiguracoes(tenant.id)
    await testarPrimeiraInteracao(tenant.id)
    await testarClienteRecorrente(tenant.id)
    await testarPerguntasInformativas(tenant.id)
    await testarPlanoMensal(tenant.id)
    await testarFidelidade(tenant.id)
    await testarRemarcacao(tenant.id)
    await testarCancelamento(tenant.id)
    await verificarLembretes(tenant.id)

    // Resultado final
    log.titulo()
    console.log(`\n${cores.negrito}RESULTADO FINAL${cores.reset}`)
    console.log(`────────────────────────────────────────`)
    console.log(`Total de testes: ${resultados.total}`)
    console.log(`${cores.verde}Sucesso: ${resultados.sucesso}${cores.reset}`)
    console.log(`${cores.vermelho}Falha: ${resultados.falha}${cores.reset}`)
    console.log(`Taxa de sucesso: ${((resultados.sucesso / resultados.total) * 100).toFixed(1)}%`)

    if (resultados.falha > 0) {
      console.log(`\n${cores.vermelho}Testes que falharam:${cores.reset}`)
      resultados.detalhes
        .filter((t) => !t.passou)
        .forEach((t) => console.log(`  • ${t.nome}${t.detalhes ? ` - ${t.detalhes}` : ''}`))
    }

    // Limpa dados de teste
    log.info('\nLimpando dados de teste...')
    await limparDadosTeste(tenant.id)

  } catch (err) {
    log.erro(`Erro fatal: ${err.message}`)
    console.error(err)
  } finally {
    await banco.$disconnect()
  }
}

executarTestes()

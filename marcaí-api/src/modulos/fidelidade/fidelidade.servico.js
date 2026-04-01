const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')

// Salva mensagem enviada na conversa do cliente (aparece no painel de Mensagens)
const salvarMensagemNaConversa = async (tenantId, clienteId, mensagem) => {
  try {
    const limite30min = new Date(Date.now() - 30 * 60 * 1000)
    const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000)

    let conversa = await banco.conversa.findFirst({
      where: { tenantId, clienteId, status: { in: ['ATIVA', 'ESCALONADA'] }, atualizadoEm: { gte: limite30min } },
      orderBy: { atualizadoEm: 'desc' },
    })
    if (!conversa) {
      conversa = await banco.conversa.findFirst({
        where: { tenantId, clienteId, status: { not: 'CANCELADA' }, atualizadoEm: { gte: limite48h } },
        orderBy: { atualizadoEm: 'desc' },
      })
    }
    if (!conversa) {
      conversa = await banco.conversa.create({
        data: { tenantId, clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
      })
    }

    await banco.mensagem.create({ data: { conversaId: conversa.id, remetente: 'ia', conteudo: mensagem } })
    await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
  } catch (err) {
    console.warn('[Fidelidade] Falha ao salvar msg na conversa:', err.message)
  }
}

// Retorna ou cria o saldo de pontos de um cliente
const obterOuCriarSaldo = async (tenantId, clienteId) => {
  return banco.pontosFidelidade.upsert({
    where: { tenantId_clienteId: { tenantId, clienteId } },
    update: {},
    create: { tenantId, clienteId },
    include: { cliente: { select: { nome: true, telefone: true } } },
  })
}

const obterConfig = async (tenantId) => {
  return banco.configFidelidade.findUnique({ where: { tenantId } })
}

const verificarRecurso = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { fidelidadeAtivo: true } })
  if (!tenant?.fidelidadeAtivo) throw { status: 403, mensagem: 'Módulo Fidelidade não está ativo', codigo: 'RECURSO_INATIVO' }
}

const salvarConfig = async (tenantId, dados) => {
  await verificarRecurso(tenantId)
  const campos = {}
  if (dados.pontosPerServico !== undefined) campos.pontosPerServico = Number(dados.pontosPerServico)
  if (dados.pontosParaResgate !== undefined) campos.pontosParaResgate = Number(dados.pontosParaResgate)
  if (dados.descricaoResgate !== undefined) campos.descricaoResgate = String(dados.descricaoResgate)
  if (dados.ativo !== undefined) campos.ativo = Boolean(dados.ativo)

  return banco.configFidelidade.upsert({
    where: { tenantId },
    update: campos,
    create: { tenantId, ...campos },
  })
}

// Chamado após agendamento CONCLUIDO — adiciona pontos ao cliente
const registrarPontosAtendimento = async (tenantId, clienteId, agendamentoId) => {
  const [tenant, config] = await Promise.all([
    banco.tenant.findUnique({ where: { id: tenantId }, select: { fidelidadeAtivo: true, configWhatsApp: true, nome: true } }),
    obterConfig(tenantId),
  ])

  if (!tenant?.fidelidadeAtivo || !config) return null

  const saldo = await banco.pontosFidelidade.upsert({
    where: { tenantId_clienteId: { tenantId, clienteId } },
    update: {
      pontos: { increment: config.pontosPerServico },
      totalGanho: { increment: config.pontosPerServico },
    },
    create: {
      tenantId,
      clienteId,
      pontos: config.pontosPerServico,
      totalGanho: config.pontosPerServico,
    },
    include: { cliente: { select: { nome: true, telefone: true } } },
  })

  // Registra no histórico
  await banco.historicoFidelidade.create({
    data: {
      pontosFidelidadeId: saldo.id,
      tipo: 'GANHO',
      pontos: config.pontosPerServico,
      descricao: 'Pontos por atendimento',
      agendamentoId,
    },
  })

  // Notifica cliente via WhatsApp (melhor esforço)
  try {
    if (tenant.configWhatsApp && saldo.cliente?.telefone) {
      const primeiroNome = saldo.cliente.nome?.split(' ')[0] || 'cliente'
      const pontosParaResgate = config.pontosParaResgate - saldo.pontos
      let msg = `🎉 ${primeiroNome}, você ganhou *${config.pontosPerServico} ponto(s)* de fidelidade!\n`
      msg += `📊 Seu saldo: *${saldo.pontos} ponto(s)*\n`

      if (saldo.pontos >= config.pontosParaResgate) {
        msg += `\n✅ *Parabéns!* Você atingiu ${config.pontosParaResgate} pontos e pode resgatar: *${config.descricaoResgate}*!\n`
        msg += `Responda "RESGATAR" para usar seu benefício. 🏆`
      } else {
        msg += `Faltam apenas *${pontosParaResgate}* para você ganhar: *${config.descricaoResgate}* 🔥`
      }

      await whatsappServico.enviarMensagem(tenant.configWhatsApp, saldo.cliente.telefone, msg, tenantId)
      await salvarMensagemNaConversa(tenantId, clienteId, msg)
    }
  } catch (err) {
    console.warn('[Fidelidade] Falha ao enviar WhatsApp de pontos:', err.message)
  }

  return saldo
}

// Resgatar pontos (gestor marca manualmente)
const resgatarPontos = async (tenantId, clienteId) => {
  await verificarRecurso(tenantId)
  const config = await obterConfig(tenantId)
  if (!config) throw { status: 400, mensagem: 'Programa de fidelidade não configurado', codigo: 'SEM_CONFIG' }

  const saldo = await banco.pontosFidelidade.findUnique({
    where: { tenantId_clienteId: { tenantId, clienteId } },
    include: { cliente: { select: { nome: true, telefone: true } } },
  })

  if (!saldo) throw { status: 404, mensagem: 'Cliente sem saldo de pontos', codigo: 'SEM_SALDO' }
  if (saldo.pontos < config.pontosParaResgate) {
    throw { status: 400, mensagem: `Saldo insuficiente. Necessário: ${config.pontosParaResgate}. Atual: ${saldo.pontos}`, codigo: 'SALDO_INSUFICIENTE' }
  }

  const atualizado = await banco.pontosFidelidade.update({
    where: { tenantId_clienteId: { tenantId, clienteId } },
    data: {
      pontos: { decrement: config.pontosParaResgate },
      totalResgatado: { increment: config.pontosParaResgate },
    },
    include: { cliente: { select: { nome: true, telefone: true } } },
  })

  await banco.historicoFidelidade.create({
    data: {
      pontosFidelidadeId: atualizado.id,
      tipo: 'RESGATE',
      pontos: -config.pontosParaResgate,
      descricao: config.descricaoResgate,
    },
  })

  // Notifica cliente
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { configWhatsApp: true } })
    if (tenant?.configWhatsApp && atualizado.cliente?.telefone) {
      const primeiroNome = atualizado.cliente.nome?.split(' ')[0] || 'cliente'
      const msg = `🏆 ${primeiroNome}, seu resgate foi confirmado!\n*${config.descricaoResgate}* está garantido no seu próximo atendimento. Aproveite! 😊`
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, atualizado.cliente.telefone, msg, tenantId)
      await salvarMensagemNaConversa(tenantId, clienteId, msg)
    }
  } catch { /* silencioso */ }

  return atualizado
}

const listarRanking = async (tenantId, limite = 20) => {
  return banco.pontosFidelidade.findMany({
    where: { tenantId },
    orderBy: { pontos: 'desc' },
    take: limite,
    include: { cliente: { select: { id: true, nome: true, telefone: true, avatarUrl: true } } },
  })
}

const obterSaldoCliente = async (tenantId, clienteId) => {
  const [saldo, config] = await Promise.all([
    banco.pontosFidelidade.findUnique({
      where: { tenantId_clienteId: { tenantId, clienteId } },
      include: {
        historico: { orderBy: { criadoEm: 'desc' }, take: 10 },
      },
    }),
    obterConfig(tenantId),
  ])
  return { saldo, config }
}

// Verifica se o cliente tem resgate pendente (não utilizado) e aplica no agendamento
// Retorna true se aplicou o resgate (agendamento deve ser gratuito)
const verificarEAplicarResgatePendente = async (tenantId, clienteId, agendamentoId) => {
  const saldo = await banco.pontosFidelidade.findUnique({
    where: { tenantId_clienteId: { tenantId, clienteId } },
  })
  if (!saldo) return { aplicado: false }

  // Busca resgate pendente (tipo RESGATE sem agendamentoId associado)
  const resgatePendente = await banco.historicoFidelidade.findFirst({
    where: {
      pontosFidelidadeId: saldo.id,
      tipo: 'RESGATE',
      agendamentoId: null,
    },
    orderBy: { criadoEm: 'desc' },
  })

  if (!resgatePendente) return { aplicado: false }

  // Associa o resgate ao agendamento
  await banco.historicoFidelidade.update({
    where: { id: resgatePendente.id },
    data: { agendamentoId },
  })

  const config = await obterConfig(tenantId)
  return {
    aplicado: true,
    beneficio: config?.descricaoResgate || 'benefício de fidelidade',
    historicoId: resgatePendente.id,
  }
}

module.exports = {
  obterConfig,
  salvarConfig,
  registrarPontosAtendimento,
  resgatarPontos,
  listarRanking,
  obterSaldoCliente,
  obterOuCriarSaldo,
  verificarEAplicarResgatePendente,
}

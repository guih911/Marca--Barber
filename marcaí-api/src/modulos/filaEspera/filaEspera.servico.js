const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')
const { processarEvento } = require('../ia/messageOrchestrator')

const normalizarTelefone = (telefone) => {
  if (!telefone) return null
  const digitos = String(telefone).replace(/\D/g, '')
  if (!digitos) return null
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
}

const obterDataDesejadaNormalizada = (dataDesejada) => {
  if (!dataDesejada) return null
  const texto = String(dataDesejada)
  const valor = dataDesejada instanceof Date
    ? dataDesejada
    : /^\d{4}-\d{2}-\d{2}$/.test(texto)
      ? new Date(`${texto}T23:59:59.999Z`)
      : new Date(dataDesejada)
  if (Number.isNaN(valor.getTime())) return null
  return valor
}

const obterJanelaDoDia = (dataHora) => {
  const inicio = new Date(dataHora)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(dataHora)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

const formatarDataHoraFila = (dataHora, timeZone = 'America/Sao_Paulo') => (
  new Date(dataHora).toLocaleString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
)

const nomeClienteConfiavelEncaixe = (cliente) => {
  const nome = String(cliente?.nome || '').trim()
  if (!nome || nome === cliente?.telefone) return false
  if (/^\+?\d[\d\s()\-]{5,}$/.test(nome)) return false
  return true
}

const entradaMaisAdequadaParaSlot = (entradas = [], profissionalId, dataHoraLiberada) => {
  if (!Array.isArray(entradas) || entradas.length === 0) return null

  return [...entradas].sort((a, b) => {
    const aProfMatch = a.profissionalId && a.profissionalId === profissionalId ? 0 : 1
    const bProfMatch = b.profissionalId && b.profissionalId === profissionalId ? 0 : 1
    if (aProfMatch !== bProfMatch) return aProfMatch - bProfMatch

    const aDistancia = Math.abs(new Date(a.dataDesejada).getTime() - new Date(dataHoraLiberada).getTime())
    const bDistancia = Math.abs(new Date(b.dataDesejada).getTime() - new Date(dataHoraLiberada).getTime())
    if (aDistancia !== bDistancia) return aDistancia - bDistancia

    return new Date(a.criadoEm) - new Date(b.criadoEm)
  })[0]
}

const incluirRelacoes = {
  cliente: true,
  servico: true,
  profissional: true,
  tenant: true,
}

const STATUS_VALIDOS = new Set(['AGUARDANDO', 'NOTIFICADO', 'CONVERTIDO', 'EXPIRADO'])

const listar = async (tenantId, { status, dataInicio, dataFim, profissionalId } = {}) => {
  const where = { tenantId }

  if (status) where.status = status
  if (profissionalId) where.profissionalId = profissionalId
  if (dataInicio || dataFim) {
    where.dataDesejada = {}
    if (dataInicio) where.dataDesejada.gte = new Date(`${dataInicio}T00:00:00`)
    if (dataFim) where.dataDesejada.lte = new Date(`${dataFim}T23:59:59`)
  }

  return banco.filaEspera.findMany({
    where,
    include: incluirRelacoes,
    orderBy: { dataDesejada: 'asc' },
  })
}

const atualizarStatus = async (id, status, camposExtras = {}) => banco.filaEspera.update({
  where: { id },
  data: {
    status,
    ...camposExtras,
  },
  include: incluirRelacoes,
})

const atualizarStatusManual = async (tenantId, id, status) => {
  if (!STATUS_VALIDOS.has(status)) {
    throw { status: 400, mensagem: 'Status de fila inválido.' }
  }

  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) throw { status: 404, mensagem: 'Entrada não encontrada.' }

  const camposExtras = status === 'NOTIFICADO' ? { notificadoEm: new Date() } : {}
  if (status === 'AGUARDANDO') camposExtras.notificadoEm = null

  return atualizarStatus(id, status, camposExtras)
}

/**
 * Coloca o cliente na fila de espera para um serviço/data.
 * Idempotente: ignora se já existe entrada equivalente aguardando ou recém-notificada.
 */
const entrar = async (tenantId, { clienteId, servicoId, profissionalId, dataDesejada, aceitaEncaixeAutomatico = true }) => {
  const tLista = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { listaEsperaAtivo: true },
  })
  if (!tLista?.listaEsperaAtivo) {
    throw { status: 403, mensagem: 'Lista de espera não está ativa para este estabelecimento. Ative em Configurações → Recursos.' }
  }

  const dataNormalizada = obterDataDesejadaNormalizada(dataDesejada)
  if (!dataNormalizada) throw { status: 400, mensagem: 'Data desejada inválida.' }

  const aceitaEncaixe = aceitaEncaixeAutomatico === false ? false : true

  const existente = await banco.filaEspera.findFirst({
    where: {
      tenantId,
      clienteId,
      servicoId,
      profissionalId: profissionalId || null,
      dataDesejada: dataNormalizada,
      status: { in: ['AGUARDANDO', 'NOTIFICADO'] },
    },
    include: incluirRelacoes,
  })
  if (existente) return existente

  return banco.filaEspera.create({
    data: {
      tenantId,
      clienteId,
      servicoId,
      profissionalId: profissionalId || null,
      dataDesejada: dataNormalizada,
      status: 'AGUARDANDO',
      aceitaEncaixeAutomatico: aceitaEncaixe,
    },
    include: incluirRelacoes,
  })
}

const buscarNotificacaoPendente = async (tenantId, clienteId) => {
  const limite = new Date(Date.now() - (12 * 60 * 60 * 1000))
  return banco.filaEspera.findFirst({
    where: {
      tenantId,
      clienteId,
      status: 'NOTIFICADO',
      notificadoEm: { gte: limite },
    },
    include: incluirRelacoes,
    orderBy: { notificadoEm: 'desc' },
  })
}

const marcarComoConvertido = async (tenantId, id) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) return null
  return atualizarStatus(id, 'CONVERTIDO')
}

const marcarComoExpirado = async (tenantId, id) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) return null
  return atualizarStatus(id, 'EXPIRADO')
}

const reativarEntrada = async (tenantId, id) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) return null
  return atualizarStatus(id, 'AGUARDANDO', { notificadoEm: null })
}

/**
 * Chamado quando um agendamento é cancelado.
 * Notifica o cliente mais compatível da fila para o slot liberado.
 */
const notificarFilaParaSlot = async (tenantId, { servicoId, profissionalId, dataHoraLiberada }) => {
  try {
    const tenantFlags = await banco.tenant.findUnique({
      where: { id: tenantId },
      select: { listaEsperaAtivo: true, filaEncaixeAutomaticoAtivo: true, configWhatsApp: true, timezone: true },
    })
    if (!tenantFlags?.listaEsperaAtivo) return

    const { inicio: diaInicio, fim: diaFim } = obterJanelaDoDia(dataHoraLiberada)

    const entradas = await banco.filaEspera.findMany({
      where: {
        tenantId,
        servicoId,
        status: 'AGUARDANDO',
        dataDesejada: { gte: diaInicio, lte: diaFim },
        OR: [
          { profissionalId: null },
          { profissionalId },
        ],
      },
      include: incluirRelacoes,
    })

    const entrada = entradaMaisAdequadaParaSlot(entradas, profissionalId, dataHoraLiberada)
    const telNormalizado = normalizarTelefone(entrada?.cliente?.telefone)
    if (!entrada || !telNormalizado) return

    const tenant = entrada.tenant
    const profissionalSlot = profissionalId
      ? await banco.profissional.findUnique({ where: { id: profissionalId }, select: { id: true, nome: true } }).catch(() => null)
      : null

    const profissionalCriarId = profissionalSlot?.id || entrada.profissionalId
    if (!profissionalCriarId) {
      console.warn('[FilaEspera] Sem profissionalId para encaixe; usando fluxo de aviso manual.')
    }

    const encaixePodeTentar = Boolean(
      tenantFlags.filaEncaixeAutomaticoAtivo
      && entrada.aceitaEncaixeAutomatico
      && profissionalCriarId
      && nomeClienteConfiavelEncaixe(entrada.cliente)
    )

    if (encaixePodeTentar) {
      try {
        const agendamentosServico = require('../agendamentos/agendamentos.servico')
        await agendamentosServico.criar(tenantId, {
          clienteId: entrada.clienteId,
          profissionalId: profissionalCriarId,
          servicoId: entrada.servicoId,
          inicio: new Date(dataHoraLiberada).toISOString(),
          origem: 'WHATSAPP',
          encaixeFila: true,
        })
        await atualizarStatus(entrada.id, 'CONVERTIDO', {
          notificadoEm: new Date(),
          dataDesejada: new Date(dataHoraLiberada),
          profissionalId: profissionalCriarId,
        })
        console.log(`[FilaEspera] Encaixe automático — ${entrada.servico.nome} | ${telNormalizado}`)
        return
      } catch (encErr) {
        console.warn('[FilaEspera] Encaixe automático não foi possível, enviando aviso para confirmar:', encErr?.mensagem || encErr?.message || encErr)
      }
    }

    if (tenant?.configWhatsApp) {
      processarEvento({
        evento: 'FILA_ESPERA',
        agendamento: {
          inicioEm: dataHoraLiberada,
          servico: entrada.servico,
          profissional: profissionalSlot || entrada.profissional
        },
        tenantId,
        cliente: entrada.cliente
      })
    }

    await atualizarStatus(entrada.id, 'NOTIFICADO', {
      notificadoEm: new Date(),
      dataDesejada: new Date(dataHoraLiberada),
      profissionalId: profissionalSlot?.id || entrada.profissionalId || null,
    })

    console.log(`[FilaEspera] Notificado ${entrada.cliente.telefone} — ${entrada.servico.nome}`)
  } catch (err) {
    console.error('[FilaEspera] Erro ao notificar:', err.message)
  }
}

/**
 * Expira entradas antigas da fila.
 */
const expirarEntradas = async () => {
  const agora = new Date()
  const limiteNotificado = new Date(Date.now() - (6 * 60 * 60 * 1000))

  const aguardando = await banco.filaEspera.updateMany({
    where: {
      status: 'AGUARDANDO',
      dataDesejada: { lt: agora },
    },
    data: { status: 'EXPIRADO' },
  })

  const notificados = await banco.filaEspera.updateMany({
    where: {
      status: 'NOTIFICADO',
      OR: [
        { dataDesejada: { lt: agora } },
        { notificadoEm: { lt: limiteNotificado } },
      ],
    },
    data: { status: 'EXPIRADO' },
  })

  const total = Number(aguardando.count || 0) + Number(notificados.count || 0)
  if (total > 0) {
    console.log(`[FilaEspera] ${total} entradas expiradas`)
  }
}

const remover = async (tenantId, id) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) throw { status: 404, mensagem: 'Entrada não encontrada.' }
  await banco.filaEspera.delete({ where: { id } })
}

module.exports = {
  listar,
  entrar,
  atualizarStatusManual,
  buscarNotificacaoPendente,
  marcarComoConvertido,
  marcarComoExpirado,
  notificarFilaParaSlot,
  reativarEntrada,
  expirarEntradas,
  remover,
}

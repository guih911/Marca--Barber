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

const atualizarStatus = async (id, status, camposExtras = {}) => banco.filaEspera.update({
  where: { id },
  data: {
    status,
    ...camposExtras,
  },
  include: incluirRelacoes,
})

/**
 * Coloca o cliente na fila de espera para um serviço/data.
 * Idempotente: ignora se já existe entrada equivalente aguardando ou recém-notificada.
 */
const entrar = async (tenantId, { clienteId, servicoId, profissionalId, dataDesejada }) => {
  const dataNormalizada = obterDataDesejadaNormalizada(dataDesejada)
  if (!dataNormalizada) throw { status: 400, mensagem: 'Data desejada inválida.' }

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
    const tz = tenant?.timezone || 'America/Sao_Paulo'
    const profissionalSlot = profissionalId
      ? await banco.profissional.findUnique({ where: { id: profissionalId }, select: { id: true, nome: true } }).catch(() => null)
      : null

    const profNome = profissionalSlot?.nome || entrada.profissional?.nome || 'um de nossos profissionais'
    const primeiroNome = entrada.cliente.nome?.split(' ')[0] || 'cliente'
    const dataFmt = formatarDataHoraFila(dataHoraLiberada, tz)

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

module.exports = {
  entrar,
  buscarNotificacaoPendente,
  marcarComoConvertido,
  marcarComoExpirado,
  notificarFilaParaSlot,
  reativarEntrada,
  expirarEntradas,
}

const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')
const OpenAI = require('openai')
const configIA = require('../../config/ia')

const normalizarTelefone = (telefone) => {
  if (!telefone) return null
  const digitos = String(telefone).replace(/\D/g, '')
  if (!digitos) return null
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
}

const openai = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })

/**
 * Coloca o cliente na fila de espera para um serviço/data.
 * Idempotente: ignora se já existe entrada AGUARDANDO igual.
 */
const entrar = async (tenantId, { clienteId, servicoId, profissionalId, dataDesejada }) => {
  // Evita duplicata na mesma fila
  const existente = await banco.filaEspera.findFirst({
    where: {
      tenantId,
      clienteId,
      servicoId,
      profissionalId: profissionalId || null,
      dataDesejada: new Date(dataDesejada),
      status: 'AGUARDANDO',
    },
  })
  if (existente) return existente

  return banco.filaEspera.create({
    data: {
      tenantId,
      clienteId,
      servicoId,
      profissionalId: profissionalId || null,
      dataDesejada: new Date(dataDesejada),
      status: 'AGUARDANDO',
    },
    include: { cliente: true, servico: true, profissional: true },
  })
}

/**
 * Chamado quando um agendamento é cancelado.
 * Notifica o primeiro da fila que bate com serviço + profissional + dia.
 */
const notificarFilaParaSlot = async (tenantId, { servicoId, profissionalId, dataHoraLiberada }) => {
  try {
    const diaInicio = new Date(dataHoraLiberada)
    diaInicio.setHours(0, 0, 0, 0)
    const diaFim = new Date(dataHoraLiberada)
    diaFim.setHours(23, 59, 59, 999)

    // Busca primeiro da fila que se encaixa
    const entrada = await banco.filaEspera.findFirst({
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
      orderBy: { criadoEm: 'asc' },
      include: {
        cliente: true,
        servico: true,
        profissional: true,
        tenant: true,
      },
    })

    const telNormalizado = normalizarTelefone(entrada?.cliente?.telefone)
    if (!entrada || !telNormalizado) return

    const tenant = entrada.tenant
    const tz = tenant?.timezone || 'America/Sao_Paulo'
    const dataFmt = new Date(dataHoraLiberada).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })

    const profNome = entrada.profissional?.nome || 'um de nossos profissionais'
    const primeiroNome = entrada.cliente.nome?.split(' ')[0] || 'cliente'

    const mensagem =
      `${primeiroNome}, abrimos um horário que você queria! 🎉\n` +
      `${entrada.servico.nome} com ${profNome} — ${dataFmt}.\n\n` +
      `Responda SIM para garantir o seu horário! ✨\n` +
      `— ${tenant.nome}`

    if (tenant?.configWhatsApp) {
      await whatsappServico.enviarMensagem(
        tenant.configWhatsApp,
        telNormalizado,
        mensagem,
        tenantId
      )
    }

    // Marca como notificado
    await banco.filaEspera.update({
      where: { id: entrada.id },
      data: { status: 'NOTIFICADO', notificadoEm: new Date() },
    })

    console.log(`[FilaEspera] Notificado ${entrada.cliente.telefone} — ${entrada.servico.nome}`)
  } catch (err) {
    console.error('[FilaEspera] Erro ao notificar:', err.message)
  }
}

/**
 * Expira entradas cuja dataDesejada já passou.
 * Chamado pelo cron diário de automações.
 */
const expirarEntradas = async () => {
  const resultado = await banco.filaEspera.updateMany({
    where: {
      status: 'AGUARDANDO',
      dataDesejada: { lt: new Date() },
    },
    data: { status: 'EXPIRADO' },
  })
  if (resultado.count > 0) {
    console.log(`[FilaEspera] ${resultado.count} entradas expiradas`)
  }
}

module.exports = { entrar, notificarFilaParaSlot, expirarEntradas }

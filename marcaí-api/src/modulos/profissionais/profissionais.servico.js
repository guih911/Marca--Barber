const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')
const filaEsperaServico = require('../filaEspera/filaEspera.servico')

const listar = async (tenantId) => {
  return banco.profissional.findMany({
    where: { tenantId },
    orderBy: { nome: 'asc' },
    include: {
      servicos: { include: { servico: true } },
    },
  })
}

const buscarPorId = async (tenantId, id) => {
  const profissional = await banco.profissional.findFirst({
    where: { id, tenantId },
    include: { servicos: { include: { servico: true } } },
  })
  if (!profissional) throw { status: 404, mensagem: 'Profissional não encontrado', codigo: 'NAO_ENCONTRADO' }
  return profissional
}

const criar = async (tenantId, dados) => {
  return banco.profissional.create({
    data: {
      tenantId,
      nome: dados.nome,
      email: dados.email || null,
      telefone: dados.telefone || null,
      avatarUrl: dados.avatarUrl || null,
      horarioTrabalho: dados.horarioTrabalho || {},
      bufferMinutos: Number(dados.bufferMinutos) || 0,
    },
  })
}

const atualizar = async (tenantId, id, dados) => {
  await verificarPropriedade(tenantId, id)

  const campos = {}
  if (dados.nome !== undefined) campos.nome = dados.nome
  if (dados.email !== undefined) campos.email = dados.email
  if (dados.telefone !== undefined) campos.telefone = dados.telefone
  if (dados.avatarUrl !== undefined) campos.avatarUrl = dados.avatarUrl
  if (dados.horarioTrabalho !== undefined) campos.horarioTrabalho = dados.horarioTrabalho
  if (dados.bufferMinutos !== undefined) campos.bufferMinutos = Number(dados.bufferMinutos)
  if (dados.ativo !== undefined) campos.ativo = Boolean(dados.ativo)

  return banco.profissional.update({
    where: { id },
    data: campos,
    include: { servicos: { include: { servico: true } } },
  })
}

const remover = async (tenantId, id) => {
  await verificarPropriedade(tenantId, id)

  const agendamentosFuturos = await banco.agendamento.count({
    where: {
      profissionalId: id,
      inicioEm: { gt: new Date() },
      status: { notIn: ['CANCELADO', 'REMARCADO'] },
    },
  })

  if (agendamentosFuturos > 0) {
    throw {
      status: 409,
      mensagem: 'Não é possível excluir: existem agendamentos futuros vinculados a este profissional',
      codigo: 'CONFLITO_AGENDAMENTOS',
    }
  }

  return banco.profissional.update({ where: { id }, data: { ativo: false } })
}

// Substitui vínculos profissional <-> serviços (batch replace)
const atualizarServicos = async (tenantId, id, servicos) => {
  await verificarPropriedade(tenantId, id)

  await banco.$transaction(async (tx) => {
    await tx.profissionalServico.deleteMany({ where: { profissionalId: id } })

    if (servicos && servicos.length > 0) {
      await tx.profissionalServico.createMany({
        data: servicos.map((s) => ({
          profissionalId: id,
          servicoId: s.servicoId,
          duracaoCustom: s.duracaoCustom ? Number(s.duracaoCustom) : null,
          precoCustom: s.precoCustom ? Number(s.precoCustom) : null,
        })),
      })
    }
  })

  return buscarPorId(tenantId, id)
}

const verificarPropriedade = async (tenantId, id) => {
  const profissional = await banco.profissional.findFirst({ where: { id, tenantId } })
  if (!profissional) throw { status: 404, mensagem: 'Profissional não encontrado', codigo: 'NAO_ENCONTRADO' }
  return profissional
}

/**
 * Registra ausência do profissional em uma data:
 * cancela todos os agendamentos do dia, notifica clientes e profissional.
 */
const registrarAusencia = async (tenantId, profissionalId, data, motivo) => {
  const profissional = await verificarPropriedade(tenantId, profissionalId)
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw { status: 404, mensagem: 'Tenant não encontrado', codigo: 'NAO_ENCONTRADO' }
  if (!tenant.cancelamentoMassaAtivo) {
    throw {
      status: 403,
      mensagem: 'Cancelamento em massa está desativado no plano atual.',
      codigo: 'FEATURE_DESATIVADA',
    }
  }

  const inicioDia = new Date(`${data}T00:00:00`)
  const fimDia = new Date(`${data}T23:59:59`)

  const agendamentos = await banco.agendamento.findMany({
    where: {
      profissionalId,
      tenantId,
      status: { in: ['AGENDADO', 'CONFIRMADO'] },
      inicioEm: { gte: inicioDia, lte: fimDia },
    },
    include: { cliente: true, servico: true },
  })

  if (agendamentos.length === 0) {
    return { cancelados: 0, clientesNotificados: 0 }
  }

  const tz = tenant?.timezone || 'America/Sao_Paulo'
  const dataFmt = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
  })

  let clientesNotificados = 0

  // Cancela em batch e notifica cada cliente
  await Promise.all(
    agendamentos.map(async (ag) => {
      await banco.agendamento.update({
        where: { id: ag.id },
        data: {
          status: 'CANCELADO',
          canceladoEm: new Date(),
          motivoCancelamento: motivo || `Profissional ${profissional.nome} não estará disponível nesta data`,
        },
      })

      // Notifica cliente
      if (ag.cliente?.telefone && tenant?.configWhatsApp) {
        try {
          const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'
          const horario = new Date(ag.inicioEm).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', timeZone: tz,
          })

          const msg =
            `${primeiroNome}, precisamos te informar que seu ${ag.servico.nome} ` +
            `com ${profissional.nome} em ${dataFmt} às ${horario} foi cancelado. 😔\n` +
            `${motivo ? `Motivo: ${motivo}\n` : ''}` +
            `Sentimos muito! Quer remarcar para outro dia? Basta responder aqui. ✨\n` +
            `— ${tenant.nome}`

          await whatsappServico.enviarMensagem(tenant.configWhatsApp, ag.cliente.telefone, msg, tenantId)
          clientesNotificados++
        } catch (err) {
          console.error(`[Ausência] Erro ao notificar cliente ${ag.clienteId}:`, err.message)
        }
      }

      // Notifica fila de espera
      filaEsperaServico.notificarFilaParaSlot(tenantId, {
        servicoId: ag.servicoId,
        profissionalId: ag.profissionalId,
        dataHoraLiberada: ag.inicioEm,
      }).catch(() => {})
    })
  )

  console.log(`[Ausência] ${agendamentos.length} agendamentos cancelados para ${profissional.nome} em ${data}`)

  return { cancelados: agendamentos.length, clientesNotificados }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, atualizarServicos, registrarAusencia }

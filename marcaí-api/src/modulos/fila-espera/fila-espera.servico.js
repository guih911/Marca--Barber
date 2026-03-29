const banco = require('../../config/banco')

const incluirRelacoes = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  servico: { select: { id: true, nome: true, duracaoMinutos: true } },
  profissional: { select: { id: true, nome: true } },
}

const listar = async (tenantId, { status, dataInicio, dataFim, profissionalId } = {}) => {
  const where = { tenantId }
  if (status) where.status = status
  if (profissionalId) where.profissionalId = profissionalId
  if (dataInicio || dataFim) {
    where.dataDesejada = {}
    if (dataInicio) where.dataDesejada.gte = new Date(dataInicio + 'T00:00:00')
    if (dataFim) where.dataDesejada.lte = new Date(dataFim + 'T23:59:59')
  }

  return banco.filaEspera.findMany({
    where,
    include: incluirRelacoes,
    orderBy: { dataDesejada: 'asc' },
  })
}

const criar = async (tenantId, { clienteId, servicoId, profissionalId, dataDesejada }) => {
  if (!clienteId || !servicoId || !dataDesejada) throw { status: 400, mensagem: 'clienteId, servicoId e dataDesejada são obrigatórios.' }

  return banco.filaEspera.create({
    data: {
      tenantId,
      clienteId,
      servicoId,
      profissionalId: profissionalId || null,
      dataDesejada: new Date(dataDesejada),
      status: 'AGUARDANDO',
    },
    include: incluirRelacoes,
  })
}

const atualizarStatus = async (tenantId, id, status) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) throw { status: 404, mensagem: 'Entrada não encontrada.' }

  return banco.filaEspera.update({
    where: { id },
    data: { status, ...(status === 'NOTIFICADO' ? { notificadoEm: new Date() } : {}) },
    include: incluirRelacoes,
  })
}

const remover = async (tenantId, id) => {
  const entrada = await banco.filaEspera.findFirst({ where: { id, tenantId } })
  if (!entrada) throw { status: 404, mensagem: 'Entrada não encontrada.' }
  await banco.filaEspera.delete({ where: { id } })
}

module.exports = { listar, criar, atualizarStatus, remover }

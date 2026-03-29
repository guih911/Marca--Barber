const banco = require('../../config/banco')

const listar = async (tenantId) => {
  return banco.servico.findMany({
    where: { tenantId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { agendamentos: true } } },
  })
}

const criar = async (tenantId, dados) => {
  return banco.servico.create({
    data: {
      tenantId,
      nome: dados.nome,
      duracaoMinutos: Number(dados.duracaoMinutos),
      precoCentavos: dados.precoCentavos !== undefined && dados.precoCentavos !== null ? Number(dados.precoCentavos) : null,
      instrucoes: dados.instrucoes || null,
      retornoEmDias: dados.retornoEmDias !== undefined && dados.retornoEmDias !== null ? Number(dados.retornoEmDias) : null,
    },
  })
}

const atualizar = async (tenantId, id, dados) => {
  await verificarPropriedade(tenantId, id)

  const campos = {}
  if (dados.nome !== undefined) campos.nome = dados.nome
  if (dados.duracaoMinutos !== undefined) campos.duracaoMinutos = Number(dados.duracaoMinutos)
  if (dados.precoCentavos !== undefined) campos.precoCentavos = dados.precoCentavos !== null ? Number(dados.precoCentavos) : null
  if (dados.instrucoes !== undefined) campos.instrucoes = dados.instrucoes || null
  if (dados.retornoEmDias !== undefined) campos.retornoEmDias = dados.retornoEmDias !== null ? Number(dados.retornoEmDias) : null
  if (dados.ativo !== undefined) campos.ativo = Boolean(dados.ativo)

  return banco.servico.update({ where: { id }, data: campos })
}

const remover = async (tenantId, id) => {
  await verificarPropriedade(tenantId, id)

  const agendamentosFuturos = await banco.agendamento.count({
    where: {
      servicoId: id,
      inicioEm: { gt: new Date() },
      status: { notIn: ['CANCELADO', 'REMARCADO'] },
    },
  })

  if (agendamentosFuturos > 0) {
    throw {
      status: 409,
      mensagem: 'Nao e possivel excluir: existem agendamentos futuros vinculados a este servico',
      codigo: 'CONFLITO_AGENDAMENTOS',
    }
  }

  return banco.servico.update({ where: { id }, data: { ativo: false } })
}

const verificarPropriedade = async (tenantId, id) => {
  const servico = await banco.servico.findFirst({ where: { id, tenantId } })
  if (!servico) throw { status: 404, mensagem: 'Servico nao encontrado', codigo: 'NAO_ENCONTRADO' }
  return servico
}

module.exports = { listar, criar, atualizar, remover }

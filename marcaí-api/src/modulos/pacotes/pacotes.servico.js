const banco = require('../../config/banco')

const verificarRecurso = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { pacotesAtivo: true } })
  if (!tenant?.pacotesAtivo) throw { status: 403, mensagem: 'Módulo de Pacotes não está ativo para este plano.', codigo: 'RECURSO_INATIVO' }
}

const listar = async (tenantId) => {
  await verificarRecurso(tenantId)
  return banco.pacote.findMany({
    where: { tenantId },
    orderBy: { nome: 'asc' },
    include: { servicos: { include: { servico: true } } },
  })
}

const buscarPorId = async (tenantId, id) => {
  const pacote = await banco.pacote.findFirst({
    where: { id, tenantId },
    include: { servicos: { include: { servico: true } } },
  })
  if (!pacote) throw { status: 404, mensagem: 'Pacote não encontrado', codigo: 'NAO_ENCONTRADO' }
  return pacote
}

const criar = async (tenantId, dados) => {
  await verificarRecurso(tenantId)
  const { servicoIds = [], ...resto } = dados
  return banco.pacote.create({
    data: {
      tenantId,
      nome: resto.nome,
      descricao: resto.descricao || null,
      tipo: resto.tipo || 'FIXO',
      precoCentavos: Number(resto.precoCentavos) || 0,
      descontoPorcent: resto.descontoPorcent ? Number(resto.descontoPorcent) : null,
      servicos: {
        create: servicoIds.map((servicoId) => ({ servicoId })),
      },
    },
    include: { servicos: { include: { servico: true } } },
  })
}

const atualizar = async (tenantId, id, dados) => {
  await verificarRecurso(tenantId)
  await verificarPropriedade(tenantId, id)
  const { servicoIds, ...resto } = dados

  await banco.$transaction(async (tx) => {
    await tx.pacote.update({
      where: { id },
      data: {
        nome: resto.nome,
        descricao: resto.descricao ?? null,
        tipo: resto.tipo,
        precoCentavos: Number(resto.precoCentavos) || 0,
        descontoPorcent: resto.descontoPorcent ? Number(resto.descontoPorcent) : null,
        ativo: resto.ativo,
      },
    })

    if (servicoIds !== undefined) {
      await tx.pacoteServico.deleteMany({ where: { pacoteId: id } })
      if (servicoIds.length > 0) {
        await tx.pacoteServico.createMany({
          data: servicoIds.map((servicoId) => ({ pacoteId: id, servicoId })),
        })
      }
    }
  })

  return buscarPorId(tenantId, id)
}

const excluir = async (tenantId, id) => {
  await verificarRecurso(tenantId)
  await verificarPropriedade(tenantId, id)
  await banco.pacote.delete({ where: { id } })
  return { removido: true }
}

const verificarPropriedade = async (tenantId, id) => {
  const pacote = await banco.pacote.findFirst({ where: { id, tenantId } })
  if (!pacote) throw { status: 404, mensagem: 'Pacote não encontrado', codigo: 'NAO_ENCONTRADO' }
  return pacote
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir }

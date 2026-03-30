const banco = require('../../config/banco')

const PLANOS_TENANT_VALIDOS = ['STARTER', 'PRO', 'ELITE']
const STATUS_ASSINATURA_VALIDOS = ['ATIVA', 'PAUSADA', 'CANCELADA']
const STATUS_CAMPANHA_VALIDOS = ['RASCUNHO', 'AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const TIPOS_CAMPANHA_VALIDOS = ['REATIVACAO', 'RETENCAO', 'REENGAJAMENTO']

const erroNaoEncontrado = (mensagem, codigo = 'NAO_ENCONTRADO') => ({
  status: 404,
  mensagem,
  codigo,
})

const erroFeature = (mensagem) => ({
  status: 403,
  mensagem,
  codigo: 'FEATURE_DESATIVADA',
})

const buscarTenantOuErro = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw erroNaoEncontrado('Tenant não encontrado')
  return tenant
}

const garantirFeatureAtiva = async (tenantId, campoFeature, mensagem) => {
  const tenant = await buscarTenantOuErro(tenantId)
  if (!tenant[campoFeature]) throw erroFeature(mensagem)
  return tenant
}

const normalizarData = (valor) => (valor ? new Date(valor) : null)

const adicionarDias = (data, dias) => {
  if (!data) return null
  const nova = new Date(data)
  nova.setDate(nova.getDate() + Number(dias))
  return nova
}

const inicioDoDia = (data = new Date()) => {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

const diferencaDias = (a, b) => Math.floor((inicioDoDia(a).getTime() - inicioDoDia(b).getTime()) / (1000 * 60 * 60 * 24))

const calcularSituacaoPagamento = (assinatura) => {
  if (!assinatura?.proximaCobrancaEm) {
    return {
      status: 'SEM_COBRANCA',
      descricao: 'Sem cobrança definida',
      diasAtraso: 0,
      diasParaVencer: null,
      emDia: true,
    }
  }

  if (assinatura.status === 'CANCELADA') {
    return {
      status: 'CANCELADA',
      descricao: 'Assinatura cancelada',
      diasAtraso: 0,
      diasParaVencer: null,
      emDia: false,
    }
  }

  const hoje = inicioDoDia(new Date())
  const diff = diferencaDias(assinatura.proximaCobrancaEm, hoje)

  if (diff < 0) {
    return {
      status: 'ATRASADO',
      descricao: `Pagamento atrasado há ${Math.abs(diff)} dia(s)`,
      diasAtraso: Math.abs(diff),
      diasParaVencer: 0,
      emDia: false,
    }
  }

  if (diff === 0) {
    return {
      status: 'VENCE_HOJE',
      descricao: 'Pagamento vence hoje',
      diasAtraso: 0,
      diasParaVencer: 0,
      emDia: true,
    }
  }

  if (diff <= 3) {
    return {
      status: 'VENCE_EM_BREVE',
      descricao: `Pagamento vence em ${diff} dia(s)`,
      diasAtraso: 0,
      diasParaVencer: diff,
      emDia: true,
    }
  }

  return {
    status: 'EM_DIA',
    descricao: `Pagamento em dia (vence em ${diff} dia(s))`,
    diasAtraso: 0,
    diasParaVencer: diff,
    emDia: true,
  }
}

const anexarSituacaoPagamento = (assinatura) => ({
  ...assinatura,
  situacaoPagamento: calcularSituacaoPagamento(assinatura),
})

const mapearCreditosPlanos = async (tenantId, creditosPorServico = []) => {
  if (!Array.isArray(creditosPorServico) || creditosPorServico.length === 0) return []

  const servicoIds = [...new Set(creditosPorServico.map((item) => item.servicoId).filter(Boolean))]
  const servicos = await banco.servico.findMany({
    where: { tenantId, id: { in: servicoIds } },
    select: { id: true },
  })

  if (servicos.length !== servicoIds.length) {
    throw {
      status: 422,
      mensagem: 'Um ou mais serviços informados não pertencem ao tenant',
      codigo: 'SERVICO_INVALIDO',
    }
  }

  return creditosPorServico.map((item) => ({
    servicoId: item.servicoId,
    creditos: Number(item.creditos ?? 1),
  }))
}

const buscarMeu = async (tenantId) => {
  const tenant = await buscarTenantOuErro(tenantId)
  const [planos, assinaturasAtivas, campanhas] = await Promise.all([
    banco.planoAssinatura.count({ where: { tenantId } }),
    banco.assinaturaCliente.count({ where: { tenantId, status: 'ATIVA' } }),
    banco.campanhaGrowth.count({ where: { tenantId } }),
  ])

  return {
    ...tenant,
    estatisticas: {
      planos,
      assinaturasAtivas,
      campanhas,
    },
  }
}

const atualizarMeu = async (tenantId, dados) => {
  const campos = {}

  if (dados.planoTenant !== undefined) {
    if (!PLANOS_TENANT_VALIDOS.includes(dados.planoTenant)) {
      throw { status: 422, mensagem: 'planoTenant inválido', codigo: 'VALIDACAO' }
    }
    campos.planoTenant = dados.planoTenant
  }

  if (dados.growthAtivo !== undefined) campos.growthAtivo = Boolean(dados.growthAtivo)
  if (dados.membershipsAtivo !== undefined) campos.membershipsAtivo = Boolean(dados.membershipsAtivo)
  if (dados.biAvancadoAtivo !== undefined) campos.biAvancadoAtivo = Boolean(dados.biAvancadoAtivo)
  if (dados.cancelamentoMassaAtivo !== undefined) campos.cancelamentoMassaAtivo = Boolean(dados.cancelamentoMassaAtivo)
  if (dados.nicho !== undefined) campos.nicho = dados.nicho?.trim() || null

  return banco.tenant.update({
    where: { id: tenantId },
    data: campos,
  })
}

const listarPlanos = async (tenantId) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )

  return banco.planoAssinatura.findMany({
    where: { tenantId },
    include: {
      creditos: {
        include: { servico: true },
        orderBy: { criadoEm: 'asc' },
      },
      _count: {
        select: { assinaturas: true },
      },
    },
    orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }],
  })
}

const criarPlano = async (tenantId, dados) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )
  const creditos = await mapearCreditosPlanos(tenantId, dados.creditosPorServico)

  return banco.$transaction(async (tx) => {
    const plano = await tx.planoAssinatura.create({
      data: {
        tenantId,
        nome: dados.nome,
        descricao: dados.descricao || null,
        precoCentavos: Number(dados.precoCentavos || 0),
        cicloDias: Number(dados.cicloDias || 30),
        diasPermitidos: Array.isArray(dados.diasPermitidos) ? dados.diasPermitidos.map(Number) : [],
        ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
      },
    })

    if (creditos.length > 0) {
      await tx.planoAssinaturaCredito.createMany({
        data: creditos.map((item) => ({
          planoAssinaturaId: plano.id,
          servicoId: item.servicoId,
          creditos: Number(item.creditos || 1),
        })),
      })
    }

    return tx.planoAssinatura.findUnique({
      where: { id: plano.id },
      include: { creditos: { include: { servico: true } } },
    })
  })
}

const atualizarPlano = async (tenantId, id, dados) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )
  const planoAtual = await banco.planoAssinatura.findFirst({ where: { id, tenantId } })
  if (!planoAtual) throw erroNaoEncontrado('Plano não encontrado')

  const creditos = dados.creditosPorServico ? await mapearCreditosPlanos(tenantId, dados.creditosPorServico) : null

  return banco.$transaction(async (tx) => {
    const plano = await tx.planoAssinatura.update({
      where: { id },
      data: {
        nome: dados.nome !== undefined ? dados.nome : undefined,
        descricao: dados.descricao !== undefined ? (dados.descricao || null) : undefined,
        precoCentavos: dados.precoCentavos !== undefined ? Number(dados.precoCentavos) : undefined,
        cicloDias: dados.cicloDias !== undefined ? Number(dados.cicloDias) : undefined,
        ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : undefined,
        diasPermitidos: Array.isArray(dados.diasPermitidos) ? dados.diasPermitidos.map(Number) : undefined,
      },
    })

    if (creditos) {
      await tx.planoAssinaturaCredito.deleteMany({ where: { planoAssinaturaId: id } })
      if (creditos.length > 0) {
        await tx.planoAssinaturaCredito.createMany({
          data: creditos.map((item) => ({
            planoAssinaturaId: id,
            servicoId: item.servicoId,
            creditos: Number(item.creditos || 1),
          })),
        })
      }
    }

    return tx.planoAssinatura.findUnique({
      where: { id: plano.id },
      include: { creditos: { include: { servico: true } } },
    })
  })
}

const removerPlano = async (tenantId, id) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )
  const plano = await banco.planoAssinatura.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { assinaturas: { where: { status: { in: ['ATIVA', 'PAUSADA'] } } } } } },
  })
  if (!plano) throw erroNaoEncontrado('Plano não encontrado')

  // Se tem assinantes ativos, apenas desativa
  if (plano._count.assinaturas > 0) {
    return banco.planoAssinatura.update({
      where: { id },
      data: { ativo: false },
    })
  }

  // Sem assinantes: deleta de verdade
  await banco.planoAssinaturaCredito.deleteMany({ where: { planoAssinaturaId: id } })
  await banco.planoAssinatura.delete({ where: { id } })
  return { removido: true }
}

const togglePlanoAtivo = async (tenantId, id) => {
  await garantirFeatureAtiva(tenantId, 'membershipsAtivo', 'Memberships estão desativados')
  const plano = await banco.planoAssinatura.findFirst({ where: { id, tenantId } })
  if (!plano) throw erroNaoEncontrado('Plano não encontrado')
  return banco.planoAssinatura.update({ where: { id }, data: { ativo: !plano.ativo } })
}

const listarAssinaturas = async (tenantId, filtros = {}) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )
  const where = { tenantId }
  if (filtros.clienteId) where.clienteId = filtros.clienteId
  if (filtros.status) where.status = filtros.status

  const assinaturas = await banco.assinaturaCliente.findMany({
    where,
    include: {
      cliente: true,
      planoAssinatura: {
        include: {
          creditos: {
            include: { servico: true },
          },
        },
      },
      creditos: {
        include: { servico: true },
      },
    },
    orderBy: { criadoEm: 'desc' },
  })

  return assinaturas.map(anexarSituacaoPagamento)
}

const criarAssinatura = async (tenantId, dados) => {
  const tenant = await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )

  const plano = await banco.planoAssinatura.findFirst({
    where: { id: dados.planoAssinaturaId, tenantId, ativo: true },
    include: { creditos: true },
  })
  if (!plano) throw erroNaoEncontrado('Plano de assinatura não encontrado')

  const cliente = await banco.cliente.findFirst({
    where: { id: dados.clienteId, tenantId },
  })
  if (!cliente) throw erroNaoEncontrado('Cliente não encontrado')

  const inicioEm = normalizarData(dados.inicioEm) || new Date()
  const fimEm = normalizarData(dados.fimEm) || adicionarDias(inicioEm, plano.cicloDias)
  const proximaCobrancaEm = normalizarData(dados.proximaCobrancaEm) || adicionarDias(inicioEm, plano.cicloDias)

  return banco.$transaction(async (tx) => {
    const assinatura = await tx.assinaturaCliente.create({
      data: {
        tenantId,
        clienteId: cliente.id,
        planoAssinaturaId: plano.id,
        status: dados.status && STATUS_ASSINATURA_VALIDOS.includes(dados.status) ? dados.status : 'ATIVA',
        inicioEm,
        fimEm,
        proximaCobrancaEm,
        renovacaoAutomatica: dados.renovacaoAutomatica !== undefined ? Boolean(dados.renovacaoAutomatica) : true,
        observacoes: dados.observacoes || null,
      },
    })

    if (plano.creditos.length > 0) {
      await tx.assinaturaClienteCredito.createMany({
        data: plano.creditos.map((credito) => ({
          assinaturaClienteId: assinatura.id,
          servicoId: credito.servicoId,
          creditosIniciais: Number(credito.creditos || 0),
          creditosRestantes: Number(credito.creditos || 0),
          consumidos: 0,
        })),
      })
    }

    const criada = await tx.assinaturaCliente.findUnique({
      where: { id: assinatura.id },
      include: {
        cliente: true,
        planoAssinatura: { include: { creditos: { include: { servico: true } } } },
        creditos: { include: { servico: true } },
      },
    })

    return anexarSituacaoPagamento(criada)
  })
}

const atualizarAssinatura = async (tenantId, id, dados) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )
  const assinatura = await banco.assinaturaCliente.findFirst({
    where: { id, tenantId },
    include: { planoAssinatura: true },
  })
  if (!assinatura) throw erroNaoEncontrado('Assinatura não encontrada')

  const atualizada = await banco.assinaturaCliente.update({
    where: { id },
    data: {
      status: dados.status && STATUS_ASSINATURA_VALIDOS.includes(dados.status) ? dados.status : undefined,
      inicioEm: dados.inicioEm ? new Date(dados.inicioEm) : undefined,
      fimEm: dados.fimEm ? new Date(dados.fimEm) : undefined,
      proximaCobrancaEm: dados.proximaCobrancaEm ? new Date(dados.proximaCobrancaEm) : undefined,
      renovacaoAutomatica: dados.renovacaoAutomatica !== undefined ? Boolean(dados.renovacaoAutomatica) : undefined,
      observacoes: dados.observacoes !== undefined ? (dados.observacoes || null) : undefined,
    },
    include: {
      cliente: true,
      planoAssinatura: { include: { creditos: { include: { servico: true } } } },
      creditos: { include: { servico: true } },
    },
  })

  return anexarSituacaoPagamento(atualizada)
}

const pausarAssinatura = async (tenantId, id) => atualizarAssinatura(tenantId, id, { status: 'PAUSADA' })
const retomarAssinatura = async (tenantId, id) => atualizarAssinatura(tenantId, id, { status: 'ATIVA' })
const cancelarAssinatura = async (tenantId, id, observacoes) =>
  atualizarAssinatura(tenantId, id, { status: 'CANCELADA', observacoes })

const registrarPagamentoAssinatura = async (tenantId, id, dados = {}) => {
  await garantirFeatureAtiva(
    tenantId,
    'membershipsAtivo',
    'Memberships estão desativados para este tenant'
  )

  const assinatura = await banco.assinaturaCliente.findFirst({
    where: { id, tenantId },
    include: { planoAssinatura: true },
  })
  if (!assinatura) throw erroNaoEncontrado('Assinatura não encontrada')

  if (assinatura.status === 'CANCELADA') {
    throw {
      status: 422,
      mensagem: 'Não é possível registrar pagamento em assinatura cancelada',
      codigo: 'ASSINATURA_CANCELADA',
    }
  }

  const pagoEm = normalizarData(dados.pagoEm) || new Date()
  const cicloDias = assinatura.planoAssinatura?.cicloDias || 30
  const proximaCobrancaEm = adicionarDias(pagoEm, cicloDias)
  const notaPagamento = `Pagamento confirmado em ${pagoEm.toLocaleDateString('pt-BR')}`
  const observacoesCompletas = [assinatura.observacoes, notaPagamento, dados.observacoes]
    .filter(Boolean)
    .join('\n')

  return atualizarAssinatura(tenantId, id, {
    status: 'ATIVA',
    proximaCobrancaEm,
    observacoes: observacoesCompletas,
  })
}

const simularTargetGrowth = async (tenantId, filtros = {}) => {
  const tenant = await garantirFeatureAtiva(
    tenantId,
    'growthAtivo',
    'Growth está desativado para este tenant'
  )

  const diasSemRetorno = Number(filtros.diasSemRetorno || 30)
  const limite = new Date()
  limite.setDate(limite.getDate() - diasSemRetorno)

  const whereAgendamentoBase = {
    tenantId,
    status: 'CONCLUIDO',
    inicioEm: { lt: limite },
    ...(filtros.profissionalId ? { profissionalId: filtros.profissionalId } : {}),
    ...(filtros.servicoId ? { servicoId: filtros.servicoId } : {}),
  }

  const clientes = await banco.cliente.findMany({
    where: {
      tenantId,
      agendamentos: {
        some: whereAgendamentoBase,
        none: {
          status: { in: ['AGENDADO', 'CONFIRMADO'] },
          inicioEm: { gte: new Date() },
        },
      },
    },
    include: {
      agendamentos: {
        where: whereAgendamentoBase,
        orderBy: { inicioEm: 'desc' },
        take: 1,
        include: { servico: true, profissional: true },
      },
    },
    orderBy: { nome: 'asc' },
    take: Number(filtros.limite || 200),
  })

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      nicho: tenant.nicho,
      planoTenant: tenant.planoTenant,
    },
    total: clientes.length,
    clientes: clientes.map((cliente) => {
      const ultimo = cliente.agendamentos[0]
      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        ultimoServico: ultimo?.servico?.nome || null,
        ultimoProfissional: ultimo?.profissional?.nome || null,
        ultimoAtendimentoEm: ultimo?.inicioEm || null,
        diasSemRetorno: ultimo?.inicioEm
          ? Math.floor((Date.now() - new Date(ultimo.inicioEm).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }
    }),
  }
}

const listarCampanhasGrowth = async (tenantId) => {
  await garantirFeatureAtiva(tenantId, 'growthAtivo', 'Growth está desativado para este tenant')

  return banco.campanhaGrowth.findMany({
    where: { tenantId },
    include: {
      envios: {
        include: { cliente: true },
        orderBy: { criadoEm: 'desc' },
      },
      _count: {
        select: { envios: true },
      },
    },
    orderBy: { criadoEm: 'desc' },
  })
}

const criarCampanhaGrowth = async (tenantId, dados) => {
  await garantirFeatureAtiva(tenantId, 'growthAtivo', 'Growth está desativado para este tenant')

  if (!TIPOS_CAMPANHA_VALIDOS.includes(dados.tipo)) {
    throw { status: 422, mensagem: 'tipo de campanha inválido', codigo: 'VALIDACAO' }
  }

  const target = await simularTargetGrowth(tenantId, dados)

  return banco.campanhaGrowth.create({
    data: {
      tenantId,
      nome: dados.nome,
      tipo: dados.tipo,
      mensagem: dados.mensagem,
      diasSemRetorno: Number(dados.diasSemRetorno || 30),
      status: 'RASCUNHO',
      totalAlvo: target.total,
    },
  })
}

const dispararCampanhaGrowth = async (tenantId, dados) => {
  const tenant = await garantirFeatureAtiva(
    tenantId,
    'growthAtivo',
    'Growth está desativado para este tenant'
  )

  const campaignId = dados.campanhaGrowthId || null
  let campanha = campaignId
    ? await banco.campanhaGrowth.findFirst({ where: { id: campaignId, tenantId } })
    : null

  if (!campanha) {
    if (!dados.nome || !dados.tipo || !dados.mensagem) {
      throw {
        status: 422,
        mensagem: 'Informe nome, tipo e mensagem para criar a campanha',
        codigo: 'VALIDACAO',
      }
    }

    campanha = await criarCampanhaGrowth(tenantId, dados)
  }

  const target = await simularTargetGrowth(tenantId, {
    diasSemRetorno: dados.diasSemRetorno || campanha.diasSemRetorno,
    profissionalId: dados.profissionalId,
    servicoId: dados.servicoId,
    limite: dados.limite || 200,
  })

  const totalEnviado = target.clientes.length
  const agora = new Date()

  await banco.$transaction(async (tx) => {
    for (const cliente of target.clientes) {
      await tx.campanhaGrowthEnvio.upsert({
        where: {
          campanhaGrowthId_clienteId: {
            campanhaGrowthId: campanha.id,
            clienteId: cliente.id,
          },
        },
        create: {
          campanhaGrowthId: campanha.id,
          clienteId: cliente.id,
          telefone: cliente.telefone,
          status: 'ENVIADO',
          enviadoEm: agora,
        },
        update: {
          telefone: cliente.telefone,
          status: 'ENVIADO',
          enviadoEm: agora,
          mensagemErro: null,
        },
      })
    }

    await tx.campanhaGrowth.update({
      where: { id: campanha.id },
      data: {
        status: 'CONCLUIDA',
        totalAlvo: target.total,
        totalEnviado,
      },
    })
  })

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
    },
    campanhaId: campanha.id,
    totalAlvo: target.total,
    totalEnviado,
    destino: target.clientes,
  }
}

const consumirCreditoAssinatura = async (tenantId, clienteId, servicoId) => {
  const assinatura = await banco.assinaturaCliente.findFirst({
    where: {
      tenantId,
      clienteId,
      status: 'ATIVA',
      OR: [
        { fimEm: null },
        { fimEm: { gte: new Date() } },
      ],
    },
    orderBy: { criadoEm: 'desc' },
  })

  if (!assinatura) return { consumido: false, motivo: 'sem_assinatura' }

  const credito = await banco.assinaturaClienteCredito.findFirst({
    where: {
      assinaturaClienteId: assinatura.id,
      servicoId,
      creditosRestantes: { gt: 0 },
    },
  })

  if (!credito) return { consumido: false, motivo: 'sem_credito' }

  await banco.assinaturaClienteCredito.update({
    where: { id: credito.id },
    data: {
      creditosRestantes: { decrement: 1 },
      consumidos: { increment: 1 },
    },
  })

  return { consumido: true, assinaturaClienteId: assinatura.id, assinaturaCreditoId: credito.id }
}

module.exports = {
  buscarMeu,
  atualizarMeu,
  listarPlanos,
  criarPlano,
  atualizarPlano,
  removerPlano,
  togglePlanoAtivo,
  listarAssinaturas,
  criarAssinatura,
  atualizarAssinatura,
  pausarAssinatura,
  retomarAssinatura,
  cancelarAssinatura,
  registrarPagamentoAssinatura,
  simularTargetGrowth,
  listarCampanhasGrowth,
  criarCampanhaGrowth,
  dispararCampanhaGrowth,
  consumirCreditoAssinatura,
  garantirFeatureAtiva,
  PLANOS_TENANT_VALIDOS,
  STATUS_ASSINATURA_VALIDOS,
  STATUS_CAMPANHA_VALIDOS,
  TIPOS_CAMPANHA_VALIDOS,
}

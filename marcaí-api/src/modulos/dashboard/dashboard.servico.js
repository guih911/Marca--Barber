const banco = require('../../config/banco')
const { inicioDoDia, fimDoDia, inicioDaSemana, fimDaSemana } = require('../../utils/formatarData')
const planosServico = require('../planos/planos.servico')

const adicionarDias = (data, dias) => {
  const novaData = new Date(data)
  novaData.setDate(novaData.getDate() + dias)
  return novaData
}

const diferencaDias = (dataFutura, dataBase) =>
  Math.floor((inicioDoDia(dataFutura).getTime() - inicioDoDia(dataBase).getTime()) / (1000 * 60 * 60 * 24))

const calcularSituacaoAssinatura = (assinatura) => {
  if (!assinatura?.proximaCobrancaEm) {
    return {
      status: 'SEM_COBRANCA',
      descricao: 'Sem cobranca definida',
    }
  }

  const hoje = new Date()
  const diff = diferencaDias(assinatura.proximaCobrancaEm, hoje)

  if (diff < 0) {
    return {
      status: 'ATRASADO',
      descricao: `Atrasado ha ${Math.abs(diff)} dia(s)`,
    }
  }

  if (diff === 0) {
    return {
      status: 'VENCE_HOJE',
      descricao: 'Vence hoje',
    }
  }

  return {
    status: 'VENCE_EM_BREVE',
    descricao: `Vence em ${diff} dia(s)`,
  }
}

const buscarMetricas = async (tenantId) => {
  const agora = new Date()
  const inicioDia = inicioDoDia(agora)
  const fimDia = fimDoDia(agora)
  const inicioSemana = inicioDaSemana(agora)
  const fimSemana = fimDaSemana(agora)

  const [agendamentosHoje, agendamentosSemana, confirmados, totalSemana, proximoAgendamento] =
    await Promise.all([
      banco.agendamento.count({
        where: {
          tenantId,
          inicioEm: { gte: inicioDia, lte: fimDia },
          status: { notIn: ['CANCELADO', 'REMARCADO'] },
        },
      }),
      banco.agendamento.count({
        where: {
          tenantId,
          inicioEm: { gte: inicioSemana, lte: fimSemana },
          status: { notIn: ['CANCELADO', 'REMARCADO'] },
        },
      }),
      banco.agendamento.count({
        where: {
          tenantId,
          inicioEm: { gte: inicioSemana, lte: fimSemana },
          status: 'CONFIRMADO',
        },
      }),
      banco.agendamento.count({
        where: {
          tenantId,
          inicioEm: { gte: inicioSemana, lte: fimSemana },
          status: { notIn: ['CANCELADO', 'REMARCADO'] },
        },
      }),
      banco.agendamento.findFirst({
        where: {
          tenantId,
          inicioEm: { gte: agora },
          status: { notIn: ['CANCELADO', 'REMARCADO'] },
        },
        orderBy: { inicioEm: 'asc' },
        include: { cliente: true, servico: true, profissional: true },
      }),
    ])

  const taxaConfirmacao = totalSemana > 0 ? Math.round((confirmados / totalSemana) * 100) : 0

  return {
    agendamentosHoje,
    agendamentosSemana,
    taxaConfirmacao,
    proximoAgendamento,
  }
}

const buscarGrafico = async (tenantId, periodo = '7d') => {
  const dias = periodo === '30d' ? 30 : 7
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - (dias - 1))
  inicio.setHours(0, 0, 0, 0)

  const agendamentos = await banco.agendamento.findMany({
    where: {
      tenantId,
      inicioEm: { gte: inicio },
      status: { notIn: ['CANCELADO', 'REMARCADO'] },
    },
    select: { inicioEm: true },
  })

  // Agrupa por data
  const contagem = {}
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    const chave = d.toISOString().split('T')[0]
    contagem[chave] = 0
  }

  for (const ag of agendamentos) {
    const chave = ag.inicioEm.toISOString().split('T')[0]
    if (chave in contagem) contagem[chave]++
  }

  return Object.entries(contagem).map(([data, total]) => ({ data, total }))
}

/**
 * Métricas financeiras da semana:
 * receita realizada, prevista, ticket médio, taxa no-show, top profissionais.
 * Usa precoCustom por profissional quando disponível.
 */
const buscarFinanceiro = async (tenantId) => {
  const agora = new Date()
  const inicioSemana = inicioDaSemana(agora)
  const fimSemana = fimDaSemana(agora)
  const inicioDia = inicioDoDia(agora)
  const fimDia = fimDoDia(agora)

  // Busca agendamentos da semana com preço (join profissionalServico para precoCustom)
  const agendamentosSemana = await banco.agendamento.findMany({
    where: {
      tenantId,
      inicioEm: { gte: inicioSemana, lte: fimSemana },
    },
    include: {
      servico: { select: { precoCentavos: true } },
      profissional: {
        select: {
          id: true, nome: true,
          servicos: { select: { servicoId: true, precoCustom: true } },
        },
      },
    },
  })

  const calcularPreco = (ag) => {
    const custom = ag.profissional?.servicos?.find((ps) => ps.servicoId === ag.servicoId)?.precoCustom
    return custom ?? ag.servico?.precoCentavos ?? 0
  }

  const concluidos = agendamentosSemana.filter((a) => a.status === 'CONCLUIDO')
  const agendados = agendamentosSemana.filter((a) => ['AGENDADO', 'CONFIRMADO'].includes(a.status))
  const naoCompareceu = agendamentosSemana.filter((a) => a.status === 'NAO_COMPARECEU')
  const totalSemanaComContagem = agendamentosSemana.filter((a) =>
    !['REMARCADO', 'CANCELADO'].includes(a.status)
  )

  const receitaSemana = concluidos.reduce((s, a) => s + calcularPreco(a), 0)
  const receitaAgendada = agendados.reduce((s, a) => s + calcularPreco(a), 0)
  const ticketMedio = concluidos.length > 0 ? Math.round(receitaSemana / concluidos.length) : 0
  const taxaNaoCompareceu =
    totalSemanaComContagem.length > 0
      ? Math.round((naoCompareceu.length / totalSemanaComContagem.length) * 100)
      : 0

  // Receita hoje
  const agendamentosHojeConc = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDO',
      inicioEm: { gte: inicioDia, lte: fimDia },
    },
    include: {
      servico: { select: { precoCentavos: true } },
      profissional: {
        select: { servicos: { select: { servicoId: true, precoCustom: true } } },
      },
    },
  })
  const receitaHoje = agendamentosHojeConc.reduce((s, a) => s + calcularPreco(a), 0)

  // Top 3 profissionais por atendimentos concluídos na semana
  const contagemPorProf = {}
  const receitaPorProf = {}
  for (const ag of concluidos) {
    const id = ag.profissionalId
    const nome = ag.profissional?.nome || id
    contagemPorProf[id] = { id, nome, atendimentos: (contagemPorProf[id]?.atendimentos || 0) + 1 }
    receitaPorProf[id] = (receitaPorProf[id] || 0) + calcularPreco(ag)
  }

  const topProfissionais = Object.values(contagemPorProf)
    .map((p) => ({ ...p, receitaCentavos: receitaPorProf[p.id] || 0 }))
    .sort((a, b) => b.atendimentos - a.atendimentos)
    .slice(0, 3)

  return {
    receitaHojeCentavos: receitaHoje,
    receitaSemanaCentavos: receitaSemana,
    receitaAgendadaCentavos: receitaAgendada,
    ticketMedioCentavos: ticketMedio,
    taxaNaoCompareceu,
    atendimentosConcluidos: concluidos.length,
    topProfissionais,
  }
}

const buscarOperacional = async (tenantId) => {
  const agora = new Date()
  const inicioHoje = inicioDoDia(agora)
  const fimHoje = fimDoDia(agora)
  const fimAmanha = fimDoDia(adicionarDias(agora, 1))
  const inicioAmanha = inicioDoDia(adicionarDias(agora, 1))
  const limiteCobranca = fimDoDia(adicionarDias(agora, 3))

  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: {
      membershipsAtivo: true,
      fidelidadeAtivo: true,
      nome: true,
    },
  })

  const [
    aguardandoHumanoTotal,
    aguardandoHumanoItens,
    confirmacoesPendentesTotal,
    confirmacoesPendentesItens,
    filaEsperaTotal,
    filaEsperaItens,
  ] = await Promise.all([
    banco.conversa.count({
      where: {
        tenantId,
        status: 'ESCALONADA',
      },
    }),
    banco.conversa.findMany({
      where: {
        tenantId,
        status: 'ESCALONADA',
      },
      orderBy: { atualizadoEm: 'asc' },
      take: 5,
      select: {
        id: true,
        atualizadoEm: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
          },
        },
      },
    }),
    banco.agendamento.count({
      where: {
        tenantId,
        status: 'AGENDADO',
        inicioEm: { gte: agora, lte: fimAmanha },
      },
    }),
    banco.agendamento.findMany({
      where: {
        tenantId,
        status: 'AGENDADO',
        inicioEm: { gte: agora, lte: fimAmanha },
      },
      orderBy: { inicioEm: 'asc' },
      take: 5,
      select: {
        id: true,
        inicioEm: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
          },
        },
        servico: {
          select: {
            nome: true,
          },
        },
        profissional: {
          select: {
            nome: true,
          },
        },
      },
    }),
    banco.filaEspera.count({
      where: {
        tenantId,
        status: 'AGUARDANDO',
      },
    }),
    banco.filaEspera.findMany({
      where: {
        tenantId,
        status: 'AGUARDANDO',
      },
      orderBy: { dataDesejada: 'asc' },
      take: 5,
      select: {
        id: true,
        dataDesejada: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
          },
        },
        servico: {
          select: {
            nome: true,
          },
        },
        profissional: {
          select: {
            nome: true,
          },
        },
      },
    }),
  ])

  let fidelidade = { disponivel: Boolean(tenant?.fidelidadeAtivo), total: 0, itens: [], config: null }
  if (tenant?.fidelidadeAtivo) {
    const config = await banco.configFidelidade.findUnique({
      where: { tenantId },
      select: {
        pontosParaResgate: true,
        descricaoResgate: true,
      },
    })

    if (config?.pontosParaResgate) {
      const [total, itens] = await Promise.all([
        banco.pontosFidelidade.count({
          where: {
            tenantId,
            pontos: { gte: config.pontosParaResgate },
          },
        }),
        banco.pontosFidelidade.findMany({
          where: {
            tenantId,
            pontos: { gte: config.pontosParaResgate },
          },
          orderBy: [{ pontos: 'desc' }, { atualizadoEm: 'asc' }],
          take: 5,
          select: {
            clienteId: true,
            pontos: true,
            atualizadoEm: true,
            cliente: {
              select: {
                id: true,
                nome: true,
                telefone: true,
              },
            },
          },
        }),
      ])

      fidelidade = {
        disponivel: true,
        total,
        itens,
        config,
      }
    }
  }

  let assinaturas = { disponivel: Boolean(tenant?.membershipsAtivo), total: 0, itens: [] }
  if (tenant?.membershipsAtivo) {
    const filtroAssinaturas = {
      tenantId,
      status: 'ATIVA',
      proximaCobrancaEm: {
        not: null,
        lte: limiteCobranca,
      },
      OR: [
        { fimEm: null },
        { fimEm: { gte: inicioHoje } },
      ],
    }

    const [total, itens] = await Promise.all([
      banco.assinaturaCliente.count({
        where: filtroAssinaturas,
      }),
      banco.assinaturaCliente.findMany({
        where: filtroAssinaturas,
        orderBy: { proximaCobrancaEm: 'asc' },
        take: 5,
        select: {
          id: true,
          proximaCobrancaEm: true,
          cliente: {
            select: {
              id: true,
              nome: true,
              telefone: true,
            },
          },
          planoAssinatura: {
            select: {
              nome: true,
            },
          },
        },
      }),
    ])

    assinaturas = {
      disponivel: true,
      total,
      itens: itens.map((item) => ({
        ...item,
        situacaoPagamento: calcularSituacaoAssinatura(item),
      })),
    }
  }

  return {
    tenant: {
      nome: tenant?.nome || null,
    },
    aguardandoHumano: {
      total: aguardandoHumanoTotal,
      itens: aguardandoHumanoItens,
    },
    confirmacoesPendentes: {
      total: confirmacoesPendentesTotal,
      itens: confirmacoesPendentesItens,
      janela: {
        inicio: agora,
        fim: fimAmanha,
      },
    },
    filaEspera: {
      total: filaEsperaTotal,
      itens: filaEsperaItens,
    },
    fidelidade,
    assinaturas,
    resumo: {
      hoje: {
        agendamentosPendentes: confirmacoesPendentesItens.filter((item) => item.inicioEm <= fimHoje).length,
        agendamentosAmanha: confirmacoesPendentesItens.filter((item) => item.inicioEm >= inicioAmanha).length,
      },
      pendenciasCriticas: aguardandoHumanoTotal + confirmacoesPendentesTotal,
    },
  }
}

const buscarIntervaloPadrao = (inicio, fim, janelaDias = 30) => {
  const fimDate = fim ? new Date(fim) : new Date()
  fimDate.setHours(23, 59, 59, 999)

  const inicioDate = inicio
    ? new Date(inicio)
    : new Date(fimDate.getTime() - (Number(janelaDias) - 1) * 24 * 60 * 60 * 1000)
  inicioDate.setHours(0, 0, 0, 0)

  return { inicio: inicioDate, fim: fimDate }
}

const inicioEHora = (dia, horaStr) => {
  const [hora, minuto] = String(horaStr || '00:00').split(':').map((v) => Number(v || 0))
  const d = new Date(dia)
  d.setHours(hora, minuto, 0, 0)
  return d
}

const calcularMinutosIntervalo = (inicio, fim) => Math.max(0, Math.round((fim - inicio) / 60000))

const calcularDisponibilidadeProfissional = (profissional, inicio, fim) => {
  const agenda = profissional.horarioTrabalho || {}
  let total = 0

  const cursor = new Date(inicio)
  while (cursor <= fim) {
    const diaSemana = cursor.getDay()
    const configDia = agenda[String(diaSemana)] || agenda[diaSemana]

    if (configDia?.ativo) {
      const inicioExpediente = inicioEHora(cursor, configDia.inicio || '09:00')
      const fimExpediente = inicioEHora(cursor, configDia.fim || '18:00')
      let minutosDia = calcularMinutosIntervalo(inicioExpediente, fimExpediente)

      if (Array.isArray(configDia.intervalos)) {
        for (const intervalo of configDia.intervalos) {
          const inicioIntervalo = inicioEHora(cursor, intervalo.inicio)
          const fimIntervalo = inicioEHora(cursor, intervalo.fim)
          minutosDia -= calcularMinutosIntervalo(inicioIntervalo, fimIntervalo)
        }
      }

      total += Math.max(0, minutosDia)
    }

    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)
  }

  return total
}

const garantirBiAvancado = async (tenantId) =>
  planosServico.garantirFeatureAtiva(
    tenantId,
    'biAvancadoAtivo',
    'BI avançado está desativado para este tenant'
  )

const buscarOcupacao = async (tenantId, filtros = {}) => {
  const tenant = await garantirBiAvancado(tenantId)
  const { inicio, fim } = buscarIntervaloPadrao(filtros.inicio, filtros.fim, filtros.janelaDias || 30)

  const whereProfissionais = {
    tenantId,
    ativo: true,
    ...(filtros.profissionalId ? { id: filtros.profissionalId } : {}),
  }
  const whereAgendamentos = {
    tenantId,
    inicioEm: { gte: inicio, lte: fim },
    status: { notIn: ['CANCELADO', 'REMARCADO'] },
    ...(filtros.profissionalId ? { profissionalId: filtros.profissionalId } : {}),
  }

  const [profissionais, agendamentos] = await Promise.all([
    banco.profissional.findMany({
      where: whereProfissionais,
      select: { id: true, nome: true, horarioTrabalho: true },
      orderBy: { nome: 'asc' },
    }),
    banco.agendamento.findMany({
      where: whereAgendamentos,
      select: { profissionalId: true, inicioEm: true, fimEm: true, status: true },
    }),
  ])

  const agendamentosPorProf = new Map()
  for (const ag of agendamentos) {
    if (!agendamentosPorProf.has(ag.profissionalId)) agendamentosPorProf.set(ag.profissionalId, [])
    agendamentosPorProf.get(ag.profissionalId).push(ag)
  }

  const profissionaisResumo = profissionais.map((profissional) => {
    const ocupados = agendamentosPorProf.get(profissional.id) || []
    const ocupadosMinutos = ocupados.reduce(
      (total, ag) => total + calcularMinutosIntervalo(new Date(ag.inicioEm), new Date(ag.fimEm)),
      0
    )
    const disponibilidadeMinutos = calcularDisponibilidadeProfissional(profissional, inicio, fim)
    const taxaOcupacao = disponibilidadeMinutos > 0
      ? Math.round((ocupadosMinutos / disponibilidadeMinutos) * 100)
      : 0

    return {
      id: profissional.id,
      nome: profissional.nome,
      disponibilidadeMinutos,
      ocupadosMinutos,
      taxaOcupacao,
      totalAgendamentos: ocupados.length,
    }
  })

  const totalDisponibilidade = profissionaisResumo.reduce((s, p) => s + p.disponibilidadeMinutos, 0)
  const totalOcupados = profissionaisResumo.reduce((s, p) => s + p.ocupadosMinutos, 0)

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      planoTenant: tenant.planoTenant,
      nicho: tenant.nicho,
    },
    periodo: { inicio, fim },
    total: {
      disponibilidadeMinutos: totalDisponibilidade,
      ocupadosMinutos: totalOcupados,
      taxaOcupacao: totalDisponibilidade > 0 ? Math.round((totalOcupados / totalDisponibilidade) * 100) : 0,
    },
    profissionais: profissionaisResumo,
  }
}

const buscarRetencao = async (tenantId, filtros = {}) => {
  const tenant = await garantirBiAvancado(tenantId)
  const janelaDias = Number(filtros.janelaDias || 180)
  const limite = new Date()
  limite.setDate(limite.getDate() - janelaDias)

  const agendamentosConcluidos = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDO',
      inicioEm: { gte: limite },
    },
    select: {
      clienteId: true,
      inicioEm: true,
    },
    orderBy: { inicioEm: 'asc' },
  })

  const agrupados = new Map()
  for (const ag of agendamentosConcluidos) {
    if (!agrupados.has(ag.clienteId)) agrupados.set(ag.clienteId, [])
    agrupados.get(ag.clienteId).push(new Date(ag.inicioEm))
  }

  let clientesComRetorno = 0
  let totalClientesComCompra = 0
  let somaDiasRetorno = 0
  const coortes = {
    ate30: 0,
    ate60: 0,
    ate90: 0,
    acima90: 0,
  }

  for (const datas of agrupados.values()) {
    if (datas.length === 0) continue
    totalClientesComCompra += 1
    if (datas.length < 2) continue

    clientesComRetorno += 1
    const primeiroRetornoDias = Math.floor((datas[1].getTime() - datas[0].getTime()) / (1000 * 60 * 60 * 24))
    somaDiasRetorno += primeiroRetornoDias

    if (primeiroRetornoDias <= 30) coortes.ate30 += 1
    else if (primeiroRetornoDias <= 60) coortes.ate60 += 1
    else if (primeiroRetornoDias <= 90) coortes.ate90 += 1
    else coortes.acima90 += 1
  }

  const clientesAtivos = await banco.cliente.count({
    where: {
      tenantId,
      agendamentos: {
        some: {
          status: 'CONCLUIDO',
          inicioEm: { gte: limite },
        },
      },
    },
  })

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      planoTenant: tenant.planoTenant,
      nicho: tenant.nicho,
    },
    janelaDias,
    clientesComCompra: totalClientesComCompra,
    clientesComRetorno,
    taxaRetencao: totalClientesComCompra > 0 ? Math.round((clientesComRetorno / totalClientesComCompra) * 100) : 0,
    tempoMedioRetornoDias: clientesComRetorno > 0 ? Math.round(somaDiasRetorno / clientesComRetorno) : 0,
    clientesAtivos,
    coortes,
  }
}

const buscarNoShowPorProfissional = async (tenantId, filtros = {}) => {
  const tenant = await garantirBiAvancado(tenantId)
  const { inicio, fim } = buscarIntervaloPadrao(filtros.inicio, filtros.fim, filtros.janelaDias || 90)

  const [profissionais, agendamentos] = await Promise.all([
    banco.profissional.findMany({
      where: {
        tenantId,
        ativo: true,
        ...(filtros.profissionalId ? { id: filtros.profissionalId } : {}),
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    banco.agendamento.findMany({
      where: {
        tenantId,
        inicioEm: { gte: inicio, lte: fim },
        status: { notIn: ['REMARCADO'] },
        ...(filtros.profissionalId ? { profissionalId: filtros.profissionalId } : {}),
      },
      select: {
        profissionalId: true,
        status: true,
      },
    }),
  ])

  const porProfissional = new Map()
  for (const ag of agendamentos) {
    if (!porProfissional.has(ag.profissionalId)) {
      porProfissional.set(ag.profissionalId, { total: 0, naoCompareceu: 0, cancelados: 0, concluidos: 0 })
    }
    const item = porProfissional.get(ag.profissionalId)
    item.total += 1
    if (ag.status === 'NAO_COMPARECEU') item.naoCompareceu += 1
    if (ag.status === 'CANCELADO') item.cancelados += 1
    if (ag.status === 'CONCLUIDO') item.concluidos += 1
  }

  const profissionaisResumo = profissionais.map((profissional) => {
    const resumo = porProfissional.get(profissional.id) || { total: 0, naoCompareceu: 0, cancelados: 0, concluidos: 0 }
    return {
      id: profissional.id,
      nome: profissional.nome,
      ...resumo,
      taxaNoShow: resumo.total > 0 ? Math.round((resumo.naoCompareceu / resumo.total) * 100) : 0,
    }
  })

  return {
    tenant: {
      id: tenant.id,
      nome: tenant.nome,
      planoTenant: tenant.planoTenant,
      nicho: tenant.nicho,
    },
    periodo: { inicio, fim },
    profissionais: profissionaisResumo,
    total: profissionaisResumo.reduce(
      (acc, item) => {
        acc.total += item.total
        acc.naoCompareceu += item.naoCompareceu
        acc.cancelados += item.cancelados
        acc.concluidos += item.concluidos
        return acc
      },
      { total: 0, naoCompareceu: 0, cancelados: 0, concluidos: 0 }
    ),
  }
}

module.exports = {
  buscarMetricas,
  buscarGrafico,
  buscarFinanceiro,
  buscarOperacional,
  buscarOcupacao,
  buscarRetencao,
  buscarNoShowPorProfissional,
}

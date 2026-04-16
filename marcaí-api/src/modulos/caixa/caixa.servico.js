const banco = require('../../config/banco')

const inicioDoMes = (data) => new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0)
const fimDoMes = (data) => new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59, 999)
const chaveMes = (data) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`

const calcularValorLiquidoAgendamento = (agendamento) => {
  const bruto = agendamento?.servico?.precoCentavos || 0
  const desconto = agendamento?.descontoCentavos || 0
  const gorjeta = agendamento?.gorjetaCentavos || 0
  return bruto - desconto + gorjeta
}

const somarFormaPagamento = (acumulador, forma, valor) => {
  if (!forma || valor <= 0) return
  if (!acumulador[forma]) acumulador[forma] = 0
  acumulador[forma] += valor
}

const distribuirFormasPagamento = (agendamento, valorLiquido, acumulador) => {
  const formaPrincipal = agendamento?.formaPagamento || 'NAO_INFORMADO'
  const formaSecundaria = agendamento?.formaPagamento2 || null
  const valorSecundario = Math.max(0, agendamento?.valorPagamento2Centavos || 0)

  if (formaSecundaria && valorSecundario > 0) {
    const valorPrincipal = Math.max(0, valorLiquido - valorSecundario)
    somarFormaPagamento(acumulador, formaPrincipal, valorPrincipal)
    somarFormaPagamento(acumulador, formaSecundaria, Math.min(valorLiquido, valorSecundario))
    return
  }

  somarFormaPagamento(acumulador, formaPrincipal, valorLiquido)
}

const calcularVariacaoPercentual = (atual, anterior) => {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

const obterSessaoAtual = async (tenantId) => {
  return banco.sessaoCaixa.findFirst({
    where: { tenantId, status: 'ABERTO' },
    orderBy: { aberturaEm: 'desc' },
  })
}

const abrirSessao = async (tenantId, usuarioId, { saldoInicial = 0, observacoes } = {}) => {
  const aberta = await obterSessaoAtual(tenantId)
  if (aberta) throw { status: 422, mensagem: 'Já existe uma sessão de caixa aberta.', codigo: 'CAIXA_JA_ABERTO' }

  return banco.sessaoCaixa.create({
    data: {
      tenantId,
      usuarioId: usuarioId || null,
      saldoInicial: Math.round(Number(saldoInicial) || 0),
      observacoes: observacoes || null,
      status: 'ABERTO',
    },
  })
}

const fecharSessao = async (tenantId, { saldoFinal, observacoes } = {}) => {
  const aberta = await obterSessaoAtual(tenantId)
  if (!aberta) throw { status: 422, mensagem: 'Nenhuma sessão de caixa aberta.', codigo: 'CAIXA_NAO_ABERTO' }

  return banco.sessaoCaixa.update({
    where: { id: aberta.id },
    data: {
      status: 'FECHADO',
      saldoFinal: saldoFinal != null ? Math.round(Number(saldoFinal)) : null,
      observacoes: observacoes || aberta.observacoes,
      fechamentoEm: new Date(),
    },
  })
}

const listarSessoes = async (tenantId, limite = 30) => {
  return banco.sessaoCaixa.findMany({
    where: { tenantId },
    orderBy: { aberturaEm: 'desc' },
    take: Number(limite),
  })
}

const registrarMovimentacao = async (tenantId, { tipo, valor, descricao } = {}) => {
  const sessao = await obterSessaoAtual(tenantId)
  if (!sessao) throw { status: 422, mensagem: 'Nenhuma sessão de caixa aberta.', codigo: 'CAIXA_NAO_ABERTO' }
  if (!valor || valor <= 0) throw { status: 400, mensagem: 'Valor inválido.', codigo: 'VALOR_INVALIDO' }
  const tipoValido = ['SANGRIA', 'REFORCO']
  if (!tipoValido.includes(tipo)) throw { status: 400, mensagem: 'Tipo inválido. Use SANGRIA ou REFORCO.', codigo: 'TIPO_INVALIDO' }

  return banco.caixaMovimentacao.create({
    data: {
      tenantId,
      sessaoId: sessao.id,
      tipo,
      valor: Math.round(Number(valor)),
      descricao: descricao || null,
    },
  })
}

// Calcula o total de receita da sessão atual (agendamentos CONCLUIDOS desde abertura)
const obterResumoSessao = async (tenantId, sessaoId) => {
  const sessao = await banco.sessaoCaixa.findFirst({ where: { id: sessaoId, tenantId } })
  if (!sessao) return null

  const inicioReferencia = sessao.aberturaEm
  const fimReferencia = sessao.fechamentoEm || new Date()

  const agendamentos = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDO',
      OR: [
        { concluidoEm: { gte: inicioReferencia, lte: fimReferencia } },
        { concluidoEm: null, atualizadoEm: { gte: inicioReferencia, lte: fimReferencia } },
      ],
    },
    include: {
      servico: { select: { precoCentavos: true, nome: true } },
      profissional: { select: { nome: true } },
    },
  })

  const movimentacoes = await banco.caixaMovimentacao.findMany({
    where: { sessaoId: sessao.id, tenantId },
    orderBy: { criadoEm: 'asc' },
  })

  const totalSangrias = movimentacoes.filter(m => m.tipo === 'SANGRIA').reduce((s, m) => s + m.valor, 0)
  const totalReforcos = movimentacoes.filter(m => m.tipo === 'REFORCO').reduce((s, m) => s + m.valor, 0)

  const totalServicos = agendamentos.reduce((s, ag) => s + (ag.servico?.precoCentavos || 0), 0)
  const totalDescontos = agendamentos.reduce((s, ag) => s + (ag.descontoCentavos || 0), 0)
  const totalGorjetas = agendamentos.reduce((s, ag) => s + (ag.gorjetaCentavos || 0), 0)
  const totalComDescontos = agendamentos.reduce((s, ag) => s + calcularValorLiquidoAgendamento(ag), 0)

  const porForma = agendamentos.reduce((acc, ag) => {
    distribuirFormasPagamento(ag, calcularValorLiquidoAgendamento(ag), acc)
    return acc
  }, {})

  return {
    sessao,
    totalAtendimentos: agendamentos.length,
    totalServicos,
    totalComDescontos,
    totalDescontos,
    totalGorjetas,
    porFormaPagamento: porForma,
    movimentacoes,
    totalSangrias,
    totalReforcos,
    saldoProjetado: (sessao.saldoInicial || 0) + totalComDescontos + totalReforcos - totalSangrias,
  }
}

const obterVisaoGeral = async (tenantId, meses = 6) => {
  const quantidadeMeses = Math.max(2, Math.min(Number(meses) || 6, 12))
  const agora = new Date()
  const mesAtualInicio = inicioDoMes(agora)
  const inicioJanela = new Date(mesAtualInicio.getFullYear(), mesAtualInicio.getMonth() - (quantidadeMeses - 1), 1, 0, 0, 0, 0)
  const fimJanela = fimDoMes(agora)

  const [agendamentos, movimentacoes] = await Promise.all([
    banco.agendamento.findMany({
      where: {
        tenantId,
        status: 'CONCLUIDO',
        OR: [
          { concluidoEm: { gte: inicioJanela, lte: fimJanela } },
          { concluidoEm: null, atualizadoEm: { gte: inicioJanela, lte: fimJanela } },
        ],
      },
      include: {
        servico: { select: { precoCentavos: true } },
        profissional: { select: { nome: true } },
      },
      orderBy: { concluidoEm: 'asc' },
    }),
    banco.caixaMovimentacao.findMany({
      where: {
        tenantId,
        criadoEm: { gte: inicioJanela, lte: fimJanela },
      },
      orderBy: { criadoEm: 'asc' },
    }),
  ])

  const series = []
  for (let i = 0; i < quantidadeMeses; i++) {
    const data = new Date(mesAtualInicio.getFullYear(), mesAtualInicio.getMonth() - (quantidadeMeses - 1) + i, 1)
    const chave = chaveMes(data)
    series.push({
      chave,
      label: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      referencia: data.toISOString(),
      receitaBruta: 0,
      receitaLiquida: 0,
      descontos: 0,
      gorjetas: 0,
      atendimentos: 0,
      ticketMedio: 0,
      reforcos: 0,
      sangrias: 0,
      resultadoCaixa: 0,
      porFormaPagamento: {},
      porProfissional: {},
    })
  }

  const seriePorChave = Object.fromEntries(series.map((item) => [item.chave, item]))

  for (const agendamento of agendamentos) {
    const dataBase = agendamento.concluidoEm || agendamento.atualizadoEm
    if (!dataBase) continue
    const chave = chaveMes(new Date(dataBase))
    const bucket = seriePorChave[chave]
    if (!bucket) continue

    const bruto = agendamento.servico?.precoCentavos || 0
    const desconto = agendamento.descontoCentavos || 0
    const gorjeta = agendamento.gorjetaCentavos || 0
    const liquido = calcularValorLiquidoAgendamento(agendamento)
    const profissional = agendamento.profissional?.nome || 'Não informado'

    bucket.receitaBruta += bruto
    bucket.receitaLiquida += liquido
    bucket.descontos += desconto
    bucket.gorjetas += gorjeta
    bucket.atendimentos += 1
    distribuirFormasPagamento(agendamento, liquido, bucket.porFormaPagamento)
    if (!bucket.porProfissional[profissional]) bucket.porProfissional[profissional] = { receitaLiquida: 0, atendimentos: 0 }
    bucket.porProfissional[profissional].receitaLiquida += liquido
    bucket.porProfissional[profissional].atendimentos += 1
  }

  for (const movimentacao of movimentacoes) {
    const chave = chaveMes(new Date(movimentacao.criadoEm))
    const bucket = seriePorChave[chave]
    if (!bucket) continue
    if (movimentacao.tipo === 'REFORCO') bucket.reforcos += movimentacao.valor
    if (movimentacao.tipo === 'SANGRIA') bucket.sangrias += movimentacao.valor
  }

  for (const bucket of series) {
    bucket.ticketMedio = bucket.atendimentos > 0 ? Math.round(bucket.receitaLiquida / bucket.atendimentos) : 0
    bucket.resultadoCaixa = bucket.receitaLiquida + bucket.reforcos - bucket.sangrias
    bucket.topProfissionais = Object.entries(bucket.porProfissional)
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.receitaLiquida - a.receitaLiquida)
      .slice(0, 5)
  }

  const atual = series[series.length - 1]
  const anterior = series[series.length - 2] || null

  return {
    atual: {
      ...atual,
      variacaoReceitaLiquida: calcularVariacaoPercentual(atual.receitaLiquida, anterior?.receitaLiquida || 0),
      variacaoAtendimentos: calcularVariacaoPercentual(atual.atendimentos, anterior?.atendimentos || 0),
      variacaoTicketMedio: calcularVariacaoPercentual(atual.ticketMedio, anterior?.ticketMedio || 0),
    },
    anterior,
    serieMensal: series,
  }
}

module.exports = { obterSessaoAtual, abrirSessao, fecharSessao, listarSessoes, obterResumoSessao, registrarMovimentacao, obterVisaoGeral }

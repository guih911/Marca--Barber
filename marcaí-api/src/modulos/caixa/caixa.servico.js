const banco = require('../../config/banco')

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

  const agendamentos = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDO',
      atualizadoEm: { gte: sessao.aberturaEm },
    },
    include: { servico: { select: { precoCentavos: true } } },
  })

  const movimentacoes = await banco.caixaMovimentacao.findMany({
    where: { sessaoId: sessao.id, tenantId },
    orderBy: { criadoEm: 'asc' },
  })

  const totalSangrias = movimentacoes.filter(m => m.tipo === 'SANGRIA').reduce((s, m) => s + m.valor, 0)
  const totalReforcos = movimentacoes.filter(m => m.tipo === 'REFORCO').reduce((s, m) => s + m.valor, 0)

  const totalServicos = agendamentos.reduce((s, ag) => s + (ag.servico?.precoCentavos || 0), 0)
  const totalComDescontos = agendamentos.reduce((s, ag) => {
    const base = ag.servico?.precoCentavos || 0
    const desc = ag.descontoCentavos || 0
    const gorj = ag.gorjetaCentavos || 0
    return s + base - desc + gorj
  }, 0)

  const porForma = agendamentos.reduce((acc, ag) => {
    const forma = ag.formaPagamento || 'Não informado'
    if (!acc[forma]) acc[forma] = 0
    acc[forma] += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  return {
    sessao,
    totalAtendimentos: agendamentos.length,
    totalServicos,
    totalComDescontos,
    porFormaPagamento: porForma,
    movimentacoes,
    totalSangrias,
    totalReforcos,
  }
}

module.exports = { obterSessaoAtual, abrirSessao, fecharSessao, listarSessoes, obterResumoSessao, registrarMovimentacao }

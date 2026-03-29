const dashboardServico = require('./dashboard.servico')

const metricas = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarMetricas(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const grafico = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarGrafico(req.usuario.tenantId, req.query.periodo)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const financeiro = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarFinanceiro(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const operacional = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarOperacional(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const ocupacao = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarOcupacao(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const retencao = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarRetencao(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const noShowProfissional = async (req, res, next) => {
  try {
    const dados = await dashboardServico.buscarNoShowPorProfissional(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { metricas, grafico, financeiro, operacional, ocupacao, retencao, noShowProfissional }

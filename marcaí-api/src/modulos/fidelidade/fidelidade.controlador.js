const fidelidadeServico = require('./fidelidade.servico')

const obterConfig = async (req, res, next) => {
  try {
    const config = await fidelidadeServico.obterConfig(req.usuario.tenantId)
    res.json({ sucesso: true, dados: config })
  } catch (err) { next(err) }
}

const salvarConfig = async (req, res, next) => {
  try {
    const config = await fidelidadeServico.salvarConfig(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: config })
  } catch (err) { next(err) }
}

const listarRanking = async (req, res, next) => {
  try {
    const ranking = await fidelidadeServico.listarRanking(req.usuario.tenantId, Number(req.query.limite) || 20)
    res.json({ sucesso: true, dados: ranking })
  } catch (err) { next(err) }
}

const obterSaldoCliente = async (req, res, next) => {
  try {
    const dados = await fidelidadeServico.obterSaldoCliente(req.usuario.tenantId, req.params.clienteId)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const resgatarPontos = async (req, res, next) => {
  try {
    const saldo = await fidelidadeServico.resgatarPontos(req.usuario.tenantId, req.params.clienteId)
    res.json({ sucesso: true, dados: saldo })
  } catch (err) { next(err) }
}

module.exports = { obterConfig, salvarConfig, listarRanking, obterSaldoCliente, resgatarPontos }

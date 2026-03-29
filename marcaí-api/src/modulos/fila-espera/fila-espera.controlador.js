const filaServico = require('./fila-espera.servico')

const listar = async (req, res, next) => {
  try {
    const dados = await filaServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const criar = async (req, res, next) => {
  try {
    const dados = await filaServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const atualizarStatus = async (req, res, next) => {
  try {
    const dados = await filaServico.atualizarStatus(req.usuario.tenantId, req.params.id, req.body.status)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const remover = async (req, res, next) => {
  try {
    await filaServico.remover(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true })
  } catch (err) { next(err) }
}

module.exports = { listar, criar, atualizarStatus, remover }

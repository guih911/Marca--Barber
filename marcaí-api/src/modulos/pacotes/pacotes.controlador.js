const pacotesServico = require('./pacotes.servico')

const listar = async (req, res, next) => {
  try {
    const dados = await pacotesServico.listar(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const buscarPorId = async (req, res, next) => {
  try {
    const dados = await pacotesServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const criar = async (req, res, next) => {
  try {
    const dados = await pacotesServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const atualizar = async (req, res, next) => {
  try {
    const dados = await pacotesServico.atualizar(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const excluir = async (req, res, next) => {
  try {
    await pacotesServico.excluir(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true })
  } catch (err) { next(err) }
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir }

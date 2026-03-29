const estoqueServico = require('./estoque.servico')

const listar = async (req, res, next) => {
  try {
    const produtos = await estoqueServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados: produtos })
  } catch (err) { next(err) }
}

const buscarPorId = async (req, res, next) => {
  try {
    const produto = await estoqueServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: produto })
  } catch (err) { next(err) }
}

const criar = async (req, res, next) => {
  try {
    const produto = await estoqueServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados: produto })
  } catch (err) { next(err) }
}

const atualizar = async (req, res, next) => {
  try {
    const produto = await estoqueServico.atualizar(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados: produto })
  } catch (err) { next(err) }
}

const registrarMovimento = async (req, res, next) => {
  try {
    const { tipo, quantidade, motivo } = req.body
    const movto = await estoqueServico.registrarMovimento(req.usuario.tenantId, req.params.id, tipo, quantidade, motivo)
    res.json({ sucesso: true, dados: movto })
  } catch (err) { next(err) }
}

module.exports = { listar, buscarPorId, criar, atualizar, registrarMovimento }

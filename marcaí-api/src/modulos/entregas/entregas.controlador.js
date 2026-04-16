const entregasServico = require('./entregas.servico')

const listar = async (req, res, next) => {
  try {
    const dados = await entregasServico.listarPedidos(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) { next(erro) }
}

const atualizarStatus = async (req, res, next) => {
  try {
    const dados = await entregasServico.atualizarStatus(req.usuario.tenantId, req.params.id, req.body.status)
    res.json({ sucesso: true, dados })
  } catch (erro) { next(erro) }
}

module.exports = { listar, atualizarStatus }

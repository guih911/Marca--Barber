const servicosServico = require('./servicos.servico')

const listar = async (req, res, next) => {
  try {
    const servicos = await servicosServico.listar(req.usuario.tenantId)
    res.json({ sucesso: true, dados: servicos })
  } catch (erro) {
    next(erro)
  }
}

const criar = async (req, res, next) => {
  try {
    const servico = await servicosServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados: servico })
  } catch (erro) {
    next(erro)
  }
}

const atualizar = async (req, res, next) => {
  try {
    const servico = await servicosServico.atualizar(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados: servico })
  } catch (erro) {
    next(erro)
  }
}

const remover = async (req, res, next) => {
  try {
    await servicosServico.remover(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: { mensagem: 'Serviço removido com sucesso' } })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { listar, criar, atualizar, remover }

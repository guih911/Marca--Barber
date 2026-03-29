const tenantServico = require('./tenant.servico')

const buscarMeu = async (req, res, next) => {
  try {
    const tenant = await tenantServico.buscarMeu(req.usuario.tenantId)
    res.json({ sucesso: true, dados: tenant })
  } catch (erro) {
    next(erro)
  }
}

const atualizar = async (req, res, next) => {
  try {
    const tenant = await tenantServico.atualizar(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: tenant })
  } catch (erro) {
    next(erro)
  }
}

const atualizarConfiguracaoIA = async (req, res, next) => {
  try {
    const tenant = await tenantServico.atualizarConfiguracaoIA(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: tenant })
  } catch (erro) {
    next(erro)
  }
}

const listarUsuarios = async (req, res, next) => {
  try {
    const usuarios = await tenantServico.listarUsuarios(req.usuario.tenantId)
    res.json({ sucesso: true, dados: usuarios })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { buscarMeu, atualizar, atualizarConfiguracaoIA, listarUsuarios }

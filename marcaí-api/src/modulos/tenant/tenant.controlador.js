const tenantServico = require('./tenant.servico')
const banco = require('../../config/banco')

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

const sugerirMensagemConfigDon = async (req, res, next) => {
  try {
    const resultado = await tenantServico.sugerirMensagemConfigDon(req.usuario.tenantId, req.body.campo)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) throw { status: 400, mensagem: 'Nenhum arquivo enviado', codigo: 'SEM_ARQUIVO' }

    const logoUrl = `/uploads/logos/${req.file.filename}`
    const atualizado = await banco.tenant.update({
      where: { id: req.usuario.tenantId },
      data: { logoUrl },
    })

    res.json({ sucesso: true, dados: { logoUrl: atualizado.logoUrl } })
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

module.exports = { buscarMeu, atualizar, atualizarConfiguracaoIA, sugerirMensagemConfigDon, uploadLogo, listarUsuarios }

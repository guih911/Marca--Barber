const path = require('path')
const profissionaisServico = require('./profissionais.servico')
const banco = require('../../config/banco')

const listar = async (req, res, next) => {
  try {
    const profissionais = await profissionaisServico.listar(req.usuario.tenantId)
    res.json({ sucesso: true, dados: profissionais })
  } catch (erro) {
    next(erro)
  }
}

const buscarPorId = async (req, res, next) => {
  try {
    const profissional = await profissionaisServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: profissional })
  } catch (erro) {
    next(erro)
  }
}

const criar = async (req, res, next) => {
  try {
    const profissional = await profissionaisServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados: profissional })
  } catch (erro) {
    next(erro)
  }
}

const atualizar = async (req, res, next) => {
  try {
    const profissional = await profissionaisServico.atualizar(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados: profissional })
  } catch (erro) {
    next(erro)
  }
}

const remover = async (req, res, next) => {
  try {
    await profissionaisServico.remover(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: { mensagem: 'Profissional removido com sucesso' } })
  } catch (erro) {
    next(erro)
  }
}

const atualizarServicos = async (req, res, next) => {
  try {
    const profissional = await profissionaisServico.atualizarServicos(
      req.usuario.tenantId,
      req.params.id,
      req.body.servicos
    )
    res.json({ sucesso: true, dados: profissional })
  } catch (erro) {
    next(erro)
  }
}

const registrarAusencia = async (req, res, next) => {
  try {
    const resultado = await profissionaisServico.registrarAusencia(
      req.usuario.tenantId,
      req.params.id,
      req.body.data,
      req.body.motivo
    )
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw { status: 400, mensagem: 'Nenhum arquivo enviado', codigo: 'SEM_ARQUIVO' }
    const profissional = await banco.profissional.findFirst({
      where: { id: req.params.id, tenantId: req.usuario.tenantId },
    })
    if (!profissional) throw { status: 404, mensagem: 'Profissional não encontrado', codigo: 'NAO_ENCONTRADO' }

    // URL relativa ao servidor
    const avatarUrl = `/uploads/avatares/${req.file.filename}`
    const atualizado = await banco.profissional.update({
      where: { id: req.params.id },
      data: { avatarUrl },
    })
    res.json({ sucesso: true, dados: { avatarUrl: atualizado.avatarUrl } })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, atualizarServicos, registrarAusencia, uploadAvatar }

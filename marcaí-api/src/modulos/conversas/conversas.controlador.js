const conversasServico = require('./conversas.servico')

const listar = async (req, res, next) => {
  try {
    const conversas = await conversasServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados: conversas })
  } catch (erro) {
    next(erro)
  }
}

const abrirPorCliente = async (req, res, next) => {
  try {
    const conversa = await conversasServico.abrirPorCliente(req.usuario.tenantId, req.params.clienteId)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const buscarPorId = async (req, res, next) => {
  try {
    const conversa = await conversasServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const enviarMensagem = async (req, res, next) => {
  try {
    const mensagem = await conversasServico.enviarMensagem(
      req.usuario.tenantId,
      req.params.id,
      req.usuario.id,
      req.body.conteudo
    )
    res.status(201).json({ sucesso: true, dados: mensagem })
  } catch (erro) {
    next(erro)
  }
}

const assumir = async (req, res, next) => {
  try {
    const conversa = await conversasServico.assumir(req.usuario.tenantId, req.params.id, req.usuario.id)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const devolver = async (req, res, next) => {
  try {
    const conversa = await conversasServico.devolver(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const encerrar = async (req, res, next) => {
  try {
    const conversa = await conversasServico.encerrar(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const reabrir = async (req, res, next) => {
  try {
    const conversa = await conversasServico.reabrir(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: conversa })
  } catch (erro) {
    next(erro)
  }
}

const adicionarNota = async (req, res, next) => {
  try {
    const nota = await conversasServico.adicionarNota(
      req.usuario.tenantId,
      req.params.id,
      req.usuario.id,
      req.body.conteudo
    )
    res.status(201).json({ sucesso: true, dados: nota })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { listar, abrirPorCliente, buscarPorId, enviarMensagem, assumir, devolver, encerrar, reabrir, adicionarNota }

const planosServico = require('./planos.servico')

const meu = async (req, res, next) => {
  try {
    const dados = await planosServico.buscarMeu(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const atualizarMeu = async (req, res, next) => {
  try {
    const dados = await planosServico.atualizarMeu(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const listarPlanos = async (req, res, next) => {
  try {
    const dados = await planosServico.listarPlanos(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const criarPlano = async (req, res, next) => {
  try {
    const dados = await planosServico.criarPlano(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const atualizarPlano = async (req, res, next) => {
  try {
    const dados = await planosServico.atualizarPlano(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const removerPlano = async (req, res, next) => {
  try {
    const dados = await planosServico.removerPlano(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const listarAssinaturas = async (req, res, next) => {
  try {
    const dados = await planosServico.listarAssinaturas(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const criarAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.criarAssinatura(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const atualizarAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.atualizarAssinatura(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const pausarAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.pausarAssinatura(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const retomarAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.retomarAssinatura(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const cancelarAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.cancelarAssinatura(req.usuario.tenantId, req.params.id, req.body.observacoes)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const registrarPagamentoAssinatura = async (req, res, next) => {
  try {
    const dados = await planosServico.registrarPagamentoAssinatura(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const simularGrowth = async (req, res, next) => {
  try {
    const dados = await planosServico.simularTargetGrowth(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const listarCampanhasGrowth = async (req, res, next) => {
  try {
    const dados = await planosServico.listarCampanhasGrowth(req.usuario.tenantId)
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const criarCampanhaGrowth = async (req, res, next) => {
  try {
    const dados = await planosServico.criarCampanhaGrowth(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

const dispararCampanhaGrowth = async (req, res, next) => {
  try {
    const dados = await planosServico.dispararCampanhaGrowth(req.usuario.tenantId, {
      ...req.body,
      campanhaGrowthId: req.params.id || req.body.campanhaGrowthId,
    })
    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

module.exports = {
  meu,
  atualizarMeu,
  listarPlanos,
  criarPlano,
  atualizarPlano,
  removerPlano,
  listarAssinaturas,
  criarAssinatura,
  atualizarAssinatura,
  pausarAssinatura,
  retomarAssinatura,
  cancelarAssinatura,
  registrarPagamentoAssinatura,
  simularGrowth,
  listarCampanhasGrowth,
  criarCampanhaGrowth,
  dispararCampanhaGrowth,
}

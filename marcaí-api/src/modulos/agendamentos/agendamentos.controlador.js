const agendamentosServico = require('./agendamentos.servico')
const disponibilidadeServico = require('./disponibilidade.servico')

const listar = async (req, res, next) => {
  try {
    const resultado = await agendamentosServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, ...resultado })
  } catch (erro) {
    next(erro)
  }
}

const buscarPorId = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const criar = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.criar(req.usuario.tenantId, req.body)
    res.status(201).json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const confirmar = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.confirmar(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const confirmarPresenca = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.confirmarPresenca(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const cancelar = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.cancelar(req.usuario.tenantId, req.params.id, req.body.motivo)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const remarcar = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.remarcar(req.usuario.tenantId, req.params.id, req.body.novoInicio)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const concluir = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.concluir(req.usuario.tenantId, req.params.id, req.body.formaPagamento)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const naoCompareceu = async (req, res, next) => {
  try {
    const ag = await agendamentosServico.naoCompareceu(req.usuario.tenantId, req.params.id, req.body.mensagemWhatsApp)
    res.json({ sucesso: true, dados: ag })
  } catch (erro) {
    next(erro)
  }
}

const disponibilidade = async (req, res, next) => {
  try {
    const slots = await disponibilidadeServico.verificarDisponibilidade(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados: slots })
  } catch (erro) {
    next(erro)
  }
}

const cancelarPeriodo = async (req, res, next) => {
  try {
    const resultado = await agendamentosServico.cancelarPeriodo(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const gerarMensagemCancelamento = async (req, res, next) => {
  try {
    const resultado = await agendamentosServico.gerarMensagemCancelamento(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const enviarPromocao = async (req, res, next) => {
  try {
    const resultado = await agendamentosServico.enviarPromocao(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { listar, buscarPorId, criar, confirmar, confirmarPresenca, cancelar, remarcar, concluir, naoCompareceu, disponibilidade, cancelarPeriodo, enviarPromocao, gerarMensagemCancelamento }

const caixaServico = require('./caixa.servico')

const obterAtual = async (req, res, next) => {
  try {
    const sessao = await caixaServico.obterSessaoAtual(req.usuario.tenantId)
    if (!sessao) return res.json({ sucesso: true, dados: null })
    const resumo = await caixaServico.obterResumoSessao(req.usuario.tenantId, sessao.id)
    res.json({ sucesso: true, dados: resumo })
  } catch (erro) { next(erro) }
}

const listar = async (req, res, next) => {
  try {
    const sessoes = await caixaServico.listarSessoes(req.usuario.tenantId, req.query.limite)
    res.json({ sucesso: true, dados: sessoes })
  } catch (erro) { next(erro) }
}

const abrir = async (req, res, next) => {
  try {
    const sessao = await caixaServico.abrirSessao(req.usuario.tenantId, req.usuario.id, req.body)
    res.status(201).json({ sucesso: true, dados: sessao })
  } catch (erro) { next(erro) }
}

const fechar = async (req, res, next) => {
  try {
    const sessao = await caixaServico.fecharSessao(req.usuario.tenantId, req.body)
    res.json({ sucesso: true, dados: sessao })
  } catch (erro) { next(erro) }
}

const obterResumoPorId = async (req, res, next) => {
  try {
    const resumo = await caixaServico.obterResumoSessao(req.usuario.tenantId, req.params.id)
    if (!resumo) return res.status(404).json({ sucesso: false, erro: { mensagem: 'Sessão não encontrada' } })
    res.json({ sucesso: true, dados: resumo })
  } catch (erro) { next(erro) }
}

const registrarMovimentacao = async (req, res, next) => {
  try {
    const { tipo, valor, descricao } = req.body
    // Usa != null (cobre undefined e null) para evitar falso negativo com valor "0"
    const valorCentavos = (valor != null && valor !== '') ? Math.round(parseFloat(String(valor).replace(',', '.')) * 100) : 0
    const mov = await caixaServico.registrarMovimentacao(req.usuario.tenantId, {
      tipo,
      valor: valorCentavos,
      descricao,
    })
    res.json({ sucesso: true, dados: mov })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { obterAtual, listar, abrir, fechar, obterResumoPorId, registrarMovimentacao }

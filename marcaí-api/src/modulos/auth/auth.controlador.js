const authServico = require('./auth.servico')

const obterFrontendOAuthUrl = () => {
  const origem =
    process.env.OAUTH_REDIRECT_URL ||
    process.env.APP_URL ||
    String(process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')[0]
      .trim()

  return `${origem.replace(/\/$/, '')}/oauth`
}

const cadastrar = async (req, res, next) => {
  try {
    const { nome, email, senha } = req.body
    const resultado = await authServico.cadastrar({ nome, email, senha })
    res.status(201).json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const login = async (req, res, next) => {
  try {
    const { email, senha } = req.body
    const resultado = await authServico.login({ email, senha })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const resultado = await authServico.renovarToken({ refreshToken })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const meuPerfil = async (req, res, next) => {
  try {
    const resultado = await authServico.buscarMeuPerfil({
      usuarioId: req.usuario.id,
      tenantId: req.usuario.tenantId,
    })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const googleCallback = (req, res) => {
  const { accessToken, refreshToken } = req.user
  const params = new URLSearchParams({
    accessToken,
    refreshToken,
  })
  res.redirect(`${obterFrontendOAuthUrl()}?${params}`)
}

const facebookCallback = (req, res) => {
  const { accessToken, refreshToken } = req.user
  const params = new URLSearchParams({
    accessToken,
    refreshToken,
  })
  res.redirect(`${obterFrontendOAuthUrl()}?${params}`)
}

const recuperarSenha = async (req, res, next) => {
  try {
    const { email } = req.body
    const resultado = await authServico.recuperarSenha({ email })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const redefinirSenha = async (req, res, next) => {
  try {
    const { token, novaSenha } = req.body
    const resultado = await authServico.redefinirSenha({ token, novaSenha })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { cadastrar, login, refresh, meuPerfil, googleCallback, facebookCallback, recuperarSenha, redefinirSenha }

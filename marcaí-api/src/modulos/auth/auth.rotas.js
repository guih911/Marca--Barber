const { Router } = require('express')
const { body } = require('express-validator')
const passport = require('passport')
const { google, facebook } = require('../../config/auth')
const { autenticar } = require('../../middlewares/autenticacao')
const authControlador = require('./auth.controlador')
const authServico = require('./auth.servico')
const { validar } = require('../../middlewares/validacao')

const router = Router()
const oauthIndisponivel = (_req, res) => {
  res.status(503).json({
    sucesso: false,
    erro: { mensagem: 'Login social não configurado no servidor.', codigo: 'OAUTH_NAO_CONFIGURADO' },
  })
}

// Configura estratégia Google OAuth somente se as credenciais estiverem presentes
if (google.clientID && google.clientSecret) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: google.clientID,
        clientSecret: google.clientSecret,
        callbackURL: google.callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const resultado = await authServico.loginOuCadastrarGoogle({
            googleId: profile.id,
            email: profile.emails[0].value,
            nome: profile.displayName,
            avatarUrl: profile.photos[0]?.value,
          })
          done(null, resultado)
        } catch (erro) {
          done(erro, null)
        }
      }
    )
  )
}

if (facebook.appID && facebook.appSecret) {
  const FacebookStrategy = require('passport-facebook').Strategy
  passport.use(
    new FacebookStrategy(
      {
        clientID: facebook.appID,
        clientSecret: facebook.appSecret,
        callbackURL: facebook.callbackURL,
        profileFields: ['id', 'displayName', 'photos', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const resultado = await authServico.loginOuCadastrarFacebook({
            facebookId: profile.id,
            email: profile.emails?.[0]?.value || null,
            nome: profile.displayName || 'Usuário Facebook',
            avatarUrl: profile.photos?.[0]?.value || null,
          })
          done(null, resultado)
        } catch (erro) {
          done(erro, null)
        }
      }
    )
  )
}

// POST /api/auth/cadastro
router.post(
  '/cadastro',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('senha').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  ],
  validar,
  authControlador.cadastrar
)

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('senha').notEmpty().withMessage('Senha é obrigatória'),
  ],
  validar,
  authControlador.login
)

// POST /api/auth/refresh
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token é obrigatório')],
  validar,
  authControlador.refresh
)

router.get('/me', autenticar, authControlador.meuPerfil)

if (google.clientID && google.clientSecret) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    authControlador.googleCallback
  )
} else {
  router.get('/google', oauthIndisponivel)
  router.get('/google/callback', oauthIndisponivel)
}

if (facebook.appID && facebook.appSecret) {
  router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }))
  router.get(
    '/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
    authControlador.facebookCallback
  )
} else {
  router.get('/facebook', oauthIndisponivel)
  router.get('/facebook/callback', oauthIndisponivel)
}

// POST /api/auth/recuperar-senha
router.post(
  '/recuperar-senha',
  [body('email').isEmail().withMessage('E-mail inválido').normalizeEmail()],
  validar,
  authControlador.recuperarSenha
)

// POST /api/auth/redefinir-senha
router.post(
  '/redefinir-senha',
  [
    body('token').notEmpty().withMessage('Token é obrigatório'),
    body('novaSenha').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
  ],
  validar,
  authControlador.redefinirSenha
)

module.exports = router

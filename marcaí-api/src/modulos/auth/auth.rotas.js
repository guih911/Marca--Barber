const { Router } = require('express')
const { body } = require('express-validator')
const passport = require('passport')
const { google } = require('../../config/auth')
const { autenticar } = require('../../middlewares/autenticacao')
const authControlador = require('./auth.controlador')
const authServico = require('./auth.servico')
const { validar } = require('../../middlewares/validacao')

const router = Router()

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

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authControlador.googleCallback
)

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

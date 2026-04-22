require('dotenv').config()
const crypto = require('crypto')

// Em produção, JWT secrets são OBRIGATÓRIOS
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('❌ JWT_SECRET é obrigatório em produção. Configure no .env')
}
if (isProduction && !process.env.JWT_REFRESH_SECRET) {
  throw new Error('❌ JWT_REFRESH_SECRET é obrigatório em produção. Configure no .env')
}

const gerarSegredoEphemero = (nomeVariavel) => {
  const segredo = crypto.randomBytes(48).toString('hex')
  console.warn(`[Auth] ${nomeVariavel} não configurado. Usando segredo efêmero apenas para desenvolvimento.`)
  return segredo
}

const jwtSecret = process.env.JWT_SECRET || gerarSegredoEphemero('JWT_SECRET')
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || gerarSegredoEphemero('JWT_REFRESH_SECRET')

module.exports = {
  jwtSecret,
  jwtRefreshSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },

  facebook: {
    appID: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/api/auth/facebook/callback',
  },

  bcryptSaltRounds: 10,
}

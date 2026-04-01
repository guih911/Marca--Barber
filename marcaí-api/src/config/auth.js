require('dotenv').config()

// Em produção, JWT secrets são OBRIGATÓRIOS
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('❌ JWT_SECRET é obrigatório em produção. Configure no .env')
}
if (isProduction && !process.env.JWT_REFRESH_SECRET) {
  throw new Error('❌ JWT_REFRESH_SECRET é obrigatório em produção. Configure no .env')
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'chave_secreta_desenvolvimento_NAO_USAR_EM_PROD',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'chave_refresh_desenvolvimento_NAO_USAR_EM_PROD',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },

  bcryptSaltRounds: 10,
}

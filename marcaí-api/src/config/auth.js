require('dotenv').config()

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'chave_secreta_desenvolvimento',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'chave_refresh_desenvolvimento',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },

  bcryptSaltRounds: 10,
}

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.ADMIN_JWT_SECRET
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET
const ALLOWED_ORIGINS = (process.env.ADMIN_CORS_ORIGINS || 'http://localhost:5174')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

if (!JWT_SECRET) {
  throw new Error('[Admin API] ADMIN_JWT_SECRET é obrigatório.')
}

module.exports = {
  PORT,
  JWT_SECRET,
  MAIN_JWT_SECRET,
  ALLOWED_ORIGINS,
}

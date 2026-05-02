const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../core/env')

const OWNER_EMAILS = (process.env.ADMIN_OWNER_EMAILS || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

const resolverPapel = (admin) => {
  if (!admin?.email) return 'ANALISTA'
  if (OWNER_EMAILS.includes(String(admin.email).toLowerCase())) return 'OWNER'
  return 'ANALISTA'
}

const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Token ausente' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.admin = {
      ...payload,
      papel: payload.papel || resolverPapel(payload),
    }
    return next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido' })
  }
}

const exigirPapel = (...papeis) => (req, res, next) => {
  if (!req.admin) return res.status(401).json({ erro: 'Não autenticado' })
  if (!papeis.includes(req.admin.papel)) {
    return res.status(403).json({ erro: 'Sem permissão para esta ação' })
  }
  return next()
}

module.exports = {
  autenticar,
  exigirPapel,
  resolverPapel,
}

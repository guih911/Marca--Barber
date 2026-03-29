const jwt = require('jsonwebtoken')
const { jwtSecret } = require('../config/auth')

// Middleware que verifica o Bearer token JWT e injeta req.usuario
const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      sucesso: false,
      erro: { mensagem: 'Token de autenticação não fornecido', codigo: 'TOKEN_AUSENTE' },
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, jwtSecret)
    req.usuario = {
      id: payload.id,
      email: payload.email,
      tenantId: payload.tenantId,
      perfil: payload.perfil,
    }
    next()
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return res.status(401).json({
        sucesso: false,
        erro: { mensagem: 'Token expirado', codigo: 'TOKEN_EXPIRADO' },
      })
    }
    return res.status(401).json({
      sucesso: false,
      erro: { mensagem: 'Token inválido', codigo: 'TOKEN_INVALIDO' },
    })
  }
}

// Middleware que exige perfil de Admin
const exigirAdmin = (req, res, next) => {
  if (req.usuario.perfil !== 'ADMIN') {
    return res.status(403).json({
      sucesso: false,
      erro: { mensagem: 'Acesso negado. Requer perfil Admin.', codigo: 'ACESSO_NEGADO' },
    })
  }
  next()
}

module.exports = { autenticar, exigirAdmin }

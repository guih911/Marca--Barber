const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { db } = require('../../core/db')
const { JWT_SECRET } = require('../../core/env')
const { autenticar, resolverPapel } = require('../../middlewares/auth')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {}
    const admin = await db.superAdmin.findUnique({ where: { email } })
    if (!admin || !admin.ativo) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(senha, admin.senhaHash)
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const papel = resolverPapel(admin)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, nome: admin.nome, papel },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    return res.json({
      token,
      admin: { id: admin.id, nome: admin.nome, email: admin.email, papel },
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/me', autenticar, async (req, res) => {
  try {
    const admin = await db.superAdmin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, nome: true, email: true, ativo: true },
    })
    if (!admin || !admin.ativo) return res.status(404).json({ erro: 'Admin não encontrado' })
    return res.json({ ...admin, papel: req.admin.papel })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { authRoutes: router }

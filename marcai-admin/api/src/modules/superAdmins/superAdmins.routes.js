const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../../core/db')
const { exigirPapel } = require('../../middlewares/auth')

const router = express.Router()

router.get('/superadmins', async (_req, res) => {
  try {
    const admins = await db.superAdmin.findMany({
      select: { id: true, nome: true, email: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    })
    return res.json(admins)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/superadmins', exigirPapel('OWNER'), async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {}
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'nome, email e senha são obrigatórios' })
    }
    const senhaHash = await bcrypt.hash(senha, 10)
    const admin = await db.superAdmin.create({ data: { nome, email, senhaHash } })
    return res.status(201).json({ id: admin.id, nome: admin.nome, email: admin.email })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Email já cadastrado' })
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { superAdminsRoutes: router }

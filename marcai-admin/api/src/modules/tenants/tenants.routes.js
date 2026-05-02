const express = require('express')
const jwt = require('jsonwebtoken')
const { db } = require('../../core/db')
const { MAIN_JWT_SECRET } = require('../../core/env')
const { obterPaginacao } = require('../../utils/http')

const router = express.Router()

router.get('/tenants', async (req, res) => {
  try {
    const { busca } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)
    const where = busca
      ? {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { slug: { contains: busca, mode: 'insensitive' } },
          ],
        }
      : {}

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        select: {
          id: true,
          nome: true,
          slug: true,
          planoContratado: true,
          cicloCobranca: true,
          ativo: true,
          onboardingCompleto: true,
          telefone: true,
          endereco: true,
          criadoEm: true,
          atualizadoEm: true,
          _count: { select: { usuarios: true, clientes: true, agendamentos: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limite,
      }),
      db.tenant.count({ where }),
    ])

    return res.json({ tenants, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/tenants/:id', async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        usuarios: { select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true } },
        _count: { select: { clientes: true, agendamentos: true, servicos: true, profissionais: true } },
      },
    })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })
    return res.json(tenant)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.patch('/tenants/:id', async (req, res) => {
  try {
    const { ativo, planoContratado, planoTenant } = req.body || {}
    const data = {}
    if (ativo !== undefined) data.ativo = Boolean(ativo)
    if (planoContratado) data.planoContratado = planoContratado
    if (planoTenant) data.planoTenant = planoTenant
    const tenant = await db.tenant.update({ where: { id: req.params.id }, data })
    return res.json(tenant)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/tenants/:id/usuarios', async (req, res) => {
  try {
    const usuarios = await db.usuario.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    })
    return res.json(usuarios)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/tenants/:id/clientes', async (req, res) => {
  try {
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)
    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where: { tenantId: req.params.id },
        select: { id: true, nome: true, telefone: true, email: true, ativo: true, criadoEm: true },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limite,
      }),
      db.cliente.count({ where: { tenantId: req.params.id } }),
    ])
    return res.json({ clientes, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/tenants/:id/agendamentos', async (req, res) => {
  try {
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)
    const [agendamentos, total] = await Promise.all([
      db.agendamento.findMany({
        where: { tenantId: req.params.id },
        include: {
          cliente: { select: { nome: true } },
          servico: { select: { nome: true, precoCentavos: true } },
          profissional: { select: { nome: true } },
        },
        orderBy: { inicioEm: 'desc' },
        skip,
        take: limite,
      }),
      db.agendamento.count({ where: { tenantId: req.params.id } }),
    ])
    return res.json({ agendamentos, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/impersonar/:tenantId', async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: req.params.tenantId } })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })

    const usuario = await db.usuario.findFirst({
      where: { tenantId: tenant.id, perfil: 'ADMIN', ativo: true },
    })
    if (!usuario) return res.status(404).json({ erro: 'Nenhum admin encontrado neste tenant' })
    if (!MAIN_JWT_SECRET) return res.status(500).json({ erro: 'MAIN_JWT_SECRET não configurado' })

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, tenantId: tenant.id, perfil: usuario.perfil },
      MAIN_JWT_SECRET,
      { expiresIn: '1h' }
    )

    return res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      tenant: { id: tenant.id, nome: tenant.nome, slug: tenant.slug },
      url: 'https://barber.marcaí.com/dashboard',
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { tenantsRoutes: router }

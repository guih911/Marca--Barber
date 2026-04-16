const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const os = require('os')
const { execSync } = require('child_process')

const db = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'marcai-admin-secret-change-me'
const ALLOWED_ORIGINS = (process.env.ADMIN_CORS_ORIGINS || 'http://localhost:5174').split(',')

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

// ─── Auth Middleware ─────────────────────────────────────────────────────────
const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Token ausente' })
  try {
    req.admin = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    const admin = await db.superAdmin.findUnique({ where: { email } })
    if (!admin || !admin.ativo) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(senha, admin.senhaHash)
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '12h' })
    res.json({ token, admin: { id: admin.id, nome: admin.nome, email: admin.email } })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/api/admin/dashboard', autenticar, async (req, res) => {
  try {
    const precos = { SOLO: 55.90, SALAO: 139.90 }
    const descontos = { MENSAL: 0, SEMESTRAL: 0.10, ANUAL: 0.20 }

    const allTenants = await db.tenant.findMany({
      select: {
        id: true, nome: true, planoContratado: true, cicloCobranca: true,
        ativo: true, onboardingCompleto: true, criadoEm: true,
      },
    })

    const ativos = allTenants.filter(t => t.ativo)
    const comPlano = ativos.filter(t => t.planoContratado && precos[t.planoContratado])
    const onboardingPendente = ativos.filter(t => !t.onboardingCompleto)

    // MRR
    const mrr = comPlano.reduce((acc, t) => {
      const base = precos[t.planoContratado] || 0
      const desc = descontos[t.cicloCobranca] || 0
      return acc + (base * (1 - desc))
    }, 0)

    // Distribuição por plano
    const planoSolo = comPlano.filter(t => t.planoContratado === 'SOLO').length
    const planoSalao = comPlano.filter(t => t.planoContratado === 'SALAO').length

    // Distribuição por ciclo
    const cicloMensal = comPlano.filter(t => !t.cicloCobranca || t.cicloCobranca === 'MENSAL').length
    const cicloSemestral = comPlano.filter(t => t.cicloCobranca === 'SEMESTRAL').length
    const cicloAnual = comPlano.filter(t => t.cicloCobranca === 'ANUAL').length

    // Novos últimos 7 e 30 dias
    const agora = Date.now()
    const novos7d = allTenants.filter(t => agora - new Date(t.criadoEm).getTime() < 7 * 86400000).length
    const novos30d = allTenants.filter(t => agora - new Date(t.criadoEm).getTime() < 30 * 86400000).length

    // ARR
    const arr = mrr * 12

    // Últimos tenants cadastrados
    const ultimosTenants = allTenants
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      .slice(0, 5)
      .map(t => ({ id: t.id, nome: t.nome, plano: t.planoContratado, ciclo: t.cicloCobranca, ativo: t.ativo, criadoEm: t.criadoEm }))

    res.json({
      totalTenants: allTenants.length,
      tenantsAtivos: ativos.length,
      onboardingPendente: onboardingPendente.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      planos: { solo: planoSolo, salao: planoSalao },
      ciclos: { mensal: cicloMensal, semestral: cicloSemestral, anual: cicloAnual },
      novos7d,
      novos30d,
      ultimosTenants,
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Tenants ─────────────────────────────────────────────────────────────────
app.get('/api/admin/tenants', autenticar, async (req, res) => {
  try {
    const { busca, pagina = 1, limite = 20 } = req.query
    const where = busca
      ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { slug: { contains: busca, mode: 'insensitive' } }] }
      : {}

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        select: {
          id: true, nome: true, slug: true, planoContratado: true, cicloCobranca: true,
          ativo: true, onboardingCompleto: true, telefone: true, endereco: true,
          criadoEm: true, atualizadoEm: true,
          _count: { select: { usuarios: true, clientes: true, agendamentos: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Number(limite),
      }),
      db.tenant.count({ where }),
    ])

    res.json({ tenants, total, pagina: Number(pagina), limite: Number(limite) })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.get('/api/admin/tenants/:id', autenticar, async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        usuarios: { select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true } },
        _count: { select: { clientes: true, agendamentos: true, servicos: true, profissionais: true } },
      },
    })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })
    res.json(tenant)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.patch('/api/admin/tenants/:id', autenticar, async (req, res) => {
  try {
    const { ativo, planoContratado, planoTenant } = req.body
    const data = {}
    if (ativo !== undefined) data.ativo = Boolean(ativo)
    if (planoContratado) data.planoContratado = planoContratado
    if (planoTenant) data.planoTenant = planoTenant

    const tenant = await db.tenant.update({ where: { id: req.params.id }, data })
    res.json(tenant)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Usuarios de um tenant ──────────────────────────────────────────────────
app.get('/api/admin/tenants/:id/usuarios', autenticar, async (req, res) => {
  try {
    const usuarios = await db.usuario.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    })
    res.json(usuarios)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Clientes de um tenant ──────────────────────────────────────────────────
app.get('/api/admin/tenants/:id/clientes', autenticar, async (req, res) => {
  try {
    const { pagina = 1, limite = 20 } = req.query
    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where: { tenantId: req.params.id },
        select: { id: true, nome: true, telefone: true, email: true, ativo: true, criadoEm: true },
        orderBy: { criadoEm: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Number(limite),
      }),
      db.cliente.count({ where: { tenantId: req.params.id } }),
    ])
    res.json({ clientes, total })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Agendamentos de um tenant ──────────────────────────────────────────────
app.get('/api/admin/tenants/:id/agendamentos', autenticar, async (req, res) => {
  try {
    const { pagina = 1, limite = 20 } = req.query
    const [agendamentos, total] = await Promise.all([
      db.agendamento.findMany({
        where: { tenantId: req.params.id },
        include: {
          cliente: { select: { nome: true } },
          servico: { select: { nome: true, precoCentavos: true } },
          profissional: { select: { nome: true } },
        },
        orderBy: { inicioEm: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Number(limite),
      }),
      db.agendamento.count({ where: { tenantId: req.params.id } }),
    ])
    res.json({ agendamentos, total })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Super Admins (CRUD) ────────────────────────────────────────────────────
app.get('/api/admin/superadmins', autenticar, async (req, res) => {
  try {
    const admins = await db.superAdmin.findMany({
      select: { id: true, nome: true, email: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    })
    res.json(admins)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.post('/api/admin/superadmins', autenticar, async (req, res) => {
  try {
    const { nome, email, senha } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'nome, email e senha são obrigatórios' })
    const senhaHash = await bcrypt.hash(senha, 10)
    const admin = await db.superAdmin.create({ data: { nome, email, senhaHash } })
    res.status(201).json({ id: admin.id, nome: admin.nome, email: admin.email })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Email já cadastrado' })
    res.status(500).json({ erro: err.message })
  }
})

// ─── Sistema / Servidor ─────────────────────────────────────────────────────
app.get('/api/admin/sistema', autenticar, async (req, res) => {
  try {
    const uptime = process.uptime()
    const mem = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    let containers = []
    try {
      const raw = execSync('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"', { timeout: 5000 }).toString()
      containers = raw.trim().split('\n').filter(Boolean).map(line => {
        const [nome, status, imagem] = line.split('|')
        return { nome, status, imagem }
      })
    } catch { /* docker não disponível */ }

    res.json({
      node: process.version,
      uptime: Math.floor(uptime),
      memoria: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      servidor: {
        totalMem: Math.round(totalMem / 1024 / 1024),
        freeMem: Math.round(freeMem / 1024 / 1024),
        cpus: os.cpus().length,
        platform: os.platform(),
        hostname: os.hostname(),
      },
      containers,
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Logs (últimos agendamentos/atividades) ─────────────────────────────────
app.get('/api/admin/logs', autenticar, async (req, res) => {
  try {
    const { limite = 50 } = req.query

    const [agendamentosRecentes, clientesRecentes, tenantsRecentes] = await Promise.all([
      db.agendamento.findMany({
        include: {
          cliente: { select: { nome: true } },
          servico: { select: { nome: true } },
          tenant: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: Number(limite),
      }),
      db.cliente.findMany({
        select: { id: true, nome: true, telefone: true, criadoEm: true, tenant: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
        take: 20,
      }),
      db.tenant.findMany({
        select: { id: true, nome: true, criadoEm: true, planoContratado: true },
        orderBy: { criadoEm: 'desc' },
        take: 10,
      }),
    ])

    res.json({ agendamentosRecentes, clientesRecentes, tenantsRecentes })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Impersonar tenant (gera JWT do sistema principal) ──────────────────────
app.post('/api/admin/impersonar/:tenantId', autenticar, async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: req.params.tenantId } })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })

    const usuario = await db.usuario.findFirst({
      where: { tenantId: tenant.id, perfil: 'ADMIN', ativo: true },
    })
    if (!usuario) return res.status(404).json({ erro: 'Nenhum admin encontrado neste tenant' })

    // Gera token do sistema principal (usa o JWT_SECRET do .env principal)
    const mainSecret = process.env.MAIN_JWT_SECRET
    if (!mainSecret) return res.status(500).json({ erro: 'MAIN_JWT_SECRET não configurado' })

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, tenantId: tenant.id, perfil: usuario.perfil },
      mainSecret,
      { expiresIn: '1h' }
    )

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      tenant: { id: tenant.id, nome: tenant.nome, slug: tenant.slug },
      url: `https://barber.xn--marca-3sa.com/dashboard`,
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Seed: cria primeiro superadmin se não existir ──────────────────────────
const seed = async () => {
  const count = await db.superAdmin.count()
  if (count === 0) {
    const senhaHash = await bcrypt.hash('admin123', 10)
    await db.superAdmin.create({
      data: { nome: 'Super Admin', email: 'admin@marcai.com', senhaHash },
    })
    console.log('[Admin] Super admin criado: admin@marcai.com / admin123')
  }
}

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await seed()
  console.log(`[Admin API] Rodando na porta ${PORT}`)
})

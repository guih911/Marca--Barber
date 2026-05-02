const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const os = require('os')
const fs = require('fs')
const path = require('path')
const http = require('http')

const db = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'marcai-admin-secret-change-me'
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET
const ALLOWED_ORIGINS = (process.env.ADMIN_CORS_ORIGINS || 'http://localhost:5174').split(',').map(s => s.trim())

const META_APP_ID = process.env.META_APP_ID || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''
const META_EMBEDDED_SIGNUP_CONFIG_ID = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || ''
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0'
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || ''
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || ''

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json({ limit: '2mb' }))

// ─── Config File Storage ─────────────────────────────────────────────────────
const DATA_DIR = '/app/data'
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')
const INBOX_FILE = path.join(DATA_DIR, 'inbox.json')

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

const lerConfig = () => {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch { return {} }
}
const salvarConfig = (data) => {
  ensureDataDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2))
}

const lerTemplates = () => {
  try { return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8')) } catch { return [] }
}
const salvarTemplates = (templates) => {
  ensureDataDir()
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2))
}

const lerInbox = () => {
  try { return JSON.parse(fs.readFileSync(INBOX_FILE, 'utf8')) } catch { return { conversas: {} } }
}
const salvarInbox = (data) => {
  ensureDataDir()
  fs.writeFileSync(INBOX_FILE, JSON.stringify(data, null, 2))
}

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ─── Helpers ─────────────────────────────────────────────────────────────────
const normalizarTelefone = (tel) => String(tel || '').replace(/\D/g, '')

const obterPaginacao = (query, defaultLimite = 20, maxLimite = 100) => {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1)
  const limite = Math.min(maxLimite, Math.max(1, parseInt(query.limite, 10) || defaultLimite))
  return { pagina, limite, skip: (pagina - 1) * limite }
}

const normalizarConfigMeta = (cfg) => {
  const c = cfg && typeof cfg === 'object' ? cfg : {}
  return {
    accessToken: c.token || c.accessToken || c.permanentToken || c.whatsappToken || null,
    phoneNumberId: c.phoneNumberId || c.numeroId || c.businessPhoneNumberId || null,
    graphVersion: c.graphVersion || 'v22.0',
  }
}

const enviarMensagemMeta = async ({ configWhatsApp, para, texto }) => {
  const { accessToken, phoneNumberId, graphVersion } = normalizarConfigMeta(configWhatsApp)
  if (!accessToken || !phoneNumberId) return { enviado: false, motivo: 'Meta não configurado' }
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: String(texto || '').slice(0, 4096) } }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Falha Meta (${res.status})`)
  return { enviado: true, provider: data }
}

const parseRemetenteHumano = (remetente) => {
  if (!String(remetente || '').startsWith('humano:')) return null
  const [, adminId, ...restante] = String(remetente).split(':')
  return { adminId: adminId || null, adminNome: restante.join(':') || 'Atendente' }
}

const obterOuCriarConversa = async (tenantId, clienteId) => {
  const existente = await db.conversa.findFirst({ where: { tenantId, clienteId, status: { not: 'ENCERRADA' } }, orderBy: { atualizadoEm: 'desc' } })
  if (existente) return existente
  return db.conversa.create({ data: { tenantId, clienteId, canal: 'WHATSAPP', status: 'ATIVA' } })
}

// ─── Docker via Unix Socket ───────────────────────────────────────────────────
const dockerRequest = (path) => new Promise((resolve) => {
  const options = { socketPath: '/var/run/docker.sock', path, method: 'GET', headers: { Host: 'localhost' } }
  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', d => data += d)
    res.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { resolve([]) }
    })
  })
  req.on('error', () => resolve([]))
  req.setTimeout(3000, () => { req.destroy(); resolve([]) })
  req.end()
})

// ─── Auth Middleware ─────────────────────────────────────────────────────────
const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ erro: 'Token ausente' })
  try { req.admin = jwt.verify(token, JWT_SECRET); next() }
  catch { res.status(401).json({ erro: 'Token inválido' }) }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    const admin = await db.superAdmin.findUnique({ where: { email } })
    if (!admin || !admin.ativo) return res.status(401).json({ erro: 'Credenciais inválidas' })
    if (!await bcrypt.compare(senha, admin.senhaHash)) return res.status(401).json({ erro: 'Credenciais inválidas' })
    const token = jwt.sign({ id: admin.id, email: admin.email, nome: admin.nome, papel: admin.papel || 'ADMIN' }, JWT_SECRET, { expiresIn: '12h' })
    res.json({ token, admin: { id: admin.id, nome: admin.nome, email: admin.email, papel: admin.papel || 'ADMIN' } })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/api/admin/dashboard', autenticar, async (_req, res) => {
  try {
    const precos = { SOLO: 55.90, SALAO: 139.90 }
    const descontos = { MENSAL: 0, SEMESTRAL: 0.10, ANUAL: 0.20 }
    const allTenants = await db.tenant.findMany({ select: { id: true, nome: true, planoContratado: true, cicloCobranca: true, ativo: true, onboardingCompleto: true, criadoEm: true } })
    const ativos = allTenants.filter(t => t.ativo)
    const comPlano = ativos.filter(t => t.planoContratado && precos[t.planoContratado])
    const mrr = comPlano.reduce((acc, t) => acc + (precos[t.planoContratado] || 0) * (1 - (descontos[t.cicloCobranca] || 0)), 0)
    const agora = Date.now()
    res.json({
      totalTenants: allTenants.length,
      tenantsAtivos: ativos.length,
      onboardingPendente: ativos.filter(t => !t.onboardingCompleto).length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      planos: { solo: comPlano.filter(t => t.planoContratado === 'SOLO').length, salao: comPlano.filter(t => t.planoContratado === 'SALAO').length },
      ciclos: { mensal: comPlano.filter(t => !t.cicloCobranca || t.cicloCobranca === 'MENSAL').length, semestral: comPlano.filter(t => t.cicloCobranca === 'SEMESTRAL').length, anual: comPlano.filter(t => t.cicloCobranca === 'ANUAL').length },
      novos7d: allTenants.filter(t => agora - new Date(t.criadoEm).getTime() < 7 * 86400000).length,
      novos30d: allTenants.filter(t => agora - new Date(t.criadoEm).getTime() < 30 * 86400000).length,
      ultimosTenants: allTenants.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)).slice(0, 5).map(t => ({ id: t.id, nome: t.nome, plano: t.planoContratado, ciclo: t.cicloCobranca, ativo: t.ativo, criadoEm: t.criadoEm })),
    })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Billing ─────────────────────────────────────────────────────────────────
app.get('/api/admin/billing/resumo', autenticar, async (_req, res) => {
  try {
    const precos = { SOLO: 55.90, SALAO: 139.90 }
    const descontos = { MENSAL: 0, SEMESTRAL: 0.10, ANUAL: 0.20 }
    const tenants = await db.tenant.findMany({ select: { id: true, ativo: true, planoContratado: true, cicloCobranca: true, criadoEm: true } })
    let mrr = 0, contratosAtivos = 0
    for (const t of tenants) {
      if (!t.ativo) continue
      const base = precos[t.planoContratado] || 0
      if (base > 0) { contratosAtivos++; mrr += base * (1 - (descontos[t.cicloCobranca] || 0)) }
    }
    const inativos = tenants.filter(t => !t.ativo).length
    res.json({ mrr: Number(mrr.toFixed(2)), arr: Number((mrr * 12).toFixed(2)), contratosAtivos, novosPagantes30d: tenants.filter(t => t.ativo && precos[t.planoContratado] && Date.now() - new Date(t.criadoEm).getTime() < 30 * 86400000).length, churnProxy: tenants.length ? Number(((inativos / tenants.length) * 100).toFixed(2)) : 0 })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Tenants ──────────────────────────────────────────────────────────────────
const lerStatusTenants = () => {
  const cfg = lerConfig()
  return cfg.tenantsStatus || {}
}
const salvarStatusTenant = (tenantId, dados) => {
  const cfg = lerConfig()
  cfg.tenantsStatus = cfg.tenantsStatus || {}
  cfg.tenantsStatus[tenantId] = { ...(cfg.tenantsStatus[tenantId] || {}), ...dados }
  salvarConfig(cfg)
}

const enrichTenant = (tenant, statusMap) => {
  const s = statusMap[tenant.id] || {}
  const trialExpira = s.trialExpira ? new Date(s.trialExpira) : null
  const emTrial = trialExpira ? trialExpira > new Date() : false
  return { ...tenant, adimplente: s.adimplente !== undefined ? s.adimplente : true, emTrial, trialExpira: trialExpira?.toISOString() || null }
}

app.get('/api/admin/tenants', autenticar, async (req, res) => {
  try {
    const { busca, ativo } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query)
    const where = {
      ...(busca ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { slug: { contains: busca, mode: 'insensitive' } }] } : {}),
      ...(ativo === 'true' ? { ativo: true } : ativo === 'false' ? { ativo: false } : {}),
    }
    const [tenants, total] = await Promise.all([
      db.tenant.findMany({ where, select: { id: true, nome: true, slug: true, planoContratado: true, cicloCobranca: true, ativo: true, onboardingCompleto: true, telefone: true, criadoEm: true, atualizadoEm: true }, orderBy: { criadoEm: 'desc' }, skip, take: limite }),
      db.tenant.count({ where }),
    ])
    const statusMap = lerStatusTenants()
    res.json({ tenants: tenants.map(t => enrichTenant(t, statusMap)), total, pagina, limite })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/tenants', autenticar, async (req, res) => {
  try {
    const { nome, telefone, planoContratado = 'SALAO', cicloCobranca = 'MENSAL', adminEmail, adminSenha, adminNome } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' })
    if (!adminEmail?.trim() || !adminSenha?.trim()) return res.status(400).json({ erro: 'Email e senha do admin são obrigatórios' })

    // Gerar slug único
    const slugBase = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let slug = slugBase
    let suffix = 0
    while (await db.tenant.findUnique({ where: { slug } })) { suffix++; slug = `${slugBase}-${suffix}` }

    const hashSenha = await bcrypt.hash(adminSenha, 10)
    const tenant = await db.$transaction(async (tx) => {
      const t = await tx.tenant.create({ data: { nome: nome.trim(), slug, telefone: telefone?.trim() || null, planoContratado, cicloCobranca, ativo: true } })
      await tx.usuario.create({ data: { tenantId: t.id, nome: (adminNome || nome).trim(), email: adminEmail.trim().toLowerCase(), senha: hashSenha, perfil: 'ADMIN', ativo: true } })
      return t
    })

    // Marcar trial de 7 dias
    const trialExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    salvarStatusTenant(tenant.id, { adimplente: true, emTrial: true, trialExpira })

    const statusMap = lerStatusTenants()
    res.status(201).json(enrichTenant(tenant, statusMap))
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Email de admin já cadastrado' })
    res.status(500).json({ erro: err.message })
  }
})

app.patch('/api/admin/tenants/:id/pagamento', autenticar, (req, res) => {
  try {
    const { adimplente } = req.body
    if (adimplente === undefined) return res.status(400).json({ erro: 'adimplente é obrigatório' })
    salvarStatusTenant(req.params.id, { adimplente: Boolean(adimplente) })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.get('/api/admin/tenants/:id', autenticar, async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: req.params.id }, include: { usuarios: { select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true } }, _count: { select: { servicos: true, profissionais: true } } } })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })
    res.json(enrichTenant(tenant, lerStatusTenants()))
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.patch('/api/admin/tenants/:id', autenticar, async (req, res) => {
  try {
    const { ativo, planoContratado, cicloCobranca } = req.body
    const data = {}
    if (ativo !== undefined) data.ativo = Boolean(ativo)
    if (planoContratado !== undefined) data.planoContratado = planoContratado
    if (cicloCobranca !== undefined) data.cicloCobranca = cicloCobranca
    res.json(await db.tenant.update({ where: { id: req.params.id }, data }))
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.delete('/api/admin/tenants/:id', autenticar, async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: req.params.id }, select: { id: true, nome: true, ativo: true } })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })
    if (tenant.ativo) return res.status(422).json({ erro: 'Desative o tenant antes de excluí-lo' })
    // Cascade delete via Prisma
    await db.tenant.delete({ where: { id: req.params.id } })
    res.json({ ok: true, mensagem: `Tenant "${tenant.nome}" excluído permanentemente` })
  } catch (err) {
    if (err.code === 'P2014' || err.code === 'P2003') return res.status(422).json({ erro: 'Não é possível excluir: tenant tem dados relacionados. Contate o suporte técnico.' })
    res.status(500).json({ erro: err.message })
  }
})

app.post('/api/admin/impersonar/:tenantId', autenticar, async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: req.params.tenantId } })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })
    const usuario = await db.usuario.findFirst({ where: { tenantId: tenant.id, perfil: 'ADMIN', ativo: true } })
    if (!usuario) return res.status(404).json({ erro: 'Nenhum admin encontrado neste tenant' })
    if (!MAIN_JWT_SECRET) return res.status(500).json({ erro: 'MAIN_JWT_SECRET não configurado' })
    const token = jwt.sign({ id: usuario.id, email: usuario.email, tenantId: tenant.id, perfil: usuario.perfil }, MAIN_JWT_SECRET, { expiresIn: '1h' })
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, tenant: { id: tenant.id, nome: tenant.nome, slug: tenant.slug }, url: 'https://barber.xn--marca-3sa.com/dashboard' })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Atendentes (Super Admins) ────────────────────────────────────────────────
app.get('/api/admin/superadmins', autenticar, async (_req, res) => {
  try {
    res.json(await db.superAdmin.findMany({ select: { id: true, nome: true, email: true, ativo: true, papel: true, criadoEm: true }, orderBy: { criadoEm: 'desc' } }))
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/superadmins', autenticar, async (req, res) => {
  try {
    const { nome, email, senha, papel = 'ATENDENTE' } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'nome, email e senha são obrigatórios' })
    const PAPEIS = ['OWNER', 'ADMIN', 'ATENDENTE']
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel inválido. Opções: ${PAPEIS.join(', ')}` })
    const senhaHash = await bcrypt.hash(senha, 10)
    const admin = await db.superAdmin.create({ data: { nome, email, senhaHash, papel } })
    res.status(201).json({ id: admin.id, nome: admin.nome, email: admin.email, papel: admin.papel })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Email já cadastrado' })
    res.status(500).json({ erro: err.message })
  }
})

app.patch('/api/admin/superadmins/:id', autenticar, async (req, res) => {
  try {
    const { ativo, papel } = req.body
    const data = {}
    if (ativo !== undefined) data.ativo = Boolean(ativo)
    if (papel) data.papel = papel
    res.json(await db.superAdmin.update({ where: { id: req.params.id }, data, select: { id: true, nome: true, email: true, ativo: true, papel: true } }))
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Integração Meta do Admin ─────────────────────────────────────────────────
app.get('/api/admin/config/meta', autenticar, (_req, res) => {
  const config = lerConfig()
  const meta = config.meta || {}
  res.json({ phoneNumberId: meta.phoneNumberId || '', accessToken: meta.accessToken ? '***configurado***' : '', graphVersion: meta.graphVersion || 'v22.0', configurado: Boolean(meta.accessToken && meta.phoneNumberId) })
})

app.put('/api/admin/config/meta', autenticar, (req, res) => {
  try {
    const { phoneNumberId, accessToken, graphVersion } = req.body
    if (!phoneNumberId || !accessToken) return res.status(400).json({ erro: 'phoneNumberId e accessToken são obrigatórios' })
    const config = lerConfig()
    config.meta = { phoneNumberId, accessToken, graphVersion: graphVersion || 'v22.0' }
    salvarConfig(config)
    res.json({ ok: true, mensagem: 'Integração Meta salva com sucesso' })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/config/meta/testar', autenticar, async (req, res) => {
  try {
    const { telefone } = req.body
    if (!telefone) return res.status(400).json({ erro: 'telefone é obrigatório' })
    const config = lerConfig()
    const meta = config.meta || {}
    if (!meta.accessToken || !meta.phoneNumberId) return res.status(422).json({ erro: 'Meta não configurado' })
    const envio = await enviarMensagemMeta({ configWhatsApp: meta, para: normalizarTelefone(telefone), texto: '✅ Teste de integração MarcaÍ Admin — conexão funcionando!' })
    res.json(envio)
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Templates de mensagem ────────────────────────────────────────────────────
app.get('/api/admin/templates', autenticar, (_req, res) => {
  res.json(lerTemplates())
})

app.post('/api/admin/templates', autenticar, (req, res) => {
  try {
    const { nome, conteudo, categoria = 'GERAL' } = req.body
    if (!nome || !conteudo) return res.status(400).json({ erro: 'nome e conteudo são obrigatórios' })
    const templates = lerTemplates()
    const template = { id: `tpl_${Date.now()}`, nome, conteudo, categoria, criadoEm: new Date().toISOString() }
    templates.push(template)
    salvarTemplates(templates)
    res.status(201).json(template)
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.delete('/api/admin/templates/:id', autenticar, (req, res) => {
  try {
    const templates = lerTemplates()
    const novo = templates.filter(t => t.id !== req.params.id)
    if (novo.length === templates.length) return res.status(404).json({ erro: 'Template não encontrado' })
    salvarTemplates(novo)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Lista tenants para disparo ───────────────────────────────────────────────
app.get('/api/admin/disparos/tenants', autenticar, async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({ where: { ativo: true }, select: { id: true, nome: true, slug: true, telefone: true, planoContratado: true }, orderBy: { nome: 'asc' } })
    res.json(tenants)
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Envio em massa (numeros diretos ou tenantIds) ────────────────────────────
app.post('/api/admin/mensagens/disparar', autenticar, async (req, res) => {
  try {
    const { numeros = [], tenantIds = [], texto, templateId } = req.body

    let textoFinal = texto
    if (templateId && !texto) {
      const template = lerTemplates().find(t => t.id === templateId)
      if (!template) return res.status(404).json({ erro: 'Template não encontrado' })
      textoFinal = template.corpo || template.conteudo
    }
    if (!textoFinal) return res.status(400).json({ erro: 'texto ou templateId é obrigatório' })

    const config = lerConfig()
    const metaAdmin = config.meta || {}
    if (!metaAdmin.accessToken || !metaAdmin.phoneNumberId) return res.status(422).json({ erro: 'Configure a integração Meta do admin (Integrações → Meta) antes de enviar' })

    // Montar lista de destinatários
    let destinatarios = []
    if (numeros.length > 0) {
      destinatarios = numeros.map(n => ({ telefone: normalizarTelefone(n.telefone || ''), nome: n.nome || null })).filter(n => n.telefone.length >= 8)
    } else if (tenantIds.length > 0) {
      const ts = await db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, nome: true, telefone: true } })
      destinatarios = ts.map(t => ({ telefone: normalizarTelefone(t.telefone || ''), nome: t.nome })).filter(n => n.telefone.length >= 8)
    }

    if (destinatarios.length === 0) return res.status(400).json({ erro: 'Nenhum destinatário válido' })

    const resultados = []
    for (const dest of destinatarios) {
      const mensagemFinal = textoFinal.replace(/\{nome\}/gi, dest.nome || 'Cliente').replace(/\{plano\}/gi, '').replace(/\{slug\}/gi, '')
      try {
        const envio = await enviarMensagemMeta({ configWhatsApp: metaAdmin, para: dest.telefone, texto: mensagemFinal })
        resultados.push({ telefone: dest.telefone, nome: dest.nome, enviado: true, ...envio })
      } catch (e) {
        resultados.push({ telefone: dest.telefone, nome: dest.nome, enviado: false, motivo: e.message })
      }
    }

    res.json({ total: resultados.length, enviados: resultados.filter(r => r.enviado).length, falhas: resultados.filter(r => !r.enviado).length, atendente: req.admin.nome, resultados })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Relatórios: admins ───────────────────────────────────────────────────────
app.get('/api/admin/relatorios/admins', autenticar, async (req, res) => {
  try {
    const { dias = 30 } = req.query
    const desde = new Date(Date.now() - Number(dias) * 86400000)
    const mensagens = await db.mensagem.findMany({ where: { remetente: { startsWith: 'humano:' }, criadoEm: { gte: desde } }, select: { id: true, remetente: true, conversaId: true } })
    const mapa = {}
    for (const msg of mensagens) {
      const parsed = parseRemetenteHumano(msg.remetente)
      if (!parsed) continue
      const chave = parsed.adminId || parsed.adminNome
      if (!mapa[chave]) mapa[chave] = { adminId: parsed.adminId, adminNome: parsed.adminNome, totalMensagens: 0, conversasSet: new Set() }
      mapa[chave].totalMensagens++
      mapa[chave].conversasSet.add(msg.conversaId)
    }
    const ranking = Object.values(mapa).map(a => ({ adminId: a.adminId, nome: a.adminNome, mensagens: a.totalMensagens, conversasAtendidas: a.conversasSet.size })).sort((a, b) => b.mensagens - a.mensagens)
    res.json({ periodo: Number(dias), ranking, totalMensagensHumanas: mensagens.length })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Relatórios: leads ────────────────────────────────────────────────────────
app.get('/api/admin/relatorios/leads', autenticar, async (req, res) => {
  try {
    const { dias = 30 } = req.query
    const desde = new Date(Date.now() - Number(dias) * 86400000)
    const where = { tags: { has: 'lead' } }
    const [todosLeads, novos30d] = await Promise.all([
      db.cliente.findMany({ where, select: { id: true, tags: true, nome: true, telefone: true, tenant: { select: { id: true, nome: true } }, _count: { select: { agendamentos: true } } } }),
      db.cliente.count({ where: { ...where, criadoEm: { gte: desde } } }),
    ])
    const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']
    const funil = Object.fromEntries(ESTAGIOS.map(e => [e, 0]))
    for (const lead of todosLeads) {
      const tag = (lead.tags || []).find(t => t.startsWith('estagio:'))
      const estagio = tag ? tag.split(':')[1] : 'NOVO'
      if (funil[estagio] !== undefined) funil[estagio]++
    }
    const totalGanho = funil.GANHO || 0
    res.json({ total: todosLeads.length, novos30d, totalGanho, taxaConversao: todosLeads.length > 0 ? Number(((totalGanho / todosLeads.length) * 100).toFixed(1)) : 0, topLeads: todosLeads.sort((a, b) => (b._count?.agendamentos || 0) - (a._count?.agendamentos || 0)).slice(0, 10).map(l => ({ id: l.id, nome: l.nome, telefone: l.telefone, agendamentos: l._count?.agendamentos || 0, tenant: l.tenant })) })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.get('/api/admin/relatorios/tenants', autenticar, async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({ where: { ativo: true }, select: { id: true, nome: true, planoContratado: true, _count: { select: { agendamentos: true, clientes: true } } }, orderBy: { agendamentos: { _count: 'desc' } }, take: 10 })
    res.json({ topTenants: tenants.map(t => ({ id: t.id, nome: t.nome, plano: t.planoContratado, agendamentos: t._count.agendamentos, clientes: t._count.clientes })) })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.get('/api/admin/relatorios/funil', autenticar, async (_req, res) => {
  try {
    const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']
    const leads = await db.cliente.findMany({ where: { tags: { has: 'lead' } }, select: { tags: true } })
    const contagem = Object.fromEntries(ESTAGIOS.map(e => [e, 0]))
    for (const lead of leads) {
      const tag = (lead.tags || []).find(t => t.startsWith('estagio:'))
      const estagio = tag ? tag.split(':')[1] : 'NOVO'
      if (contagem[estagio] !== undefined) contagem[estagio]++
    }
    res.json({ totalLeads: leads.length, conversaoGanho: leads.length > 0 ? Number(((contagem.GANHO / leads.length) * 100).toFixed(1)) : 0, estagios: ESTAGIOS.map(e => ({ estagio: e, total: contagem[e] })) })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Atendimento / Conversas ──────────────────────────────────────────────────
app.get('/api/admin/comercial/conversas', autenticar, async (req, res) => {
  try {
    const { tenantId, busca, modo = 'SUPORTE', mostrarIa = 'false' } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query)
    const apenasHumano = String(mostrarIa) !== 'true'
    const where = { ...(tenantId ? { tenantId: String(tenantId) } : {}), ...(modo === 'SUPORTE' ? { status: 'ESCALONADA' } : {}), ...(busca ? { cliente: { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { telefone: { contains: busca, mode: 'insensitive' } }] } } : {}) }
    const [conversas, total] = await Promise.all([
      db.conversa.findMany({ where, skip, take: limite, orderBy: { atualizadoEm: 'desc' }, include: { tenant: { select: { id: true, nome: true } }, cliente: { select: { id: true, nome: true, telefone: true } }, mensagens: { orderBy: { criadoEm: 'desc' }, take: 30, select: { id: true, remetente: true, conteudo: true, criadoEm: true } } } }),
      db.conversa.count({ where }),
    ])
    const itens = conversas.map(conv => {
      const filtradas = apenasHumano ? conv.mensagens.filter(m => String(m.remetente).startsWith('humano:') || m.remetente === 'cliente') : conv.mensagens
      const ultimaHumana = conv.mensagens.find(m => String(m.remetente).startsWith('humano:'))
      const parser = ultimaHumana ? parseRemetenteHumano(ultimaHumana.remetente) : null
      return { ...conv, mensagens: filtradas.reverse(), ultimaRespostaHumana: ultimaHumana ? { criadoEm: ultimaHumana.criadoEm, adminId: parser?.adminId, adminNome: parser?.adminNome } : null }
    })
    res.json({ conversas: itens, total, pagina, limite })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/comercial/conversas/:conversaId/mensagens', autenticar, async (req, res) => {
  try {
    const { texto, humano = true } = req.body || {}
    if (!texto) return res.status(400).json({ erro: 'texto é obrigatório' })
    const conversa = await db.conversa.findUnique({ where: { id: req.params.conversaId }, include: { cliente: { select: { telefone: true } }, tenant: { select: { configWhatsApp: true } } } })
    if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' })
    const nomeAtendente = req.admin.nome || req.admin.email
    const remetente = humano ? `humano:${req.admin.id}:${nomeAtendente}` : 'ia'
    let envio = { enviado: false, motivo: 'Registrado internamente' }
    if (humano) {
      try { envio = await enviarMensagemMeta({ configWhatsApp: conversa.tenant.configWhatsApp, para: conversa.cliente.telefone, texto: `${nomeAtendente}: ${texto}` }) }
      catch (e) { envio = { enviado: false, motivo: e.message } }
    }
    const mensagem = await db.mensagem.create({ data: { conversaId: conversa.id, remetente, conteudo: texto } })
    await db.conversa.update({ where: { id: conversa.id }, data: { status: humano ? 'ESCALONADA' : conversa.status, atualizadoEm: new Date() } })
    res.status(201).json({ mensagem, envio, atendente: nomeAtendente })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.get('/api/admin/comercial/suporte/tickets', autenticar, async (req, res) => {
  try {
    const { slaMinutos = 30 } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query)
    const where = { status: 'ESCALONADA' }
    const [tickets, total] = await Promise.all([
      db.conversa.findMany({ where, orderBy: { atualizadoEm: 'asc' }, skip, take: limite, include: { tenant: { select: { id: true, nome: true } }, cliente: { select: { id: true, nome: true, telefone: true } }, mensagens: { orderBy: { criadoEm: 'desc' }, take: 1, select: { id: true, remetente: true, conteudo: true, criadoEm: true } } } }),
      db.conversa.count({ where }),
    ])
    const slaMs = (parseInt(slaMinutos, 10) || 30) * 60000
    const agora = Date.now()
    const itens = tickets.map(t => {
      const idadeMs = agora - new Date(t.atualizadoEm).getTime()
      return { ...t, sla: { limiteMinutos: parseInt(slaMinutos, 10) || 30, minutosEmAberto: Math.floor(idadeMs / 60000), atrasado: idadeMs > slaMs } }
    })
    res.json({ tickets: itens, total, pagina, limite, atrasados: itens.filter(t => t.sla.atrasado).length })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Integrações Meta (diagnóstico) ──────────────────────────────────────────
app.get('/api/admin/integracoes/meta/saude', autenticar, async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, nome: true, ativo: true, configWhatsApp: true, conversas: { orderBy: { atualizadoEm: 'desc' }, take: 1, select: { atualizadoEm: true, mensagens: { orderBy: { criadoEm: 'desc' }, take: 5, select: { remetente: true, criadoEm: true } } } } } })
    const itens = tenants.map(tenant => {
      const meta = normalizarConfigMeta(tenant.configWhatsApp)
      const ultimaConversa = tenant.conversas?.[0]
      const ultimaHumana = (ultimaConversa?.mensagens || []).find(m => String(m.remetente).startsWith('humano:'))
      return { tenantId: tenant.id, tenantNome: tenant.nome, ativo: tenant.ativo, configuracao: { tokenOk: Boolean(meta.accessToken), phoneNumberIdOk: Boolean(meta.phoneNumberId), prontoParaEnvio: Boolean(meta.accessToken && meta.phoneNumberId) }, monitoramento: { ultimaAtividade: ultimaConversa?.atualizadoEm || null, ultimaRespostaHumanaEm: ultimaHumana?.criadoEm || null } }
    })
    res.json({ total: itens.length, integracaoOk: itens.filter(i => i.configuracao.prontoParaEnvio).length, itens })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Meta Embedded Signup (Admin's own number) ───────────────────────────────
const chamarGraphApi = async (caminho, { method = 'GET', accessToken, query = {}, body } = {}) => {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${caminho}`)
  if (accessToken) url.searchParams.set('access_token', accessToken)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url.toString(), opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Graph API error ${res.status}`)
  return data
}

const trocarCodePorToken = async (code, redirectUri) => {
  // Try without redirect_uri first (standard for Embedded Signup SDK)
  for (const incluirRedirect of [false, true]) {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`)
    url.searchParams.set('client_id', META_APP_ID)
    url.searchParams.set('client_secret', META_APP_SECRET)
    url.searchParams.set('code', code)
    if (incluirRedirect && redirectUri) url.searchParams.set('redirect_uri', redirectUri)
    const res = await fetch(url.toString())
    const data = await res.json().catch(() => ({}))
    if (data.access_token) return data
    if (!incluirRedirect && redirectUri) continue
    throw new Error(data?.error?.message || 'Meta não retornou access_token')
  }
}

const trocarPorLongLived = async (shortToken) => {
  if (!shortToken || !META_APP_ID || !META_APP_SECRET) return null
  try {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`)
    url.searchParams.set('grant_type', 'fb_exchange_token')
    url.searchParams.set('client_id', META_APP_ID)
    url.searchParams.set('client_secret', META_APP_SECRET)
    url.searchParams.set('fb_exchange_token', shortToken)
    const res = await fetch(url.toString())
    const data = await res.json().catch(() => ({}))
    return data.access_token ? data : null
  } catch { return null }
}

app.get('/api/admin/integracoes/meta/config', autenticar, (_req, res) => {
  const cfg = lerConfig()
  const meta = cfg.meta || {}
  const conectado = Boolean(meta.accessToken && meta.phoneNumberId)
  res.json({
    enabled: Boolean(META_APP_ID && META_APP_SECRET && META_EMBEDDED_SIGNUP_CONFIG_ID),
    appId: META_APP_ID || null,
    configId: META_EMBEDDED_SIGNUP_CONFIG_ID || null,
    apiVersion: META_GRAPH_API_VERSION,
    status: {
      conectado,
      displayPhoneNumber: meta.displayPhoneNumber || null,
      verifiedName: meta.verifiedName || null,
      phoneNumberId: conectado ? meta.phoneNumberId : null,
      webhookAssinado: Boolean(meta.webhookAssinado),
      webhookErro: meta.webhookErro || null,
      conectadoEm: meta.conectadoEm || null,
    },
  })
})

app.post('/api/admin/integracoes/meta/complete', autenticar, async (req, res) => {
  try {
    const { code, phoneNumberId, wabaId, businessAccountId, redirectUri } = req.body || {}
    if (!code) return res.status(400).json({ erro: 'code é obrigatório' })
    if (!META_APP_ID || !META_APP_SECRET || !META_EMBEDDED_SIGNUP_CONFIG_ID) {
      return res.status(400).json({ erro: 'Variáveis META_APP_ID / META_APP_SECRET / META_EMBEDDED_SIGNUP_CONFIG_ID não configuradas no servidor.' })
    }

    const tokenData = await trocarCodePorToken(code, redirectUri)
    let accessToken = tokenData.access_token

    const longLived = await trocarPorLongLived(accessToken)
    if (longLived?.access_token) accessToken = longLived.access_token

    // Fetch phone number details
    let detalhesNumero = {}
    let phoneIdFinal = phoneNumberId
    if (phoneIdFinal) {
      try { detalhesNumero = await chamarGraphApi(String(phoneIdFinal), { accessToken, query: { fields: 'display_phone_number,verified_name,id' } }) } catch {}
    }
    if (!phoneIdFinal && wabaId) {
      try {
        const lista = await chamarGraphApi(`${wabaId}/phone_numbers`, { accessToken, query: { fields: 'id,display_phone_number' } })
        const primeiro = lista?.data?.[0]
        if (primeiro?.id) {
          phoneIdFinal = primeiro.id
          detalhesNumero = await chamarGraphApi(String(phoneIdFinal), { accessToken, query: { fields: 'display_phone_number,verified_name,id' } })
        }
      } catch {}
    }

    // Try to subscribe webhook to WABA
    let webhookAssinado = false
    let webhookErro = null
    if (wabaId) {
      try {
        const tokenWh = META_SYSTEM_USER_TOKEN || accessToken
        await chamarGraphApi(`${wabaId}/subscribed_apps`, { method: 'POST', accessToken: tokenWh })
        webhookAssinado = true
      } catch (e) { webhookErro = e.message }
    }

    const cfg = lerConfig()
    cfg.meta = {
      ...( cfg.meta || {}),
      accessToken,
      phoneNumberId: phoneIdFinal ? String(phoneIdFinal) : (cfg.meta?.phoneNumberId || null),
      wabaId: wabaId ? String(wabaId) : (cfg.meta?.wabaId || null),
      businessAccountId: businessAccountId ? String(businessAccountId) : null,
      displayPhoneNumber: detalhesNumero.display_phone_number || cfg.meta?.displayPhoneNumber || null,
      verifiedName: detalhesNumero.verified_name || cfg.meta?.verifiedName || null,
      graphVersion: META_GRAPH_API_VERSION,
      webhookAssinado,
      webhookErro: webhookAssinado ? null : webhookErro,
      conectadoEm: new Date().toISOString(),
    }
    salvarConfig(cfg)

    const avisos = []
    if (!phoneIdFinal) avisos.push('phone_number_id não detectado. Reconecte ou fale com o suporte.')
    if (!longLived?.access_token) avisos.push('Token de curta duração. Reconecte em algumas horas para atualizar.')
    if (!webhookAssinado) avisos.push(`Webhook não assinado: ${webhookErro || 'erro desconhecido'}`)

    res.json({ ok: true, displayPhoneNumber: detalhesNumero.display_phone_number || null, avisos })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/integracoes/meta/desconectar', autenticar, (req, res) => {
  try {
    const cfg = lerConfig()
    delete cfg.meta
    salvarConfig(cfg)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.post('/api/admin/integracoes/meta/webhook/reassinar', autenticar, async (req, res) => {
  try {
    const cfg = lerConfig()
    const meta = cfg.meta || {}
    if (!meta.wabaId) return res.status(422).json({ erro: 'wabaId não disponível. Reconecte o WhatsApp.' })
    const tokenWh = META_SYSTEM_USER_TOKEN || meta.accessToken
    await chamarGraphApi(`${meta.wabaId}/subscribed_apps`, { method: 'POST', accessToken: tokenWh })
    meta.webhookAssinado = true
    meta.webhookErro = null
    cfg.meta = meta
    salvarConfig(cfg)
    res.json({ ok: true, mensagem: 'Webhook reinscrito com sucesso.' })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ─── Sistema / Hardware do Servidor ──────────────────────────────────────────
app.get('/api/admin/sistema', autenticar, async (_req, res) => {
  try {
    const mem = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const cpus = os.cpus()

    // Containers via Docker socket
    let containers = []
    try {
      const raw = await dockerRequest('/containers/json?all=false')
      if (Array.isArray(raw)) {
        containers = raw.map(c => ({
          nome: (c.Names || []).join(', ').replace(/^\//, ''),
          imagem: c.Image,
          status: c.Status,
          estado: c.State,
        })).filter(c => c.nome.startsWith('marca') || c.nome.startsWith('soloflow') || c.nome.startsWith('marcai'))
      }
    } catch { }

    res.json({
      node: process.version,
      uptime: Math.floor(process.uptime()),
      memoria: { rss: Math.round(mem.rss / 1024 / 1024), heapUsed: Math.round(mem.heapUsed / 1024 / 1024), heapTotal: Math.round(mem.heapTotal / 1024 / 1024) },
      servidor: {
        totalMem: Math.round(totalMem / 1024 / 1024),
        freeMem: Math.round(freeMem / 1024 / 1024),
        usadoMem: Math.round((totalMem - freeMem) / 1024 / 1024),
        pctMem: Math.round(((totalMem - freeMem) / totalMem) * 100),
        cpus: cpus.length,
        modeloCpu: cpus[0]?.model || 'N/A',
        platform: os.platform(),
        hostname: os.hostname(),
        loadAvg: os.loadavg().map(n => n.toFixed(2)),
      },
      containers,
    })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Logs ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/logs', autenticar, async (req, res) => {
  try {
    const { limite = 50 } = req.query
    const [tenantsRecentes, conversasRecentes] = await Promise.all([
      db.tenant.findMany({ select: { id: true, nome: true, criadoEm: true, planoContratado: true, ativo: true }, orderBy: { criadoEm: 'desc' }, take: Number(limite) }),
      db.conversa.findMany({ where: { status: 'ESCALONADA' }, select: { id: true, criadoEm: true, atualizadoEm: true, tenant: { select: { nome: true } }, cliente: { select: { nome: true, telefone: true } } }, orderBy: { atualizadoEm: 'desc' }, take: 20 }),
    ])
    res.json({ tenantsRecentes, conversasRecentes })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Inbox — Webhook receptor (sem autenticação, chamado pela Meta) ───────────
app.get('/api/admin/inbox/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
  if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }
  res.status(403).json({ erro: 'Token inválido' })
})

app.post('/api/admin/inbox/webhook', (req, res) => {
  res.sendStatus(200)
  try {
    const body = req.body
    if (body?.object !== 'whatsapp_business_account') return
    const cfg = lerConfig()
    const myPhoneNumberId = cfg.meta?.phoneNumberId
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue
        const val = change.value || {}
        if (myPhoneNumberId && val.metadata?.phone_number_id !== myPhoneNumberId) continue
        const inbox = lerInbox()
        const contacts = {}
        for (const c of (val.contacts || [])) contacts[c.wa_id] = c.profile?.name || c.wa_id
        for (const msg of (val.messages || [])) {
          if (msg.type !== 'text' && msg.type !== 'image' && msg.type !== 'audio' && msg.type !== 'document') continue
          const phone = normalizarTelefone(msg.from)
          const nome = contacts[msg.from] || contacts[phone] || phone
          const texto = msg.text?.body || `[${msg.type}]`
          if (!inbox.conversas[phone]) {
            inbox.conversas[phone] = { phone, nome, naoLidas: 0, arquivada: false, mensagens: [] }
          }
          const conv = inbox.conversas[phone]
          if (nome && nome !== phone) conv.nome = nome
          const jaExiste = conv.mensagens.some(m => m.wamid === msg.id)
          if (!jaExiste) {
            conv.mensagens.push({ id: gerarId(), de: 'cliente', texto, ts: new Date(Number(msg.timestamp) * 1000).toISOString(), wamid: msg.id })
            conv.naoLidas = (conv.naoLidas || 0) + 1
            conv.ultimaAtividade = new Date().toISOString()
          }
        }
        // Mensagens enviadas pelo admin (status updates)
        for (const status of (val.statuses || [])) {
          // atualizar status de entrega se necessário
        }
        salvarInbox(inbox)
      }
    }
  } catch (e) { console.error('[Inbox Webhook]', e.message) }
})

// ─── Inbox — API autenticada ──────────────────────────────────────────────────
app.get('/api/admin/inbox/conversas', autenticar, (req, res) => {
  const { busca, arquivadas = 'false' } = req.query
  const inbox = lerInbox()
  let lista = Object.values(inbox.conversas || {})
  if (String(arquivadas) !== 'true') lista = lista.filter(c => !c.arquivada)
  if (busca) {
    const q = busca.toLowerCase()
    lista = lista.filter(c => c.nome?.toLowerCase().includes(q) || c.phone?.includes(q))
  }
  lista.sort((a, b) => new Date(b.ultimaAtividade || 0) - new Date(a.ultimaAtividade || 0))
  const resumo = lista.map(c => ({
    phone: c.phone,
    nome: c.nome,
    naoLidas: c.naoLidas || 0,
    arquivada: c.arquivada || false,
    ultimaAtividade: c.ultimaAtividade || null,
    ultimaMensagem: c.mensagens?.slice(-1)[0] || null,
  }))
  res.json({ conversas: resumo, total: resumo.length })
})

app.get('/api/admin/inbox/conversas/:phone', autenticar, (req, res) => {
  const phone = normalizarTelefone(req.params.phone)
  const inbox = lerInbox()
  const conv = inbox.conversas[phone]
  if (!conv) return res.status(404).json({ erro: 'Conversa não encontrada' })
  res.json(conv)
})

app.post('/api/admin/inbox/conversas/:phone/enviar', autenticar, async (req, res) => {
  try {
    const phone = normalizarTelefone(req.params.phone)
    const { texto, nome } = req.body || {}
    if (!texto?.trim()) return res.status(400).json({ erro: 'texto é obrigatório' })
    const cfg = lerConfig()
    const meta = cfg.meta || {}
    if (!meta.accessToken || !meta.phoneNumberId) return res.status(400).json({ erro: 'WhatsApp não configurado. Conecte em Integrações.' })
    const envio = await enviarMensagemMeta({ configWhatsApp: { token: meta.accessToken, phoneNumberId: meta.phoneNumberId, graphVersion: META_GRAPH_API_VERSION }, para: phone, texto: texto.trim() })
    const inbox = lerInbox()
    if (!inbox.conversas[phone]) {
      inbox.conversas[phone] = { phone, nome: nome || phone, naoLidas: 0, arquivada: false, mensagens: [] }
    }
    const conv = inbox.conversas[phone]
    if (nome) conv.nome = nome
    conv.mensagens.push({ id: gerarId(), de: 'admin', texto: texto.trim(), ts: new Date().toISOString(), adminNome: req.admin.nome || req.admin.email })
    conv.ultimaAtividade = new Date().toISOString()
    salvarInbox(inbox)
    res.json({ ok: true, envio })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

app.patch('/api/admin/inbox/conversas/:phone/lida', autenticar, (req, res) => {
  const phone = normalizarTelefone(req.params.phone)
  const inbox = lerInbox()
  if (inbox.conversas[phone]) { inbox.conversas[phone].naoLidas = 0; salvarInbox(inbox) }
  res.json({ ok: true })
})

app.patch('/api/admin/inbox/conversas/:phone/arquivar', autenticar, (req, res) => {
  const phone = normalizarTelefone(req.params.phone)
  const inbox = lerInbox()
  if (inbox.conversas[phone]) { inbox.conversas[phone].arquivada = !inbox.conversas[phone].arquivada; salvarInbox(inbox) }
  res.json({ ok: true })
})

app.post('/api/admin/inbox/conversas', autenticar, async (req, res) => {
  try {
    const { phone, nome, texto } = req.body || {}
    if (!phone || !texto?.trim()) return res.status(400).json({ erro: 'phone e texto são obrigatórios' })
    const tel = normalizarTelefone(phone)
    const cfg = lerConfig()
    const meta = cfg.meta || {}
    if (!meta.accessToken || !meta.phoneNumberId) return res.status(400).json({ erro: 'WhatsApp não configurado.' })
    const envio = await enviarMensagemMeta({ configWhatsApp: { token: meta.accessToken, phoneNumberId: meta.phoneNumberId, graphVersion: META_GRAPH_API_VERSION }, para: tel, texto: texto.trim() })
    const inbox = lerInbox()
    if (!inbox.conversas[tel]) inbox.conversas[tel] = { phone: tel, nome: nome || tel, naoLidas: 0, arquivada: false, mensagens: [] }
    const conv = inbox.conversas[tel]
    if (nome) conv.nome = nome
    conv.mensagens.push({ id: gerarId(), de: 'admin', texto: texto.trim(), ts: new Date().toISOString(), adminNome: req.admin.nome || req.admin.email })
    conv.ultimaAtividade = new Date().toISOString()
    salvarInbox(inbox)
    res.json({ ok: true, phone: tel, envio })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, service: 'marcai-admin-api', version: '2.0' }))

// ─── Seed ─────────────────────────────────────────────────────────────────────
const seed = async () => {
  ensureDataDir()
  const count = await db.superAdmin.count()
  if (count === 0) {
    const senhaHash = await bcrypt.hash('admin123', 10)
    await db.superAdmin.create({ data: { nome: 'Super Admin', email: 'admin@marcai.com', senhaHash, papel: 'OWNER' } })
    console.log('[Admin] Super admin criado: admin@marcai.com / admin123')
  }
}

app.listen(PORT, async () => {
  await seed()
  console.log(`[Admin API] v2.0 — porta ${PORT}`)
})

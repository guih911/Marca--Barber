require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { domainToASCII } = require('url')
const express = require('express')
const cors = require('cors')
const passport = require('passport')

const { tratarErros } = require('./middlewares/tratarErros')

// Importa rotas
const authRotas = require('./modulos/auth/auth.rotas')
const tenantRotas = require('./modulos/tenant/tenant.rotas')
const servicosRotas = require('./modulos/servicos/servicos.rotas')
const profissionaisRotas = require('./modulos/profissionais/profissionais.rotas')
const clientesRotas = require('./modulos/clientes/clientes.rotas')
const agendamentosRotas = require('./modulos/agendamentos/agendamentos.rotas')
const conversasRotas = require('./modulos/conversas/conversas.rotas')
const dashboardRotas = require('./modulos/dashboard/dashboard.rotas')
const planosRotas = require('./modulos/planos/planos.rotas')
const iaRotas = require('./modulos/ia/ia.rotas')
const fidelidadeRotas = require('./modulos/fidelidade/fidelidade.rotas')
const estoqueRotas = require('./modulos/estoque/estoque.rotas')
const comandaRotas = require('./modulos/comanda/comanda.rotas')
const pacotesRotas = require('./modulos/pacotes/pacotes.rotas')
const comissoesRotas = require('./modulos/comissoes/comissoes.rotas')
const publicRotas = require('./modulos/public/public.rotas')
const caixaRotas = require('./modulos/caixa/caixa.rotas')
const galeriaRotas = require('./modulos/galeria/galeria.rotas')
const filaEsperaRotas = require('./modulos/fila-espera/fila-espera.rotas')
const pagamentosRotas = require('./modulos/pagamentos/pagamentos.rotas')
const entregasRotas = require('./modulos/entregas/entregas.rotas')
const {
  iniciarCronLembretes,
  garantirInscricaoWebhookMetaParaTodos,
} = require('./modulos/ia/ia.controlador')
const { iniciarCronAutomacoes } = require('./modulos/ia/automacoes.servico')

const app = express()
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}
const uploadsDir = path.join(__dirname, '../uploads')

for (const pasta of ['avatares', 'galeria', 'logos']) {
  fs.mkdirSync(path.join(uploadsDir, pasta), { recursive: true })
}

// ─── Rate limiter simples em memória ──────────────────────────────────────────
const rateLimits = new Map()
const rateLimit = (maxRequests, windowMs) => (req, res, next) => {
  const key = `${req.ip}:${req.baseUrl || req.originalUrl}`
  const now = Date.now()
  const window = rateLimits.get(key) || { count: 0, resetAt: now + windowMs }
  if (now > window.resetAt) { window.count = 0; window.resetAt = now + windowMs }
  window.count++
  rateLimits.set(key, window)
  if (window.count > maxRequests) {
    return res.status(429).json({ sucesso: false, erro: { mensagem: 'Muitas requisições. Aguarde.' } })
  }
  next()
}

// Limpa entradas expiradas a cada 5 minutos para não vazar memória
setInterval(() => {
  const now = Date.now()
  for (const [key, window] of rateLimits) {
    if (now > window.resetAt) rateLimits.delete(key)
  }
}, 5 * 60 * 1000)

// Mesma origem em IDN vs punycode (ex.: marcaí.com vs xn--marca-3sa.com) — o browser pode enviar qualquer forma.
const normalizarOrigemCors = (origem) => {
  if (!origem || typeof origem !== 'string') return ''
  try {
    const u = new URL(origem)
    const host = domainToASCII(u.hostname)
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`
  } catch {
    return origem.trim()
  }
}

// Middlewares globais
const origemPermitida = (origin, callback) => {
  // Em desenvolvimento, aceita qualquer origem localhost / 127.0.0.1
  if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return callback(null, true)
  }
  const candidatas = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // Origens padrão (app + site institucional, IDN)
  candidatas.push('https://app.barbermark.com.br', 'https://barbermark.com.br', 'https://www.barbermark.com.br', 'https://barber.marcaí.com', 'https://marcaí.com', 'https://www.marcaí.com')
  const nOrig = normalizarOrigemCors(origin)
  const ok = candidatas.some((c) => c && (c === origin || normalizarOrigemCors(c) === nOrig))
  if (ok) return callback(null, true)
  callback(new Error(`Origem não permitida pelo CORS: ${origin}`))
}

app.use(
  cors({
    origin: origemPermitida,
    credentials: true,
  })
)
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (buf?.length) req.rawBody = Buffer.from(buf)
  },
}))
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

// Serve static uploaded files
app.use('/uploads', express.static(uploadsDir))

// Health check com validação do banco de dados
app.get('/health', async (req, res) => {
  const banco = require('./config/banco')
  try {
    // Verifica conexão com o banco
    await banco.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      versao: '1.0.0',
      ambiente: process.env.NODE_ENV,
      banco: 'conectado',
      timestamp: new Date().toISOString(),
    })
  } catch (erro) {
    console.error('[Health] Falha na conexão com o banco:', erro.message)
    res.status(503).json({
      status: 'unhealthy',
      versao: '1.0.0',
      ambiente: process.env.NODE_ENV,
      banco: 'desconectado',
      erro: erro.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Rotas da API
// Antes: 5 req/min em TODA /api/auth bloqueava login + refresh + /me no mesmo minuto. Subir o teto; bruteforce continua mitigado pelo limite.
app.use('/api/auth', rateLimit(40, 60 * 1000), authRotas)
app.use('/api/tenants', tenantRotas)
app.use('/api/servicos', servicosRotas)
app.use('/api/profissionais', profissionaisRotas)
app.use('/api/clientes', clientesRotas)
app.use('/api/agendamentos', agendamentosRotas)
app.use('/api/disponibilidade', agendamentosRotas) // rota de disponibilidade inclusa
app.use('/api/conversas', conversasRotas)
app.use('/api/dashboard', dashboardRotas)
app.use('/api/planos', planosRotas)
// Webhook da Meta: não limitar (IPs da Meta; burst de eventos; mesma chave = /api/ia)
app.use('/api/ia', (req, res, next) => {
  if (String(req.path || '').includes('webhook/meta') || String(req.originalUrl || '').includes('webhook/meta')) {
    return next()
  }
  return rateLimit(60, 60 * 1000)(req, res, next)
}, iaRotas)
app.use('/api/fidelidade', fidelidadeRotas)
app.use('/api/estoque', estoqueRotas)
app.use('/api/comanda', comandaRotas)
app.use('/api/pacotes', pacotesRotas)
app.use('/api/comissoes', comissoesRotas)
app.use('/api/public', rateLimit(60, 60 * 1000), publicRotas)
app.use('/api/caixa', caixaRotas)
app.use('/api/galeria', galeriaRotas)
app.use('/api/fila-espera', filaEsperaRotas)
app.use('/api/pagamentos', pagamentosRotas)
app.use('/api/entregas', entregasRotas)

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    sucesso: false,
    erro: { mensagem: 'Rota não encontrada', codigo: 'ROTA_NAO_ENCONTRADA' },
  })
})

// Handler global de erros (deve ser o último middleware)
app.use(tratarErros)

const PORTA = process.env.PORT || 3001

// Flag para evitar duplicação de crons em múltiplas instâncias/reloads
let cronsIniciados = false

if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`[Servidor] Don rodando na porta ${PORTA}`)
    console.log(`[Servidor] Ambiente: ${process.env.NODE_ENV || 'development'}`)
    console.log(`[Servidor] Frontend permitido: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)

    console.log('[WhatsApp] Meta oficial e Sendzen disponíveis no painel de integrações')

    // Proteção contra duplicação de crons (importante para pm2/cluster)
    if (!cronsIniciados) {
      cronsIniciados = true

      // Inicia cron de lembretes automaticos de agendamento (24h)
      iniciarCronLembretes()
      console.log('[Cron] Lembretes iniciados')

      // Inicia automacoes enterprise (2h, auto-cancel, retorno, reativacao, parabens, fila)
      iniciarCronAutomacoes()
      console.log('[Cron] Automações iniciadas')

      // Auto-corrige tenants conectados na Meta com webhookAssinado=false (em background, não bloqueia).
      // Atalho para não exigir reconexão manual depois de a barbearia já ter conectado uma vez.
      setTimeout(() => {
        garantirInscricaoWebhookMetaParaTodos().catch((e) =>
          console.warn('[Webhook Meta auto-fix] erro:', e?.message || e),
        )
      }, 5000)
    } else {
      console.log('[Cron] Crons já iniciados, ignorando duplicação')
    }
  })
}
module.exports = app

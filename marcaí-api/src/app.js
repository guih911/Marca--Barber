require('dotenv').config()
const fs = require('fs')
const path = require('path')
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
const { inicializarSessoesWWebJS, iniciarCronLembretes } = require('./modulos/ia/ia.controlador')
const { iniciarCronAutomacoes } = require('./modulos/ia/automacoes.servico')

const app = express()
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

// Middlewares globais
const origemPermitida = (origin, callback) => {
  // Em desenvolvimento, aceita qualquer origem localhost
  if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true)
  }
  const permitidas = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim())
  // Aceita também a versão punycode do domínio
  permitidas.push('https://barber.xn--marca-3sa.com')
  if (permitidas.includes(origin)) return callback(null, true)
  callback(new Error(`Origem não permitida pelo CORS: ${origin}`))
}

app.use(
  cors({
    origin: origemPermitida,
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))
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
app.use('/api/auth', rateLimit(5, 60 * 1000), authRotas)
app.use('/api/tenants', tenantRotas)
app.use('/api/servicos', servicosRotas)
app.use('/api/profissionais', profissionaisRotas)
app.use('/api/clientes', clientesRotas)
app.use('/api/agendamentos', agendamentosRotas)
app.use('/api/disponibilidade', agendamentosRotas) // rota de disponibilidade inclusa
app.use('/api/conversas', conversasRotas)
app.use('/api/dashboard', dashboardRotas)
app.use('/api/planos', planosRotas)
app.use('/api/ia', rateLimit(60, 60 * 1000), iaRotas)
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

    // Recarrega sessoes WhatsApp Web.js para tenants que ja tinham QR conectado
    inicializarSessoesWWebJS()

    // Proteção contra duplicação de crons (importante para pm2/cluster)
    if (!cronsIniciados) {
      cronsIniciados = true

      // Inicia cron de lembretes automaticos de agendamento (24h)
      iniciarCronLembretes()
      console.log('[Cron] Lembretes iniciados')

      // Inicia automacoes enterprise (2h, auto-cancel, retorno, reativacao, parabens, fila)
      iniciarCronAutomacoes()
      console.log('[Cron] Automações iniciadas')
    } else {
      console.log('[Cron] Crons já iniciados, ignorando duplicação')
    }
  })
}
module.exports = app


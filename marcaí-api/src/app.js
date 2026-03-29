require('dotenv').config()
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
const { inicializarSessoesWWebJS, iniciarCronLembretes } = require('./modulos/ia/ia.controlador')
const { iniciarCronAutomacoes } = require('./modulos/ia/automacoes.servico')

const app = express()

// Middlewares globais
const origemPermitida = (origin, callback) => {
  // Em desenvolvimento, aceita qualquer origem localhost
  if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true)
  }
  const permitidas = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim())
  if (permitidas.includes(origin)) return callback(null, true)
  callback(new Error(`Origem nÃ£o permitida pelo CORS: ${origin}`))
}

app.use(
  cors({
    origin: origemPermitida,
    credentials: true,
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', versao: '1.0.0', ambiente: process.env.NODE_ENV })
})

// Rotas da API
app.use('/api/auth', authRotas)
app.use('/api/tenants', tenantRotas)
app.use('/api/servicos', servicosRotas)
app.use('/api/profissionais', profissionaisRotas)
app.use('/api/clientes', clientesRotas)
app.use('/api/agendamentos', agendamentosRotas)
app.use('/api/disponibilidade', agendamentosRotas) // rota de disponibilidade inclusa
app.use('/api/conversas', conversasRotas)
app.use('/api/dashboard', dashboardRotas)
app.use('/api/planos', planosRotas)
app.use('/api/ia', iaRotas)
app.use('/api/fidelidade', fidelidadeRotas)
app.use('/api/estoque', estoqueRotas)
app.use('/api/comanda', comandaRotas)
app.use('/api/pacotes', pacotesRotas)
app.use('/api/comissoes', comissoesRotas)
app.use('/api/public', publicRotas)
app.use('/api/caixa', caixaRotas)
app.use('/api/galeria', galeriaRotas)
app.use('/api/fila-espera', filaEsperaRotas)

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    sucesso: false,
    erro: { mensagem: 'Rota nÃ£o encontrada', codigo: 'ROTA_NAO_ENCONTRADA' },
  })
})

// Handler global de erros (deve ser o Ãºltimo middleware)
app.use(tratarErros)

const PORTA = process.env.PORT || 3001

if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`Servidor Don rodando na porta ${PORTA}`)
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`)
    console.log(`Frontend permitido: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)

    // Recarrega sessoes WhatsApp Web.js para tenants que ja tinham QR conectado
    inicializarSessoesWWebJS()

    // Inicia cron de lembretes automaticos de agendamento (24h)
    iniciarCronLembretes()

    // Inicia automacoes enterprise (2h, auto-cancel, retorno, reativacao, parabens, fila)
    iniciarCronAutomacoes()
  })
}
module.exports = app




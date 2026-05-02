const express = require('express')
const cors = require('cors')
const { ALLOWED_ORIGINS } = require('./core/env')
const { autenticar } = require('./middlewares/auth')
const { authRoutes } = require('./modules/auth/auth.routes')
const { dashboardRoutes } = require('./modules/dashboard/dashboard.routes')
const { tenantsRoutes } = require('./modules/tenants/tenants.routes')
const { superAdminsRoutes } = require('./modules/superAdmins/superAdmins.routes')
const { systemRoutes } = require('./modules/system/system.routes')
const { logsRoutes } = require('./modules/logs/logs.routes')
const { comercialRoutes } = require('./modules/comercial/comercial.routes')
const { clientesRoutes } = require('./modules/clientes/clientes.routes')
const { relatoriosRoutes } = require('./modules/relatorios/relatorios.routes')
const { disparosRoutes } = require('./modules/disparos/disparos.routes')

const createApp = () => {
  const app = express()
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
  app.use(express.json({ limit: '5mb' }))

  app.use('/api/admin', authRoutes)

  app.use('/api/admin', autenticar, dashboardRoutes)
  app.use('/api/admin', autenticar, tenantsRoutes)
  app.use('/api/admin', autenticar, superAdminsRoutes)
  app.use('/api/admin', autenticar, systemRoutes)
  app.use('/api/admin', autenticar, logsRoutes)
  app.use('/api/admin', autenticar, comercialRoutes)
  app.use('/api/admin', autenticar, clientesRoutes)
  app.use('/api/admin', autenticar, relatoriosRoutes)
  app.use('/api/admin', autenticar, disparosRoutes)

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'marcai-admin-api' }))

  return app
}

module.exports = { createApp }

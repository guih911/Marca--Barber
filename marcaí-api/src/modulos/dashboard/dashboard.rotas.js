const { Router } = require('express')
const { query } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const dashboardControlador = require('./dashboard.controlador')

const router = Router()

router.use(autenticar)

router.get('/metricas', dashboardControlador.metricas)
router.get('/grafico', dashboardControlador.grafico)
router.get('/financeiro', dashboardControlador.financeiro)
router.get('/operacional', dashboardControlador.operacional)
router.get(
  '/ocupacao',
  [
    query('inicio').optional().isISO8601(),
    query('fim').optional().isISO8601(),
    query('janelaDias').optional().isInt({ min: 1, max: 365 }),
    query('profissionalId').optional().isUUID(),
  ],
  validar,
  dashboardControlador.ocupacao
)
router.get(
  '/retencao',
  [
    query('janelaDias').optional().isInt({ min: 1, max: 365 }),
  ],
  validar,
  dashboardControlador.retencao
)
router.get(
  '/no-show-profissional',
  [
    query('inicio').optional().isISO8601(),
    query('fim').optional().isISO8601(),
    query('janelaDias').optional().isInt({ min: 1, max: 365 }),
    query('profissionalId').optional().isUUID(),
  ],
  validar,
  dashboardControlador.noShowProfissional
)

module.exports = router

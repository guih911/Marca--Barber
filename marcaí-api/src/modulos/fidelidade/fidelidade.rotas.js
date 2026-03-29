const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./fidelidade.controlador')

const router = Router()
router.use(autenticar)

router.get('/config', ctrl.obterConfig)
router.put('/config', ctrl.salvarConfig)
router.get('/ranking', ctrl.listarRanking)
router.get('/clientes/:clienteId', ctrl.obterSaldoCliente)
router.post('/clientes/:clienteId/resgatar', ctrl.resgatarPontos)

module.exports = router

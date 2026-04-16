const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./entregas.controlador')

const router = Router()
router.use(autenticar)

router.get('/', ctrl.listar)
router.patch('/:id/status', ctrl.atualizarStatus)

module.exports = router

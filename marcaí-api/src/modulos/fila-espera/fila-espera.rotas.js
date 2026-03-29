const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./fila-espera.controlador')

const router = Router()
router.use(autenticar)

router.get('/', ctrl.listar)
router.post('/', ctrl.criar)
router.patch('/:id/status', ctrl.atualizarStatus)
router.delete('/:id', ctrl.remover)

module.exports = router

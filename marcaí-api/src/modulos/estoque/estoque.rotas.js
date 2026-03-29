const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./estoque.controlador')

const router = Router()
router.use(autenticar)

router.get('/', ctrl.listar)
router.get('/:id', ctrl.buscarPorId)
router.post('/', ctrl.criar)
router.patch('/:id', ctrl.atualizar)
router.post('/:id/movimentos', ctrl.registrarMovimento)

module.exports = router

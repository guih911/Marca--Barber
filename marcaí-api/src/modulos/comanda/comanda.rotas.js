const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./comanda.controlador')

const router = Router()
router.use(autenticar)

router.get('/:agendamentoId', ctrl.obterComanda)
router.post('/:agendamentoId/itens', ctrl.adicionarItem)
router.delete('/:agendamentoId/itens/:itemId', ctrl.removerItem)
router.post('/:agendamentoId/enviar-recibo', ctrl.enviarRecibo)

module.exports = router

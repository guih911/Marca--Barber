const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const pagamentosControlador = require('./pagamentos.controlador')

const router = Router()

// Rotas autenticadas
router.post('/checkout', autenticar, pagamentosControlador.checkout)
router.get('/status', autenticar, pagamentosControlador.status)

// Webhook público (chamado pelo Asaas)
router.post('/webhook', pagamentosControlador.webhook)

module.exports = router

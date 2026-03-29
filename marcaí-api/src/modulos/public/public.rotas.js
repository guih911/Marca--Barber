const { Router } = require('express')
const publicControlador = require('./public.controlador')

const router = Router()

// Rotas públicas — sem autenticação
router.get('/check-in', publicControlador.checkIn)
router.get('/:slug/info', publicControlador.info)
router.get('/:slug/slots', publicControlador.slots)
router.post('/:slug/agendar', publicControlador.agendar)
router.get('/:slug/planos', publicControlador.planos)
router.post('/:slug/assinar', publicControlador.assinar)

module.exports = router

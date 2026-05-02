const { Router } = require('express')
const publicControlador = require('./public.controlador')

const router = Router()

const validarIdentificador = (valor) => /^[a-zA-Z0-9\-_]+$/.test(valor || '')

const validarSlug = (req, res, next) => {
  if (!validarIdentificador(req.params.slug)) {
    return res.status(400).json({ sucesso: false, erro: { mensagem: 'Identificador invalido' } })
  }
  next()
}

const validarHash = (req, res, next) => {
  if (!validarIdentificador(req.params.hash)) {
    return res.status(400).json({ sucesso: false, erro: { mensagem: 'Hash invalido' } })
  }
  next()
}

router.get('/check-in', publicControlador.checkIn)
router.patch('/check-in/confirmar', publicControlador.confirmarCheckIn)
router.get('/painel/:slug/:hash', validarSlug, validarHash, publicControlador.painelTv)
router.get('/:slug/info', validarSlug, publicControlador.info)
router.get('/:slug/produtos', validarSlug, publicControlador.produtos)
router.get('/:slug/meus-pedidos', validarSlug, publicControlador.meusPedidos)
router.post('/:slug/pedidos', validarSlug, publicControlador.criarPedido)
router.get('/:slug/cliente', validarSlug, publicControlador.cliente)
router.get('/:slug/perfil', validarSlug, publicControlador.perfil)
router.patch('/:slug/perfil', validarSlug, publicControlador.atualizarPerfil)
router.get('/:slug/pacotes', validarSlug, publicControlador.pacotes)
router.get('/:slug/slots', validarSlug, publicControlador.slots)
router.get('/:slug/slots-combo', validarSlug, publicControlador.slotsCombo)
router.post('/:slug/agendar', validarSlug, publicControlador.agendar)
router.get('/:slug/planos', validarSlug, publicControlador.planos)
router.post('/:slug/assinar', validarSlug, publicControlador.assinar)
router.get('/:slug/meus-agendamentos', validarSlug, publicControlador.meusAgendamentos)
router.get('/:slug/historico', validarSlug, publicControlador.historico)
router.post('/:slug/reagendar', validarSlug, publicControlador.reagendar)
router.get('/:slug/verificar-assinatura', validarSlug, publicControlador.verificarAssinatura)
router.post('/:slug/enviar-codigo', validarSlug, publicControlador.enviarCodigo)
router.post('/:slug/verificar-codigo', validarSlug, publicControlador.verificarCodigo)

module.exports = router

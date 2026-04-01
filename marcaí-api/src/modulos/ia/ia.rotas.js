const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const iaControlador = require('./ia.controlador')

const router = Router()

// Meta Cloud API
router.get('/webhook/meta/:tenantId', iaControlador.verificarWebhookMeta)
router.post('/webhook/meta/:tenantId', iaControlador.webhookMeta)

// WhatsApp web / Baileys
router.post('/wwebjs/iniciar', autenticar, iaControlador.iniciarWWebJS)
router.post('/wwebjs/status', autenticar, iaControlador.statusWWebJS)
router.post('/wwebjs/desconectar', autenticar, iaControlador.desconectarWWebJS)

// Webhook interno
router.post(
  '/webhook',
  [
    body('telefone').notEmpty().withMessage('Telefone e obrigatorio'),
    body('mensagem').notEmpty().withMessage('Mensagem e obrigatoria'),
  ],
  validar,
  iaControlador.webhook
)

// Simulacao simples do painel
router.post(
  '/simular',
  autenticar,
  [body('mensagem').notEmpty().withMessage('Mensagem e obrigatoria')],
  validar,
  iaControlador.simular
)

// Teste real do Don usando o fluxo completo
router.post(
  '/teste',
  autenticar,
  [
    body('mensagem').notEmpty().withMessage('Mensagem e obrigatoria'),
    body('telefone').optional().isString(),
    body('nome').optional().isString(),
    body('lidWhatsapp').optional().isString(),
  ],
  validar,
  iaControlador.testeCliente
)

router.post('/teste/resetar', autenticar, iaControlador.resetarTesteCliente)
router.post('/teste/suite', autenticar, iaControlador.suiteTesteCliente)

// Envio de link de agendamento
router.post(
  '/enviar-link',
  autenticar,
  [
    body('clienteId').notEmpty().withMessage('clienteId e obrigatorio'),
    body('linkAgendamento').notEmpty().withMessage('linkAgendamento e obrigatorio'),
  ],
  validar,
  iaControlador.enviarLinkAgendamento
)

module.exports = router

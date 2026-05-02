const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const iaControlador = require('./ia.controlador')

const router = Router()

// Meta Cloud API
router.get('/meta/config', autenticar, iaControlador.obterConfiguracaoMeta)
router.post('/meta/embedded-signup/complete', autenticar, iaControlador.concluirEmbeddedSignupMeta)
router.post('/meta/desconectar', autenticar, iaControlador.desconectarMetaOficial)
router.post('/meta/reassinar-webhook', autenticar, iaControlador.reassinarWebhookMeta)
router.post(
  '/meta/teste-envio',
  autenticar,
  [
    body('telefone').notEmpty().withMessage('Telefone é obrigatório.'),
    body('mensagem').optional().isString(),
  ],
  validar,
  iaControlador.enviarTesteMeta,
)
router.get('/meta/message-templates', autenticar, iaControlador.listarTemplatesMeta)
router.post(
  '/meta/message-templates/enviar-teste',
  autenticar,
  [
    body('nomeTemplate').notEmpty().withMessage('nomeTemplate é obrigatório.'),
    body('idioma').notEmpty().withMessage('idioma é obrigatório (ex: pt_BR).'),
    body('telefone').notEmpty().withMessage('Telefone de teste é obrigatório.'),
  ],
  validar,
  iaControlador.enviarTemplateTesteMeta,
)
router.get('/webhook/meta', iaControlador.verificarWebhookMeta)
router.post('/webhook/meta', iaControlador.webhookMeta)
router.get('/webhook/meta/:tenantId', iaControlador.verificarWebhookMeta)
router.post('/webhook/meta/:tenantId', iaControlador.webhookMeta)

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

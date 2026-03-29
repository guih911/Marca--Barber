const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const iaControlador = require('./ia.controlador')

const router = Router()

// ─── Webhooks por provedor (públicos, sem autenticação) ───────────────────────

// Meta Cloud API
// GET  /api/ia/webhook/meta/:tenantId  — verificação do webhook
// POST /api/ia/webhook/meta/:tenantId  — mensagens recebidas
router.get('/webhook/meta/:tenantId', iaControlador.verificarWebhookMeta)
router.post('/webhook/meta/:tenantId', iaControlador.webhookMeta)

// ─── WhatsApp Web.js (requerem autenticação) ──────────────────────────────────
// POST /api/ia/wwebjs/iniciar — inicia sessão e retorna QR Code
router.post('/wwebjs/iniciar', autenticar, iaControlador.iniciarWWebJS)
// POST /api/ia/wwebjs/status — verifica status da conexão
router.post('/wwebjs/status', autenticar, iaControlador.statusWWebJS)
// POST /api/ia/wwebjs/desconectar — destrói a sessão
router.post('/wwebjs/desconectar', autenticar, iaControlador.desconectarWWebJS)

// ─── Webhook interno legado (body normalizado) ────────────────────────────────
// POST /api/ia/webhook
router.post(
  '/webhook',
  [
    body('telefone').notEmpty().withMessage('Telefone é obrigatório'),
    body('mensagem').notEmpty().withMessage('Mensagem é obrigatória'),
  ],
  validar,
  iaControlador.webhook
)

// ─── Simular conversa (painel) ────────────────────────────────────────────────
// POST /api/ia/simular
router.post(
  '/simular',
  autenticar,
  [body('mensagem').notEmpty().withMessage('Mensagem é obrigatória')],
  validar,
  iaControlador.simular
)

// ─── Teste real do Don com cliente de teste ────────────────────────────────────
// POST /api/ia/teste
router.post(
  '/teste',
  autenticar,
  [body('mensagem').notEmpty().withMessage('Mensagem é obrigatória')],
  validar,
  iaControlador.testeCliente
)
// POST /api/ia/teste/resetar
router.post('/teste/resetar', autenticar, iaControlador.resetarTesteCliente)

// ─── Enviar link de agendamento via WhatsApp ──────────────────────────────────
// POST /api/ia/enviar-link
router.post(
  '/enviar-link',
  autenticar,
  [
    body('clienteId').notEmpty().withMessage('clienteId é obrigatório'),
    body('linkAgendamento').notEmpty().withMessage('linkAgendamento é obrigatório'),
  ],
  validar,
  iaControlador.enviarLinkAgendamento
)

module.exports = router

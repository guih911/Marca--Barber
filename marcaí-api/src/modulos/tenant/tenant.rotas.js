const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const tenantControlador = require('./tenant.controlador')

const router = Router()

// GET /api/tenants/meu
router.get('/meu', autenticar, tenantControlador.buscarMeu)

// GET /api/tenants/meu/usuarios
router.get('/meu/usuarios', autenticar, tenantControlador.listarUsuarios)

// PATCH /api/tenants/meu
router.patch(
  '/meu',
  autenticar,
  [
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio'),
    body('segmento').optional().isIn(['SAUDE', 'BELEZA', 'ADVOCACIA', 'FITNESS', 'EDUCACAO', 'OUTRO']),
    body('nicho').optional().trim(),
    body('timezone').optional().notEmpty(),
    body('autoCancelarNaoConfirmados').optional().isBoolean(),
    body('horasAutoCancelar').optional().isInt({ min: 1, max: 48 }),
    body('exigirConfirmacaoPresenca').optional().isBoolean(),
  ],
  validar,
  tenantControlador.atualizar
)

// PATCH /api/tenants/meu/configuracao-ia
router.patch(
  '/meu/configuracao-ia',
  autenticar,
  [
    body('tomDeVoz').optional().isIn(['FORMAL', 'DESCONTRALIDO', 'ACOLHEDOR']),
    body('antecedenciaCancelar').optional().isInt({ min: 0 }),
  ],
  validar,
  tenantControlador.atualizarConfiguracaoIA
)

module.exports = router

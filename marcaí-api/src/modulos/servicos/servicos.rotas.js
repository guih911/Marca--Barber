const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const servicosControlador = require('./servicos.controlador')

const router = Router()

router.use(autenticar)

// GET /api/servicos
router.get('/', servicosControlador.listar)

// POST /api/servicos
router.post(
  '/',
  [
    body('nome').trim().notEmpty().withMessage('Nome e obrigatorio'),
    body('duracaoMinutos').isInt({ min: 5 }).withMessage('Duracao deve ser no minimo 5 minutos'),
    body('precoCentavos').optional({ nullable: true }).isInt({ min: 0 }),
    body('retornoEmDias').optional({ nullable: true }).isInt({ min: 0 }),
    body('instrucoes').optional({ nullable: true }).isString(),
  ],
  validar,
  servicosControlador.criar
)

// PATCH /api/servicos/:id
router.patch(
  '/:id',
  [
    body('nome').optional().trim().notEmpty(),
    body('duracaoMinutos').optional().isInt({ min: 5 }),
    body('precoCentavos').optional({ nullable: true }).isInt({ min: 0 }),
    body('retornoEmDias').optional({ nullable: true }).isInt({ min: 0 }),
    body('instrucoes').optional({ nullable: true }).isString(),
    body('ativo').optional().isBoolean(),
  ],
  validar,
  servicosControlador.atualizar
)

// DELETE /api/servicos/:id
router.delete('/:id', servicosControlador.remover)

module.exports = router

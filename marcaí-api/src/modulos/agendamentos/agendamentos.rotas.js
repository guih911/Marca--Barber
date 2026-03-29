const { Router } = require('express')
const { body, query } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const agendamentosControlador = require('./agendamentos.controlador')

const router = Router()

router.use(autenticar)

// GET /api/disponibilidade
router.get(
  '/disponibilidade',
  [
    query('profissionalId').notEmpty().withMessage('profissionalId é obrigatório'),
    query('servicoId').notEmpty().withMessage('servicoId é obrigatório'),
    query('data').notEmpty().withMessage('data é obrigatória (YYYY-MM-DD)'),
  ],
  validar,
  agendamentosControlador.disponibilidade
)

router.get('/', agendamentosControlador.listar)
router.get('/:id', agendamentosControlador.buscarPorId)

router.post(
  '/',
  [
    body('clienteId').notEmpty().withMessage('clienteId é obrigatório'),
    body('profissionalId').notEmpty().withMessage('profissionalId é obrigatório'),
    body('servicoId').notEmpty().withMessage('servicoId é obrigatório'),
    body('inicio').isISO8601().withMessage('Data de início inválida'),
  ],
  validar,
  agendamentosControlador.criar
)

router.patch('/:id/confirmar', agendamentosControlador.confirmar)
router.patch('/:id/confirmar-presenca', agendamentosControlador.confirmarPresenca)
router.patch('/:id/cancelar', agendamentosControlador.cancelar)
router.patch(
  '/:id/remarcar',
  [body('novoInicio').isISO8601().withMessage('Nova data inválida')],
  validar,
  agendamentosControlador.remarcar
)
router.patch('/:id/concluir', agendamentosControlador.concluir)
router.patch('/:id/nao-compareceu', agendamentosControlador.naoCompareceu)

router.post(
  '/cancelar-periodo',
  [
    body('dataInicio').isISO8601().withMessage('dataInicio inválida (YYYY-MM-DD)'),
    body('dataFim').isISO8601().withMessage('dataFim inválida (YYYY-MM-DD)'),
  ],
  validar,
  agendamentosControlador.cancelarPeriodo
)

router.post(
  '/promocao',
  [body('mensagem').notEmpty().withMessage('mensagem é obrigatória')],
  validar,
  agendamentosControlador.enviarPromocao
)

router.post('/gerar-mensagem-cancelamento', agendamentosControlador.gerarMensagemCancelamento)

module.exports = router

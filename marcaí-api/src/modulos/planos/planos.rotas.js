const { Router } = require('express')
const { body, param, query } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const planosControlador = require('./planos.controlador')
const {
  PLANOS_TENANT_VALIDOS,
  STATUS_ASSINATURA_VALIDOS,
  STATUS_CAMPANHA_VALIDOS,
  TIPOS_CAMPANHA_VALIDOS,
} = require('./planos.servico')

const router = Router()

router.use(autenticar)

router.get('/meu', planosControlador.meu)
router.put(
  '/meu',
  [
    body('planoTenant').optional().isIn(PLANOS_TENANT_VALIDOS),
    body('growthAtivo').optional().isBoolean(),
    body('membershipsAtivo').optional().isBoolean(),
    body('biAvancadoAtivo').optional().isBoolean(),
    body('cancelamentoMassaAtivo').optional().isBoolean(),
    body('nicho').optional().trim(),
  ],
  validar,
  planosControlador.atualizarMeu
)

router.get('/assinaturas', planosControlador.listarPlanos)
router.post(
  '/assinaturas',
  [
    body('nome').trim().notEmpty().withMessage('nome é obrigatório'),
    body('precoCentavos').optional().isInt({ min: 0 }),
    body('cicloDias').optional().isInt({ min: 1, max: 3650 }),
    body('ativo').optional().isBoolean(),
    body('descricao').optional().isString(),
    body('creditosPorServico').optional().isArray(),
    body('creditosPorServico.*.servicoId').optional().isUUID(),
    body('creditosPorServico.*.creditos').optional().isInt({ min: 1, max: 99 }),
  ],
  validar,
  planosControlador.criarPlano
)
router.patch(
  '/assinaturas/:id',
  [
    param('id').isUUID().withMessage('id inválido'),
    body('nome').optional().trim().notEmpty(),
    body('precoCentavos').optional().isInt({ min: 0 }),
    body('cicloDias').optional().isInt({ min: 1, max: 3650 }),
    body('ativo').optional().isBoolean(),
    body('descricao').optional().isString(),
    body('creditosPorServico').optional().isArray(),
    body('creditosPorServico.*.servicoId').optional().isUUID(),
    body('creditosPorServico.*.creditos').optional().isInt({ min: 1, max: 99 }),
  ],
  validar,
  planosControlador.atualizarPlano
)
router.delete(
  '/assinaturas/:id',
  [param('id').isUUID().withMessage('id inválido')],
  validar,
  planosControlador.removerPlano
)

router.get(
  '/assinaturas-clientes',
  [
    query('clienteId').optional().isUUID(),
    query('status').optional().isIn(STATUS_ASSINATURA_VALIDOS),
  ],
  validar,
  planosControlador.listarAssinaturas
)
router.post(
  '/assinaturas-clientes',
  [
    body('clienteId').isUUID().withMessage('clienteId inválido'),
    body('planoAssinaturaId').isUUID().withMessage('planoAssinaturaId inválido'),
    body('status').optional().isIn(STATUS_ASSINATURA_VALIDOS),
    body('inicioEm').optional().isISO8601(),
    body('fimEm').optional().isISO8601(),
    body('proximaCobrancaEm').optional().isISO8601(),
    body('renovacaoAutomatica').optional().isBoolean(),
    body('observacoes').optional().isString(),
  ],
  validar,
  planosControlador.criarAssinatura
)
router.patch(
  '/assinaturas-clientes/:id',
  [
    param('id').isUUID().withMessage('id inválido'),
    body('status').optional().isIn(STATUS_ASSINATURA_VALIDOS),
    body('inicioEm').optional().isISO8601(),
    body('fimEm').optional().isISO8601(),
    body('proximaCobrancaEm').optional().isISO8601(),
    body('renovacaoAutomatica').optional().isBoolean(),
    body('observacoes').optional().isString(),
  ],
  validar,
  planosControlador.atualizarAssinatura
)
router.post(
  '/assinaturas-clientes/:id/pausar',
  [param('id').isUUID().withMessage('id inválido')],
  validar,
  planosControlador.pausarAssinatura
)
router.post(
  '/assinaturas-clientes/:id/retomar',
  [param('id').isUUID().withMessage('id inválido')],
  validar,
  planosControlador.retomarAssinatura
)
router.post(
  '/assinaturas-clientes/:id/cancelar',
  [
    param('id').isUUID().withMessage('id inválido'),
    body('observacoes').optional().isString(),
  ],
  validar,
  planosControlador.cancelarAssinatura
)
router.post(
  '/assinaturas-clientes/:id/pagamento',
  [
    param('id').isUUID().withMessage('id inválido'),
    body('pagoEm').optional().isISO8601(),
    body('observacoes').optional().isString(),
  ],
  validar,
  planosControlador.registrarPagamentoAssinatura
)

router.get(
  '/growth/simular',
  [
    query('diasSemRetorno').isInt({ min: 1, max: 365 }).withMessage('diasSemRetorno é obrigatório'),
    query('profissionalId').optional().isUUID(),
    query('servicoId').optional().isUUID(),
    query('limite').optional().isInt({ min: 1, max: 1000 }),
  ],
  validar,
  planosControlador.simularGrowth
)

router.get('/growth/campanhas', planosControlador.listarCampanhasGrowth)
router.post(
  '/growth/campanhas',
  [
    body('nome').trim().notEmpty().withMessage('nome é obrigatório'),
    body('tipo').isIn(TIPOS_CAMPANHA_VALIDOS),
    body('diasSemRetorno').isInt({ min: 1, max: 365 }),
    body('mensagem').trim().notEmpty().withMessage('mensagem é obrigatória'),
    body('profissionalId').optional().isUUID(),
    body('servicoId').optional().isUUID(),
    body('limite').optional().isInt({ min: 1, max: 1000 }),
  ],
  validar,
  planosControlador.criarCampanhaGrowth
)
router.post(
  '/growth/campanhas/:id/disparar',
  [
    param('id').isUUID().withMessage('id inválido'),
    body('diasSemRetorno').optional().isInt({ min: 1, max: 365 }),
    body('profissionalId').optional().isUUID(),
    body('servicoId').optional().isUUID(),
    body('limite').optional().isInt({ min: 1, max: 1000 }),
  ],
  validar,
  planosControlador.dispararCampanhaGrowth
)
router.post(
  '/growth/disparar',
  [
    body('campanhaGrowthId').optional().isUUID(),
    body('nome').optional().trim(),
    body('tipo').optional().isIn(TIPOS_CAMPANHA_VALIDOS),
    body('diasSemRetorno').optional().isInt({ min: 1, max: 365 }),
    body('mensagem').optional().trim(),
    body('profissionalId').optional().isUUID(),
    body('servicoId').optional().isUUID(),
    body('limite').optional().isInt({ min: 1, max: 1000 }),
  ],
  validar,
  planosControlador.dispararCampanhaGrowth
)

module.exports = router

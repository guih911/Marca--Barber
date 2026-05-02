const path = require('path')
const fs = require('fs')
const { Router } = require('express')
const { body } = require('express-validator')
const multer = require('multer')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const { CAMPOS_PERMITIDOS } = require('../../utils/gerarSugestaoConfigDon')
const tenantControlador = require('./tenant.controlador')

const router = Router()
const uploadsDir = path.join(__dirname, '../../../uploads/logos')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `tenant-${req.usuario.tenantId}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('Apenas imagens são permitidas'))
  },
})

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
    body('minutosMargemAutoCancelamento').optional().isInt({ min: 0, max: 180 }),
    body('filaReengajamentoHorario').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
    body('exigirConfirmacaoPresenca').optional().isBoolean(),
  ],
  validar,
  tenantControlador.atualizar
)

router.post('/meu/logo', autenticar, upload.single('logo'), tenantControlador.uploadLogo)

// PATCH /api/tenants/meu/configuracao-ia
router.patch(
  '/meu/configuracao-ia',
  autenticar,
  [
    body('tomDeVoz').optional().isIn(['FORMAL', 'DESCONTRALIDO', 'ACOLHEDOR']),
    body('antecedenciaCancelar').optional().isInt({ min: 0 }),
    body('iaIncluirLinkAgendamento').optional().isBoolean(),
    body('apresentacaoSalaoAtivo').optional().isBoolean(),
    body('configMensagensDon').optional({ nullable: true }),
  ],
  validar,
  tenantControlador.atualizarConfiguracaoIA
)

// POST /api/tenants/meu/sugerir-mensagem-don
router.post(
  '/meu/sugerir-mensagem-don',
  autenticar,
  [body('campo').isIn(CAMPOS_PERMITIDOS).withMessage('Campo inválido')],
  validar,
  tenantControlador.sugerirMensagemConfigDon
)

module.exports = router

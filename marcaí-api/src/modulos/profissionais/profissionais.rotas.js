const path = require('path')
const { Router } = require('express')
const { body } = require('express-validator')
const multer = require('multer')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const profissionaisControlador = require('./profissionais.controlador')

const uploadsDir = path.join(__dirname, '../../../uploads/avatares')
require('fs').mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `prof-${req.params.id}-${Date.now()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('Apenas imagens são permitidas'))
  },
})

const router = Router()

router.use(autenticar)

router.get('/', profissionaisControlador.listar)
router.get('/:id', profissionaisControlador.buscarPorId)

router.post(
  '/',
  [body('nome').trim().notEmpty().withMessage('Nome é obrigatório')],
  validar,
  profissionaisControlador.criar
)

router.patch(
  '/:id',
  [
    body('nome').optional().trim().notEmpty(),
    body('bufferMinutos').optional().isInt({ min: 0 }),
    body('ativo').optional().isBoolean(),
  ],
  validar,
  profissionaisControlador.atualizar
)

router.delete('/:id', profissionaisControlador.remover)

router.post(
  '/:id/servicos',
  [body('servicos').isArray().withMessage('Serviços devem ser um array')],
  validar,
  profissionaisControlador.atualizarServicos
)

router.post(
  '/:id/ausencia',
  [body('data').notEmpty().withMessage('data é obrigatória (YYYY-MM-DD)')],
  validar,
  profissionaisControlador.registrarAusencia
)

router.post('/:id/avatar', upload.single('avatar'), profissionaisControlador.uploadAvatar)

module.exports = router

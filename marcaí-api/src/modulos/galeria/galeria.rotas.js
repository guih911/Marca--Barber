const path = require('path')
const { Router } = require('express')
const multer = require('multer')
const { autenticar } = require('../../middlewares/autenticacao')
const galeriaControlador = require('./galeria.controlador')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../../uploads/galeria'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `galeria-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('Apenas imagens são permitidas'))
  },
})

const router = Router()
router.use(autenticar)

router.get('/', galeriaControlador.listar)
router.post('/', upload.single('foto'), galeriaControlador.criar)
router.patch('/:id', galeriaControlador.atualizar)
router.delete('/:id', galeriaControlador.remover)

module.exports = router

const { Router } = require('express')
const { body } = require('express-validator')
const multer = require('multer')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const clientesControlador = require('./clientes.controlador')

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nome = String(file.originalname || '').toLowerCase()
    if (
      file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || nome.endsWith('.csv')
    ) cb(null, true)
    else cb(new Error('Envie uma planilha CSV (.csv)'))
  },
})

router.use(autenticar)

router.get('/', clientesControlador.listar)
router.get('/aniversariantes', clientesControlador.aniversariantes)
router.post('/importar', upload.single('arquivo'), clientesControlador.importar)
router.get('/:id', clientesControlador.buscarPorId)

router.post(
  '/',
  [
    body('nome').trim().notEmpty().withMessage('Nome e obrigatorio'),
    body('telefone').trim().notEmpty().withMessage('Telefone e obrigatorio'),
    body('email').optional({ nullable: true }).isEmail().withMessage('E-mail invalido'),
    body('notas').optional({ nullable: true }).isString(),
    body('tipoCortePreferido').optional({ nullable: true }).isString(),
    body('preferencias').optional({ nullable: true }).isString(),
  ],
  validar,
  clientesControlador.criar
)

router.patch(
  '/:id',
  [
    body('nome').optional().trim().notEmpty(),
    body('telefone').optional().trim().notEmpty().withMessage('Telefone invalido'),
    body('email').optional({ nullable: true }).isEmail(),
    body('notas').optional({ nullable: true }).isString(),
    body('tipoCortePreferido').optional({ nullable: true }).isString(),
    body('preferencias').optional({ nullable: true }).isString(),
    body('tags').optional().isArray(),
    body('dataNascimento').optional({ nullable: true }).isISO8601().withMessage('Data de nascimento invalida'),
  ],
  validar,
  clientesControlador.atualizar
)

router.post('/:id/desativar', clientesControlador.desativar)
router.post('/:id/reativar', clientesControlador.reativar)
router.delete('/:id', clientesControlador.remover)

module.exports = router

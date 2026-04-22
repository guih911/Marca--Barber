const { Router } = require('express')
const { body } = require('express-validator')
const { autenticar } = require('../../middlewares/autenticacao')
const { validar } = require('../../middlewares/validacao')
const conversasControlador = require('./conversas.controlador')

const router = Router()

router.use(autenticar)

router.get('/', conversasControlador.listar)
router.get('/por-cliente/:clienteId', conversasControlador.abrirPorCliente)
router.get('/:id', conversasControlador.buscarPorId)

router.post(
  '/:id/mensagens',
  [body('conteudo').trim().notEmpty().withMessage('Conteúdo da mensagem é obrigatório')],
  validar,
  conversasControlador.enviarMensagem
)

router.patch('/:id/assumir', conversasControlador.assumir)
router.patch('/:id/devolver', conversasControlador.devolver)
router.patch('/:id/encerrar', conversasControlador.encerrar)
router.patch('/:id/reabrir', conversasControlador.reabrir)

router.post(
  '/:id/notas',
  [body('conteudo').trim().notEmpty().withMessage('Conteúdo da nota é obrigatório')],
  validar,
  conversasControlador.adicionarNota
)

module.exports = router

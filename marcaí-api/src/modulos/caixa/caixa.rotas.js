const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const caixaControlador = require('./caixa.controlador')

const router = Router()
router.use(autenticar)

router.get('/atual', caixaControlador.obterAtual)
router.get('/', caixaControlador.listar)
router.get('/visao-geral', caixaControlador.obterVisaoGeral)
router.get('/:id/resumo', caixaControlador.obterResumoPorId)
router.post('/abrir', caixaControlador.abrir)
router.post('/fechar', caixaControlador.fechar)
router.post('/movimentacao', caixaControlador.registrarMovimentacao)

module.exports = router

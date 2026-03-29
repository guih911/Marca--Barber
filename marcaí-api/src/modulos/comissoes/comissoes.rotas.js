const { Router } = require('express')
const { autenticar } = require('../../middlewares/autenticacao')
const ctrl = require('./comissoes.controlador')

const router = Router()
router.use(autenticar)

router.get('/', ctrl.calcular)
router.patch('/profissionais/:profissionalId/servicos/:servicoId', ctrl.atualizarComissao)
router.patch('/profissionais/:profissionalId/padrao', ctrl.atualizarComissaoPadrao)

module.exports = router

const comissoesServico = require('./comissoes.servico')

const calcular = async (req, res, next) => {
  try {
    const dados = await comissoesServico.calcularComissoes(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const atualizarComissao = async (req, res, next) => {
  try {
    const { profissionalId, servicoId } = req.params
    const { comissaoPercent } = req.body
    const dados = await comissoesServico.atualizarComissao(req.usuario.tenantId, profissionalId, servicoId, comissaoPercent)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const atualizarComissaoPadrao = async (req, res, next) => {
  try {
    const { profissionalId } = req.params
    const { comissaoPercent } = req.body
    const dados = await comissoesServico.atualizarComissaoPadrao(req.usuario.tenantId, profissionalId, comissaoPercent)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

module.exports = { calcular, atualizarComissao, atualizarComissaoPadrao }

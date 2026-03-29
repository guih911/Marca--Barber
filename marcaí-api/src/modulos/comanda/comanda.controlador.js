const comandaServico = require('./comanda.servico')

const obterComanda = async (req, res, next) => {
  try {
    const dados = await comandaServico.obterComanda(req.usuario.tenantId, req.params.agendamentoId)
    res.json({ sucesso: true, dados })
  } catch (err) { next(err) }
}

const adicionarItem = async (req, res, next) => {
  try {
    const item = await comandaServico.adicionarItem(req.usuario.tenantId, req.params.agendamentoId, req.body)
    res.status(201).json({ sucesso: true, dados: item })
  } catch (err) { next(err) }
}

const removerItem = async (req, res, next) => {
  try {
    await comandaServico.removerItem(req.usuario.tenantId, req.params.agendamentoId, req.params.itemId)
    res.json({ sucesso: true })
  } catch (err) { next(err) }
}

const enviarRecibo = async (req, res, next) => {
  try {
    const resultado = await comandaServico.enviarReciboWhatsApp(req.usuario.tenantId, req.params.agendamentoId)
    res.json({ sucesso: true, dados: resultado })
  } catch (err) { next(err) }
}

module.exports = { obterComanda, adicionarItem, removerItem, enviarRecibo }

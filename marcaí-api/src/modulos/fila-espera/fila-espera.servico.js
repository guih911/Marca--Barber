const filaEsperaServico = require('../filaEspera/filaEspera.servico')

const criar = async (tenantId, dados) => filaEsperaServico.entrar(tenantId, dados)

const atualizarStatus = async (tenantId, id, status) =>
  filaEsperaServico.atualizarStatusManual(tenantId, id, status)

module.exports = {
  listar: filaEsperaServico.listar,
  criar,
  atualizarStatus,
  remover: filaEsperaServico.remover,
}

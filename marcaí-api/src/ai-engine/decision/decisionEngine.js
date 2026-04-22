const engine = require('../../modulos/ia/engine')
const { detectarIntencao } = require('../intent/intentClassifier')

const montarDecisaoIA = async ({
  mensagem,
  tenantId,
  clienteId,
  timezone,
  tenant,
  contextoConversa = {},
  instrucaoExtra = '',
}) => {
  const intencao = detectarIntencao({
    mensagem,
    temContextoRecenteDeRemarcacao: Boolean(contextoConversa.temContextoRecenteDeRemarcacao),
  })

  const dadosEngineBase = intencao
    ? await engine.buscarDadosReais(intencao, {
        tenantId,
        clienteId,
        timezone,
        tenant,
        mensagem,
      })
    : ''

  const instrucaoEngine = `${dadosEngineBase || ''}${instrucaoExtra || ''}`.trim()
  const usarModeloComplexo = engine.deveUsarModeloComplexo(mensagem, intencao)

  return {
    intencao,
    instrucaoEngine,
    usarModeloComplexo,
  }
}

module.exports = {
  montarDecisaoIA,
}

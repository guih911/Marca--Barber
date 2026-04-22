# AI Engine

Camada de decisao conversacional separada da camada HTTP.

## Estrutura inicial

- `intent/intentClassifier.js`: classificacao de intencao e ajustes de contexto curto
- `decision/decisionEngine.js`: orquestra intencao, dados reais e escolha de complexidade
- `response/responsePolicy.js`: politica de texto final (clareza, objetividade, anti-robotico)

## Objetivo

Evoluir a engine para um fluxo previsivel:

1. intencao
2. contexto
3. dados reais
4. regra de negocio
5. resposta
6. proximo passo

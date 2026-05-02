# Ciclo Semanal de Melhoria da IA (Don Barber)

Objetivo: manter a IA em nível de recepcionista sênior, focada em conversão, ocupação de agenda e baixo no-show.

## 1) Métricas (toda semana)

Executar:

`npm run ia:relatorio-semanal -- --dias=7`

Opcional por tenant:

`npm run ia:relatorio-semanal -- --dias=7 --tenantId=<ID>`

KPIs acompanhados:
- `taxaNoShow`
- `taxaCancelamento`
- `taxaEscalonamento` (conversa enviada para humano)
- `tempoMedioPrimeiraRespostaSeg`
- `remarcados` (indica retenção/recuperação de agenda)

## 2) Qualidade de resposta (amostragem)

- Selecionar 20 conversas recentes por tenant.
- Marcar score de 1 a 5 em:
  - Clareza
  - Tom humano/brasileiro
  - Resolução sem fricção
  - Aderência operacional (ferramenta certa, sem invenção)

Meta: média >= 4.3.

## 3) Guardrails de prompt (ajuste iterativo)

- Ajustar prompt apenas com evidência de métrica/conversa.
- Limite: no máximo 2 mudanças por semana no playbook principal.
- Re-testar com `npm test` e amostra de conversas antes de subir.

## 4) Checklist semanal (go/no-go)

- [ ] Taxa de no-show <= 15%
- [ ] Taxa de escalonamento <= 12%
- [ ] Tempo médio de primeira resposta <= 120s
- [ ] Fluxos de agendar/remarcar/cancelar sem regressão em amostras
- [ ] Lembretes alinhados com Meu Negócio e sem duplicidade de texto
- [ ] Build e deploy sem erro

## 5) Ações recomendadas quando sair da meta

- No-show alto: revisar texto de lembrete no dia e dia anterior; testar combinação 2h + 24h.
- Escalonamento alto: identificar intents com maior fuga e reforçar detecção/fluxo.
- Resposta lenta: reduzir prolixidade e instruções redundantes; forçar próximo passo curto.
- Cancelamento alto: reforçar oferta de alternativa no mesmo dia e fila de espera.


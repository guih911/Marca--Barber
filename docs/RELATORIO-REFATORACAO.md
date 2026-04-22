# Relatorio de Refatoracao

## 1) Diagnostico encontrado

- inconsistencias de arquitetura entre modulos
- duplicidade de regra na fila de espera
- pontos de seguranca no admin (segredos hardcoded, seed default)
- enums inconsistentes em conversa
- engine de IA grande e com alto acoplamento
- telas de IA no web sem roteamento oficial

## 2) O que foi reestruturado

### Arquitetura e seguranca

- hardening do `marcai-admin`:
  - `docker-compose.yml` sem segredos fixos
  - bootstrap de superadmin via env
  - `prisma migrate deploy` no container
- `auth.js` da API sem segredo de desenvolvimento fixo em fallback

### Negocio

- unificacao de responsabilidades da fila de espera
- ajuste de status de conversa (`ENCERRADA`) onde havia valor invalido

### IA

- criacao de estrutura inicial de `ai-engine`:
  - `intentClassifier`
  - `decisionEngine`
  - `responsePolicy`
- integracao do `decisionEngine` no webhook de atendimento
- aplicacao de politica de resposta para reduzir texto robotico/repetitivo

### Web

- habilitacao das rotas de configuracao e teste da IA
- item de menu para IA recepcionista no sidebar

### Landing

- reforco de proposta comercial com foco em:
  - IA recepcionista
  - lista de espera
  - planos e combos
- adicionada secao de prova social

## 3) O que ainda falta

- quebrar `ia.servico.js` em modulos menores por responsabilidade
- consolidar contratos tipados compartilhados (api/web/mobile/admin)
- fortalecer observabilidade da IA (metricas por fluxo e tool-call)
- suite E2E de conversa (intencao -> ferramentas -> resposta)
- governanca completa de multi-tenant (limites/plano/capacidade)

## 4) Checklist produto pronto para venda

- Pronto:
  - seguranca inicial admin
  - fila de espera consolidada
  - base modular do ai-engine criada
  - UX minima da IA no web e landing comercial mais clara
- Parcial:
  - arquitetura limpa da API
  - modelagem de dominio SaaS completa
  - padronizacao total de frontend/mobile/admin
  - observabilidade e testes de regressao
- Faltando:
  - pacote comercial completo (planos SaaS e billing operacional)
  - SLOs e monitoramento de producao
  - onboarding guiado de tenant e operacao assistida

# Marcaí Barber SaaS

Monorepo com produtos da plataforma Marcaí para barbearias:

- `marcaí-api`: API principal (agenda, clientes, planos, combos, IA e operação)
- `marcaí-web`: painel operacional da barbearia
- `marcai-mobile`: app mobile de operação
- `marcai-admin`: backoffice administrativo (`api` + `web`)
- `marcai-landing`: landing comercial

## Objetivo de produto

Transformar o sistema em SaaS profissional, multi-tenant, com IA recepcionista útil para:

- agendar, confirmar, remarcar e cancelar
- operar lista de espera com promoção de vaga
- apoiar vendas de plano mensal e combos
- manter tom humano, curto e objetivo

## Estrutura-alvo (alto nível)

```text
api/
  src/
    modules/
    ai-engine/
    shared/
    infra/
web/
  src/
    domains/
    components/
    services/
mobile/
  src/
    domains/
    screens/
    services/
admin/
  api/
  web/
landing/
  src/
```

## Padrões de código

- JavaScript/React com formatação via Prettier
- regras básicas com ESLint
- convenções:
  - `camelCase` para variáveis/funções
  - `PascalCase` para componentes/classes
  - `UPPER_CASE` para constantes globais

## Segurança mínima

- sem segredos hardcoded em arquivos versionados
- bootstrap inicial de admin via variáveis de ambiente
- migrations com `prisma migrate deploy` em produção

## Documentação complementar

- `docs/RELATORIO-REFATORACAO.md`
- `docs/MODELO-DOMINIO-SAAS.md`
- `docs/IA-RECEPCIONISTA-V2.md`

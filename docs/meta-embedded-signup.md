# Meta Embedded Signup

Este projeto já está preparado para operar apenas com a integração oficial da Meta, sem QR Code.

## Variáveis do servidor

Defina estas variáveis em `/opt/marca-barber/.env`:

- `META_GRAPH_API_VERSION`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_WEBHOOK_CALLBACK_URL`

Produção atual:

- `META_WEBHOOK_CALLBACK_URL=https://barber.marcaí.com/api/ia/webhook/meta`

## O que criar no painel da Meta

1. Crie ou use um app do tipo `Business`.
2. Adicione o produto `WhatsApp`.
3. Ative o fluxo `Embedded Signup`.
4. Gere o `Configuration ID` do Embedded Signup.
5. Configure o webhook do app com:
   - Callback URL: `https://barber.marcaí.com/api/ia/webhook/meta`
   - Verify token: o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN`
6. No app, mantenha habilitados os eventos do WhatsApp necessários para mensagens.

## Como o sistema usa esses dados

- O frontend inicia o Embedded Signup em `Configurações -> Integrações`.
- A Meta devolve um `code` e os IDs do canal oficial.
- A API troca o `code` por token, salva o `phoneNumberId`, `wabaId` e `businessAccountId` no tenant.
- O webhook oficial passa a resolver o tenant por `phoneNumberId` ou `wabaId`.

## Campos salvos por tenant

Na configuração do WhatsApp do tenant, o sistema salva:

- `provedor=meta`
- `token`
- `apiToken`
- `appId`
- `configId`
- `phoneNumberId`
- `wabaId`
- `businessAccountId`
- `displayPhoneNumber`
- `verifiedName`
- `webhookVerifyToken`
- `webhookCallbackUrl`
- `embeddedSignupAt`

## Validação rápida

Depois de preencher as variáveis:

1. Reinicie a API com `docker compose up -d marcai-api marcai-web`.
2. Abra `Configurações -> Integrações`.
3. Confirme que a tela não mostra mais aviso de variáveis ausentes.
4. Clique em `Conectar com a Meta`.
5. Finalize o fluxo do Facebook/WhatsApp.
6. Verifique se o número oficial aparece como conectado.

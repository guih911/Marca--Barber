# Checklist: validação ponta a ponta da IA (dev local + Anthropic)

Objetivo: garantir **mensagem recebida → processamento (LLM + ferramentas) → resposta / escalonamento** com observabilidade clara, **sem depender do Sendzen** para o núcleo da engine.

---

## 1. Pré-condições

| Item | Verificação |
|------|-------------|
| API | `npm run dev` em `marcaí-api` (porta padrão **3001**). |
| Banco | `DATABASE_URL` válido; migrações aplicadas. |
| Anthropic | `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL=claude-sonnet-4-6` (ou `ANTHROPIC_MODEL_COMPLEXO` para fluxo “complexo”). |
| JWT de teste | Usuário logado no web **ou** token obtido via `/api/auth/login` (ou fluxo do projeto) com `Authorization: Bearer <token>`. |
| Túnel (opcional) | Se for testar **links** gerados pela IA (agenda, plano) como um cliente real veria, defina `APP_URL` = URL pública do túnel (ex.: `https://xyz.ngrok-free.app`), senão a IA usa fallbacks de URL. |

> **Segurança:** não commite `.env`. Se uma chave (Anthropic, JWT, etc.) vazou em chat ou repositório, **revogue e gere outra** no painel do provedor.

---

## 2. Rotas relevantes (referência)

| Método | Caminho | Auth | Uso |
|--------|---------|------|-----|
| `POST` | `/api/ia/webhook` | Não* | Webhook **interno**: corpo com `telefone`, `mensagem`, `tenantId` (ou header `x-tenant-id`). |
| `POST` | `/api/ia/teste` | Sim | Teste completo no tenant do usuário; default `+5511900000001` / "Cliente Teste". |
| `POST` | `/api/ia/teste/suite` | Sim | Roda a suíte `CENARIOS_WHATSAPP_BR` (opcional: `filtros` no body). |
| `POST` | `/api/ia/teste/resetar` | Sim | Limpa dados do cliente de teste. |
| `POST` | `/api/ia/webhook/sendzen` e `.../sendzen/:tenantId` | Não (payload real) | Integração **Sendzen**; logs `[Webhook Sendzen]`. |
| `POST` | `/api/ia/webhook/meta` e `.../meta/:tenantId` | Não | Meta Cloud API. |

\* Ideal proteger em produção (IP allowlist, secret, etc.).

---

## 3. Teste rápido **sem** Sendzen (recomendado no dia a dia)

### 3.1 Webhook interno (curl)

Substitua `TENANT_ID` e, se necessário, o host.

```bash
curl -s -X POST "http://localhost:3001/api/ia/webhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"tenantId\":\"TENANT_ID\",\"telefone\":\"+5511999999999\",\"mensagem\":\"oi, quero agendar corte amanha\"}"
```

**Esperado:** `200` com `sucesso: true` e `dados` contendo a resposta da engine (texto, flags como `escalonado` quando aplicável).

### 3.2 Fluxo autenticado (Insomnia/Postman/curl com JWT)

```bash
curl -s -X POST "http://localhost:3001/api/ia/teste" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer SEU_JWT" ^
  -d "{\"mensagem\":\"quero falar com humano\"}"
```

**Esperado:** resposta com `escalonado: true` quando a tool `escalonarParaHumano` for acionada.

---

## 4. O que olhar no **terminal** (logs)

| Marcador / tema | O que indica |
|-----------------|--------------|
| `[Webhook Sendzen Bruto]` | Payload bruto do Sendzen (só se usar essa rota). |
| `[Engine]` / `[Webhook]` | Processamento, erros serializados por conversa. |
| Erros de fetch / 401 / 429 | Chave Anthropic, quota ou rede. |
| Resposta vazia ou fallback | `clienteLLMDisponivel` falso ou erro no `chamarLLMComFerramentas`. |

Para **comparar qualidade/custo** antes e depois da migração, anote por cenário: tempo de resposta, uso aproximado de tokens (se o provedor expuser), ocorrência de `escalonado` e de alertas na suíte.

---

## 5. Suíte automática (regressão)

`POST /api/ia/teste/suite` com JWT:

- **Corpo vazio** ou `{"filtros":[]}`: executa **todos** os cenários de `CENARIOS_WHATSAPP_BR` (pode demorar).
- **Filtro parcial** pelo **nome** do cenário: o código usa `cenario.nome.includes(filtro)`.

Exemplo (só cenários cujo nome contém `agendamento`):

```json
{ "filtros": ["agendamento"] }
```

**Campos úteis na resposta:** `resumo.totalEscalonamentos`, `resumo.totalErros`, `resumo.distribuicaoAlertas`, `resultados[]` com `respostas` por passo.

---

## 6. Dez cenários manuais sugeridos (cobertura alinhada ao produto)

Use `/api/ia/teste` (ou `/api/ia/webhook` com o mesmo `telefone`/`tenantId` para manter a conversa) e marque passo a passo.

| # | Foco | Nome do cenário na suíte (para `filtros`) | Passos mínimos / observação |
|---|------|-------------------------------------------|-----------------------------|
| 1 | Novo agendamento | `horario_especifico_pedido` ou `agendamento_semana_que_vem` | Verificar oferta de horários reais (sem inventar) e confirmação. |
| 2 | Reagendamento | `remarcar_horario` | Cliente conhecido; checar atualização no banco / agenda web. |
| 3 | Cancelamento | `cancelar_com_motivo` ou `cancelar_com_remarcacao` | Status do agendamento e tom adequado. |
| 4 | Confirmação de slot | `confirmacao_slot_sim` / `confirmacao_slot_nao` | `sim, fecha ai` vs recusa de horário. |
| 5 | Plano mensal | `plano_mensal_existente` | Resposta alinhada a planos cadastrados no tenant. |
| 6 | Combo / pacote | `combo_existente` ou `combo_tres_servicos` | Preços e regras só se existirem no sistema. |
| 7 | Preço / objeção | `preco_combo_objecao` | Comercial leve, sem prometer desconto inexistente. |
| 8 | Escalonamento humano | `pedido_humano` ou `reclamacao_grave_atendimento` | `escalonado: true` e conversa `ESCALONADA` (lista de chats / mobile com badge, se ativo). |
| 9 | NPS crítico | `nps_nota_1_escalona` | Deve priorizar atendimento humano. |
| 10 | Lista de espera | *(manual)* | Perguntar explicitamente p.ex. *"quero entrar na lista de espera para hoje"* e validar tool/regra do tenant. |

> A suíte **não** inclui hoje um cenário com nome contendo "fila" ou "espera"; o item 10 é **obrigatório** validar no chat real.

### Template de registro (qualidade / custo)

| Cenário | Data | OK? | Notas (tom, alucinação, tools) | Latência aprox. |
|---------|------|-----|--------------------------------|-----------------|
| … | 2026-04-22 | ☐ | | |

---

## 7. Sendzen em **dev** (sem "sujar" produção)

1. Sobe a API local e um **túnel HTTPS** (Cloudflare Tunnel, ngrok, etc.) apontando para `localhost:3001`.
2. No painel Sendzen, use a URL pública:  
   `https://SEU_TUNEL/api/ia/webhook/sendzen` **ou** `.../sendzen/{tenantId}` conforme a config do tenant.
3. Ajuste `SENDZEN_WEBHOOK_CALLBACK_URL` e/ou o que o app expõe em **config Sendzen** para bater com o path que o provedor chama.
4. Opcional: `SENDZEN_WEBHOOK_SECRET` alinhado ao secret do Sendzen.
5. Defina `APP_URL` = URL do túnel se quiser que links na mensagem apontem para o ambiente tunelado.

**Validação:** ao enviar uma mensagem de teste pelo número conectado, o terminal deve mostrar `[Webhook Sendzen Bruto]` e o fluxo deve seguir igual ao `processarWebhook` interno.

---

## 8. Encerramento do checklist

- [ ] Webhook interno ou `/teste` responde com Claude (sem erro de chave).
- [ ] Pelo menos um fluxo de **agendamento** e um de **cancelar/remarcar** validados.
- [ ] Pelo menos um **escalonamento** com `escalonado: true` e visível na UI de conversas.
- [ ] (Opcional) Sendzen com túnel apontando só para o ambiente de dev.
- [ ] (Opcional) `POST /teste/suite` com `filtros` finos para CI ou antes de release.

---

*Documento alinhado às rotas em `marcaí-api/src/modulos/ia/ia.rotas.js` e à suíte em `marcaí-api/src/modulos/ia/ia.teste.servico.js`.*

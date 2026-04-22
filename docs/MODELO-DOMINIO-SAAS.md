# Modelo de Dominio SaaS (Barbearias)

## Entidades principais

- `Barbershop` (Tenant)
- `User`
- `Barber`
- `Client`
- `Service`
- `Combo`
- `SubscriptionPlan`
- `ClientSubscription`
- `Appointment`
- `WaitlistEntry`
- `Availability`
- `Conversation`
- `Message`
- `AIInteraction`
- `Payment`
- `Notification`

## Diretrizes de modelagem

- toda entidade de negocio deve ter `tenantId` (multi-tenant)
- status com enum fechado e nomes consistentes
- datas de auditoria (`createdAt`, `updatedAt`) em todas entidades relevantes
- separar estado operacional (agenda/fila) de estado comercial (planos/pagamentos)

## Regras de negocio chave

### Agendamento

- criar, confirmar, remarcar, cancelar, no-show
- nunca confirmar horario sem disponibilidade real

### Lista de espera

- entrada por servico/profissional/data preferencial
- notificacao quando surgir vaga compativel
- expiracao de oferta e promocao automatica da fila

### Planos mensais

- plano com creditos, regras e validade
- uso de credito apenas em servicos elegiveis

### Combos

- pacote promocional com servicos, preco e validade opcional
- oferta contextual, sem insistencia

## Contratos multi-tenant

- autenticacao sempre resolve tenant do usuario/token
- queries sempre filtradas por tenant
- recursos e limites guiados por plano do tenant

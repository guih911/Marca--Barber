-- Configuração do Don: link opcional e templates de lembretes (JSON)
ALTER TABLE "tenants" ADD COLUMN "iaIncluirLinkAgendamento" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN "configMensagensDon" JSONB;

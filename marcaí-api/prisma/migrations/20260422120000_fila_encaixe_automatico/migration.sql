-- Encaixe automático: opt-in na fila; flag no tenant
ALTER TABLE "fila_espera" ADD COLUMN IF NOT EXISTS "aceitaEncaixeAutomatico" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "filaEncaixeAutomaticoAtivo" BOOLEAN NOT NULL DEFAULT true;

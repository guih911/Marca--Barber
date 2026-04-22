-- Reparação: histórico de migrações indicava aplicação sem o DDL ter corrido (drift).
-- Idempotente: seguro reexecutar.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "lembretesMinutosAntes" JSONB;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "lembretesConfiguradosEnviados" JSONB;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_facebookId_key" ON "usuarios"("facebookId");

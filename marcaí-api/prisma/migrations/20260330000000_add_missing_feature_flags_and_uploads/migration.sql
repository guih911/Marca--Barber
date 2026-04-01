-- Adiciona colunas de feature flags que estavam no schema mas ausentes no banco.
-- Usa IF NOT EXISTS para ser idempotente (seguro re-executar).

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "galeriaAtivo"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "listaEsperaAtivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "caixaAtivo"       BOOLEAN NOT NULL DEFAULT false;

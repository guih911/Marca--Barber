-- AlterTable: adiciona campos de informações do negócio para IA e clientes
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tiposPagamento" JSONB;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cortaCabeloInfantil" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "idadeMinimaCabeloInfantilMeses" INTEGER;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "numeroDono" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "diferenciais" JSONB;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "linkMaps" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "apresentacaoSalaoAtivo" BOOLEAN NOT NULL DEFAULT true;

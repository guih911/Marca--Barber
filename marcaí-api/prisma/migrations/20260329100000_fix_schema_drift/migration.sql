-- ============================================================
-- Fix schema drift: add all missing columns, tables, enum values
-- ============================================================

-- 1. Add missing enum value LINK_PUBLICO to CanalOrigem
ALTER TYPE "CanalOrigem" ADD VALUE IF NOT EXISTS 'LINK_PUBLICO';

-- 2. Add missing columns to "agendamentos"
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "formaPagamento2" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "valorPagamento2Centavos" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "descontoCentavos" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "gorjetaCentavos" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "npsEnviadoEm" TIMESTAMP(3);

-- 3. Add missing columns to "clientes"
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "alergias" TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "frequenciaRetornoIdealDias" INTEGER;

-- 4. Add missing column to "planos_assinatura"
ALTER TABLE "planos_assinatura" ADD COLUMN IF NOT EXISTS "diasPermitidos" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- 5. Create missing table "fotos_galeria"
CREATE TABLE IF NOT EXISTS "fotos_galeria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "clienteId" TEXT,
    "agendamentoId" TEXT,
    "fotoUrl" TEXT NOT NULL,
    "titulo" TEXT,
    "descricao" TEXT,
    "servicoNome" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fotos_galeria_pkey" PRIMARY KEY ("id")
);

-- Index on fotos_galeria
CREATE INDEX IF NOT EXISTS "fotos_galeria_tenantId_criadoEm_idx" ON "fotos_galeria"("tenantId", "criadoEm");

-- Foreign keys for fotos_galeria
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fotos_galeria_tenantId_fkey') THEN
    ALTER TABLE "fotos_galeria" ADD CONSTRAINT "fotos_galeria_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fotos_galeria_profissionalId_fkey') THEN
    ALTER TABLE "fotos_galeria" ADD CONSTRAINT "fotos_galeria_profissionalId_fkey"
      FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

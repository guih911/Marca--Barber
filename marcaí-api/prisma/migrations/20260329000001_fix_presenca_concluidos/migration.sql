-- Add concluidoEm column to agendamentos (was missing from previous migrations)
ALTER TABLE "agendamentos"
ADD COLUMN IF NOT EXISTS "concluidoEm" TIMESTAMP(3);

-- Fix: set presencaConfirmadaEm for all CONCLUIDO appointments that have NULL presence
UPDATE "agendamentos"
SET "presencaConfirmadaEm" = "concluidoEm"
WHERE status = 'CONCLUIDO'
  AND "presencaConfirmadaEm" IS NULL
  AND "concluidoEm" IS NOT NULL;

-- For those without concluidoEm, use updatedAt
UPDATE "agendamentos"
SET "presencaConfirmadaEm" = "atualizadoEm"
WHERE status = 'CONCLUIDO'
  AND "presencaConfirmadaEm" IS NULL
  AND "concluidoEm" IS NULL;

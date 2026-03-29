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

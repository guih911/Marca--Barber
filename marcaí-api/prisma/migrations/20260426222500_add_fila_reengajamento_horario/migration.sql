-- Horário configurável por tenant para reengajamento da fila no fim do dia.
ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "filaReengajamentoHorario" TEXT NOT NULL DEFAULT '20:30';

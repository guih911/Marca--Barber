-- AlterTable: adiciona modoBarbeiro na conversa para persistir modo de avaliação
ALTER TABLE "conversas" ADD COLUMN IF NOT EXISTS "modoBarbeiro" BOOLEAN NOT NULL DEFAULT false;

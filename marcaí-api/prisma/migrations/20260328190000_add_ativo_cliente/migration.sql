-- AlterTable: adiciona campo ativo no cliente para desativação/arquivamento
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;

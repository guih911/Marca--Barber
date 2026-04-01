-- Adiciona hashPublico aos tenants (hash curto para URLs públicas)
-- Usa IF NOT EXISTS para ser idempotente

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hashPublico" TEXT;

-- Cria índice único ignorando NULLs
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_hashPublico_key" ON "tenants"("hashPublico");

-- Gera hash alfanumérico de 8 caracteres para tenants sem hash
-- Usa md5(random()) que é nativo do PostgreSQL (sem extensões)
DO $$
DECLARE
  r RECORD;
  novo_hash TEXT;
  tentativas INT;
BEGIN
  FOR r IN SELECT id FROM "tenants" WHERE "hashPublico" IS NULL LOOP
    tentativas := 0;
    LOOP
      -- md5 gera 32 chars hex; pega os primeiros 8
      novo_hash := substring(md5(random()::text || clock_timestamp()::text), 1, 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "tenants" WHERE "hashPublico" = novo_hash);
      tentativas := tentativas + 1;
      EXIT WHEN tentativas > 20;
    END LOOP;
    UPDATE "tenants" SET "hashPublico" = novo_hash WHERE id = r.id;
  END LOOP;
END $$;

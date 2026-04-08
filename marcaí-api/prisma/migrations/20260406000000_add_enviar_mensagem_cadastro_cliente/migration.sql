ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "enviarMensagemAoCadastrarCliente" BOOLEAN NOT NULL DEFAULT true;

-- Adiciona lidWhatsapp à tabela clientes (Linked Device ID do WhatsApp)
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "lidWhatsapp" TEXT;

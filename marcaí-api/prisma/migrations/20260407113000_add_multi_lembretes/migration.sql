ALTER TABLE "tenants"
ADD COLUMN "lembretesMinutosAntes" JSONB;

ALTER TABLE "agendamentos"
ADD COLUMN "lembretesConfiguradosEnviados" JSONB;

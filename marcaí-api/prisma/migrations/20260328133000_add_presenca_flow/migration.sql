ALTER TABLE "tenants"
ADD COLUMN "exigirConfirmacaoPresenca" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "agendamentos"
ADD COLUMN "presencaConfirmadaEm" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "PlanoTenant" AS ENUM ('STARTER', 'PRO', 'ELITE');

-- CreateEnum
CREATE TYPE "StatusAssinaturaCliente" AS ENUM ('ATIVA', 'PAUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoCampanhaGrowth" AS ENUM ('REATIVACAO', 'RETENCAO', 'REENGAJAMENTO');

-- CreateEnum
CREATE TYPE "StatusCampanhaGrowth" AS ENUM ('RASCUNHO', 'AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusEnvioGrowth" AS ENUM ('SIMULADO', 'ENVIADO', 'FALHOU');

-- AlterTable
ALTER TABLE "tenants"
  ADD COLUMN     "nicho" TEXT,
  ADD COLUMN     "planoTenant" "PlanoTenant" NOT NULL DEFAULT 'STARTER',
  ADD COLUMN     "growthAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "membershipsAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "biAvancadoAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "cancelamentoMassaAtivo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "planos_assinatura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoCentavos" INTEGER NOT NULL DEFAULT 0,
    "cicloDias" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_assinatura_creditos" (
    "id" TEXT NOT NULL,
    "planoAssinaturaId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_assinatura_creditos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas_clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "planoAssinaturaId" TEXT NOT NULL,
    "status" "StatusAssinaturaCliente" NOT NULL DEFAULT 'ATIVA',
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fimEm" TIMESTAMP(3),
    "proximaCobrancaEm" TIMESTAMP(3),
    "renovacaoAutomatica" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas_cliente_creditos" (
    "id" TEXT NOT NULL,
    "assinaturaClienteId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "creditosIniciais" INTEGER NOT NULL DEFAULT 0,
    "creditosRestantes" INTEGER NOT NULL DEFAULT 0,
    "consumidos" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_cliente_creditos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas_growth" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampanhaGrowth" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "diasSemRetorno" INTEGER NOT NULL,
    "status" "StatusCampanhaGrowth" NOT NULL DEFAULT 'RASCUNHO',
    "totalAlvo" INTEGER NOT NULL DEFAULT 0,
    "totalEnviado" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_growth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas_growth_envios" (
    "id" TEXT NOT NULL,
    "campanhaGrowthId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "status" "StatusEnvioGrowth" NOT NULL DEFAULT 'SIMULADO',
    "mensagemErro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_growth_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planos_assinatura_creditos_planoAssinaturaId_servicoId_key" ON "planos_assinatura_creditos"("planoAssinaturaId", "servicoId");

-- CreateIndex
CREATE INDEX "planos_assinatura_tenantId_ativo_idx" ON "planos_assinatura"("tenantId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_cliente_creditos_assinaturaClienteId_servicoId_key" ON "assinaturas_cliente_creditos"("assinaturaClienteId", "servicoId");

-- CreateIndex
CREATE INDEX "assinaturas_cliente_creditos_servicoId_idx" ON "assinaturas_cliente_creditos"("servicoId");

-- CreateIndex
CREATE INDEX "assinaturas_clientes_tenantId_clienteId_status_idx" ON "assinaturas_clientes"("tenantId", "clienteId", "status");

-- CreateIndex
CREATE INDEX "campanhas_growth_tenantId_status_idx" ON "campanhas_growth"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campanhas_growth_envios_campanhaGrowthId_clienteId_key" ON "campanhas_growth_envios"("campanhaGrowthId", "clienteId");

-- CreateIndex
CREATE INDEX "campanhas_growth_envios_clienteId_status_idx" ON "campanhas_growth_envios"("clienteId", "status");

-- AddForeignKey
ALTER TABLE "planos_assinatura" ADD CONSTRAINT "planos_assinatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_assinatura_creditos" ADD CONSTRAINT "planos_assinatura_creditos_planoAssinaturaId_fkey" FOREIGN KEY ("planoAssinaturaId") REFERENCES "planos_assinatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_assinatura_creditos" ADD CONSTRAINT "planos_assinatura_creditos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_clientes" ADD CONSTRAINT "assinaturas_clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_clientes" ADD CONSTRAINT "assinaturas_clientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_clientes" ADD CONSTRAINT "assinaturas_clientes_planoAssinaturaId_fkey" FOREIGN KEY ("planoAssinaturaId") REFERENCES "planos_assinatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_cliente_creditos" ADD CONSTRAINT "assinaturas_cliente_creditos_assinaturaClienteId_fkey" FOREIGN KEY ("assinaturaClienteId") REFERENCES "assinaturas_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_cliente_creditos" ADD CONSTRAINT "assinaturas_cliente_creditos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_growth" ADD CONSTRAINT "campanhas_growth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_growth_envios" ADD CONSTRAINT "campanhas_growth_envios_campanhaGrowthId_fkey" FOREIGN KEY ("campanhaGrowthId") REFERENCES "campanhas_growth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas_growth_envios" ADD CONSTRAINT "campanhas_growth_envios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger de consumo de credito em conclusao de agendamento
DROP TRIGGER IF EXISTS "trg_consumir_credito_assinatura_cliente" ON "agendamentos";
DROP FUNCTION IF EXISTS consumir_credito_assinatura_cliente();

CREATE OR REPLACE FUNCTION consumir_credito_assinatura_cliente()
RETURNS TRIGGER AS $$
DECLARE
  assinatura_id TEXT;
  memberships_ativo BOOLEAN;
BEGIN
  IF NEW."status" = 'CONCLUIDO' AND OLD."status" IS DISTINCT FROM 'CONCLUIDO' THEN
    SELECT t."membershipsAtivo"
      INTO memberships_ativo
    FROM "tenants" t
    WHERE t."id" = NEW."tenantId"
    LIMIT 1;

    IF memberships_ativo IS DISTINCT FROM TRUE THEN
      RETURN NEW;
    END IF;

    SELECT ac."id"
      INTO assinatura_id
    FROM "assinaturas_clientes" ac
    WHERE ac."tenantId" = NEW."tenantId"
      AND ac."clienteId" = NEW."clienteId"
      AND ac."status" = 'ATIVA'
      AND (ac."inicioEm" <= NEW."fimEm")
      AND (ac."fimEm" IS NULL OR ac."fimEm" >= NEW."inicioEm")
    ORDER BY ac."criadoEm" DESC
    LIMIT 1;

    IF assinatura_id IS NOT NULL THEN
      UPDATE "assinaturas_cliente_creditos"
      SET "creditosRestantes" = GREATEST("creditosRestantes" - 1, 0),
          "consumidos" = "consumidos" + 1,
          "atualizadoEm" = NOW()
      WHERE "assinaturaClienteId" = assinatura_id
        AND "servicoId" = NEW."servicoId"
        AND "creditosRestantes" > 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_consumir_credito_assinatura_cliente"
AFTER UPDATE OF "status" ON "agendamentos"
FOR EACH ROW
EXECUTE FUNCTION consumir_credito_assinatura_cliente();

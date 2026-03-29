-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('SANGRIA', 'REFORCO');

-- CreateTable
CREATE TABLE "caixa_movimentacoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "valor" INTEGER NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caixa_movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caixa_movimentacoes_tenantId_sessaoId_idx" ON "caixa_movimentacoes"("tenantId", "sessaoId");

-- AddForeignKey
ALTER TABLE "caixa_movimentacoes" ADD CONSTRAINT "caixa_movimentacoes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_movimentacoes" ADD CONSTRAINT "caixa_movimentacoes_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessoes_caixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

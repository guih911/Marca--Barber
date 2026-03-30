-- CreateEnum
CREATE TYPE "StatusCaixa" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('SANGRIA', 'REFORCO');

-- CreateTable
CREATE TABLE "sessoes_caixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "status" "StatusCaixa" NOT NULL DEFAULT 'ABERTO',
    "saldoInicial" INTEGER NOT NULL DEFAULT 0,
    "saldoFinal" INTEGER,
    "observacoes" TEXT,
    "aberturaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechamentoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessoes_caixa_tenantId_status_idx" ON "sessoes_caixa"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "sessoes_caixa" ADD CONSTRAINT "sessoes_caixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

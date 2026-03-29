-- CreateEnum
CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoPacote" AS ENUM ('FIXO', 'DESCONTO');

-- DropForeignKey
ALTER TABLE "assinaturas_clientes" DROP CONSTRAINT "assinaturas_clientes_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "planos_assinatura" DROP CONSTRAINT "planos_assinatura_tenantId_fkey";

-- AlterTable
ALTER TABLE "profissional_servicos" ADD COLUMN     "comissaoPercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "comandaAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comissoesAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estoqueatvo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fidelidadeAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "npsAtivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pacotesAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relatorioDiarioAtivo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "config_fidelidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pontosPerServico" INTEGER NOT NULL DEFAULT 1,
    "pontosParaResgate" INTEGER NOT NULL DEFAULT 10,
    "descricaoResgate" TEXT NOT NULL DEFAULT '1 serviço grátis',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_fidelidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL DEFAULT 0,
    "totalGanho" INTEGER NOT NULL DEFAULT 0,
    "totalResgatado" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pontos_fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_fidelidade" (
    "id" TEXT NOT NULL,
    "pontosFidelidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "descricao" TEXT,
    "agendamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_fidelidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'unid',
    "precoCustoCentavos" INTEGER,
    "precoVendaCentavos" INTEGER,
    "quantidadeAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantidadeMinima" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "alertaEnviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_estoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda_itens" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precoCentavos" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comanda_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoPacote" NOT NULL DEFAULT 'FIXO',
    "precoCentavos" INTEGER NOT NULL DEFAULT 0,
    "descontoPorcent" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote_servicos" (
    "id" TEXT NOT NULL,
    "pacoteId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,

    CONSTRAINT "pacote_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_fidelidade_tenantId_key" ON "config_fidelidade"("tenantId");

-- CreateIndex
CREATE INDEX "pontos_fidelidade_tenantId_idx" ON "pontos_fidelidade"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_fidelidade_tenantId_clienteId_key" ON "pontos_fidelidade"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "historico_fidelidade_pontosFidelidadeId_criadoEm_idx" ON "historico_fidelidade"("pontosFidelidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "produtos_tenantId_ativo_idx" ON "produtos"("tenantId", "ativo");

-- CreateIndex
CREATE INDEX "movimentos_estoque_produtoId_criadoEm_idx" ON "movimentos_estoque"("produtoId", "criadoEm");

-- CreateIndex
CREATE INDEX "comanda_itens_agendamentoId_idx" ON "comanda_itens"("agendamentoId");

-- CreateIndex
CREATE INDEX "pacotes_tenantId_ativo_idx" ON "pacotes"("tenantId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "pacote_servicos_pacoteId_servicoId_key" ON "pacote_servicos"("pacoteId", "servicoId");

-- CreateIndex
CREATE INDEX "planos_assinatura_creditos_servicoId_idx" ON "planos_assinatura_creditos"("servicoId");

-- AddForeignKey
ALTER TABLE "planos_assinatura" ADD CONSTRAINT "planos_assinatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_clientes" ADD CONSTRAINT "assinaturas_clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_fidelidade" ADD CONSTRAINT "config_fidelidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_fidelidade" ADD CONSTRAINT "historico_fidelidade_pontosFidelidadeId_fkey" FOREIGN KEY ("pontosFidelidadeId") REFERENCES "pontos_fidelidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_servicos" ADD CONSTRAINT "pacote_servicos_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_servicos" ADD CONSTRAINT "pacote_servicos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

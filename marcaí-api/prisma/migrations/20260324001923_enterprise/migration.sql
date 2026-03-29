-- CreateEnum
CREATE TYPE "StatusFila" AS ENUM ('AGUARDANDO', 'NOTIFICADO', 'CONVERTIDO', 'EXPIRADO');

-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "lembrete2hEnviadoEm" TIMESTAMP(3),
ADD COLUMN     "retornoEnviadoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ADD COLUMN     "parabensEnviadoEm" TIMESTAMP(3),
ADD COLUMN     "reativacaoEnviadaEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "servicos" ADD COLUMN     "retornoEmDias" INTEGER;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "autoCancelarNaoConfirmados" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "horasAutoCancelar" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "fila_espera" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "profissionalId" TEXT,
    "dataDesejada" TIMESTAMP(3) NOT NULL,
    "status" "StatusFila" NOT NULL DEFAULT 'AGUARDANDO',
    "notificadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fila_espera_tenantId_servicoId_dataDesejada_idx" ON "fila_espera"("tenantId", "servicoId", "dataDesejada");

-- AddForeignKey
ALTER TABLE "fila_espera" ADD CONSTRAINT "fila_espera_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_espera" ADD CONSTRAINT "fila_espera_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_espera" ADD CONSTRAINT "fila_espera_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_espera" ADD CONSTRAINT "fila_espera_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

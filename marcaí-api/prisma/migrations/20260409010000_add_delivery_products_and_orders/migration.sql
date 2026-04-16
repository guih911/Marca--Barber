ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "entregaAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "taxaEntregaCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "valorMinimoEntregaCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tempoMedioEntregaMin" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN IF NOT EXISTS "janelasEntrega" JSONB;

ALTER TABLE "produtos"
ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "divulgarNoLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "permiteEntrega" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE "StatusPedidoEntrega" AS ENUM ('NOVO', 'PREPARANDO', 'A_CAMINHO', 'CHEGUEI', 'FINALIZADO', 'CANCELADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "pedidos_entrega" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "clienteId" TEXT,
  "clienteNome" TEXT NOT NULL,
  "clienteTelefone" TEXT NOT NULL,
  "enderecoEntrega" TEXT NOT NULL,
  "referenciaEndereco" TEXT,
  "observacoes" TEXT,
  "formaPagamento" TEXT NOT NULL,
  "taxaEntregaCentavos" INTEGER NOT NULL DEFAULT 0,
  "subtotalCentavos" INTEGER NOT NULL DEFAULT 0,
  "totalCentavos" INTEGER NOT NULL DEFAULT 0,
  "janelaEntregaLabel" TEXT,
  "janelaEntregaInicio" TEXT,
  "janelaEntregaFim" TEXT,
  "previsaoEntregaEm" TIMESTAMP(3),
  "status" "StatusPedidoEntrega" NOT NULL DEFAULT 'NOVO',
  "preparandoEm" TIMESTAMP(3),
  "saiuParaEntregaEm" TIMESTAMP(3),
  "chegouEm" TIMESTAMP(3),
  "finalizadoEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pedidos_entrega_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pedido_entrega_itens" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "produtoId" TEXT,
  "nomeProduto" TEXT NOT NULL,
  "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "precoUnitarioCentavos" INTEGER NOT NULL DEFAULT 0,
  "subtotalCentavos" INTEGER NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pedido_entrega_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pedidos_entrega_tenantId_status_criadoEm_idx" ON "pedidos_entrega"("tenantId", "status", "criadoEm");
CREATE INDEX IF NOT EXISTS "pedidos_entrega_tenantId_clienteTelefone_idx" ON "pedidos_entrega"("tenantId", "clienteTelefone");
CREATE INDEX IF NOT EXISTS "pedido_entrega_itens_pedidoId_idx" ON "pedido_entrega_itens"("pedidoId");

DO $$ BEGIN
  ALTER TABLE "pedidos_entrega"
  ADD CONSTRAINT "pedidos_entrega_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pedidos_entrega"
  ADD CONSTRAINT "pedidos_entrega_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pedido_entrega_itens"
  ADD CONSTRAINT "pedido_entrega_itens_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pedido_entrega_itens"
  ADD CONSTRAINT "pedido_entrega_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

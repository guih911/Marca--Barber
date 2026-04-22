-- Prisma @updatedAt não usa DEFAULT no PostgreSQL; alinha com schema.
ALTER TABLE "pedidos_entrega" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

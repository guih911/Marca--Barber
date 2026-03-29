CREATE UNIQUE INDEX "conversas_unique_open_por_cliente_canal"
ON "conversas" ("tenantId", "clienteId", "canal")
WHERE "status" IN ('ATIVA', 'ESCALONADA');

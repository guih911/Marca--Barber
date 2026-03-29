import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const recente = await prisma.$queryRawUnsafe(
    `SELECT c.id, c."criadoEm", c."atualizadoEm", c."canal", cl.telefone
     FROM conversas c
     JOIN clientes cl ON cl.id = c."clienteId"
     WHERE c."tenantId" = 'e3b8f5e5-2887-4ce1-827d-6603d07c94f6'
     ORDER BY c."atualizadoEm" DESC LIMIT 5`
  );
  console.log("Conversas recentes:", JSON.stringify(recente, null, 2));
  
  // Última mensagem recebida
  const ultimaMsg = await prisma.$queryRawUnsafe(
    `SELECT m.*, c."clienteId"
     FROM mensagens m
     JOIN conversas c ON c.id = m."conversaId"
     WHERE c."tenantId" = 'e3b8f5e5-2887-4ce1-827d-6603d07c94f6'
     ORDER BY m."criadoEm" DESC LIMIT 5`
  );
  console.log("\nÚltimas mensagens:", JSON.stringify(ultimaMsg, null, 2));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e.message); prisma.$disconnect(); });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const conversas = await prisma.$queryRawUnsafe(
    "SELECT * FROM conversas WHERE \"tenantId\" = 'e3b8f5e5-2887-4ce1-827d-6603d07c94f6' ORDER BY \"atualizadoEm\" DESC LIMIT 3"
  );
  console.log("Conversas:", JSON.stringify(conversas, null, 2));
  
  if (conversas.length > 0) {
    const colsMsgs = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'mensagens' ORDER BY ordinal_position"
    );
    console.log("Colunas mensagens:", colsMsgs.map(c => c.column_name).join(', '));
    
    const msgs = await prisma.$queryRawUnsafe(
      `SELECT * FROM mensagens WHERE "conversaId" = '${conversas[0].id}' ORDER BY "criadoEm" DESC LIMIT 5`
    );
    console.log("Mensagens:", JSON.stringify(msgs, null, 2));
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e.message); prisma.$disconnect(); });

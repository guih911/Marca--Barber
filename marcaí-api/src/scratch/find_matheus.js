const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const clientes = await prisma.cliente.findMany({
    where: {
      nome: {
        contains: 'Matheus',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      nome: true,
      telefone: true,
      tenantId: true
    }
  })
  console.log(JSON.stringify(clientes, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())

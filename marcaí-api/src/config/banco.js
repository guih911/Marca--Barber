const { PrismaClient } = require('@prisma/client')

// Singleton do Prisma Client para evitar múltiplas conexões
let banco

if (process.env.NODE_ENV === 'production') {
  banco = new PrismaClient()
} else {
  // Em desenvolvimento, reutiliza a instância entre hot-reloads do nodemon
  if (!global.__bancoPrisma) {
    global.__bancoPrisma = new PrismaClient({
      log: ['query', 'warn', 'error'],
    })
  }
  banco = global.__bancoPrisma
}

module.exports = banco

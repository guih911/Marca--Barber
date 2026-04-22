/**
 * Remove TODOS os clientes do banco (e agendamentos, conversas, fidelidade, etc. em cascata).
 *
 * Uso:
 *   node scripts/limpar-todos-clientes.js --dry-run
 *   node scripts/limpar-todos-clientes.js --confirm
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function excluirCascataPorIds(clienteIds) {
  if (clienteIds.length === 0) return 0

  const pontos = await prisma.pontosFidelidade.findMany({
    where: { clienteId: { in: clienteIds } },
    select: { id: true },
  })
  const pontoIds = pontos.map((p) => p.id)
  if (pontoIds.length) {
    await prisma.historicoFidelidade.deleteMany({ where: { pontosFidelidadeId: { in: pontoIds } } })
  }
  await prisma.pontosFidelidade.deleteMany({ where: { clienteId: { in: clienteIds } } })

  await prisma.assinaturaCliente.deleteMany({ where: { clienteId: { in: clienteIds } } })
  await prisma.campanhaGrowthEnvio.deleteMany({ where: { clienteId: { in: clienteIds } } })
  await prisma.filaEspera.deleteMany({ where: { clienteId: { in: clienteIds } } })
  try {
    await prisma.pedidoEntrega.deleteMany({ where: { clienteId: { in: clienteIds } } })
  } catch (e) {
    if (e?.code !== 'P2021') throw e
  }
  try {
    await prisma.fotoGaleria.deleteMany({ where: { clienteId: { in: clienteIds } } })
  } catch (e) {
    if (e?.code !== 'P2021') throw e
  }

  const conversas = await prisma.conversa.findMany({
    where: { clienteId: { in: clienteIds } },
    select: { id: true },
  })
  const conversaIds = conversas.map((c) => c.id)
  if (conversaIds.length) {
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } })
    await prisma.conversa.deleteMany({ where: { id: { in: conversaIds } } })
  }

  await prisma.agendamento.deleteMany({ where: { clienteId: { in: clienteIds } } })
  const r = await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  return r.count
}

async function main() {
  const dry = process.argv.includes('--dry-run')
  const ok = process.argv.includes('--confirm')

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, telefone: true, tenantId: true },
  })

  console.log(`Total de clientes no banco: ${clientes.length}`)
  for (const c of clientes) {
    console.log(`  - ${c.nome} | ${c.telefone} | tenant ${c.tenantId}`)
  }

  if (dry) {
    console.log('[dry-run] Nada foi apagado.')
    return
  }

  if (!ok) {
    console.log('Para apagar de verdade, execute: node scripts/limpar-todos-clientes.js --confirm')
    process.exit(0)
  }

  if (clientes.length === 0) {
    console.log('Nada a remover.')
    return
  }

  const n = await excluirCascataPorIds(clientes.map((c) => c.id))
  console.log(`Concluído. Registros de cliente removidos: ${n}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

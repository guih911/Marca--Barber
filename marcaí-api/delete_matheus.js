const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const matheus = await prisma.cliente.findMany({
    where: { nome: { contains: 'Matheus', mode: 'insensitive' } }
  });
  for (const m of matheus) {
    console.log(`Deletando cliente: ${m.nome}`);
    await prisma.comandaItem.deleteMany({ where: { agendamento: { clienteId: m.id } }});
    await prisma.agendamento.deleteMany({ where: { clienteId: m.id } });
    await prisma.mensagem.deleteMany({ where: { conversa: { clienteId: m.id } } });
    await prisma.conversa.deleteMany({ where: { clienteId: m.id } });
    await prisma.filaEspera.deleteMany({ where: { clienteId: m.id } });
    await prisma.assinaturaClienteCredito.deleteMany({ where: { assinaturaCliente: { clienteId: m.id } } });
    await prisma.assinaturaCliente.deleteMany({ where: { clienteId: m.id } });
    await prisma.historicoFidelidade.deleteMany({ where: { pontosFidelidade: { clienteId: m.id } } });
    await prisma.pontosFidelidade.deleteMany({ where: { clienteId: m.id } });
    await prisma.campanhaGrowthEnvio.deleteMany({ where: { clienteId: m.id } });
    await prisma.pedidoEntregaItem.deleteMany({ where: { pedido: { clienteId: m.id } } });
    await prisma.pedidoEntrega.deleteMany({ where: { clienteId: m.id } });
    await prisma.cliente.delete({ where: { id: m.id } });
    console.log(`Cliente ${m.nome} deletado do banco de dados.`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

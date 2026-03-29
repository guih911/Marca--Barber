const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// Gera slug a partir do nome
const gerarSlug = (nome) => {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

async function main() {
  console.log('Iniciando seed do banco de dados...')

  // Limpa dados existentes
  await prisma.mensagem.deleteMany()
  await prisma.conversa.deleteMany()
  await prisma.agendamento.deleteMany()
  await prisma.bloqueioHorario.deleteMany()
  await prisma.profissionalServico.deleteMany()
  await prisma.profissional.deleteMany()
  await prisma.servico.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.usuario.deleteMany()
  await prisma.tenant.deleteMany()

  // Cria tenant de demonstração
  const tenant = await prisma.tenant.create({
    data: {
      nome: 'Beleza & Estilo',
      slug: 'beleza-estilo',
      segmento: 'BELEZA',
      telefone: '(11) 99999-0000',
      endereco: 'Rua das Flores, 123 - São Paulo, SP',
      timezone: 'America/Sao_Paulo',
      tomDeVoz: 'ACOLHEDOR',
      mensagemBoasVindas: 'Olá! Seja bem-vindo(a) à Beleza & Estilo. Como posso te ajudar hoje?',
      mensagemForaHorario: 'Nosso horário de atendimento é de segunda a sábado, das 9h às 19h. Deixe sua mensagem e retornaremos em breve!',
      antecedenciaCancelar: 2,
      onboardingCompleto: true,
    },
  })

  console.log('Tenant criado:', tenant.nome)

  // Cria usuário admin
  const senhaHash = await bcrypt.hash('senha123', 10)
  const admin = await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Admin Demo',
      email: 'admin@demo.com',
      senhaHash,
      perfil: 'ADMIN',
    },
  })

  console.log('Usuário admin criado:', admin.email)

  // Cria serviços
  const servicos = await Promise.all([
    prisma.servico.create({
      data: {
        tenantId: tenant.id,
        nome: 'Corte Feminino',
        duracaoMinutos: 60,
        precoCentavos: 8000,
        instrucoes: 'Venha com o cabelo lavado e sem produtos.',
        ativo: true,
      },
    }),
    prisma.servico.create({
      data: {
        tenantId: tenant.id,
        nome: 'Coloração Completa',
        duracaoMinutos: 120,
        precoCentavos: 18000,
        instrucoes: 'Evite lavar o cabelo 2 dias antes.',
        ativo: true,
      },
    }),
    prisma.servico.create({
      data: {
        tenantId: tenant.id,
        nome: 'Manicure',
        duracaoMinutos: 45,
        precoCentavos: 4000,
        ativo: true,
      },
    }),
    prisma.servico.create({
      data: {
        tenantId: tenant.id,
        nome: 'Escova Progressiva',
        duracaoMinutos: 180,
        precoCentavos: 25000,
        instrucoes: 'Não lavar o cabelo por 3 dias após o procedimento.',
        ativo: true,
      },
    }),
    prisma.servico.create({
      data: {
        tenantId: tenant.id,
        nome: 'Sobrancelha Design',
        duracaoMinutos: 30,
        precoCentavos: 3500,
        ativo: true,
      },
    }),
  ])

  console.log(`${servicos.length} serviços criados`)

  // Horário de trabalho padrão (seg-sab, 9h-19h, intervalo 12-13h)
  const horarioPadrao = {
    0: { ativo: false }, // domingo
    1: { ativo: true, inicio: '09:00', fim: '19:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
    2: { ativo: true, inicio: '09:00', fim: '19:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
    3: { ativo: true, inicio: '09:00', fim: '19:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
    4: { ativo: true, inicio: '09:00', fim: '19:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
    5: { ativo: true, inicio: '09:00', fim: '19:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
    6: { ativo: true, inicio: '09:00', fim: '17:00', intervalos: [] },
  }

  // Cria profissionais
  const profissionais = await Promise.all([
    prisma.profissional.create({
      data: {
        tenantId: tenant.id,
        nome: 'Ana Carolina',
        email: 'ana@belezaestilo.com',
        telefone: '(11) 99999-1111',
        horarioTrabalho: horarioPadrao,
        bufferMinutos: 10,
        ativo: true,
      },
    }),
    prisma.profissional.create({
      data: {
        tenantId: tenant.id,
        nome: 'Beatriz Santos',
        email: 'beatriz@belezaestilo.com',
        telefone: '(11) 99999-2222',
        horarioTrabalho: horarioPadrao,
        bufferMinutos: 5,
        ativo: true,
      },
    }),
    prisma.profissional.create({
      data: {
        tenantId: tenant.id,
        nome: 'Carla Oliveira',
        email: 'carla@belezaestilo.com',
        telefone: '(11) 99999-3333',
        horarioTrabalho: horarioPadrao,
        bufferMinutos: 0,
        ativo: true,
      },
    }),
  ])

  console.log(`${profissionais.length} profissionais criados`)

  // Vincula serviços aos profissionais
  await Promise.all([
    // Ana faz corte e coloração
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[0].id, servicoId: servicos[0].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[0].id, servicoId: servicos[1].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[0].id, servicoId: servicos[3].id } }),
    // Beatriz faz manicure e sobrancelha
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[1].id, servicoId: servicos[2].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[1].id, servicoId: servicos[4].id } }),
    // Carla faz tudo
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[2].id, servicoId: servicos[0].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[2].id, servicoId: servicos[1].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[2].id, servicoId: servicos[2].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[2].id, servicoId: servicos[3].id } }),
    prisma.profissionalServico.create({ data: { profissionalId: profissionais[2].id, servicoId: servicos[4].id } }),
  ])

  // Cria clientes
  const clientes = await Promise.all([
    prisma.cliente.create({
      data: { tenantId: tenant.id, nome: 'Maria Silva', telefone: '11987654321', email: 'maria@email.com', tags: ['VIP', 'Recorrente'] },
    }),
    prisma.cliente.create({
      data: { tenantId: tenant.id, nome: 'Juliana Costa', telefone: '11976543210', email: 'juliana@email.com', tags: ['Novo'] },
    }),
    prisma.cliente.create({
      data: { tenantId: tenant.id, nome: 'Fernanda Lima', telefone: '11965432109', tags: ['Recorrente'] },
    }),
    prisma.cliente.create({
      data: { tenantId: tenant.id, nome: 'Patricia Rocha', telefone: '11954321098', email: 'patricia@email.com', tags: [] },
    }),
    prisma.cliente.create({
      data: { tenantId: tenant.id, nome: 'Camila Souza', telefone: '11943210987', tags: ['VIP'] },
    }),
  ])

  console.log(`${clientes.length} clientes criados`)

  // Cria agendamentos (passados e futuros)
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())

  const agendamentos = await Promise.all([
    // Agendamentos de hoje
    prisma.agendamento.create({
      data: {
        tenantId: tenant.id,
        clienteId: clientes[0].id,
        profissionalId: profissionais[0].id,
        servicoId: servicos[0].id,
        inicioEm: new Date(hoje.getTime() + 9 * 60 * 60 * 1000),
        fimEm: new Date(hoje.getTime() + 10 * 60 * 60 * 1000),
        status: 'CONFIRMADO',
        origem: 'WHATSAPP',
      },
    }),
    prisma.agendamento.create({
      data: {
        tenantId: tenant.id,
        clienteId: clientes[1].id,
        profissionalId: profissionais[1].id,
        servicoId: servicos[2].id,
        inicioEm: new Date(hoje.getTime() + 10 * 60 * 60 * 1000),
        fimEm: new Date(hoje.getTime() + 10 * 60 * 60 * 1000 + 45 * 60 * 1000),
        status: 'AGENDADO',
        origem: 'WEBCHAT',
      },
    }),
    prisma.agendamento.create({
      data: {
        tenantId: tenant.id,
        clienteId: clientes[2].id,
        profissionalId: profissionais[2].id,
        servicoId: servicos[1].id,
        inicioEm: new Date(hoje.getTime() + 14 * 60 * 60 * 1000),
        fimEm: new Date(hoje.getTime() + 16 * 60 * 60 * 1000),
        status: 'AGENDADO',
        origem: 'DASHBOARD',
      },
    }),
    // Agendamento amanhã
    prisma.agendamento.create({
      data: {
        tenantId: tenant.id,
        clienteId: clientes[3].id,
        profissionalId: profissionais[0].id,
        servicoId: servicos[3].id,
        inicioEm: new Date(hoje.getTime() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        fimEm: new Date(hoje.getTime() + 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        status: 'AGENDADO',
        origem: 'WHATSAPP',
      },
    }),
    // Agendamento passado concluído
    prisma.agendamento.create({
      data: {
        tenantId: tenant.id,
        clienteId: clientes[4].id,
        profissionalId: profissionais[1].id,
        servicoId: servicos[4].id,
        inicioEm: new Date(hoje.getTime() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        fimEm: new Date(hoje.getTime() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'CONCLUIDO',
        origem: 'WHATSAPP',
      },
    }),
  ])

  console.log(`${agendamentos.length} agendamentos criados`)

  // Cria conversas com mensagens
  const conversa = await prisma.conversa.create({
    data: {
      tenantId: tenant.id,
      clienteId: clientes[0].id,
      canal: 'WHATSAPP',
      status: 'ATIVA',
    },
  })

  await Promise.all([
    prisma.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'cliente', conteudo: 'Oi! Quero agendar um corte.' },
    }),
    prisma.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'ia', conteudo: 'Olá, Maria! Que ótimo! Temos disponibilidade com a Ana Carolina amanhã às 9h ou às 14h. Qual prefere?' },
    }),
    prisma.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'cliente', conteudo: 'Pode ser às 9h!' },
    }),
    prisma.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'ia', conteudo: 'Perfeito! Agendei o Corte Feminino com Ana Carolina amanhã às 9h. Você receberá uma confirmação. Precisa de mais alguma coisa?' },
    }),
  ])

  console.log('Conversa com mensagens criada')
  console.log('\nSeed concluído com sucesso!')
  console.log('\nCredenciais para login:')
  console.log('Email: admin@demo.com')
  console.log('Senha: senha123')
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

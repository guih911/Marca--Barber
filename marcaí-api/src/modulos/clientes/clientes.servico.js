const banco = require('../../config/banco')
const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

const gerarVariantesTelefone = (telefone = '') => {
  const base = normalizarTelefone(telefone)
  if (!base) return []

  const variantes = new Set([`+${base}`])

  if (base.startsWith('55')) {
    const nacional = base.slice(2)
    variantes.add(`+${nacional}`)

    if (nacional.length === 10) {
      variantes.add(`+55${nacional.slice(0, 2)}9${nacional.slice(2)}`)
      variantes.add(`+${nacional.slice(0, 2)}9${nacional.slice(2)}`)
    }

    if (nacional.length === 11 && nacional[2] === '9') {
      variantes.add(`+55${nacional.slice(0, 2)}${nacional.slice(3)}`)
      variantes.add(`+${nacional.slice(0, 2)}${nacional.slice(3)}`)
    }
  } else if (base.length === 10) {
    variantes.add(`+55${base}`)
    variantes.add(`+55${base.slice(0, 2)}9${base.slice(2)}`)
  } else if (base.length === 11 && base[2] === '9') {
    variantes.add(`+55${base}`)
    variantes.add(`+55${base.slice(0, 2)}${base.slice(3)}`)
  }

  return [...variantes]
}

const listar = async (tenantId, { pagina = 1, limite = 20, busca = '', ativo }) => {
  const pagAtual = Number(pagina)
  const limAtual = Number(limite)
  const pular = (pagAtual - 1) * limAtual

  // ativo=false → inativos, ativo=true (ou não informado) → ativos
  const filtroAtivo = ativo === 'false' ? false : true

  const where = {
    tenantId,
    ativo: filtroAtivo,
    ...(busca && {
      OR: [
        { nome: { contains: busca, mode: 'insensitive' } },
        { telefone: { contains: busca } },
        { email: { contains: busca, mode: 'insensitive' } },
      ],
    }),
  }

  const [clientes, total] = await Promise.all([
    banco.cliente.findMany({
      where,
      skip: pular,
      take: limAtual,
      orderBy: { nome: 'asc' },
      include: {
        _count: { select: { agendamentos: true } },
        agendamentos: {
          orderBy: { inicioEm: 'desc' },
          take: 1,
          select: { inicioEm: true },
        },
      },
    }),
    banco.cliente.count({ where }),
  ])

  return {
    clientes: clientes.map((c) => ({
      ...c,
      totalAgendamentos: c._count.agendamentos,
      ultimaVisita: c.agendamentos[0]?.inicioEm || null,
    })),
    meta: { total, pagina: pagAtual, limite: limAtual },
  }
}

const buscarPorId = async (tenantId, id) => {
  const cliente = await banco.cliente.findFirst({
    where: { id, tenantId },
    include: {
      agendamentos: {
        include: { servico: true, profissional: true },
        orderBy: { inicioEm: 'desc' },
      },
    },
  })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }
  return cliente
}

const criar = async (tenantId, dados) => {
  const existente = await banco.cliente.findUnique({
    where: { tenantId_telefone: { tenantId, telefone: dados.telefone } },
  })
  if (existente) throw { status: 409, mensagem: 'Cliente com este telefone ja existe', codigo: 'DUPLICADO' }

  return banco.cliente.create({
    data: {
      tenantId,
      nome: dados.nome,
      telefone: dados.telefone,
      email: dados.email || null,
      notas: dados.notas || null,
      tipoCortePreferido: dados.tipoCortePreferido || null,
      preferencias: dados.preferencias || null,
    },
  })
}

const buscarOuCriarPorTelefone = async (tenantId, telefone, nome) => {
  let cliente = await banco.cliente.findUnique({
    where: { tenantId_telefone: { tenantId, telefone } },
  })

  if (!cliente) {
    const variantes = gerarVariantesTelefone(telefone)
    if (variantes.length > 1) {
      cliente = await banco.cliente.findFirst({
        where: {
          tenantId,
          telefone: { in: variantes },
        },
        orderBy: { atualizadoEm: 'desc' },
      })
    }
  }

  if (!cliente) {
    // Novo cliente: sempre usa o telefone como placeholder de nome.
    // O bot irá perguntar o nome preferido e cadastrarCliente o salvará depois.
    cliente = await banco.cliente.create({
      data: { tenantId, nome: telefone, telefone },
    })
  }

  return cliente
}

const atualizar = async (tenantId, id, dados) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }

  if (dados.telefone && dados.telefone !== cliente.telefone) {
    const duplicado = await banco.cliente.findUnique({
      where: { tenantId_telefone: { tenantId, telefone: dados.telefone } },
    })
    if (duplicado && duplicado.id !== id) {
      throw { status: 409, mensagem: 'Ja existe cliente com este telefone', codigo: 'DUPLICADO' }
    }
  }

  const campos = {}
  if (dados.nome !== undefined) campos.nome = dados.nome
  if (dados.email !== undefined) campos.email = dados.email
  if (dados.telefone !== undefined) campos.telefone = dados.telefone
  if (dados.notas !== undefined) campos.notas = dados.notas
  if (dados.tipoCortePreferido !== undefined) campos.tipoCortePreferido = dados.tipoCortePreferido
  if (dados.preferencias !== undefined) campos.preferencias = dados.preferencias
  if (dados.tags !== undefined) campos.tags = dados.tags
  if (dados.dataNascimento !== undefined) campos.dataNascimento = dados.dataNascimento ? new Date(dados.dataNascimento) : null

  return banco.cliente.update({ where: { id }, data: campos })
}

const desativar = async (tenantId, id) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }

  // Encerra todas as conversas ativas do cliente
  await banco.conversa.updateMany({
    where: { clienteId: id, tenantId, status: { in: ['ATIVA', 'ESCALONADA'] } },
    data: { status: 'ENCERRADA' },
  })

  return banco.cliente.update({ where: { id }, data: { ativo: false } })
}

const reativar = async (tenantId, id) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }
  return banco.cliente.update({ where: { id }, data: { ativo: true } })
}

const remover = async (tenantId, id) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }

  // Cascade: mensagens → conversas → fila de espera → agendamentos → cliente
  const conversas = await banco.conversa.findMany({ where: { clienteId: id, tenantId }, select: { id: true } })
  const conversaIds = conversas.map((c) => c.id)

  await banco.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } })
  await banco.conversa.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.filaEspera.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.agendamento.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.cliente.delete({ where: { id } })

  return { sucesso: true }
}

module.exports = { listar, buscarPorId, criar, buscarOuCriarPorTelefone, atualizar, remover, desativar, reativar }

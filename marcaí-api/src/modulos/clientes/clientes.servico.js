const banco = require('../../config/banco')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')

const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')
const erroTemCampoLidWhatsapp = (erro) => String(erro?.message || erro || '').includes('lidWhatsapp')
const nomePareceTelefone = (nome = '') => /^\+?\d[\d\s()\-]{5,}$/.test(String(nome || '').trim())

const adicionarVarianteTelefone = (variantes, telefone = '') => {
  const digitos = normalizarTelefone(telefone)
  if (!digitos) return
  variantes.add(digitos)
  variantes.add(`+${digitos}`)
}

const gerarVariantesTelefone = (telefone = '') => {
  const base = normalizarTelefone(telefone)
  if (!base) return []

  const variantes = new Set()
  adicionarVarianteTelefone(variantes, base)

  if (base.startsWith('55')) {
    const nacional = base.slice(2)
    adicionarVarianteTelefone(variantes, nacional)

    if (nacional.length === 10) {
      adicionarVarianteTelefone(variantes, `55${nacional.slice(0, 2)}9${nacional.slice(2)}`)
      adicionarVarianteTelefone(variantes, `${nacional.slice(0, 2)}9${nacional.slice(2)}`)
    }

    if (nacional.length === 11 && nacional[2] === '9') {
      adicionarVarianteTelefone(variantes, `55${nacional.slice(0, 2)}${nacional.slice(3)}`)
      adicionarVarianteTelefone(variantes, `${nacional.slice(0, 2)}${nacional.slice(3)}`)
    }
  } else if (base.length === 10) {
    adicionarVarianteTelefone(variantes, `55${base}`)
    adicionarVarianteTelefone(variantes, `55${base.slice(0, 2)}9${base.slice(2)}`)
  } else if (base.length === 11 && base[2] === '9') {
    adicionarVarianteTelefone(variantes, `55${base}`)
    adicionarVarianteTelefone(variantes, `55${base.slice(0, 2)}${base.slice(3)}`)
  }

  return [...variantes]
}

const listar = async (tenantId, { pagina = 1, limite = 20, busca = '', ativo }) => {
  const pagAtual = Number(pagina)
  const limAtual = Number(limite)
  const pular = (pagAtual - 1) * limAtual

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
    clientes: clientes.map((cliente) => ({
      ...cliente,
      totalAgendamentos: cliente._count.agendamentos,
      ultimaVisita: cliente.agendamentos[0]?.inicioEm || null,
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

const ehLid = (telefone) => {
  if (!telefone) return false
  const digitos = String(telefone).replace(/\D/g, '')
  return !digitos.startsWith('55') && digitos.length > 13
}

const normalizarTelefoneReal = (telefone) => {
  if (!telefone) return telefone
  const digitos = String(telefone).replace(/\D/g, '')
  if (ehLid(digitos)) return telefone
  if (digitos.startsWith('55') && digitos.length >= 12) return `+${digitos}`
  if (digitos.length >= 10) return `+55${digitos}`
  return telefone
}

const buscarResumoPorTelefone = async (tenantId, telefone) => {
  const telefoneNorm = normalizarTelefoneReal(telefone) || telefone
  const variantes = gerarVariantesTelefone(telefoneNorm)
  const lidNorm = normalizarTelefone(telefoneNorm)

  if (variantes.length === 0 && !lidNorm) return null

  return banco.cliente.findFirst({
    where: {
      tenantId,
      OR: [
        ...(variantes.length ? [{ telefone: { in: variantes } }] : []),
        ...(lidNorm ? [{ lidWhatsapp: lidNorm }] : []),
      ],
    },
    orderBy: { atualizadoEm: 'desc' },
    select: {
      id: true,
      nome: true,
      telefone: true,
      lidWhatsapp: true,
      criadoEm: true,
      atualizadoEm: true,
      _count: {
        select: {
          agendamentos: true,
          conversas: true,
        },
      },
    },
  })
}

const deveAtualizarNome = (nomeAtual = '', nomeNovo = '') => {
  const atual = String(nomeAtual || '').trim()
  const novo = String(nomeNovo || '').trim()
  if (!novo) return false
  if (!atual) return true
  if (nomePareceTelefone(atual)) return true
  return novo.length > atual.length && novo.toLowerCase().includes(atual.toLowerCase())
}

const buscarPorTelefone = async (tenantId, telefone) => {
  const telefoneNorm = normalizarTelefoneReal(telefone) || telefone
  const variantes = gerarVariantesTelefone(telefoneNorm)
  const lidNorm = normalizarTelefone(telefoneNorm)

  if (variantes.length === 0 && !lidNorm) return null

  // Busca normal por telefone ou lidWhatsapp
  const cliente = await banco.cliente.findFirst({
    where: {
      tenantId,
      OR: [
        ...(variantes.length ? [{ telefone: { in: variantes } }] : []),
        ...(lidNorm ? [{ lidWhatsapp: lidNorm }] : []),
      ],
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  if (cliente) return cliente

  // CRÍTICO: Se não encontrou, busca também por telefone salvo como LID
  // Isso resolve o caso onde o Baileys salvou o LID como telefone
  // e agora estamos recebendo o telefone real
  if (variantes.length > 0) {
    // Extrai apenas os dígitos do telefone para buscar em telefones que podem ser LIDs mal formatados
    const apenasDigitos = normalizarTelefone(telefoneNorm)
    // Busca clientes onde o telefone contém esses dígitos no final (ex: LID que termina com o número real)
    const clienteComLid = await banco.cliente.findFirst({
      where: {
        tenantId,
        OR: [
          // Telefone é um LID e o lidWhatsapp não está preenchido (caso antigo)
          { telefone: { not: { startsWith: '+55' } } },
        ],
      },
      orderBy: { atualizadoEm: 'desc' },
    })

    // Se encontrou cliente com telefone não-brasileiro, verifica se pode ser o mesmo
    // Isso é mais conservador - só retorna se tiver forte indício de ser o mesmo
    if (clienteComLid && ehLid(clienteComLid.telefone)) {
      // Se o lidWhatsapp do cliente bate com alguma variante, é o mesmo
      if (clienteComLid.lidWhatsapp && variantes.includes(`+${clienteComLid.lidWhatsapp}`)) {
        return clienteComLid
      }
    }
  }

  return null
}

const criar = async (tenantId, dados) => {
  const telefoneNorm = normalizarTelefoneReal(dados.telefone) || dados.telefone

  const existente = await buscarPorTelefone(tenantId, telefoneNorm)
  if (existente) throw { status: 409, mensagem: 'Cliente com este telefone ja existe', codigo: 'DUPLICADO' }

  if (dados.nome && !ehLid(telefoneNorm)) {
    const primeiroNome = dados.nome.trim().split(/\s+/)[0].toLowerCase()
    const clienteComLid = await banco.cliente.findFirst({
      where: {
        tenantId,
        nome: { contains: primeiroNome, mode: 'insensitive' },
      },
    })
    if (clienteComLid && ehLid(clienteComLid.telefone)) {
      return banco.cliente.update({
        where: { id: clienteComLid.id },
        data: {
          ...(deveAtualizarNome(clienteComLid.nome, dados.nome) ? { nome: dados.nome.trim() } : {}),
          telefone: telefoneNorm,
          ...(dados.tipoCortePreferido && { tipoCortePreferido: dados.tipoCortePreferido }),
          ...(dados.preferencias && { preferencias: dados.preferencias }),
          ...(dados.notas && { notas: dados.notas }),
        },
      })
    }
  }

  return banco.cliente.create({
    data: {
      tenantId,
      nome: dados.nome,
      telefone: telefoneNorm,
      email: dados.email || null,
      notas: dados.notas || null,
      tipoCortePreferido: dados.tipoCortePreferido || null,
      preferencias: dados.preferencias || null,
    },
  })
}

const buscarOuCriarPorTelefone = async (tenantId, telefone, nome, lidWhatsapp) => {
  const telefoneNorm = normalizarTelefoneReal(telefone) || telefone
  const lidNorm = lidWhatsapp ? normalizarTelefone(lidWhatsapp) : null
  const nomeLimpo = String(nome || '').trim()
  let cliente = null

  logClienteTrace('buscar_ou_criar_inicio', {
    tenantId,
    telefoneRecebido: telefone,
    telefoneNormalizado: telefoneNorm,
    nomeRecebido: nomeLimpo || null,
    lidWhatsappRecebido: lidNorm,
    telefonePareceLid: ehLid(telefoneNorm),
  })

  if (lidNorm) {
    try {
      cliente = await banco.cliente.findFirst({
        where: { tenantId, lidWhatsapp: lidNorm },
        orderBy: { atualizadoEm: 'desc' },
      })
      if (cliente) {
        logClienteTrace('cliente_encontrado_por_lid', {
          tenantId,
          lidWhatsapp: lidNorm,
          cliente: resumirCliente(cliente),
        })
      }
    } catch (erro) {
      if (!erroTemCampoLidWhatsapp(erro)) throw erro
    }
  }

  if (!cliente) {
    cliente = await buscarPorTelefone(tenantId, telefoneNorm)
    if (cliente) {
      logClienteTrace('cliente_encontrado_por_telefone', {
        tenantId,
        telefoneNormalizado: telefoneNorm,
        cliente: resumirCliente(cliente),
      })
    }
  }

  // CRÍTICO: Tenta encontrar cliente com LID ou telefone estranho pelo nome
  // Isso resolve o caso do cliente que veio pelo WhatsApp (salvou com LID) e depois agenda pelo link (telefone real)
  if (!cliente && nomeLimpo && !ehLid(telefoneNorm)) {
    const primeiroNome = nomeLimpo.split(/\s+/)[0].toLowerCase()

    // Busca cliente por nome que tenha:
    // 1. Telefone em formato de LID (não começa com 55, mais de 13 dígitos)
    // 2. OU telefone que não seja o mesmo que estamos recebendo (possível duplicata)
    // 3. E tenha sido criado recentemente (últimos 90 dias) para evitar merges errados
    const dataCutoff = new Date()
    dataCutoff.setDate(dataCutoff.getDate() - 90)

    const clientesSimilares = await banco.cliente.findMany({
      where: {
        tenantId,
        nome: { contains: primeiroNome, mode: 'insensitive' },
        criadoEm: { gte: dataCutoff },
      },
      orderBy: { atualizadoEm: 'desc' },
      take: 5,
    })

    // Encontra o melhor candidato para merge:
    // Prioridade 1: Cliente com telefone LID
    // Prioridade 2: Cliente com lidWhatsapp mas sem telefone real brasileiro
    const clienteComLid = clientesSimilares.find((c) => ehLid(c.telefone))
      || clientesSimilares.find((c) => c.lidWhatsapp && !c.telefone?.startsWith('+55'))

    if (clienteComLid) {
      // IMPORTANTE: Verifica se já existe um cliente com o telefone real
      // Se existir, não faz merge para evitar duplicação
      const clienteComTelefoneReal = await buscarResumoPorTelefone(tenantId, telefoneNorm)
      if (clienteComTelefoneReal && clienteComTelefoneReal.id !== clienteComLid.id) {
        logClienteTrace('merge_bloqueado_telefone_ja_existe', {
          tenantId,
          nomeRecebido: nomeLimpo,
          telefoneNormalizado: telefoneNorm,
          clienteComLid: resumirCliente(clienteComLid),
          clienteComTelefone: resumirCliente(clienteComTelefoneReal),
          acao: 'usando_cliente_com_telefone_real',
        }, 'warn')
        // Usa o cliente que já tem o telefone real
        cliente = await banco.cliente.findUnique({ where: { id: clienteComTelefoneReal.id } })
      } else {
        logClienteTrace('merge_por_nome_em_cliente_lid', {
          tenantId,
          nomeRecebido: nomeLimpo,
          telefoneNormalizado: telefoneNorm,
          clienteComLid: resumirCliente(clienteComLid),
          motivo: ehLid(clienteComLid.telefone) ? 'telefone_eh_lid' : 'tem_lidWhatsapp_sem_telefone_real',
        })

        // Preserva o lidWhatsapp se já existir
        const lidParaSalvar = lidNorm || clienteComLid.lidWhatsapp || (ehLid(clienteComLid.telefone) ? normalizarTelefone(clienteComLid.telefone) : null)

        cliente = await banco.cliente.update({
          where: { id: clienteComLid.id },
          data: {
            telefone: telefoneNorm,
            ...(lidParaSalvar ? { lidWhatsapp: lidParaSalvar } : {}),
            ...(deveAtualizarNome(clienteComLid.nome, nomeLimpo) ? { nome: nomeLimpo } : {}),
          },
        })
        console.log(`[Clientes] Merge automatico: ${clienteComLid.telefone} -> ${telefone} (${nomeLimpo}) | LID: ${lidParaSalvar || 'N/A'}`)
      }
    }
  }

  if (!cliente) {
    // ÚLTIMA TENTATIVA: Busca cliente recente com telefone LID sem agendamentos
    // Isso pega casos onde o nome digitado é diferente do nome do WhatsApp
    if (!ehLid(telefoneNorm)) {
      const umaSemanaAtras = new Date()
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7)

      const clienteOrfao = await banco.cliente.findFirst({
        where: {
          tenantId,
          criadoEm: { gte: umaSemanaAtras },
          agendamentos: { none: {} },
          // Telefone que parece LID (não começa com +55)
          telefone: { not: { startsWith: '+55' } },
        },
        orderBy: { criadoEm: 'desc' },
      })

      if (clienteOrfao && ehLid(clienteOrfao.telefone)) {
        logClienteTrace('merge_cliente_orfao_com_lid', {
          tenantId,
          nomeRecebido: nomeLimpo,
          telefoneNormalizado: telefoneNorm,
          clienteOrfao: resumirCliente(clienteOrfao),
        })

        const lidParaSalvar = lidNorm || clienteOrfao.lidWhatsapp || normalizarTelefone(clienteOrfao.telefone)
        cliente = await banco.cliente.update({
          where: { id: clienteOrfao.id },
          data: {
            telefone: telefoneNorm,
            nome: nomeLimpo || clienteOrfao.nome,
            ...(lidParaSalvar ? { lidWhatsapp: lidParaSalvar } : {}),
          },
        })
        console.log(`[Clientes] Merge cliente orfao: ${clienteOrfao.telefone} -> ${telefone} (${nomeLimpo})`)
      }
    }
  }

  if (!cliente) {
    try {
      const data = { tenantId, nome: nomeLimpo || telefoneNorm, telefone: telefoneNorm }
      if (lidNorm) data.lidWhatsapp = lidNorm

      cliente = await banco.cliente.create({ data })
      logClienteTrace('cliente_criado', {
        tenantId,
        cliente: resumirCliente(cliente),
        origem: {
          telefoneNormalizado: telefoneNorm,
          nomeRecebido: nomeLimpo || null,
          lidWhatsappRecebido: lidNorm,
        },
      })
    } catch (erro) {
      if (!lidNorm || !erroTemCampoLidWhatsapp(erro)) throw erro
      cliente = await banco.cliente.create({
        data: { tenantId, nome: nomeLimpo || telefoneNorm, telefone: telefoneNorm },
      })
      logClienteTrace('cliente_criado_sem_lid', {
        tenantId,
        cliente: resumirCliente(cliente),
        motivo: 'campo_lidWhatsapp_indisponivel',
        origem: {
          telefoneNormalizado: telefoneNorm,
          nomeRecebido: nomeLimpo || null,
          lidWhatsappRecebido: lidNorm,
        },
      }, 'warn')
    }
  } else {
    const atualizacoes = {}
    const telefoneRecebidoNormalizado = normalizarTelefone(telefoneNorm)
    const recebidoEhReal = telefoneRecebidoNormalizado.startsWith('55') && telefoneRecebidoNormalizado.length >= 12

    if (lidNorm && !cliente.lidWhatsapp) {
      atualizacoes.lidWhatsapp = lidNorm
    }

    if (recebidoEhReal && cliente.telefone !== telefoneNorm) {
      const clienteComTelefoneReal = await buscarResumoPorTelefone(tenantId, telefoneNorm)
      if (clienteComTelefoneReal && clienteComTelefoneReal.id !== cliente.id) {
        logClienteTrace('conflito_telefone_real_em_merge', {
          tenantId,
          telefoneRecebido: telefoneNorm,
          nomeRecebido: nomeLimpo || null,
          lidWhatsappRecebido: lidNorm,
          clienteAtual: resumirCliente(cliente),
          clienteQueJaPossuiTelefone: resumirCliente(clienteComTelefoneReal),
        }, 'warn')
      } else {
        atualizacoes.telefone = telefoneNorm
      }
    }

    if (deveAtualizarNome(cliente.nome, nomeLimpo)) {
      atualizacoes.nome = nomeLimpo
    }

    if (Object.keys(atualizacoes).length > 0) {
      const clienteAntes = resumirCliente(cliente)
      try {
        cliente = await banco.cliente.update({ where: { id: cliente.id }, data: atualizacoes })
        logClienteTrace('cliente_atualizado_em_busca_ou_criacao', {
          tenantId,
          clienteAntes,
          atualizacoes,
          clienteDepois: resumirCliente(cliente),
        })
      } catch (erro) {
        logClienteTrace('falha_ao_atualizar_cliente_existente', {
          tenantId,
          clienteAntes,
          atualizacoes,
          erro: {
            code: erro?.code || null,
            message: erro?.message || String(erro),
          },
        }, 'warn')
      }
    }
  }

  logClienteTrace('buscar_ou_criar_resultado', {
    tenantId,
    telefoneRecebido: telefone,
    telefoneNormalizado: telefoneNorm,
    nomeRecebido: nomeLimpo || null,
    lidWhatsappRecebido: lidNorm,
    clienteResolvido: resumirCliente(cliente),
  })

  return cliente
}

const atualizar = async (tenantId, id, dados) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }

  const telefoneNorm = dados.telefone !== undefined ? (normalizarTelefoneReal(dados.telefone) || dados.telefone) : undefined

  if (telefoneNorm && telefoneNorm !== cliente.telefone) {
    const duplicado = await buscarPorTelefone(tenantId, telefoneNorm)
    if (duplicado && duplicado.id !== id) {
      throw { status: 409, mensagem: 'Ja existe cliente com este telefone', codigo: 'DUPLICADO' }
    }
  }

  const campos = {}
  if (dados.nome !== undefined) campos.nome = dados.nome
  if (dados.email !== undefined) campos.email = dados.email
  if (dados.telefone !== undefined) campos.telefone = telefoneNorm
  if (dados.notas !== undefined) campos.notas = dados.notas
  if (dados.tipoCortePreferido !== undefined) campos.tipoCortePreferido = dados.tipoCortePreferido
  if (dados.preferencias !== undefined) campos.preferencias = dados.preferencias
  if (dados.tags !== undefined) campos.tags = dados.tags
  if (dados.dataNascimento !== undefined) campos.dataNascimento = dados.dataNascimento ? new Date(dados.dataNascimento) : null
  if (dados.alergias !== undefined) campos.alergias = dados.alergias || null
  if (dados.instagram !== undefined) campos.instagram = dados.instagram || null
  if (dados.frequenciaIdeal !== undefined) campos.frequenciaIdeal = dados.frequenciaIdeal != null ? Number(dados.frequenciaIdeal) : null

  return banco.cliente.update({ where: { id }, data: campos })
}

const desativar = async (tenantId, id) => {
  const cliente = await banco.cliente.findFirst({ where: { id, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }

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

  const conversas = await banco.conversa.findMany({
    where: { clienteId: id, tenantId },
    select: { id: true },
  })
  const conversaIds = conversas.map((conversa) => conversa.id)

  await banco.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } })
  await banco.conversa.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.filaEspera.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.agendamento.deleteMany({ where: { clienteId: id, tenantId } })
  await banco.cliente.delete({ where: { id } })

  return { sucesso: true }
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorTelefone,
  criar,
  buscarOuCriarPorTelefone,
  atualizar,
  remover,
  desativar,
  reativar,
}

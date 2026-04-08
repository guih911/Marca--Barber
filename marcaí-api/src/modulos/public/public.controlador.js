const banco = require('../../config/banco')
const disponibilidadeServico = require('../agendamentos/disponibilidade.servico')
const agendamentosServico = require('../agendamentos/agendamentos.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const baileysManager = require('../ia/baileys.manager')
const whatsappServico = require('../ia/whatsapp.servico')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')
const { resumirHorarioFuncionamento, montarHorarioDetalhado } = require('../../utils/horarioFuncionamento')

const STATUS_AGENDAMENTO_OCULTOS = ['REMARCADO']
const STATUS_SEM_OPERACAO = ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU']
const MAPA_PAGAMENTO = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  VALE_PRESENTE: 'Vale-presente',
}
const MAPA_DIFERENCIAIS = {
  sinuca: 'Sinuca',
  wifi: 'Wi-Fi grátis',
  tv: 'TV',
  estacionamento: 'Estacionamento',
  cafezinho: 'Cafezinho',
  cerveja: 'Cerveja e drinks',
  ar_condicionado: 'Ar-condicionado',
  musica_ao_vivo: 'Música ao vivo',
  venda_produtos: 'Venda de produtos',
}

const buscarTenantPorIdentificador = async (identificador, select = {}) => (
  banco.tenant.findFirst({
    where: {
      OR: [{ slug: identificador }, { hashPublico: identificador }],
    },
    select: {
      id: true,
      nome: true,
      slug: true,
      hashPublico: true,
      logoUrl: true,
      endereco: true,
      telefone: true,
      tiposPagamento: true,
      diferenciais: true,
      linkMaps: true,
      timezone: true,
      ativo: true,
      ...select,
    },
  })
)

const buscarTenantPorPainel = async ({ slug, hash }, select = {}) => (
  banco.tenant.findFirst({
    where: {
      slug,
      hashPublico: hash,
    },
    select: {
      id: true,
      nome: true,
      slug: true,
      hashPublico: true,
      logoUrl: true,
      endereco: true,
      telefone: true,
      timezone: true,
      ativo: true,
      ...select,
    },
  })
)

const obterDataIsoNoFuso = (data, timeZone) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)

const obterOffsetMinutos = (data, timeZone) => {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(data).find((parte) => parte.type === 'timeZoneName')?.value || 'GMT'

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const sinal = match[1] === '-' ? -1 : 1
  const horas = Number(match[2] || 0)
  const minutos = Number(match[3] || 0)
  return sinal * ((horas * 60) + minutos)
}

const obterJanelaDiaNoFuso = (timeZone, base = new Date()) => {
  const dataIso = obterDataIsoNoFuso(base, timeZone)
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const meioDiaUtc = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0))
  const offsetMinutos = obterOffsetMinutos(meioDiaUtc, timeZone)

  return {
    dataIso,
    inicioUtc: new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0) - (offsetMinutos * 60 * 1000)),
    fimUtc: new Date(Date.UTC(ano, mes - 1, dia, 23, 59, 59, 999) - (offsetMinutos * 60 * 1000)),
  }
}

const formatarHoraNoFuso = (data, timeZone) =>
  new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })

const formatarDataPainel = (data, timeZone) =>
  new Date(data).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  })

const formatarNomeCurto = (nome = '') => nome.trim().split(/\s+/).slice(0, 2).join(' ')
const normalizarLista = (valor) => Array.isArray(valor) ? valor.filter(Boolean) : []
const normalizarTelefoneQuery = (valor = '') => String(valor || '').replace(/\D/g, '')
const formatarTelefonePublico = (tel = '') => {
  const digitos = normalizarTelefoneQuery(tel)
  if (digitos.startsWith('55') && digitos.length >= 12) return `+${digitos}`
  if (digitos.length >= 10) return `+55${digitos}`
  return ''
}

const obterMomentoMovimentacao = (agendamento) => (
  agendamento.concluidoEm
  || agendamento.canceladoEm
  || agendamento.presencaConfirmadaEm
  || agendamento.atualizadoEm
  || agendamento.criadoEm
)

const resumirMovimentacaoAgendamento = (agendamento, timeZone) => {
  const clienteNome = formatarNomeCurto(agendamento.cliente?.nome || 'Cliente')
  const servicoNome = agendamento.servico?.nome || 'serviço'
  const profissionalNome = formatarNomeCurto(agendamento.profissional?.nome || 'Equipe')
  const momento = obterMomentoMovimentacao(agendamento)

  if (agendamento.status === 'CONCLUIDO') {
    return {
      tipo: 'CONCLUIDO',
      titulo: `${clienteNome} concluiu ${servicoNome}`,
      detalhe: `Atendimento com ${profissionalNome}`,
      momentoEm: momento,
      hora: formatarHoraNoFuso(momento, timeZone),
    }
  }

  if (agendamento.status === 'CANCELADO') {
    return {
      tipo: 'CANCELADO',
      titulo: `${clienteNome} cancelou o horário`,
      detalhe: `${servicoNome} com ${profissionalNome}`,
      momentoEm: momento,
      hora: formatarHoraNoFuso(momento, timeZone),
    }
  }

  if (agendamento.status === 'NAO_COMPARECEU') {
    return {
      tipo: 'NAO_COMPARECEU',
      titulo: `${clienteNome} não compareceu`,
      detalhe: `${servicoNome} com ${profissionalNome}`,
      momentoEm: momento,
      hora: formatarHoraNoFuso(momento, timeZone),
    }
  }

  if (agendamento.presencaConfirmadaEm) {
    return {
      tipo: 'CHEGADA_CONFIRMADA',
      titulo: `${clienteNome} chegou ao salão`,
      detalhe: `${servicoNome} com ${profissionalNome}`,
      momentoEm: agendamento.presencaConfirmadaEm,
      hora: formatarHoraNoFuso(agendamento.presencaConfirmadaEm, timeZone),
    }
  }

  if (agendamento.status === 'CONFIRMADO') {
    return {
      tipo: 'CONFIRMADO',
      titulo: `${clienteNome} confirmou o horário`,
      detalhe: `${servicoNome} com ${profissionalNome}`,
      momentoEm: momento,
      hora: formatarHoraNoFuso(momento, timeZone),
    }
  }

  return {
    tipo: 'NOVO_AGENDAMENTO',
    titulo: `Novo agendamento de ${clienteNome}`,
    detalhe: `${servicoNome} com ${profissionalNome}`,
    momentoEm: momento,
    hora: formatarHoraNoFuso(momento, timeZone),
  }
}

// GET /api/public/:slug/info
const info = async (req, res, next) => {
  try {
    // Aceita slug ou hashPublico como identificador
    const identificador = req.params.slug
    const tenant = await buscarTenantPorIdentificador(identificador, {
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      galeriaAtivo: true,
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const [servicos, profissionais, galeria] = await Promise.all([
      banco.servico.findMany({
        where: { tenantId: tenant.id, ativo: true },
        select: { id: true, nome: true, duracaoMinutos: true, precoCentavos: true },
        orderBy: { nome: 'asc' },
      }),
      banco.profissional.findMany({
        where: { tenantId: tenant.id, ativo: true },
        select: {
          id: true,
          nome: true,
          avatarUrl: true,
          horarioTrabalho: true,
          servicos: { select: { servicoId: true } },
        },
        orderBy: { nome: 'asc' },
      }),
      tenant.galeriaAtivo
        ? banco.fotoGaleria.findMany({
          where: { tenantId: tenant.id },
          select: {
            id: true,
            fotoUrl: true,
            titulo: true,
            servicoNome: true,
            profissional: { select: { id: true, nome: true } },
          },
          orderBy: [{ destaque: 'desc' }, { criadoEm: 'desc' }],
          take: 8,
        })
        : Promise.resolve([]),
    ])

    const pagamentos = normalizarLista(tenant.tiposPagamento).map((tipo) => MAPA_PAGAMENTO[tipo] || tipo)
    const comodidades = normalizarLista(tenant.diferenciais).map((item) => MAPA_DIFERENCIAIS[item] || item)
    const redesSociais = [
      tenant.instagramUrl ? { tipo: 'instagram', label: 'Instagram', url: tenant.instagramUrl } : null,
      tenant.facebookUrl ? { tipo: 'facebook', label: 'Facebook', url: tenant.facebookUrl } : null,
      tenant.tiktokUrl ? { tipo: 'tiktok', label: 'TikTok', url: tenant.tiktokUrl } : null,
    ].filter(Boolean)
    const horarioFuncionamento = resumirHorarioFuncionamento(profissionais)
    const horarioDetalhado = montarHorarioDetalhado(profissionais)

    res.json({
      sucesso: true,
      dados: {
        tenant: {
          id: tenant.id, nome: tenant.nome, slug: tenant.slug, logoUrl: tenant.logoUrl,
          endereco: tenant.endereco, telefone: tenant.telefone, linkMaps: tenant.linkMaps,
          horarioFuncionamento,
          horarioDetalhado,
          pagamentos,
          comodidades,
          redesSociais,
          whatsappNumero: baileysManager.obterNumeroConectado(tenant.id) || null,
        },
        servicos,
        profissionais: profissionais.map((p) => ({
          id: p.id,
          nome: p.nome,
          avatarUrl: p.avatarUrl,
          servicoIds: p.servicos.map((ps) => ps.servicoId),
        })),
        galeria: galeria.map((foto) => ({
          id: foto.id,
          fotoUrl: foto.fotoUrl,
          titulo: foto.titulo,
          servicoNome: foto.servicoNome,
          profissional: foto.profissional?.nome || null,
        })),
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/cliente?tel=5562999999999
const cliente = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tel = String(req.query.tel || '').replace(/\D/g, '')
    if (!tel || tel.length < 10) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const telFinal = tel.startsWith('55') && tel.length >= 12 ? `+${tel}` : `+55${tel}`
    const clienteExistente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)

    return res.json({
      sucesso: true,
      dados: {
        existe: Boolean(clienteExistente),
        cliente: clienteExistente
          ? { id: clienteExistente.id, nome: clienteExistente.nome, telefone: clienteExistente.telefone }
          : null,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/perfil?tel=5562999999999
const perfil = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const telFinal = formatarTelefonePublico(req.query.tel)
    if (!telFinal) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, ativo: true, membershipsAtivo: true, pacotesAtivo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const clienteExistente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!clienteExistente) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Cliente não encontrado' } })
    }

    res.json({
      sucesso: true,
      dados: {
        id: clienteExistente.id,
        nome: clienteExistente.nome,
        telefone: clienteExistente.telefone,
        email: clienteExistente.email || '',
        dataNascimento: clienteExistente.dataNascimento || null,
        instagram: clienteExistente.instagram || '',
        tipoCortePreferido: clienteExistente.tipoCortePreferido || '',
        preferencias: clienteExistente.preferencias || '',
        membershipsAtivo: tenant.membershipsAtivo,
        pacotesAtivo: tenant.pacotesAtivo,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// PATCH /api/public/:slug/perfil
const atualizarPerfil = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const telFinal = formatarTelefonePublico(req.body?.telefone || req.body?.tel)
    if (!telFinal) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const clienteExistente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!clienteExistente) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Cliente não encontrado' } })
    }

    const atualizado = await clientesServico.atualizar(tenant.id, clienteExistente.id, {
      nome: req.body?.nome !== undefined ? String(req.body.nome || '').trim() : undefined,
      email: req.body?.email !== undefined ? String(req.body.email || '').trim() || null : undefined,
      dataNascimento: req.body?.dataNascimento !== undefined ? req.body.dataNascimento || null : undefined,
      instagram: req.body?.instagram !== undefined ? String(req.body.instagram || '').trim() || null : undefined,
      tipoCortePreferido: req.body?.tipoCortePreferido !== undefined ? String(req.body.tipoCortePreferido || '').trim() || null : undefined,
      preferencias: req.body?.preferencias !== undefined ? String(req.body.preferencias || '').trim() || null : undefined,
    })

    res.json({
      sucesso: true,
      dados: {
        id: atualizado.id,
        nome: atualizado.nome,
        telefone: atualizado.telefone,
        email: atualizado.email || '',
        dataNascimento: atualizado.dataNascimento || null,
        instagram: atualizado.instagram || '',
        tipoCortePreferido: atualizado.tipoCortePreferido || '',
        preferencias: atualizado.preferencias || '',
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/pacotes
const pacotes = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, ativo: true, pacotesAtivo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    if (!tenant.pacotesAtivo) {
      return res.json({ sucesso: true, dados: [] })
    }

    const lista = await banco.pacote.findMany({
      where: { tenantId: tenant.id, ativo: true },
      include: {
        servicos: {
          include: {
            servico: { select: { id: true, nome: true, precoCentavos: true, duracaoMinutos: true } },
          },
        },
      },
      orderBy: { nome: 'asc' },
    })

    res.json({
      sucesso: true,
      dados: lista.map((pacote) => ({
        id: pacote.id,
        nome: pacote.nome,
        descricao: pacote.descricao || '',
        tipo: pacote.tipo,
        precoCentavos: pacote.precoCentavos,
        descontoPorcent: pacote.descontoPorcent || null,
        servicos: pacote.servicos.map((item) => ({
          id: item.servico.id,
          nome: item.servico.nome,
          precoCentavos: item.servico.precoCentavos,
          duracaoMinutos: item.servico.duracaoMinutos,
        })),
      })),
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/painel/:slug/:hash
const painelTv = async (req, res, next) => {
  try {
    const tenant = await buscarTenantPorPainel({
      slug: req.params.slug,
      hash: req.params.hash,
    })

    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Painel da barbearia não encontrado' } })
    }

    const timeZone = tenant.timezone || 'America/Sao_Paulo'
    const agora = new Date()
    const { dataIso, inicioUtc, fimUtc } = obterJanelaDiaNoFuso(timeZone, agora)

    const agendamentosHoje = await banco.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        inicioEm: { gte: inicioUtc, lte: fimUtc },
        status: { notIn: STATUS_AGENDAMENTO_OCULTOS },
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        servico: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
      },
      orderBy: [{ inicioEm: 'asc' }, { criadoEm: 'desc' }],
    })

    const agendaHoje = agendamentosHoje.map((agendamento) => ({
      id: agendamento.id,
      status: agendamento.status,
      clienteNome: formatarNomeCurto(agendamento.cliente?.nome || 'Cliente'),
      servicoNome: agendamento.servico?.nome || 'Serviço',
      profissionalNome: formatarNomeCurto(agendamento.profissional?.nome || 'Equipe'),
      inicioEm: agendamento.inicioEm,
      fimEm: agendamento.fimEm,
      hora: formatarHoraNoFuso(agendamento.inicioEm, timeZone),
      fimHora: formatarHoraNoFuso(agendamento.fimEm, timeZone),
      presencaConfirmada: Boolean(agendamento.presencaConfirmadaEm),
    }))

    res.json({
      sucesso: true,
      dados: {
        tenant: {
          id: tenant.id,
          nome: tenant.nome,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          timezone: timeZone,
        },
        janela: {
          dataIso,
          dataLabel: formatarDataPainel(agora, timeZone),
          inicioDiaEm: inicioUtc,
          fimDiaEm: fimUtc,
          atualizadoEm: agora,
        },
        agendaHoje,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/slots?servicoId=&profissionalId=&data=
const slots = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { servicoId, profissionalId, data } = req.query
    if (!servicoId || !data) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'servicoId e data são obrigatórios' } })
    }

    const todosSlots = await disponibilidadeServico.verificarDisponibilidade(tenant.id, {
      servicoId,
      profissionalId: profissionalId || undefined,
      data,
    })

    // Filtra apenas slots realmente disponíveis para o endpoint público
    const slotsDisponiveis = todosSlots.filter((slot) => slot.disponivel !== false)

    res.json({ sucesso: true, dados: slotsDisponiveis })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/slots-combo?servicoIds=id1,id2&profissionalId=&data=
const slotsCombo = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { servicoIds, profissionalId, data } = req.query
    if (!servicoIds || !data) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'servicoIds e data são obrigatórios' } })
    }

    const ids = servicoIds.split(',').filter(Boolean)
    const combos = await disponibilidadeServico.verificarDisponibilidadeCombo(tenant.id, {
      servicoIds: ids,
      profissionalId: profissionalId || undefined,
      data,
    })

    const disponiveis = combos.filter(c => c.disponivel !== false)
    res.json({ sucesso: true, dados: disponiveis })
  } catch (erro) {
    next(erro)
  }
}

// POST /api/public/:slug/agendar
const agendar = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, ativo: true, nome: true, configWhatsApp: true, timezone: true, tomDeVoz: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { nome, telefone, servicoId, servicoIds, profissionalId, inicio } = req.body
    const idsServicos = servicoIds?.length > 0 ? servicoIds : servicoId ? [servicoId] : []
    if (!nome || !telefone || !idsServicos.length || !profissionalId || !inicio) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: 'nome, telefone, servicoId(s), profissionalId e inicio são obrigatórios' },
      })
    }

    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const nomeLimpo = String(nome).trim()
    const isCombo = idsServicos.length > 1

    let cliente = await clientesServico.buscarOuCriarPorTelefone(tenant.id, telFinal, nomeLimpo)

    let agendamentos
    if (isCombo) {
      agendamentos = await agendamentosServico.criarCombo(tenant.id, {
        clienteId: cliente.id,
        servicoIds: idsServicos,
        profissionalId,
        inicio,
        origem: 'LINK_PUBLICO',
      })
    } else {
      const ag = await agendamentosServico.criar(tenant.id, {
        clienteId: cliente.id,
        servicoId: idsServicos[0],
        profissionalId,
        inicio,
        origem: 'LINK_PUBLICO',
      })
      agendamentos = [ag]
    }

    // Busca detalhes completos
    const agsFull = await banco.agendamento.findMany({
      where: { id: { in: agendamentos.map(a => a.id) } },
      include: {
        servico: { select: { nome: true, precoCentavos: true } },
        profissional: { select: { nome: true } },
      },
      orderBy: { inicioEm: 'asc' },
    })

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const dataFmt = new Date(agsFull[0].inicioEm).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })
    const primeiroNome = cliente.nome?.split(' ')[0] || cliente.nome
    const nomesServicos = agsFull.map(a => a.servico.nome).join(' + ')
    const totalCentavos = agsFull.reduce((s, a) => s + (a.servico.precoCentavos || 0), 0)

    const linhas = [
      `✅ Agendamento confirmado, ${primeiroNome}!`,
      ``,
      `✂️ ${nomesServicos}`,
      `👤 Com ${agsFull[0].profissional.nome}`,
      `📅 ${dataFmt}`,
    ]
    if (totalCentavos) {
      linhas.push(`💰 ${(totalCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    }
    linhas.push(``, `Até lá! 💈 — ${tenant.nome}`)
    const mensagemConfirmacao = linhas.join('\n')

    try {
      const conversa = await conversasServico.buscarOuCriarConversa(tenant.id, cliente.id, 'WHATSAPP')
      await banco.mensagem.createMany({
        data: [
          { conversaId: conversa.id, remetente: 'ia', conteudo: mensagemConfirmacao },
          { conversaId: conversa.id, remetente: 'sistema', conteudo: `📅 Agendamento via link público — ${nomesServicos} em ${dataFmt}` },
        ],
      })
      await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
    } catch (errConversa) {
      console.warn('[Agendar] Erro ao registrar na conversa:', errConversa.message)
    }

    if (tenant.configWhatsApp?.provedor) {
      try {
        const lidJid = cliente.lidWhatsapp ? `${cliente.lidWhatsapp}@lid` : null
        await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, mensagemConfirmacao, tenant.id, lidJid)
      } catch (errWpp) {
        console.error(`[Agendar] Falha WhatsApp:`, errWpp.message)
      }
    }

    res.status(201).json({
      sucesso: true,
      dados: {
        agendamentoIds: agsFull.map(a => a.id),
        servicos: nomesServicos,
        profissional: agsFull[0].profissional.nome,
        inicioEm: agsFull[0].inicioEm,
        mensagem: 'Agendamento confirmado!',
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/check-in?slug=&telefone=&inicio=&fim=
const checkIn = async (req, res, next) => {
  try {
    const { slug, telefone, inicio, fim } = req.query
    if (!slug || !telefone) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'slug e telefone são obrigatórios' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { slug },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const telLimpo = String(telefone).replace(/\D/g, '')
    const telFinal = telLimpo.startsWith('55') && telLimpo.length >= 12 ? `+${telLimpo}` : `+55${telLimpo}`
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)

    if (!cliente) {
      return res.json({ sucesso: true, dados: { agendamento: null } })
    }

    const agendamento = await banco.agendamento.findFirst({
      where: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        status: { in: ['AGENDADO', 'CONFIRMADO'] },
        ...(inicio && fim ? { inicioEm: { gte: new Date(inicio), lte: new Date(fim) } } : {}),
      },
      include: {
        servico: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
        cliente: { select: { id: true, nome: true } },
      },
      orderBy: { inicioEm: 'asc' },
    })

    res.json({ sucesso: true, dados: { agendamento: agendamento || null } })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/planos
const planos = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, nome: true, slug: true, logoUrl: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }
    const listaPlanos = await banco.planoAssinatura.findMany({
      where: { tenantId: tenant.id, ativo: true },
      include: {
        creditos: {
          include: { servico: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { precoCentavos: 'asc' },
    })
    res.json({ sucesso: true, dados: { tenant, planos: listaPlanos } })
  } catch (erro) {
    next(erro)
  }
}

// POST /api/public/:slug/assinar
const assinar = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, nome: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { nome, telefone, planoId } = req.body
    if (!nome || !telefone || !planoId) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'nome, telefone e planoId são obrigatórios' } })
    }

    const plano = await banco.planoAssinatura.findFirst({
      where: { id: planoId, tenantId: tenant.id, ativo: true },
      include: { creditos: { include: { servico: { select: { nome: true } } } } },
    })
    if (!plano) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Plano não encontrado' } })
    }

    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const nomeLimpo = String(nome).trim()

    const cliente = await clientesServico.buscarOuCriarPorTelefone(tenant.id, telFinal, nomeLimpo)

    // Verifica se já tem assinatura ativa neste plano
    const assinaturaExistente = await banco.assinaturaCliente.findFirst({
      where: { clienteId: cliente.id, planoAssinaturaId: planoId, status: 'ATIVA' },
    })
    if (assinaturaExistente) {
      return res.status(409).json({ sucesso: false, erro: { mensagem: 'Cliente já possui assinatura ativa neste plano' } })
    }

    const agora = new Date()
    const proxCobranca = new Date(agora)
    proxCobranca.setDate(proxCobranca.getDate() + (plano.cicloDias || 30))

    const assinatura = await banco.assinaturaCliente.create({
      data: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        planoAssinaturaId: planoId,
        status: 'ATIVA',
        inicioEm: agora,
        proximaCobrancaEm: proxCobranca,
      },
    })

    // Envia confirmação via WhatsApp (não bloqueia a assinatura se falhar)
    try {
      const tenantWhats = await banco.tenant.findUnique({
        where: { id: tenant.id },
        select: { configWhatsApp: true },
      })
      const configWpp = tenantWhats?.configWhatsApp

      if (configWpp && configWpp.provedor) {
        const valorFormatado = (plano.precoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const resumoCreditos = plano.creditos
          .map((c) => `${c.creditos}x ${c.servico.nome}`)
          .join(', ')

        const mensagem =
          `✅ Plano ativado, ${cliente.nome}!\n\n` +
          `Seu plano *${plano.nome}* está ativo. ` +
          (resumoCreditos ? `Você tem ${resumoCreditos} por mês.\n\n` : '\n') +
          `O pagamento de *${valorFormatado}* é feito na barbearia. Qualquer dúvida, é só responder aqui! 💈`

        const lidJidAssinatura = cliente.lidWhatsapp ? `${cliente.lidWhatsapp}@lid` : null
        await whatsappServico.enviarMensagem(configWpp, cliente.telefone, mensagem, tenant.id, lidJidAssinatura)
      }
    } catch (errWhats) {
      console.error('[Assinar] Erro ao enviar WhatsApp de confirmação:', errWhats.message)
    }

    res.status(201).json({ sucesso: true, dados: { assinaturaId: assinatura.id, mensagem: 'Assinatura criada! O pagamento será cobrado no próximo atendimento.' } })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/meus-agendamentos?tel=5562993050931
const meusAgendamentos = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tel = (req.query.tel || '').replace(/\D/g, '')
    if (!tel || tel.length < 10) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, timezone: true },
    })
    if (!tenant) return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })

    const telFinal = tel.startsWith('55') && tel.length >= 12 ? `+${tel}` : `+55${tel}`
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!cliente) return res.json({ sucesso: true, dados: [] })

    const agora = new Date()
    const agendamentos = await banco.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        status: { in: ['AGENDADO', 'CONFIRMADO'] },
        inicioEm: { gte: agora },
      },
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true, avatarUrl: true } },
      },
      orderBy: { inicioEm: 'asc' },
      take: 5,
    })

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const dados = agendamentos.map((ag) => ({
      id: ag.id,
      servicoId: ag.servicoId,
      profissionalId: ag.profissionalId,
      servico: ag.servico.nome,
      profissional: ag.profissional.nome,
      profissionalAvatar: ag.profissional.avatarUrl,
      inicioEm: ag.inicioEm,
      status: ag.status,
      dataFormatada: new Date(ag.inicioEm).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }),
      horaFormatada: new Date(ag.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }),
    }))

    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/verificar-assinatura?tel=5562993050931
// Verifica se o cliente tem plano ativo e retorna os créditos disponíveis
const verificarAssinatura = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tel = (req.query.tel || '').replace(/\D/g, '')
    if (!tel || tel.length < 10) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, membershipsAtivo: true },
    })
    if (!tenant) return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })

    // Se memberships não está ativo, retorna sem assinatura
    if (!tenant.membershipsAtivo) {
      return res.json({ sucesso: true, dados: { temPlano: false, assinatura: null } })
    }

    const telFinal = tel.startsWith('55') && tel.length >= 12 ? `+${tel}` : `+55${tel}`
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!cliente) {
      return res.json({ sucesso: true, dados: { temPlano: false, assinatura: null } })
    }

    // Busca assinatura ativa do cliente
    const assinatura = await banco.assinaturaCliente.findFirst({
      where: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        status: 'ATIVA',
        OR: [{ fimEm: null }, { fimEm: { gte: new Date() } }],
      },
      include: {
        planoAssinatura: { select: { nome: true } },
        creditos: {
          include: { servico: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { criadoEm: 'desc' },
    })

    if (!assinatura) {
      return res.json({ sucesso: true, dados: { temPlano: false, assinatura: null } })
    }

    // Monta lista de serviços com créditos disponíveis
    const servicosComCredito = assinatura.creditos
      .filter((c) => c.creditosRestantes > 0)
      .map((c) => ({
        servicoId: c.servicoId,
        servicoNome: c.servico.nome,
        creditosRestantes: c.creditosRestantes,
        creditosIniciais: c.creditosIniciais,
      }))

    res.json({
      sucesso: true,
      dados: {
        temPlano: true,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        assinatura: {
          id: assinatura.id,
          planoNome: assinatura.planoAssinatura?.nome,
          servicosComCredito,
        },
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// POST /api/public/:slug/reagendar
const reagendar = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, ativo: true, nome: true, configWhatsApp: true, timezone: true, antecedenciaCancelar: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { agendamentoId, telefone, novoInicio } = req.body
    if (!agendamentoId || !telefone || !novoInicio) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'agendamentoId, telefone e novoInicio são obrigatórios' } })
    }

    // Busca cliente pelo telefone
    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!cliente) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Cliente não encontrado' } })
    }

    // Verifica se o agendamento pertence ao cliente
    const agendamento = await banco.agendamento.findFirst({
      where: { id: agendamentoId, tenantId: tenant.id, clienteId: cliente.id },
    })
    if (!agendamento) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Agendamento não encontrado' } })
    }

    // Verifica antecedência mínima (padrão 2h)
    const antecedenciaHoras = tenant.antecedenciaCancelar || 2
    const horasRestantes = (agendamento.inicioEm - new Date()) / (1000 * 60 * 60)
    if (horasRestantes > 0 && horasRestantes < antecedenciaHoras) {
      return res.status(422).json({
        sucesso: false,
        erro: {
          mensagem: `Reagendamento exige ${antecedenciaHoras}h de antecedência. Entre em contato com o estabelecimento.`,
          codigo: 'ANTECEDENCIA_INSUFICIENTE',
        },
      })
    }

    // Remarca via serviço existente
    const agRemarcado = await agendamentosServico.remarcar(tenant.id, agendamentoId, novoInicio)

    // Busca detalhes completos
    const agFull = await banco.agendamento.findUnique({
      where: { id: agRemarcado.id },
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    })

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const dataFmt = new Date(agFull.inicioEm).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })

    // Notifica via WhatsApp
    if (tenant.configWhatsApp?.provedor) {
      try {
        const primeiroNome = cliente.nome?.split(' ')[0] || cliente.nome
        const msg = `🔄 Horário reagendado, ${primeiroNome}!\n\n✂️ ${agFull.servico.nome}\n👤 Com ${agFull.profissional.nome}\n📅 ${dataFmt}\n\nTe esperamos! 💈 — ${tenant.nome}`
        const lidJid = cliente.lidWhatsapp ? `${cliente.lidWhatsapp}@lid` : null
        await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, msg, tenant.id, lidJid)
      } catch (err) {
        console.error('[Reagendar] Falha WhatsApp:', err.message)
      }
    }

    res.json({
      sucesso: true,
      dados: {
        agendamentoId: agFull.id,
        servico: agFull.servico.nome,
        profissional: agFull.profissional.nome,
        inicioEm: agFull.inicioEm,
        mensagem: 'Horário reagendado com sucesso!',
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/public/:slug/historico?tel=5562993050931
const historico = async (req, res, next) => {
  try {
    const identificador = req.params.slug
    const tel = (req.query.tel || '').replace(/\D/g, '')
    if (!tel || tel.length < 10) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone inválido' } })
    }

    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: identificador }, { hashPublico: identificador }] },
      select: { id: true, timezone: true },
    })
    if (!tenant) return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })

    const telFinal = tel.startsWith('55') && tel.length >= 12 ? `+${tel}` : `+55${tel}`
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)
    if (!cliente) return res.json({ sucesso: true, dados: [] })

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const agendamentos = await banco.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        status: { in: ['CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'] },
      },
      include: {
        servico: { select: { nome: true, precoCentavos: true } },
        profissional: { select: { nome: true } },
      },
      orderBy: { inicioEm: 'desc' },
      take: 20,
    })

    const dados = agendamentos.map((ag) => ({
      id: ag.id,
      servico: ag.servico.nome,
      profissional: ag.profissional.nome,
      preco: ag.servico.precoCentavos,
      status: ag.status,
      nota: ag.feedbackNota,
      inicioEm: ag.inicioEm,
      dataFormatada: new Date(ag.inicioEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: tz }),
      horaFormatada: new Date(ag.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }),
    }))

    res.json({ sucesso: true, dados })
  } catch (erro) {
    next(erro)
  }
}

// ═══ OTP via WhatsApp (login no link de agendamento) ═══
// Códigos em memória: { "tenantId:telefone" → { codigo, expira, tentativas } }
const otpStore = new Map()

// POST /api/public/:slug/enviar-codigo
const enviarCodigo = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, nome: true, ativo: true, configWhatsApp: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { telefone } = req.body
    if (!telefone) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone obrigatório' } })
    }

    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const chave = `${tenant.id}:${telFinal}`

    // Rate limit: máximo 3 códigos por telefone a cada 5 min
    const existente = otpStore.get(chave)
    if (existente && existente.tentativas >= 3 && Date.now() < existente.expira) {
      return res.status(429).json({ sucesso: false, erro: { mensagem: 'Muitas tentativas. Aguarde 5 minutos.' } })
    }

    // Gera código de 4 dígitos
    const codigo = String(Math.floor(1000 + Math.random() * 9000))
    otpStore.set(chave, { codigo, expira: Date.now() + 5 * 60 * 1000, tentativas: 0 })

    // Envia via WhatsApp
    if (tenant.configWhatsApp?.provedor) {
      const msg = `🔐 Seu código de acesso: ${codigo}\n\nUse no link de agendamento da ${tenant.nome}.\nVálido por 5 minutos.`
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, telFinal, msg, tenant.id)
      console.log(`[OTP] Código enviado para ${telFinal} — tenant ${tenant.id}`)
    } else {
      return res.status(422).json({ sucesso: false, erro: { mensagem: 'WhatsApp não conectado. Fale com a barbearia.' } })
    }

    res.json({ sucesso: true, dados: { mensagem: 'Código enviado no WhatsApp' } })
  } catch (erro) {
    next(erro)
  }
}

// POST /api/public/:slug/verificar-codigo
const verificarCodigo = async (req, res, next) => {
  try {
    const tenant = await banco.tenant.findFirst({
      where: { OR: [{ slug: req.params.slug }, { hashPublico: req.params.slug }] },
      select: { id: true, ativo: true },
    })
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const { telefone, codigo } = req.body
    if (!telefone || !codigo) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone e código obrigatórios' } })
    }

    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const chave = `${tenant.id}:${telFinal}`

    const otp = otpStore.get(chave)
    if (!otp) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Nenhum código enviado. Solicite um novo.' } })
    }

    otp.tentativas++
    if (otp.tentativas > 5) {
      otpStore.delete(chave)
      return res.status(429).json({ sucesso: false, erro: { mensagem: 'Muitas tentativas. Solicite um novo código.' } })
    }

    if (Date.now() > otp.expira) {
      otpStore.delete(chave)
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Código expirado. Solicite um novo.' } })
    }

    if (otp.codigo !== String(codigo).trim()) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Código incorreto.' } })
    }

    // Código válido — busca ou cria cliente
    otpStore.delete(chave)
    const cliente = await clientesServico.buscarPorTelefone(tenant.id, telFinal)

    res.json({
      sucesso: true,
      dados: {
        autenticado: true,
        telefone: telFinal,
        cliente: cliente ? { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } : null,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

// Limpa OTPs expirados a cada 10 min
setInterval(() => {
  const agora = Date.now()
  for (const [chave, otp] of otpStore) {
    if (agora > otp.expira) otpStore.delete(chave)
  }
}, 10 * 60 * 1000)

module.exports = { info, cliente, perfil, atualizarPerfil, pacotes, painelTv, slots, slotsCombo, agendar, checkIn, planos, assinar, meusAgendamentos, historico, verificarAssinatura, reagendar, enviarCodigo, verificarCodigo }

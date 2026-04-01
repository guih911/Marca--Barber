const banco = require('../../config/banco')
const disponibilidadeServico = require('../agendamentos/disponibilidade.servico')
const agendamentosServico = require('../agendamentos/agendamentos.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const baileysManager = require('../ia/baileys.manager')
const whatsappServico = require('../ia/whatsapp.servico')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')

const STATUS_AGENDAMENTO_OCULTOS = ['REMARCADO']
const STATUS_SEM_OPERACAO = ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU']

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
    const tenant = await buscarTenantPorIdentificador(identificador)
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Barbearia não encontrada' } })
    }

    const [servicos, profissionais] = await Promise.all([
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
          servicos: { select: { servicoId: true } },
        },
        orderBy: { nome: 'asc' },
      }),
    ])

    res.json({
      sucesso: true,
      dados: {
        tenant: {
          id: tenant.id, nome: tenant.nome, slug: tenant.slug, logoUrl: tenant.logoUrl,
          endereco: tenant.endereco, telefone: tenant.telefone, linkMaps: tenant.linkMaps,
          whatsappNumero: baileysManager.obterNumeroConectado(tenant.id) || null,
        },
        servicos,
        profissionais: profissionais.map((p) => ({
          id: p.id,
          nome: p.nome,
          avatarUrl: p.avatarUrl,
          servicoIds: p.servicos.map((ps) => ps.servicoId),
        })),
      },
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

    const { nome, telefone, servicoId, profissionalId, inicio } = req.body
    if (!nome || !telefone || !servicoId || !profissionalId || !inicio) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: 'nome, telefone, servicoId, profissionalId e inicio são obrigatórios' },
      })
    }

    // Normaliza telefone (remove formatação) e garante DDI Brasil
    const telNorm = String(telefone).replace(/\D/g, '')
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? `+${telNorm}` : `+55${telNorm}`
    const nomeLimpo = String(nome).trim()

    logClienteTrace('link_publico_agendar_recebido', {
      tenantId: tenant.id,
      slug: req.params.slug,
      nomeRecebido: nomeLimpo,
      telefoneRecebido: telefone,
      telefoneNormalizado: telFinal,
      servicoId,
      profissionalId,
      inicio,
    })

    let cliente = await clientesServico.buscarOuCriarPorTelefone(tenant.id, telFinal, nomeLimpo)

    logClienteTrace('link_publico_cliente_resolvido', {
      tenantId: tenant.id,
      slug: req.params.slug,
      nomeRecebido: nomeLimpo,
      telefoneNormalizado: telFinal,
      cliente: resumirCliente(cliente),
      nomeDivergenteDoCadastro: Boolean(cliente?.nome && nomeLimpo && cliente.nome !== nomeLimpo),
    })

    // Cria agendamento via serviço (já valida conflito, dias, expediente)
    const agendamento = await agendamentosServico.criar(tenant.id, {
      clienteId: cliente.id,
      servicoId,
      profissionalId,
      inicio,
      origem: 'LINK_PUBLICO',
    })

    // Busca detalhes completos para a confirmação
    const agFull = await banco.agendamento.findUnique({
      where: { id: agendamento.id },
      include: {
        servico: { select: { nome: true, precoCentavos: true } },
        profissional: { select: { nome: true } },
      },
    })

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const dataFmt = new Date(agFull.inicioEm).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })
    const primeiroNome = cliente.nome?.split(' ')[0] || cliente.nome

    // Monta mensagem de confirmação
    const linhas = [
      `✅ Agendamento confirmado, ${primeiroNome}!`,
      ``,
      `✂️ ${agFull.servico.nome}`,
      `👤 Com ${agFull.profissional.nome}`,
      `📅 ${dataFmt}`,
    ]
    if (agFull.servico.precoCentavos) {
      linhas.push(`💰 ${(agFull.servico.precoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    }
    linhas.push(``, `Até lá! 💈 — ${tenant.nome}`)
    const mensagemConfirmacao = linhas.join('\n')

    // Registra na conversa SEMPRE (independente do WhatsApp)
    try {
      const conversa = await conversasServico.buscarOuCriarConversa(tenant.id, cliente.id, 'WHATSAPP')
      await banco.mensagem.createMany({
        data: [
          { conversaId: conversa.id, remetente: 'ia', conteudo: mensagemConfirmacao },
          {
            conversaId: conversa.id, remetente: 'sistema',
            conteudo: `📅 Agendamento via link público — ${agFull.servico.nome} em ${dataFmt}`,
          },
        ],
      })
      await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
    } catch (errConversa) {
      console.warn('[Agendar] Erro ao registrar na conversa:', errConversa.message)
    }

    // Envia via WhatsApp (não bloqueia o agendamento se falhar)
    if (tenant.configWhatsApp?.provedor) {
      try {
        // lidJid garante entrega mesmo após restart do servidor (jidMap vazio)
        const lidJid = cliente.lidWhatsapp ? `${cliente.lidWhatsapp}@lid` : null
        await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, mensagemConfirmacao, tenant.id, lidJid)
        console.log(`[Agendar] WhatsApp de confirmação enviado para ${cliente.telefone}`)
      } catch (errWpp) {
        console.error(`[Agendar] Falha ao enviar WhatsApp de confirmação para ${cliente.telefone}:`, errWpp.message)
      }
    }

    res.status(201).json({
      sucesso: true,
      dados: {
        agendamentoId: agendamento.id,
        servico: agFull.servico.nome,
        profissional: agFull.profissional.nome,
        inicioEm: agFull.inicioEm,
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

module.exports = { info, painelTv, slots, agendar, checkIn, planos, assinar, meusAgendamentos, verificarAssinatura }

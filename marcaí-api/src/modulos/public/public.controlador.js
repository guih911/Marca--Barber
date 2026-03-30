const banco = require('../../config/banco')
const disponibilidadeServico = require('../agendamentos/disponibilidade.servico')
const agendamentosServico = require('../agendamentos/agendamentos.servico')
const baileysManager = require('../ia/baileys.manager')
const whatsappServico = require('../ia/whatsapp.servico')

// GET /api/public/:slug/info
const info = async (req, res, next) => {
  try {
    // Aceita slug ou hashPublico como identificador
    const identificador = req.params.slug
    const tenant = await banco.tenant.findFirst({
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
      },
    })
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
      select: { id: true, ativo: true, nome: true, configWhatsApp: true },
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
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? telNorm : `55${telNorm}`

    // Busca ou cria cliente (busca pelos últimos 8 dígitos para ser flexível)
    let cliente = await banco.cliente.findFirst({
      where: { tenantId: tenant.id, telefone: { contains: telNorm.slice(-8) } },
    })
    if (!cliente) {
      cliente = await banco.cliente.create({
        data: {
          tenantId: tenant.id,
          nome: String(nome).trim(),
          telefone: telFinal,
        },
      })
    }

    // Cria agendamento via serviço (já valida conflito, dias, expediente)
    const agendamento = await agendamentosServico.criar(tenant.id, {
      clienteId: cliente.id,
      servicoId,
      profissionalId,
      inicio,
      origem: 'LINK_PUBLICO',
    })

    res.status(201).json({ sucesso: true, dados: { agendamentoId: agendamento.id, mensagem: 'Agendamento confirmado!' } })
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
    const cliente = await banco.cliente.findFirst({
      where: { tenantId: tenant.id, telefone: { contains: telLimpo.slice(-8) } },
    })

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
    const telFinal = telNorm.startsWith('55') && telNorm.length >= 12 ? telNorm : `55${telNorm}`

    let cliente = await banco.cliente.findFirst({
      where: { tenantId: tenant.id, telefone: { contains: telNorm.slice(-8) } },
    })
    if (!cliente) {
      cliente = await banco.cliente.create({
        data: { tenantId: tenant.id, nome: String(nome).trim(), telefone: telFinal },
      })
    }

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

        await whatsappServico.enviarMensagem(configWpp, cliente.telefone, mensagem, tenant.id)
      }
    } catch (errWhats) {
      console.error('[Assinar] Erro ao enviar WhatsApp de confirmação:', errWhats.message)
    }

    res.status(201).json({ sucesso: true, dados: { assinaturaId: assinatura.id, mensagem: 'Assinatura criada! O pagamento será cobrado no próximo atendimento.' } })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { info, slots, agendar, checkIn, planos, assinar }

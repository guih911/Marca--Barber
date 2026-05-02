const express = require('express')
const { db } = require('../../core/db')
const { obterPaginacao, normalizarTelefone } = require('../../utils/http')
const { enviarMensagemMeta, normalizarConfigMeta } = require('./metaWhatsApp.service')

const router = express.Router()

const obterOuCriarConversa = async (tenantId, clienteId) => {
  const existente = await db.conversa.findFirst({
    where: { tenantId, clienteId, status: { not: 'ENCERRADA' } },
    orderBy: { atualizadoEm: 'desc' },
  })
  if (existente) return existente
  return db.conversa.create({
    data: { tenantId, clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
  })
}

const parseRemetenteHumano = (remetente) => {
  if (!String(remetente || '').startsWith('humano:')) return null
  const [, adminId, ...restante] = String(remetente).split(':')
  return {
    adminId: adminId || null,
    adminNome: (restante || []).join(':') || 'Humano',
  }
}

router.get('/leads', async (req, res) => {
  try {
    const { tenantId, busca, estagio } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)
    const filtrosTags = ['lead']
    if (estagio) filtrosTags.push(`estagio:${String(estagio).toUpperCase()}`)

    const where = {
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { telefone: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
      tags: { hasEvery: filtrosTags },
    }

    const [leads, total] = await Promise.all([
      db.cliente.findMany({
        where,
        orderBy: { atualizadoEm: 'desc' },
        skip,
        take: limite,
        include: {
          tenant: { select: { id: true, nome: true } },
          _count: { select: { agendamentos: true, conversas: true } },
        },
      }),
      db.cliente.count({ where }),
    ])

    return res.json({ leads, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/leads', async (req, res) => {
  try {
    const { tenantId, nome, telefone, email, origem, estagio = 'NOVO' } = req.body || {}
    if (!tenantId || !nome || !telefone) {
      return res.status(400).json({ erro: 'tenantId, nome e telefone são obrigatórios' })
    }
    const telefoneFmt = normalizarTelefone(telefone)
    const tags = [`lead`, `origem:${String(origem || 'MANUAL').toUpperCase()}`, `estagio:${String(estagio).toUpperCase()}`]

    const lead = await db.cliente.upsert({
      where: { tenantId_telefone: { tenantId: String(tenantId), telefone: telefoneFmt } },
      create: {
        tenantId: String(tenantId),
        nome: String(nome).trim(),
        telefone: telefoneFmt,
        email: email || null,
        tags,
      },
      update: {
        nome: String(nome).trim(),
        email: email || null,
        tags,
      },
    })

    return res.status(201).json(lead)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.patch('/leads/:clienteId/estagio', async (req, res) => {
  try {
    const { estagio } = req.body || {}
    if (!estagio) return res.status(400).json({ erro: 'estagio é obrigatório' })
    const cliente = await db.cliente.findUnique({ where: { id: req.params.clienteId } })
    if (!cliente) return res.status(404).json({ erro: 'Lead não encontrado' })
    const tagsSemEstagio = (cliente.tags || []).filter((tag) => !String(tag).startsWith('estagio:'))
    const atualizado = await db.cliente.update({
      where: { id: cliente.id },
      data: { tags: [...tagsSemEstagio, `estagio:${String(estagio).toUpperCase()}`] },
    })
    return res.json(atualizado)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/leads/mensagens/lote', async (req, res) => {
  try {
    const { leadIds = [], texto } = req.body || {}
    if (!Array.isArray(leadIds) || leadIds.length === 0 || !texto) {
      return res.status(400).json({ erro: 'leadIds e texto são obrigatórios' })
    }

    const leads = await db.cliente.findMany({
      where: { id: { in: leadIds } },
      include: { tenant: { select: { id: true, nome: true, configWhatsApp: true } } },
    })

    const resultados = []
    for (const lead of leads) {
      try {
        const conversa = await obterOuCriarConversa(lead.tenantId, lead.id)
        const envio = await enviarMensagemMeta({
          configWhatsApp: lead.tenant.configWhatsApp,
          para: lead.telefone,
          texto,
        })
        await db.mensagem.create({
          data: {
            conversaId: conversa.id,
            remetente: `humano:${req.admin.id}:${req.admin.nome || req.admin.email}`,
            conteudo: texto,
          },
        })
        resultados.push({ leadId: lead.id, tenantId: lead.tenantId, ...envio })
      } catch (erroLead) {
        resultados.push({ leadId: lead.id, tenantId: lead.tenantId, enviado: false, motivo: erroLead.message })
      }
    }

    return res.json({
      total: resultados.length,
      enviados: resultados.filter((item) => item.enviado).length,
      falhas: resultados.filter((item) => !item.enviado).length,
      resultados,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/comercial/conversas', async (req, res) => {
  try {
    const { tenantId, busca, modo = 'SUPORTE', mostrarIa = 'false' } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)
    const apenasHumano = String(mostrarIa) !== 'true'

    const where = {
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
      ...(modo === 'SUPORTE' ? { status: 'ESCALONADA' } : {}),
      ...(busca
        ? {
            cliente: {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' } },
                { telefone: { contains: busca, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    }

    const [conversas, total] = await Promise.all([
      db.conversa.findMany({
        where,
        skip,
        take: limite,
        orderBy: { atualizadoEm: 'desc' },
        include: {
          tenant: { select: { id: true, nome: true } },
          cliente: { select: { id: true, nome: true, telefone: true } },
          mensagens: {
            orderBy: { criadoEm: 'desc' },
            take: 30,
            select: { id: true, remetente: true, conteudo: true, criadoEm: true },
          },
        },
      }),
      db.conversa.count({ where }),
    ])

    const itens = conversas.map((conversa) => {
      const mensagensFiltradas = apenasHumano
        ? conversa.mensagens.filter((m) => String(m.remetente).startsWith('humano:') || m.remetente === 'cliente')
        : conversa.mensagens
      const ultimaHumana = conversa.mensagens.find((m) => String(m.remetente).startsWith('humano:'))
      const parser = ultimaHumana ? parseRemetenteHumano(ultimaHumana.remetente) : null
      return {
        ...conversa,
        mensagens: mensagensFiltradas.reverse(),
        ultimaRespostaHumana: ultimaHumana
          ? { criadoEm: ultimaHumana.criadoEm, adminId: parser?.adminId, adminNome: parser?.adminNome }
          : null,
      }
    })

    return res.json({ conversas: itens, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/comercial/conversas/:conversaId/mensagens', async (req, res) => {
  try {
    const { texto, humano = true } = req.body || {}
    if (!texto) return res.status(400).json({ erro: 'texto é obrigatório' })

    const conversa = await db.conversa.findUnique({
      where: { id: req.params.conversaId },
      include: {
        cliente: { select: { telefone: true } },
        tenant: { select: { configWhatsApp: true } },
      },
    })
    if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' })

    const remetente = humano
      ? `humano:${req.admin.id}:${req.admin.nome || req.admin.email}`
      : 'ia'

    let envio = { enviado: false, motivo: 'Mensagem apenas registrada internamente' }
    if (humano) {
      try {
        envio = await enviarMensagemMeta({
          configWhatsApp: conversa.tenant.configWhatsApp,
          para: conversa.cliente.telefone,
          texto,
        })
      } catch (erroMeta) {
        envio = { enviado: false, motivo: erroMeta.message }
      }
    }

    const mensagem = await db.mensagem.create({
      data: { conversaId: conversa.id, remetente, conteudo: texto },
    })

    await db.conversa.update({
      where: { id: conversa.id },
      data: {
        status: humano ? 'ESCALONADA' : conversa.status,
        atualizadoEm: new Date(),
      },
    })

    return res.status(201).json({ mensagem, envio })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/comercial/suporte/tickets', async (req, res) => {
  try {
    const { tenantId, slaMinutos = 30 } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)

    const where = {
      status: 'ESCALONADA',
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
    }

    const [tickets, total] = await Promise.all([
      db.conversa.findMany({
        where,
        orderBy: { atualizadoEm: 'asc' },
        skip,
        take: limite,
        include: {
          tenant: { select: { id: true, nome: true } },
          cliente: { select: { id: true, nome: true, telefone: true } },
          mensagens: {
            orderBy: { criadoEm: 'desc' },
            take: 1,
            select: { id: true, remetente: true, conteudo: true, criadoEm: true },
          },
        },
      }),
      db.conversa.count({ where }),
    ])

    const slaMs = Math.max(1, Number.parseInt(slaMinutos, 10) || 30) * 60000
    const agora = Date.now()

    const itens = tickets.map((ticket) => {
      const idadeMs = agora - new Date(ticket.atualizadoEm).getTime()
      return {
        ...ticket,
        sla: {
          limiteMinutos: Number.parseInt(slaMinutos, 10) || 30,
          minutosEmAberto: Math.floor(idadeMs / 60000),
          atrasado: idadeMs > slaMs,
        },
      }
    })

    return res.json({
      tickets: itens,
      total,
      pagina,
      limite,
      atrasados: itens.filter((ticket) => ticket.sla.atrasado).length,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.post('/comercial/suporte/tickets', async (req, res) => {
  try {
    const { tenantId, clienteId, assunto, prioridade = 'NORMAL' } = req.body || {}
    if (!tenantId || !clienteId || !assunto) {
      return res.status(400).json({ erro: 'tenantId, clienteId e assunto são obrigatórios' })
    }

    const conversa = await obterOuCriarConversa(String(tenantId), String(clienteId))
    const ticket = await db.conversa.update({
      where: { id: conversa.id },
      data: {
        status: 'ESCALONADA',
        motivoEscalacao: JSON.stringify({
          assunto,
          prioridade: String(prioridade).toUpperCase(),
          origem: 'ADMIN',
          abertoPor: req.admin.id,
        }),
      },
    })

    await db.mensagem.create({
      data: {
        conversaId: conversa.id,
        remetente: `humano:${req.admin.id}:${req.admin.nome || req.admin.email}`,
        conteudo: `[TICKET] ${assunto}`,
      },
    })

    return res.status(201).json(ticket)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Relatório: performance por admin ────────────────────────────────────────
router.get('/relatorios/admins', async (req, res) => {
  try {
    const { dias = 30 } = req.query
    const desde = new Date(Date.now() - Number(dias) * 86400000)

    const mensagens = await db.mensagem.findMany({
      where: {
        remetente: { startsWith: 'humano:' },
        criadoEm: { gte: desde },
      },
      select: { id: true, remetente: true, conversaId: true, criadoEm: true },
    })

    const mapa = {}
    for (const msg of mensagens) {
      const parsed = parseRemetenteHumano(msg.remetente)
      if (!parsed) continue
      const chave = parsed.adminId || parsed.adminNome
      if (!mapa[chave]) {
        mapa[chave] = {
          adminId: parsed.adminId,
          adminNome: parsed.adminNome,
          totalMensagens: 0,
          conversasSet: new Set(),
        }
      }
      mapa[chave].totalMensagens++
      mapa[chave].conversasSet.add(msg.conversaId)
    }

    // Leads convertidos (estagio:GANHO) com última interação humana no período
    const leadsGanhos = await db.cliente.findMany({
      where: {
        tags: { has: 'estagio:GANHO' },
        atualizadoEm: { gte: desde },
      },
      select: {
        conversas: {
          select: {
            mensagens: {
              where: { remetente: { startsWith: 'humano:' } },
              orderBy: { criadoEm: 'desc' },
              take: 1,
              select: { remetente: true },
            },
          },
        },
      },
    })

    const ganhosPorAdmin = {}
    for (const lead of leadsGanhos) {
      for (const conv of lead.conversas) {
        const msg = conv.mensagens[0]
        if (!msg) continue
        const parsed = parseRemetenteHumano(msg.remetente)
        if (!parsed) continue
        const chave = parsed.adminId || parsed.adminNome
        ganhosPorAdmin[chave] = (ganhosPorAdmin[chave] || 0) + 1
      }
    }

    // Tickets resolvidos (ENCERRADA após ESCALONADA) no período
    const conversasEncerradas = await db.conversa.count({
      where: { status: 'ENCERRADA', atualizadoEm: { gte: desde } },
    })

    const ranking = Object.values(mapa)
      .map((a) => {
        const conversas = a.conversasSet.size
        const ganhos = ganhosPorAdmin[a.adminId || a.adminNome] || 0
        return {
          adminId: a.adminId,
          nome: a.adminNome,
          mensagens: a.totalMensagens,
          conversasAtendidas: conversas,
          leadsConvertidos: ganhos,
          taxaConversao: conversas > 0 ? Number(((ganhos / conversas) * 100).toFixed(1)) : 0,
        }
      })
      .sort((a, b) => b.conversasAtendidas - a.conversasAtendidas)

    return res.json({
      periodo: Number(dias),
      ranking,
      totalMensagensHumanas: mensagens.length,
      conversasEncerradas,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Relatório: funil de leads ────────────────────────────────────────────────
router.get('/relatorios/leads', async (req, res) => {
  try {
    const { dias = 30, tenantId } = req.query
    const desde = new Date(Date.now() - Number(dias) * 86400000)

    const where = {
      tags: { has: 'lead' },
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
    }

    const [todosLeads, novos30d] = await Promise.all([
      db.cliente.findMany({
        where,
        select: {
          id: true,
          tags: true,
          criadoEm: true,
          tenant: { select: { id: true, nome: true } },
        },
      }),
      db.cliente.count({ where: { ...where, criadoEm: { gte: desde } } }),
    ])

    const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']
    const funil = Object.fromEntries(ESTAGIOS.map((e) => [e, 0]))
    const porTenant = {}

    for (const lead of todosLeads) {
      const tag = (lead.tags || []).find((t) => t.startsWith('estagio:'))
      const estagio = tag ? tag.split(':')[1] : 'NOVO'
      if (funil[estagio] !== undefined) funil[estagio]++
      const tn = lead.tenant?.nome || lead.tenant?.id || 'Desconhecido'
      porTenant[tn] = (porTenant[tn] || 0) + 1
    }

    const totalGanho = funil.GANHO || 0
    const taxaConversao = todosLeads.length > 0
      ? Number(((totalGanho / todosLeads.length) * 100).toFixed(1))
      : 0

    const rankingTenants = Object.entries(porTenant)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Top 10 leads por número de agendamentos
    const topLeads = await db.cliente.findMany({
      where: { ...where, _count: undefined },
      orderBy: { agendamentos: { _count: 'desc' } },
      take: 10,
      select: {
        id: true,
        nome: true,
        telefone: true,
        tags: true,
        tenant: { select: { id: true, nome: true } },
        _count: { select: { agendamentos: true } },
      },
    })

    return res.json({
      total: todosLeads.length,
      novos30d,
      totalGanho,
      taxaConversao,
      topLeads: topLeads.map((l) => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        agendamentos: l._count.agendamentos,
        tenant: l.tenant,
      })),
      rankingTenants,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Clientes cross-tenant ────────────────────────────────────────────────────
router.get('/clientes', async (req, res) => {
  try {
    const { busca, tenantId } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)

    const where = {
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { telefone: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where,
        orderBy: { atualizadoEm: 'desc' },
        skip,
        take: limite,
        include: {
          tenant: { select: { id: true, nome: true } },
          _count: { select: { agendamentos: true, conversas: true } },
        },
      }),
      db.cliente.count({ where }),
    ])

    return res.json({ clientes, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Cliente 360 ──────────────────────────────────────────────────────────────
router.get('/clientes/:id', async (req, res) => {
  try {
    const cliente = await db.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { id: true, nome: true } },
        agendamentos: {
          orderBy: { inicioEm: 'desc' },
          take: 10,
          include: {
            servico: { select: { nome: true, precoCentavos: true } },
            profissional: { select: { nome: true } },
          },
        },
        conversas: {
          orderBy: { atualizadoEm: 'desc' },
          take: 3,
          include: {
            mensagens: {
              orderBy: { criadoEm: 'desc' },
              take: 10,
              select: { id: true, remetente: true, conteudo: true, criadoEm: true },
            },
          },
        },
      },
    })
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' })
    return res.json(cliente)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Relatório: top tenants por agendamentos ─────────────────────────────────
router.get('/relatorios/tenants', async (_req, res) => {
  try {
    const topTenants = await db.tenant.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        planoContratado: true,
        _count: { select: { agendamentos: true, clientes: true } },
      },
      orderBy: { agendamentos: { _count: 'desc' } },
      take: 10,
    })

    return res.json({
      topTenants: topTenants.map((t) => ({
        id: t.id,
        nome: t.nome,
        plano: t.planoContratado,
        agendamentos: t._count.agendamentos,
        clientes: t._count.clientes,
      })),
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Relatório: funil de conversão ───────────────────────────────────────────
router.get('/relatorios/funil', async (_req, res) => {
  try {
    const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']
    const leads = await db.cliente.findMany({
      where: { tags: { has: 'lead' } },
      select: { tags: true },
    })

    const contagem = Object.fromEntries(ESTAGIOS.map((e) => [e, 0]))
    for (const lead of leads) {
      const tag = (lead.tags || []).find((t) => t.startsWith('estagio:'))
      const estagio = tag ? tag.split(':')[1] : 'NOVO'
      if (contagem[estagio] !== undefined) contagem[estagio]++
    }

    const totalLeads = leads.length
    const conversaoGanho = totalLeads > 0
      ? Number(((contagem.GANHO / totalLeads) * 100).toFixed(1))
      : 0

    return res.json({
      totalLeads,
      conversaoGanho,
      estagios: ESTAGIOS.map((e) => ({ estagio: e, total: contagem[e] })),
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Disparos: lista tenants com status Meta ──────────────────────────────────
router.get('/disparos/tenants', async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, configWhatsApp: true },
      orderBy: { nome: 'asc' },
    })

    const itens = tenants.map((t) => {
      const meta = normalizarConfigMeta(t.configWhatsApp)
      return {
        id: t.id,
        nome: t.nome,
        metaConfigurado: Boolean(meta.accessToken && meta.phoneNumberId),
      }
    })

    return res.json(itens)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─── Disparos: envio em massa por número ─────────────────────────────────────
router.post('/disparos', async (req, res) => {
  try {
    const { tenantId, numeros = [], texto, salvarComoLead = false } = req.body || {}
    if (!tenantId || !Array.isArray(numeros) || numeros.length === 0 || !texto) {
      return res.status(400).json({ erro: 'tenantId, numeros e texto são obrigatórios' })
    }

    const tenant = await db.tenant.findUnique({
      where: { id: String(tenantId) },
      select: { id: true, nome: true, configWhatsApp: true },
    })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })

    const meta = normalizarConfigMeta(tenant.configWhatsApp)
    if (!meta.accessToken || !meta.phoneNumberId) {
      return res.status(422).json({ erro: 'Meta WhatsApp não configurado neste tenant' })
    }

    const resultados = []
    for (const item of numeros) {
      const telefone = normalizarTelefone(String(item.telefone || item))
      const nome = item.nome || null
      const textoFinal = texto.replace(/\{nome\}/gi, nome || 'Cliente')

      try {
        // Upsert cliente se necessário
        let cliente = await db.cliente.findFirst({
          where: { tenantId: tenant.id, telefone },
        })

        if (!cliente) {
          cliente = await db.cliente.create({
            data: {
              tenantId: tenant.id,
              nome: nome || telefone,
              telefone,
              tags: salvarComoLead ? ['lead', 'origem:DISPARO', 'estagio:NOVO'] : ['origem:DISPARO'],
            },
          })
        } else if (salvarComoLead && !(cliente.tags || []).includes('lead')) {
          const tagsSemEstagio = (cliente.tags || []).filter((t) => !t.startsWith('estagio:'))
          await db.cliente.update({
            where: { id: cliente.id },
            data: { tags: [...tagsSemEstagio, 'lead', 'origem:DISPARO', 'estagio:NOVO'] },
          })
        }

        const conversa = await obterOuCriarConversa(tenant.id, cliente.id)
        const envio = await enviarMensagemMeta({
          configWhatsApp: tenant.configWhatsApp,
          para: telefone,
          texto: textoFinal,
        })

        await db.mensagem.create({
          data: {
            conversaId: conversa.id,
            remetente: `humano:${req.admin.id}:${req.admin.nome || req.admin.email}`,
            conteudo: textoFinal,
          },
        })

        resultados.push({ telefone, nome, enviado: true, ...envio })
      } catch (erroItem) {
        resultados.push({ telefone, nome, enviado: false, motivo: erroItem.message })
      }
    }

    return res.json({
      total: resultados.length,
      enviados: resultados.filter((r) => r.enviado).length,
      falhas: resultados.filter((r) => !r.enviado).length,
      resultados,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/integracoes/meta/saude', async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        nome: true,
        ativo: true,
        configWhatsApp: true,
        conversas: {
          orderBy: { atualizadoEm: 'desc' },
          take: 1,
          select: {
            atualizadoEm: true,
            mensagens: {
              orderBy: { criadoEm: 'desc' },
              take: 5,
              select: { remetente: true, criadoEm: true },
            },
          },
        },
      },
    })

    const itens = tenants.map((tenant) => {
      const meta = normalizarConfigMeta(tenant.configWhatsApp)
      const ultimaConversa = tenant.conversas?.[0]
      const ultimaHumana = (ultimaConversa?.mensagens || []).find((msg) => String(msg.remetente).startsWith('humano:'))
      return {
        tenantId: tenant.id,
        tenantNome: tenant.nome,
        ativo: tenant.ativo,
        configuracao: {
          tokenOk: Boolean(meta.accessToken),
          phoneNumberIdOk: Boolean(meta.phoneNumberId),
          prontoParaEnvio: Boolean(meta.accessToken && meta.phoneNumberId),
        },
        monitoramento: {
          ultimaAtividade: ultimaConversa?.atualizadoEm || null,
          ultimaRespostaHumanaEm: ultimaHumana?.criadoEm || null,
        },
      }
    })

    return res.json({
      total: itens.length,
      integracaoOk: itens.filter((item) => item.configuracao.prontoParaEnvio).length,
      itens,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { comercialRoutes: router }

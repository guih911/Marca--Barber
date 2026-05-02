const express = require('express')
const { db } = require('../../core/db')

const router = express.Router()

const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']

// GET /api/admin/relatorios/admins — ranking de admins por mensagens enviadas
router.get('/relatorios/admins', async (_req, res) => {
  try {
    // Busca todas as mensagens com remetente iniciando com 'humano:'
    const mensagens = await db.mensagem.findMany({
      where: { remetente: { startsWith: 'humano:' } },
      select: { remetente: true, criadoEm: true },
    })

    const ranking = {}
    for (const msg of mensagens) {
      const parts = String(msg.remetente).split(':')
      const adminId = parts[1] || 'desconhecido'
      const nome = parts.slice(2).join(':') || 'Admin'
      if (!ranking[adminId]) ranking[adminId] = { adminId, nome, mensagens: 0 }
      ranking[adminId].mensagens += 1
    }

    const sorted = Object.values(ranking).sort((a, b) => b.mensagens - a.mensagens)
    return res.json({ ranking: sorted, total: mensagens.length })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// GET /api/admin/relatorios/leads — top leads por agendamentos
router.get('/relatorios/leads', async (_req, res) => {
  try {
    const leads = await db.cliente.findMany({
      where: { tags: { has: 'lead' } },
      orderBy: { atualizadoEm: 'desc' },
      take: 50,
      include: {
        tenant: { select: { id: true, nome: true } },
        _count: { select: { agendamentos: true } },
      },
    })

    const topLeads = leads
      .map(l => ({ id: l.id, nome: l.nome, tenant: l.tenant, agendamentos: l._count?.agendamentos || 0 }))
      .sort((a, b) => b.agendamentos - a.agendamentos)
      .slice(0, 10)

    return res.json({ topLeads, total: leads.length })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// GET /api/admin/relatorios/tenants — top tenants por agendamentos
router.get('/relatorios/tenants', async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({
      where: { ativo: true },
      take: 50,
      include: {
        _count: { select: { agendamentos: true, clientes: true } },
      },
      orderBy: { atualizadoEm: 'desc' },
    })

    const topTenants = tenants
      .map(t => ({
        id: t.id,
        nome: t.nome,
        plano: t.planoContratado,
        agendamentos: t._count?.agendamentos || 0,
        clientes: t._count?.clientes || 0,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos)
      .slice(0, 10)

    return res.json({ topTenants, total: tenants.length })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// GET /api/admin/relatorios/funil — funil de conversão de leads por estágio
router.get('/relatorios/funil', async (_req, res) => {
  try {
    const leadsComEstagio = await db.cliente.findMany({
      where: { tags: { has: 'lead' } },
      select: { id: true, tags: true, _count: { select: { agendamentos: true } } },
    })

    const countByEstagio = {}
    for (const est of ESTAGIOS) countByEstagio[est] = { total: 0, comAgendamento: 0 }

    for (const lead of leadsComEstagio) {
      const tag = (lead.tags || []).find(t => String(t).startsWith('estagio:'))
      const estagio = tag ? tag.split(':')[1] : 'NOVO'
      if (!countByEstagio[estagio]) countByEstagio[estagio] = { total: 0, comAgendamento: 0 }
      countByEstagio[estagio].total += 1
      if ((lead._count?.agendamentos || 0) > 0) countByEstagio[estagio].comAgendamento += 1
    }

    const estagios = ESTAGIOS.map(est => ({
      estagio: est,
      total: countByEstagio[est]?.total || 0,
      comAgendamento: countByEstagio[est]?.comAgendamento || 0,
    }))

    const totalLeads = leadsComEstagio.length
    const ganho = countByEstagio['GANHO']?.total || 0
    const conversaoGanho = totalLeads > 0 ? Math.round((ganho / totalLeads) * 100) : 0

    return res.json({ estagios, totalLeads, conversaoGanho })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { relatoriosRoutes: router }

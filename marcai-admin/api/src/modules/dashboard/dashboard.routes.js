const express = require('express')
const { db } = require('../../core/db')

const router = express.Router()

router.get('/dashboard', async (_req, res) => {
  try {
    const precos = { SOLO: 55.9, SALAO: 139.9 }
    const descontos = { MENSAL: 0, SEMESTRAL: 0.1, ANUAL: 0.2 }

    const allTenants = await db.tenant.findMany({
      select: {
        id: true,
        nome: true,
        planoContratado: true,
        cicloCobranca: true,
        ativo: true,
        onboardingCompleto: true,
        criadoEm: true,
      },
    })

    const ativos = allTenants.filter((t) => t.ativo)
    const comPlano = ativos.filter((t) => t.planoContratado && precos[t.planoContratado])
    const onboardingPendente = ativos.filter((t) => !t.onboardingCompleto)

    const mrr = comPlano.reduce((acc, t) => {
      const base = precos[t.planoContratado] || 0
      const desc = descontos[t.cicloCobranca] || 0
      return acc + base * (1 - desc)
    }, 0)

    const planoSolo = comPlano.filter((t) => t.planoContratado === 'SOLO').length
    const planoSalao = comPlano.filter((t) => t.planoContratado === 'SALAO').length

    const cicloMensal = comPlano.filter((t) => !t.cicloCobranca || t.cicloCobranca === 'MENSAL').length
    const cicloSemestral = comPlano.filter((t) => t.cicloCobranca === 'SEMESTRAL').length
    const cicloAnual = comPlano.filter((t) => t.cicloCobranca === 'ANUAL').length

    const agora = Date.now()
    const novos7d = allTenants.filter((t) => agora - new Date(t.criadoEm).getTime() < 7 * 86400000).length
    const novos30d = allTenants.filter((t) => agora - new Date(t.criadoEm).getTime() < 30 * 86400000).length

    const arr = mrr * 12

    const ultimosTenants = allTenants
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        plano: t.planoContratado,
        ciclo: t.cicloCobranca,
        ativo: t.ativo,
        criadoEm: t.criadoEm,
      }))

    return res.json({
      totalTenants: allTenants.length,
      tenantsAtivos: ativos.length,
      onboardingPendente: onboardingPendente.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      planos: { solo: planoSolo, salao: planoSalao },
      ciclos: { mensal: cicloMensal, semestral: cicloSemestral, anual: cicloAnual },
      novos7d,
      novos30d,
      ultimosTenants,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

router.get('/billing/resumo', async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        ativo: true,
        planoContratado: true,
        cicloCobranca: true,
        criadoEm: true,
      },
    })
    const precos = { SOLO: 55.9, SALAO: 139.9 }
    const descontos = { MENSAL: 0, SEMESTRAL: 0.1, ANUAL: 0.2 }

    let mrr = 0
    let contratosAtivos = 0
    for (const tenant of tenants) {
      if (!tenant.ativo) continue
      const base = precos[tenant.planoContratado] || 0
      const desconto = descontos[tenant.cicloCobranca] || 0
      if (base > 0) {
        contratosAtivos += 1
        mrr += base * (1 - desconto)
      }
    }

    const ultimos30Dias = Date.now() - 30 * 86400000
    const novosPagantes30d = tenants.filter(
      (tenant) => tenant.ativo && precos[tenant.planoContratado] && new Date(tenant.criadoEm).getTime() >= ultimos30Dias
    ).length

    const inativos = tenants.filter((tenant) => !tenant.ativo).length
    const churnProxy = tenants.length ? (inativos / tenants.length) * 100 : 0

    return res.json({
      mrr: Number(mrr.toFixed(2)),
      arr: Number((mrr * 12).toFixed(2)),
      contratosAtivos,
      novosPagantes30d,
      churnProxy: Number(churnProxy.toFixed(2)),
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { dashboardRoutes: router }

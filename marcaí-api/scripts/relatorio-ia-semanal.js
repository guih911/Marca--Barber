#!/usr/bin/env node
require('dotenv').config()

const banco = require('../src/config/banco')

const arg = (nome, fallback = null) => {
  const flag = `--${nome}=`
  const raw = process.argv.find((a) => a.startsWith(flag))
  if (!raw) return fallback
  return raw.slice(flag.length)
}

const dias = Math.max(1, Number(arg('dias', 7)) || 7)
const tenantId = arg('tenantId', null)

const inicio = new Date()
inicio.setDate(inicio.getDate() - dias)

const periodo = { gte: inicio, lte: new Date() }

const calcPct = (num, den) => (den > 0 ? ((num / den) * 100).toFixed(1) : '0.0')

const gerarInsight = (kpi) => {
  const insights = []
  if (kpi.taxaNoShow > 15) {
    insights.push('No-show alto: revisar copy de lembretes e testar 2 janelas (ex.: 2h + 24h).')
  }
  if (kpi.taxaCancelamento > 20) {
    insights.push('Cancelamento elevado: oferecer slots alternativos no mesmo dia antes de cancelar.')
  }
  if (kpi.taxaEscalonamento > 12) {
    insights.push('Escalonamento alto: revisar intents que mais caem em humano e ajustar prompt/ferramentas.')
  }
  if (kpi.tempoMedioPrimeiraRespostaSeg > 120) {
    insights.push('Primeira resposta lenta: priorizar fluxo direto de agendamento e menos mensagens longas.')
  }
  if (insights.length === 0) {
    insights.push('Operação saudável: manter monitoramento semanal e testes de variações linguísticas.')
  }
  return insights
}

const medirTempoPrimeiraResposta = async (tenantIdAtual) => {
  const conversas = await banco.conversa.findMany({
    where: {
      tenantId: tenantIdAtual,
      atualizadoEm: periodo,
    },
    select: {
      id: true,
      mensagens: {
        where: { remetente: { in: ['cliente', 'ia'] } },
        orderBy: { criadoEm: 'asc' },
        select: { remetente: true, criadoEm: true },
      },
    },
    take: 1500,
  })

  const diffs = []
  for (const c of conversas) {
    const primeiraCliente = c.mensagens.find((m) => m.remetente === 'cliente')
    if (!primeiraCliente) continue
    const primeiraIA = c.mensagens.find(
      (m) => m.remetente === 'ia' && new Date(m.criadoEm).getTime() >= new Date(primeiraCliente.criadoEm).getTime()
    )
    if (!primeiraIA) continue
    const delta = (new Date(primeiraIA.criadoEm).getTime() - new Date(primeiraCliente.criadoEm).getTime()) / 1000
    if (Number.isFinite(delta) && delta >= 0) diffs.push(delta)
  }

  if (!diffs.length) return 0
  const total = diffs.reduce((acc, n) => acc + n, 0)
  return Math.round(total / diffs.length)
}

const montarKpiTenant = async (tenant) => {
  const wherePeriodo = { tenantId: tenant.id, criadoEm: periodo }

  const [totalAgendamentos, concluidos, cancelados, noShow, remarcados, conversasTotais, conversasEscalonadas, tempoRsp] =
    await Promise.all([
      banco.agendamento.count({ where: wherePeriodo }),
      banco.agendamento.count({ where: { ...wherePeriodo, status: 'CONCLUIDO' } }),
      banco.agendamento.count({ where: { ...wherePeriodo, status: 'CANCELADO' } }),
      banco.agendamento.count({ where: { ...wherePeriodo, status: 'NAO_COMPARECEU' } }),
      banco.agendamento.count({ where: { ...wherePeriodo, status: 'REMARCADO' } }),
      banco.conversa.count({ where: { tenantId: tenant.id, atualizadoEm: periodo } }),
      banco.conversa.count({ where: { tenantId: tenant.id, atualizadoEm: periodo, status: 'ESCALONADA' } }),
      medirTempoPrimeiraResposta(tenant.id),
    ])

  const atendimentoConcluido = concluidos + noShow
  const kpi = {
    totalAgendamentos,
    concluidos,
    cancelados,
    noShow,
    remarcados,
    conversasTotais,
    conversasEscalonadas,
    tempoMedioPrimeiraRespostaSeg: tempoRsp,
    taxaNoShow: Number(calcPct(noShow, atendimentoConcluido)),
    taxaCancelamento: Number(calcPct(cancelados, totalAgendamentos)),
    taxaEscalonamento: Number(calcPct(conversasEscalonadas, conversasTotais)),
  }
  return kpi
}

const main = async () => {
  const tenants = await banco.tenant.findMany({
    where: tenantId ? { id: tenantId } : { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  if (!tenants.length) {
    console.log('Nenhum tenant encontrado para o filtro informado.')
    return
  }

  console.log(`\n=== Relatório IA Semanal (${dias} dias) ===`)
  console.log(`Período inicial: ${inicio.toISOString()}\n`)

  for (const tenant of tenants) {
    const kpi = await montarKpiTenant(tenant)
    const insights = gerarInsight(kpi)
    console.log(`\n--- ${tenant.nome} (${tenant.id}) ---`)
    console.log(`Agendamentos: ${kpi.totalAgendamentos}`)
    console.log(`Concluídos: ${kpi.concluidos} | Cancelados: ${kpi.cancelados} | No-show: ${kpi.noShow} | Remarcados: ${kpi.remarcados}`)
    console.log(`Taxa no-show: ${kpi.taxaNoShow.toFixed(1)}% | Taxa cancelamento: ${kpi.taxaCancelamento.toFixed(1)}%`)
    console.log(`Conversas: ${kpi.conversasTotais} | Escalonadas: ${kpi.conversasEscalonadas} (${kpi.taxaEscalonamento.toFixed(1)}%)`)
    console.log(`Tempo médio 1ª resposta IA: ${kpi.tempoMedioPrimeiraRespostaSeg}s`)
    console.log('Insights:')
    insights.forEach((i) => console.log(`- ${i}`))
  }
}

main()
  .catch((err) => {
    console.error('Erro ao gerar relatório semanal da IA:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await banco.$disconnect().catch(() => {})
  })

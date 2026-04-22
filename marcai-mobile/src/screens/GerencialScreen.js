import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  listarAgendamentos,
  listarFilaEspera,
  listarProfissionais,
  obterCaixaAtual,
  obterVisaoGeralCaixa,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PrimaryButton, SectionCard } from '../ui/components'
import { colors, radius, spacing, typography } from '../ui/theme'

function inicioFimDiaLocal(data) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(data)
  fim.setHours(23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function formatarMoeda(centavos) {
  return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GerencialScreen({ navigation }) {
  const { user, logout, isPlanoSolo } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [erro, setErro] = useState('')
  const [resumo, setResumo] = useState({
    totalDia: 0,
    confirmados: 0,
    concluidos: 0,
    pendentes: 0,
    profissionais: 0,
    receitaDia: 0,
    ticketMedio: 0,
    noShow: 0,
    ocupacao: 0,
  })
  const [semana, setSemana] = useState([])
  const [caixaAtual, setCaixaAtual] = useState(null)
  const [visaoCaixa, setVisaoCaixa] = useState(null)
  const [filaHoje, setFilaHoje] = useState([])
  const [receitaSemanas, setReceitaSemanas] = useState({ atual: 0, passada: 0 })

  const dataTitulo = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
    []
  )

  const carregar = useCallback(async () => {
    setErro('')
    const { inicio, fim } = inicioFimDiaLocal(new Date())
    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - 6)
    inicioSemana.setHours(0, 0, 0, 0)
    const inicioDuasSemanas = new Date()
    inicioDuasSemanas.setDate(inicioDuasSemanas.getDate() - 13)
    inicioDuasSemanas.setHours(0, 0, 0, 0)

    const [agenda, agendaCompletaDia, agendaSemana, agenda14d, profissionais, fila, caixa, visao] =
      await Promise.all([
        listarAgendamentos({
          inicio,
          fim,
          limite: 200,
          ordem: 'proximosPrimeiro',
        }),
        listarAgendamentos({
          inicio,
          fim,
          limite: 300,
          ordem: 'proximosPrimeiro',
          status: 'AGENDADO,CONFIRMADO,CONCLUIDO,NAO_COMPARECEU,CANCELADO',
        }),
        listarAgendamentos({
          inicio: inicioSemana.toISOString(),
          fim: new Date().toISOString(),
          limite: 500,
          ordem: 'proximosPrimeiro',
          status: 'AGENDADO,CONFIRMADO,CONCLUIDO,NAO_COMPARECEU',
        }),
        listarAgendamentos({
          inicio: inicioDuasSemanas.toISOString(),
          fim: new Date().toISOString(),
          limite: 800,
          ordem: 'proximosPrimeiro',
          status: 'CONCLUIDO',
        }),
        listarProfissionais(),
        isPlanoSolo
          ? Promise.resolve([])
          : listarFilaEspera({ dataInicio: inicio.slice(0, 10), dataFim: fim.slice(0, 10) }),
        obterCaixaAtual(),
        obterVisaoGeralCaixa(6),
      ])

    const agendamentos = agenda.agendamentos || []
    const confirmados = agendamentos.filter((a) => a.status === 'CONFIRMADO').length
    const concluidos = agendamentos.filter((a) => a.status === 'CONCLUIDO').length
    const pendentes = agendamentos.filter((a) => a.status === 'AGENDADO').length
    const noShow = (agendaCompletaDia.agendamentos || []).filter((a) => a.status === 'NAO_COMPARECEU').length

    const receitaDia = (agendaCompletaDia.agendamentos || [])
      .filter((a) => a.status === 'CONCLUIDO')
      .reduce((soma, a) => {
        const bruto = a?.servico?.precoCentavos || 0
        const desconto = a?.descontoCentavos || 0
        const gorjeta = a?.gorjetaCentavos || 0
        return soma + (bruto - desconto + gorjeta)
      }, 0)

    const ticketMedio = concluidos > 0 ? Math.round(receitaDia / concluidos) : 0
    const capacidadeBase = Math.max(1, (profissionais.length || 1) * 16)
    const ocupacao = Math.min(100, Math.round(((agendamentos.length || 0) / capacidadeBase) * 100))

    setResumo({
      totalDia: agendamentos.length,
      confirmados,
      concluidos,
      pendentes,
      profissionais: profissionais.length,
      receitaDia,
      ticketMedio,
      noShow,
      ocupacao,
    })

    const mapaSemana = {}
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(inicioSemana)
      d.setDate(inicioSemana.getDate() + i)
      const chave = d.toISOString().slice(0, 10)
      mapaSemana[chave] = { chave, label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), total: 0, receita: 0 }
    }
    for (const ag of agendaSemana.agendamentos || []) {
      const chave = new Date(ag.inicioEm).toISOString().slice(0, 10)
      if (!mapaSemana[chave]) continue
      mapaSemana[chave].total += 1
      if (ag.status === 'CONCLUIDO') {
        mapaSemana[chave].receita += (ag?.servico?.precoCentavos || 0) - (ag?.descontoCentavos || 0) + (ag?.gorjetaCentavos || 0)
      }
    }
    setSemana(Object.values(mapaSemana))
    setFilaHoje(fila || [])
    setCaixaAtual(caixa)
    setVisaoCaixa(visao)

    const agora = Date.now()
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000
    const atualInicio = agora - seteDiasMs
    const passadaInicio = agora - (2 * seteDiasMs)
    const receitaAtual = (agenda14d.agendamentos || [])
      .filter((a) => new Date(a.inicioEm).getTime() >= atualInicio)
      .reduce((soma, a) => soma + ((a?.servico?.precoCentavos || 0) - (a?.descontoCentavos || 0) + (a?.gorjetaCentavos || 0)), 0)
    const receitaPassada = (agenda14d.agendamentos || [])
      .filter((a) => {
        const t = new Date(a.inicioEm).getTime()
        return t >= passadaInicio && t < atualInicio
      })
      .reduce((soma, a) => soma + ((a?.servico?.precoCentavos || 0) - (a?.descontoCentavos || 0) + (a?.gorjetaCentavos || 0)), 0)
    setReceitaSemanas({ atual: receitaAtual, passada: receitaPassada })
  }, [isPlanoSolo])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        await carregar()
      } catch (e) {
        if (ativo) setErro(e.message || 'Não foi possível carregar o resumo.')
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [carregar])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await carregar()
    } catch (e) {
      setErro(e.message || 'Falha ao atualizar indicadores.')
    } finally {
      setRefreshing(false)
    }
  }, [carregar])

  const previsaoReceitaMes = useMemo(() => {
    const receitaAtual = visaoCaixa?.atual?.receitaLiquida || 0
    if (!receitaAtual) return 0
    const agora = new Date()
    const diaAtual = agora.getDate()
    const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    const mediaDia = receitaAtual / Math.max(1, diaAtual)
    return Math.round(mediaDia * totalDiasMes)
  }, [visaoCaixa])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.welcome}>Resumo</Text>
            <Text style={styles.date}>
              {user?.nome?.split(' ')[0] || 'Barbeiro'} · {dataTitulo}
              {isPlanoSolo ? ' · Plano solo' : ''}
            </Text>
          </View>
          <Pressable onPress={logout} hitSlop={10}>
            <Text style={styles.logout}>Sair</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {erro ? <Text style={styles.erro}>{erro}</Text> : null}

            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Faturamento hoje</Text>
              <Text style={styles.heroValue}>{formatarMoeda(resumo.receitaDia)}</Text>
              <Text style={styles.heroSub}>
                {resumo.concluidos} concluído(s) · ticket médio {formatarMoeda(resumo.ticketMedio)}
              </Text>
            </View>

            <View style={styles.kpiGrid}>
              <KpiCard title="Agendamentos hoje" value={resumo.totalDia} />
              {!isPlanoSolo ? <KpiCard title="Taxa de ocupação" value={`${resumo.ocupacao}%`} /> : null}
              <KpiCard title="Pendentes" value={resumo.pendentes} />
              <KpiCard title="Não compareceu" value={resumo.noShow} />
            </View>

            <SectionCard title={isPlanoSolo ? 'Resumo' : 'Visão executiva'}>
              {!isPlanoSolo ? (
                <InfoRow label="Profissionais ativos" value={String(resumo.profissionais)} />
              ) : null}
              <InfoRow label="Confirmados" value={String(resumo.confirmados)} />
              <InfoRow label="Receita líquida do mês" value={formatarMoeda(visaoCaixa?.atual?.receitaLiquida || 0)} />
              <InfoRow label="Previsão de receita no mês" value={formatarMoeda(previsaoReceitaMes)} />
            </SectionCard>

            {!isPlanoSolo ? (
              <SectionCard title="Ritmo da semana">
                {semana.map((d) => (
                  <View key={d.chave} style={styles.weekRow}>
                    <Text style={styles.weekLabel}>{d.label}</Text>
                    <Text style={styles.weekValue}>{d.total} ag. · {formatarMoeda(d.receita)}</Text>
                  </View>
                ))}
              </SectionCard>
            ) : null}

            <SectionCard title="Operação comercial">
              {!isPlanoSolo ? (
                <InfoRow label="Lista de espera hoje" value={`${filaHoje.length} cliente(s)`} />
              ) : null}
              <InfoRow label="Faturamento semana atual" value={formatarMoeda(receitaSemanas.atual)} />
              <InfoRow label="Faturamento semana passada" value={formatarMoeda(receitaSemanas.passada)} />
              {caixaAtual?.sessao ? (
                <View style={styles.caixaAbertoBox}>
                  <Text style={styles.caixaAbertoText}>Caixa aberto</Text>
                  <Text style={styles.caixaAbertoSub}>
                    Atendimentos: {caixaAtual.totalAtendimentos || 0} · Projetado: {formatarMoeda(caixaAtual.saldoProjetado || 0)}
                  </Text>
                </View>
              ) : null}
            </SectionCard>

            <View style={styles.actions}>
              <PrimaryButton label="Ir para a agenda" onPress={() => navigation.navigate('AgendaTab')} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function KpiCard({ title, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  welcome: { color: colors.text, ...typography.h2 },
  date: { marginTop: 4, color: colors.textMuted, ...typography.caption, textTransform: 'capitalize' },
  logout: { color: colors.textMuted, ...typography.body },
  center: { marginTop: 80, alignItems: 'center' },
  erro: {
    color: colors.danger,
    marginBottom: spacing.xs,
    ...typography.caption,
    borderWidth: 1,
    borderColor: `${colors.danger}66`,
    backgroundColor: `${colors.danger}22`,
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  hero: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  heroLabel: { color: colors.primary, ...typography.caption, fontWeight: '700', textTransform: 'uppercase' },
  heroValue: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 6 },
  heroSub: { color: colors.textMuted, ...typography.caption, marginTop: 6 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  metricTitle: { color: colors.textMuted, ...typography.caption },
  metricValue: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textMuted, ...typography.caption, flex: 1, paddingRight: 12 },
  infoValue: { color: colors.text, ...typography.body, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  weekLabel: { color: colors.text, ...typography.caption, textTransform: 'capitalize', fontWeight: '700' },
  weekValue: { color: colors.textMuted, ...typography.caption },
  caixaAbertoBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  caixaAbertoText: { color: colors.text, fontWeight: '700', ...typography.caption },
  caixaAbertoSub: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  actions: { marginTop: spacing.xs, gap: spacing.xs },
})

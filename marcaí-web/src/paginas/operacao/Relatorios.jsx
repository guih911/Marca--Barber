import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, TrendingUp, DollarSign, Users, Calendar, RefreshCw, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const formatarReais = (centavos) => {
  if (!centavos && centavos !== 0) return 'R$ 0,00'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CardMetrica = ({ titulo, valor, icone: Icone, descricao, variacao }) => (
  <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">{titulo}</p>
        <p className="text-2xl font-bold text-texto mt-1 truncate">{valor}</p>
        {descricao && <p className="text-xs text-texto-sec mt-1">{descricao}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
        {Icone && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primaria/10">
            <Icone size={18} className="text-primaria" />
          </div>
        )}
        {variacao !== undefined && variacao !== null && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${variacao > 0 ? 'text-green-600' : variacao < 0 ? 'text-red-500' : 'text-texto-sec'}`}>
            {variacao > 0 ? <ArrowUp size={11} /> : variacao < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
            {Math.abs(variacao)}%
          </span>
        )}
      </div>
    </div>
  </div>
)

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const TooltipCustom = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-borda rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-texto mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.name === 'Receita' ? formatarReais(p.value) : p.value}</p>
      ))}
    </div>
  )
}

const Relatorios = () => {
  const toast = useToast()
  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [filtros, setFiltros] = useState({ inicio: inicioMes, fim: hoje, profissionalId: '' })
  const [agendamentos, setAgendamentos] = useState([])
  const [agendamentosAnterior, setAgendamentosAnterior] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [profissionais, setProfissionais] = useState([])

  useEffect(() => {
    api.get('/api/profissionais').then((r) => setProfissionais(r?.dados || r || [])).catch(() => {})
  }, [])

  const calcularPeriodoAnterior = () => {
    const ini = new Date(filtros.inicio + 'T12:00:00')
    const fim = new Date(filtros.fim + 'T12:00:00')
    const diffMs = fim - ini
    const fimAnt = new Date(ini - 86400000) // dia antes do início
    const iniAnt = new Date(fimAnt - diffMs)
    return {
      inicio: iniAnt.toISOString().split('T')[0],
      fim: fimAnt.toISOString().split('T')[0],
    }
  }

  const carregar = async () => {
    setCarregando(true)
    try {
      const profQuery = filtros.profissionalId ? `&profissionalId=${filtros.profissionalId}` : ''
      const anterior = calcularPeriodoAnterior()
      const [resAgs, resAnt] = await Promise.allSettled([
        api.get(`/api/agendamentos?status=CONCLUIDO&dataInicio=${filtros.inicio}&dataFim=${filtros.fim}&limite=500${profQuery}`),
        api.get(`/api/agendamentos?status=CONCLUIDO&dataInicio=${anterior.inicio}&dataFim=${anterior.fim}&limite=500${profQuery}`),
      ])
      setAgendamentos(resAgs.status === 'fulfilled' ? (resAgs.value?.agendamentos || []) : [])
      setAgendamentosAnterior(resAnt.status === 'fulfilled' ? (resAnt.value?.agendamentos || []) : [])
    } catch {
      toast('Erro ao carregar relatório', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [filtros])

  // ── Métricas básicas ─────────────────────────────────────────────────────────
  const totalPeriodo = agendamentos.reduce((s, ag) => s + (ag.servico?.precoCentavos || 0), 0)
  const totalAnterior = agendamentosAnterior.reduce((s, ag) => s + (ag.servico?.precoCentavos || 0), 0)
  const ticketMedio = agendamentos.length > 0 ? Math.round(totalPeriodo / agendamentos.length) : 0
  const ticketMedioAnt = agendamentosAnterior.length > 0 ? Math.round(totalAnterior / agendamentosAnterior.length) : 0
  const clientesUnicos = new Set(agendamentos.map((ag) => ag.clienteId).filter(Boolean)).size
  const clientesUnicosAnt = new Set(agendamentosAnterior.map((ag) => ag.clienteId).filter(Boolean)).size

  const variacaoReais = (atual, anterior) => {
    if (!anterior) return null
    return Math.round(((atual - anterior) / anterior) * 100)
  }

  // ── LTV e taxa de retorno ────────────────────────────────────────────────────
  const ltv = clientesUnicos > 0 ? Math.round(totalPeriodo / clientesUnicos) : 0

  const clienteContagem = useMemo(() => {
    const c = {}
    agendamentos.forEach((ag) => { if (ag.clienteId) c[ag.clienteId] = (c[ag.clienteId] || 0) + 1 })
    return c
  }, [agendamentos])

  const clientesRetornaram = Object.values(clienteContagem).filter((v) => v > 1).length
  const taxaRetorno = clientesUnicos > 0 ? Math.round((clientesRetornaram / clientesUnicos) * 100) : 0

  // ── Top 5 clientes por receita ────────────────────────────────────────────────
  const top5Clientes = useMemo(() => {
    const mapa = {}
    agendamentos.forEach((ag) => {
      if (!ag.clienteId) return
      if (!mapa[ag.clienteId]) mapa[ag.clienteId] = { nome: ag.cliente?.nome || 'Cliente sem nome', receita: 0, visitas: 0 }
      mapa[ag.clienteId].receita += ag.servico?.precoCentavos || 0
      mapa[ag.clienteId].visitas++
    })
    return Object.values(mapa).sort((a, b) => b.receita - a.receita).slice(0, 5)
  }, [agendamentos])

  // ── Evolução temporal ────────────────────────────────────────────────────────
  const evolucao = useMemo(() => {
    const mapa = {}
    agendamentos.forEach((ag) => {
      const chave = (ag.inicioEm || '').split('T')[0]
      if (!chave) return
      if (!mapa[chave]) mapa[chave] = { data: chave, receita: 0, atendimentos: 0 }
      mapa[chave].receita += ag.servico?.precoCentavos || 0
      mapa[chave].atendimentos++
    })
    return Object.values(mapa)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => ({
        ...d,
        label: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }))
  }, [agendamentos])

  // ── Heatmap de ocupação ──────────────────────────────────────────────────────
  const heatmap = useMemo(() => {
    const mapa = {}
    let maxVal = 0
    agendamentos.forEach((ag) => {
      if (!ag.inicioEm) return
      const d = new Date(ag.inicioEm)
      const dia = d.getDay()
      const hora = d.getHours()
      const key = `${dia}-${hora}`
      mapa[key] = (mapa[key] || 0) + 1
      if (mapa[key] > maxVal) maxVal = mapa[key]
    })
    return { mapa, maxVal }
  }, [agendamentos])

  const horas = Array.from({ length: 12 }, (_, i) => i + 8) // 8h às 19h

  // ── Por forma de pagamento ───────────────────────────────────────────────────
  const porFormaPagamento = agendamentos.reduce((acc, ag) => {
    const forma = ag.formaPagamento || 'NÃO INFORMADO'
    if (!acc[forma]) acc[forma] = { count: 0, total: 0 }
    acc[forma].count++
    acc[forma].total += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  // ── Por profissional ─────────────────────────────────────────────────────────
  const porProfissional = agendamentos.reduce((acc, ag) => {
    const nome = ag.profissional?.nome || 'Desconhecido'
    if (!acc[nome]) acc[nome] = { count: 0, total: 0 }
    acc[nome].count++
    acc[nome].total += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  // ── Por serviço ──────────────────────────────────────────────────────────────
  const porServico = agendamentos.reduce((acc, ag) => {
    const nome = ag.servico?.nome || 'Desconhecido'
    if (!acc[nome]) acc[acc[nome] ? nome : nome] = { count: 0, total: 0 }
    if (!acc[nome]) acc[nome] = { count: 0, total: 0 }
    acc[nome].count++
    acc[nome].total += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  const labelForma = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito', 'NÃO INFORMADO': 'Não informado' }

  const atalhos = [
    { label: 'Hoje', i: hoje, f: hoje },
    { label: 'Semana', i: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] })(), f: hoje },
    { label: 'Mês', i: inicioMes, f: hoje },
    { label: '90 dias', i: (() => { const d = new Date(); d.setDate(d.getDate() - 89); return d.toISOString().split('T')[0] })(), f: hoje },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Relatórios</h1>
        <p className="text-texto-sec text-sm mt-1">Análise financeira e de atendimentos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-texto">De</label>
          <input type="date" value={filtros.inicio} onChange={(e) => setFiltros(p => ({ ...p, inicio: e.target.value }))} className="border border-borda rounded-lg px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-texto">Até</label>
          <input type="date" value={filtros.fim} onChange={(e) => setFiltros(p => ({ ...p, fim: e.target.value }))} className="border border-borda rounded-lg px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30" />
        </div>
        {profissionais.length > 0 && (
          <select value={filtros.profissionalId} onChange={(e) => setFiltros(p => ({ ...p, profissionalId: e.target.value }))} className="border border-borda rounded-lg px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30">
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
        {atalhos.map(({ label, i, f }) => (
          <button key={label} onClick={() => setFiltros(p => ({ ...p, inicio: i, fim: f }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filtros.inicio === i && filtros.fim === f ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria'}`}>
            {label}
          </button>
        ))}
        <button onClick={carregar} className="ml-auto p-2 rounded-lg border border-borda text-texto-sec hover:text-texto transition-colors" title="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-texto-sec" /></div>
      ) : (
        <>
          {/* Cards de resumo com comparativo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CardMetrica titulo="Receita no período" valor={formatarReais(totalPeriodo)} icone={DollarSign}
              descricao={`${agendamentos.length} atendimentos`}
              variacao={agendamentosAnterior.length > 0 ? variacaoReais(totalPeriodo, totalAnterior) : null} />
            <CardMetrica titulo="Ticket médio" valor={formatarReais(ticketMedio)} icone={TrendingUp}
              variacao={agendamentosAnterior.length > 0 ? variacaoReais(ticketMedio, ticketMedioAnt) : null} />
            <CardMetrica titulo="Clientes únicos" valor={clientesUnicos} icone={Users}
              descricao="no período selecionado"
              variacao={clientesUnicosAnt > 0 ? variacaoReais(clientesUnicos, clientesUnicosAnt) : null} />
            <CardMetrica titulo="Total atendimentos" valor={agendamentos.length} icone={Calendar}
              variacao={agendamentosAnterior.length > 0 ? variacaoReais(agendamentos.length, agendamentosAnterior.length) : null} />
          </div>

          {/* LTV e taxa de retorno */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
              <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">LTV médio (período)</p>
              <p className="text-2xl font-bold text-texto mt-1">{formatarReais(ltv)}</p>
              <p className="text-xs text-texto-sec mt-1">receita total ÷ clientes únicos</p>
            </div>
            <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
              <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Taxa de retorno</p>
              <p className="text-2xl font-bold text-texto mt-1">{taxaRetorno}%</p>
              <p className="text-xs text-texto-sec mt-1">{clientesRetornaram} de {clientesUnicos} clientes voltaram</p>
            </div>
          </div>

          {/* Top 5 clientes */}
          {top5Clientes.length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-borda bg-fundo">
                <p className="text-sm font-semibold text-texto">Top 5 clientes (receita no período)</p>
              </div>
              <div className="divide-y divide-borda">
                {top5Clientes.map((c, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primaria/10 text-primaria text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto truncate">{c.nome}</p>
                      <p className="text-xs text-texto-sec">{c.visitas} visita{c.visitas !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-primaria shrink-0">{formatarReais(c.receita)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolução temporal */}
          {evolucao.length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm p-5 overflow-hidden">
              <p className="text-sm font-semibold text-texto mb-4">Evolução de receita no período</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={evolucao} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} domain={[0, 'auto']} allowDecimals={false} tickFormatter={(v) => `R$ ${Math.round(v / 100)}`} />
                  <Tooltip content={<TooltipCustom />} formatter={(v) => formatarReais(v)} />
                  <Bar dataKey="receita" name="Receita" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Heatmap de ocupação */}
          {agendamentos.length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm p-5 overflow-x-auto">
              <p className="text-sm font-semibold text-texto mb-4">Heatmap de ocupação</p>
              <div className="min-w-[480px]">
                <div className="grid" style={{ gridTemplateColumns: `44px repeat(${horas.length}, 1fr)` }}>
                  <div />
                  {horas.map((h) => (
                    <div key={h} className="text-center text-[10px] text-texto-sec pb-1">{h}h</div>
                  ))}
                  {diasSemana.map((dia, di) => (
                    <React.Fragment key={di}>
                      <div className="text-[11px] text-texto-sec flex items-center pr-2 font-medium">{dia}</div>
                      {horas.map((h) => {
                        const val = heatmap.mapa[`${di}-${h}`] || 0
                        const pct = heatmap.maxVal > 0 ? val / heatmap.maxVal : 0
                        const bg = pct === 0 ? 'bg-gray-50' : pct < 0.33 ? 'bg-primaria/20' : pct < 0.66 ? 'bg-primaria/50' : 'bg-primaria'
                        const text = pct > 0.5 ? 'text-white' : 'text-texto-sec'
                        return (
                          <div key={`${di}-${h}`} title={`${dia} ${h}h: ${val} atendimentos`}
                            className={`${bg} ${text} m-0.5 rounded text-[10px] flex items-center justify-center h-6`}>
                            {val > 0 ? val : ''}
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <span className="text-[10px] text-texto-sec">Menos</span>
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                    <div key={p} className="w-4 h-4 rounded" style={{ backgroundColor: p === 0 ? '#F3F4F6' : `rgba(124,58,237,${p})` }} />
                  ))}
                  <span className="text-[10px] text-texto-sec">Mais</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabelas por forma de pagamento / profissional / serviço */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-borda bg-fundo">
                <p className="text-sm font-semibold text-texto">Por forma de pagamento</p>
              </div>
              <div className="divide-y divide-borda">
                {Object.keys(porFormaPagamento).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-texto-sec">Nenhum dado</p>
                ) : Object.entries(porFormaPagamento).sort((a, b) => b[1].total - a[1].total).map(([forma, info]) => (
                  <div key={forma} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-texto">{labelForma[forma] || forma}</p>
                      <p className="text-xs text-texto-sec">{info.count} atendimento{info.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-primaria">{formatarReais(info.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-borda bg-fundo">
                <p className="text-sm font-semibold text-texto">Por profissional</p>
              </div>
              <div className="divide-y divide-borda">
                {Object.keys(porProfissional).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-texto-sec">Nenhum dado</p>
                ) : Object.entries(porProfissional).sort((a, b) => b[1].total - a[1].total).map(([nome, info]) => (
                  <div key={nome} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-texto">{nome}</p>
                      <p className="text-xs text-texto-sec">{info.count} atendimento{info.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-primaria">{formatarReais(info.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-borda bg-fundo">
                <p className="text-sm font-semibold text-texto">Por serviço</p>
              </div>
              <div className="divide-y divide-borda">
                {Object.keys(porServico).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-texto-sec">Nenhum dado</p>
                ) : Object.entries(porServico).sort((a, b) => b[1].total - a[1].total).map(([nome, info]) => (
                  <div key={nome} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-texto">{nome}</p>
                      <p className="text-xs text-texto-sec">{info.count} atendimento{info.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-primaria">{formatarReais(info.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparativo com período anterior */}
          {agendamentos.length > 0 && agendamentosAnterior.length === 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
              <p className="text-sm font-semibold text-texto mb-1">Comparativo com período anterior</p>
              <p className="text-xs text-texto-sec">Sem dados no período anterior para comparar.</p>
            </div>
          )}
          {agendamentosAnterior.length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
              <p className="text-sm font-semibold text-texto mb-1">Comparativo com período anterior</p>
              <p className="text-xs text-texto-sec mb-4">Período atual vs. período imediatamente anterior de mesma duração</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Receita', atual: formatarReais(totalPeriodo), anterior: formatarReais(totalAnterior), var: variacaoReais(totalPeriodo, totalAnterior) },
                  { label: 'Atendimentos', atual: agendamentos.length, anterior: agendamentosAnterior.length, var: variacaoReais(agendamentos.length, agendamentosAnterior.length) },
                  { label: 'Ticket médio', atual: formatarReais(ticketMedio), anterior: formatarReais(ticketMedioAnt), var: variacaoReais(ticketMedio, ticketMedioAnt) },
                  { label: 'Clientes únicos', atual: clientesUnicos, anterior: clientesUnicosAnt, var: variacaoReais(clientesUnicos, clientesUnicosAnt) },
                ].map(({ label, atual, anterior, var: v }) => (
                  <div key={label} className="rounded-xl border border-borda p-3">
                    <p className="text-[11px] text-texto-sec font-medium uppercase tracking-wide mb-2">{label}</p>
                    <p className="text-lg font-bold text-texto">{atual}</p>
                    <p className="text-xs text-texto-sec">Anterior: {anterior}</p>
                    {v !== null && (
                      <span className={`text-xs font-semibold flex items-center gap-0.5 mt-1 ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-texto-sec'}`}>
                        {v > 0 ? <ArrowUp size={10} /> : v < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
                        {Math.abs(v)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Relatorios

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, TrendingUp, DollarSign, Users, Calendar, Star, Printer, RefreshCw, ExternalLink } from 'lucide-react'
import api from '../../servicos/api'

const fmt = (centavos) => {
  if (!centavos && centavos !== 0) return 'R$ 0,00'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const hoje = () => new Date().toISOString().split('T')[0]
const inicioSemana = () => {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().split('T')[0]
}
const inicioMes = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

const ATALHOS = [
  { label: 'Hoje', inicio: () => hoje(), fim: () => hoje() },
  { label: 'Semana', inicio: inicioSemana, fim: () => hoje() },
  { label: 'Mês', inicio: inicioMes, fim: () => hoje() },
]

export default function ModalRelatorios({ onFechar }) {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState({ inicio: inicioMes(), fim: hoje() })
  const [carregando, setCarregando] = useState(false)
  const [agendamentos, setAgendamentos] = useState([])
  const [atalhoAtivo, setAtalhoAtivo] = useState('Mês')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await api.get(
        `/api/agendamentos?status=CONCLUIDO&inicio=${filtros.inicio}T00:00:00&fim=${filtros.fim}T23:59:59&limite=500`
      )
      setAgendamentos(res.agendamentos || [])
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => { carregar() }, [carregar])

  // Cálculos
  const totalReceita = agendamentos.reduce((s, ag) => s + (ag.servico?.precoCentavos || 0), 0)
  const ticketMedio = agendamentos.length > 0 ? Math.round(totalReceita / agendamentos.length) : 0
  const clientesUnicos = new Set(agendamentos.map((ag) => ag.clienteId).filter(Boolean)).size

  // Por profissional — com média de avaliação
  const porProfissional = agendamentos.reduce((acc, ag) => {
    const nome = ag.profissional?.nome || 'Desconhecido'
    if (!acc[nome]) acc[nome] = { count: 0, total: 0, notas: [] }
    acc[nome].count++
    acc[nome].total += ag.servico?.precoCentavos || 0
    if (ag.feedbackNota) acc[nome].notas.push(ag.feedbackNota)
    return acc
  }, {})

  // Por serviço
  const porServico = agendamentos.reduce((acc, ag) => {
    const nome = ag.servico?.nome || 'Desconhecido'
    if (!acc[nome]) acc[nome] = { count: 0, total: 0 }
    acc[nome].count++
    acc[nome].total += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  // Por forma de pagamento
  const labelForma = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito', 'NÃO INFORMADO': 'Não informado' }
  const porPagamento = agendamentos.reduce((acc, ag) => {
    const forma = ag.formaPagamento || 'NÃO INFORMADO'
    if (!acc[forma]) acc[forma] = { count: 0, total: 0 }
    acc[forma].count++
    acc[forma].total += ag.servico?.precoCentavos || 0
    return acc
  }, {})

  const exportarPDF = () => {
    const conteudo = document.getElementById('relatorio-conteudo')
    if (!conteudo) return
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Relatório ${filtros.inicio} a ${filtros.fim}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { color: #666; font-size: 12px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .card-label { font-size: 11px; color: #666; text-transform: uppercase; }
  .card-val { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .row-name { flex: 1; }
  .row-sub { font-size: 11px; color: #888; }
  .row-val { font-weight: 600; color: #7c4dff; }
  .stars { color: #f59e0b; font-size: 11px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${conteudo.innerHTML}
</body>
</html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  const selecionarAtalho = (a) => {
    setAtalhoAtivo(a.label)
    setFiltros({ inicio: a.inicio(), fim: a.fim() })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-borda shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primaria" />
            <h2 className="font-semibold text-texto">Relatórios</h2>
            <button
              onClick={() => { onFechar(); navigate('/operacao/relatorios') }}
              className="inline-flex items-center gap-1 text-xs text-primaria hover:underline ml-1"
              title="Abrir relatório completo com gráficos, heatmap e Top 5"
            >
              <ExternalLink size={12} /> versão completa
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-borda text-xs font-medium text-texto-sec hover:text-primaria hover:border-primaria transition-colors"
            >
              <Printer size={13} /> Exportar PDF
            </button>
            <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-borda shrink-0 flex flex-wrap items-center gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a.label}
              onClick={() => selecionarAtalho(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${atalhoAtivo === a.label ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria'}`}
            >
              {a.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <input
              type="date"
              value={filtros.inicio}
              onChange={(e) => { setAtalhoAtivo(''); setFiltros((p) => ({ ...p, inicio: e.target.value })) }}
              className="border border-borda rounded-lg px-2 py-1 text-xs text-texto"
            />
            <span className="text-xs text-texto-sec">até</span>
            <input
              type="date"
              value={filtros.fim}
              onChange={(e) => { setAtalhoAtivo(''); setFiltros((p) => ({ ...p, fim: e.target.value })) }}
              className="border border-borda rounded-lg px-2 py-1 text-xs text-texto"
            />
          </div>
          <button onClick={carregar} className="p-1.5 rounded-lg border border-borda text-texto-sec hover:text-texto transition-colors ml-auto" title="Atualizar">
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {carregando ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-texto-sec" /></div>
          ) : (
            <div id="relatorio-conteudo">
              <h1 style={{ fontFamily: 'Arial', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }} className="text-texto font-bold text-lg sr-only">Relatório de Atendimentos</h1>
              <p className="text-xs text-texto-sec mb-4 sr-only">Período: {filtros.inicio} a {filtros.fim} · {agendamentos.length} atendimentos concluídos</p>

              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Receita no período', valor: fmt(totalReceita), icone: DollarSign, cor: 'text-green-600 bg-green-50' },
                  { label: 'Ticket médio', valor: fmt(ticketMedio), icone: TrendingUp, cor: 'text-blue-600 bg-blue-50' },
                  { label: 'Atendimentos', valor: agendamentos.length, icone: Calendar, cor: 'text-primaria bg-primaria/10' },
                  { label: 'Clientes únicos', valor: clientesUnicos, icone: Users, cor: 'text-purple-600 bg-purple-50' },
                ].map(({ label, valor, icone: Icone, cor }) => (
                  <div key={label} className="bg-white border border-borda rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-texto-sec uppercase tracking-wide">{label}</p>
                        <p className="text-xl font-bold text-texto mt-0.5">{valor}</p>
                      </div>
                      <div className={`p-2 rounded-xl ${cor}`}>
                        <Icone size={15} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Por profissional com NPS */}
                <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-borda bg-fundo">
                    <p className="text-xs font-semibold text-texto uppercase tracking-wide">Por profissional</p>
                  </div>
                  <div className="divide-y divide-borda">
                    {Object.keys(porProfissional).length === 0 ? (
                      <p className="px-4 py-4 text-sm text-texto-sec">Nenhum dado</p>
                    ) : Object.entries(porProfissional).sort((a, b) => b[1].total - a[1].total).map(([nome, info]) => {
                      const mediaNota = info.notas.length > 0
                        ? (info.notas.reduce((s, n) => s + n, 0) / info.notas.length).toFixed(1)
                        : null
                      return (
                        <div key={nome} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-texto">{nome}</p>
                            <span className="text-sm font-semibold text-primaria">{fmt(info.total)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-texto-sec">{info.count} atendimento{info.count !== 1 ? 's' : ''}</p>
                            {mediaNota && (
                              <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> {mediaNota} ({info.notas.length})
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Por serviço */}
                <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-borda bg-fundo">
                    <p className="text-xs font-semibold text-texto uppercase tracking-wide">Por serviço</p>
                  </div>
                  <div className="divide-y divide-borda">
                    {Object.keys(porServico).length === 0 ? (
                      <p className="px-4 py-4 text-sm text-texto-sec">Nenhum dado</p>
                    ) : Object.entries(porServico).sort((a, b) => b[1].count - a[1].count).map(([nome, info]) => (
                      <div key={nome} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-texto">{nome}</p>
                          <p className="text-xs text-texto-sec">{info.count}×</p>
                        </div>
                        <span className="text-sm font-semibold text-primaria">{fmt(info.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Por pagamento */}
                <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-borda bg-fundo">
                    <p className="text-xs font-semibold text-texto uppercase tracking-wide">Por pagamento</p>
                  </div>
                  <div className="divide-y divide-borda">
                    {Object.keys(porPagamento).length === 0 ? (
                      <p className="px-4 py-4 text-sm text-texto-sec">Nenhum dado</p>
                    ) : Object.entries(porPagamento).sort((a, b) => b[1].total - a[1].total).map(([forma, info]) => (
                      <div key={forma} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-texto">{labelForma[forma] || forma}</p>
                          <p className="text-xs text-texto-sec">{info.count} atendimento{info.count !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-sm font-semibold text-primaria">{fmt(info.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Avaliações NPS por profissional — destaque */}
              {agendamentos.some((ag) => ag.feedbackNota) && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Star size={12} fill="currentColor" /> Avaliações pós-atendimento (NPS)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(porProfissional).filter(([, info]) => info.notas.length > 0).map(([nome, info]) => {
                      const media = (info.notas.reduce((s, n) => s + n, 0) / info.notas.length).toFixed(1)
                      const dist = [1, 2, 3, 4, 5].map((n) => ({ n, c: info.notas.filter((x) => x === n).length }))
                      return (
                        <div key={nome} className="bg-white rounded-xl border border-amber-100 p-3">
                          <p className="text-xs font-semibold text-texto">{nome}</p>
                          <p className="text-2xl font-bold text-amber-600 mt-1">{media}<span className="text-xs text-texto-sec font-normal">/5</span></p>
                          <p className="text-[10px] text-texto-sec">{info.notas.length} avaliação{info.notas.length !== 1 ? 'ões' : ''}</p>
                          <div className="mt-2 space-y-0.5">
                            {dist.reverse().map(({ n, c }) => (
                              <div key={n} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-texto-sec w-3 text-right">{n}★</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${info.notas.length > 0 ? (c / info.notas.length) * 100 : 0}%` }} />
                                </div>
                                <span className="text-[10px] text-texto-sec w-3">{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

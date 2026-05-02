import { useState, useEffect, useMemo } from 'react'
import { Loader2, LockOpen, Lock, DollarSign, TrendingUp, Users, Clock, RefreshCw, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, X, Wallet, Scissors, BarChart3 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const formatarReais = (centavos) => {
  if (centavos == null) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatarDataHora = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const formatarDuracao = (abertura) => {
  if (!abertura) return ''
  const diff = Math.floor((Date.now() - new Date(abertura)) / 60000)
  if (diff < 60) return `${diff} min`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const LABELS_FORMA = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito', NAO_INFORMADO: 'Não informado' }

const calcularVariacaoClasse = (valor) => {
  if (valor == null) return 'text-texto-sec'
  if (valor > 0) return 'text-green-600'
  if (valor < 0) return 'text-red-500'
  return 'text-texto-sec'
}

const formatarVariacao = (valor) => {
  if (valor == null) return 'Sem base anterior'
  if (valor === 0) return '0% vs mês anterior'
  return `${valor > 0 ? '+' : ''}${valor}% vs mês anterior`
}

const obterLeituraOperacional = ({ sessaoAberta, resumo, resumoMensal }) => {
  if (!sessaoAberta || !resumo) {
    return {
      titulo: 'Comece o turno com controle',
      descricao: 'Abra o caixa no início do expediente para registrar entradas, saídas e fechamento com rastreabilidade.',
      alertas: [
        'Defina saldo inicial para facilitar conferência no fechamento.',
        'Use reforço/sangria com descrição para manter histórico limpo.',
      ],
    }
  }

  const atendimentos = Number(resumo.totalAtendimentos || 0)
  const mediaSessao = atendimentos > 0 ? Math.round((Number(resumo.totalComDescontos || 0) / atendimentos)) : 0
  const ticketMensal = Number(resumoMensal?.ticketMedio || 0)
  const variacaoTicket = ticketMensal > 0 && mediaSessao > 0
    ? Math.round(((mediaSessao - ticketMensal) / ticketMensal) * 100)
    : null

  const alertas = []
  if (atendimentos === 0) alertas.push('Sem atendimentos registrados na sessão até agora.')
  if (variacaoTicket != null && variacaoTicket < -15) {
    alertas.push('Ticket da sessão está abaixo do mês. Vale revisar descontos e serviços adicionais.')
  }
  if (alertas.length === 0) {
    alertas.push('Operação dentro do esperado para o turno atual.')
  }

  return {
    titulo: 'Leitura operacional do caixa',
    descricao: mediaSessao > 0
      ? `Ticket médio do turno: ${formatarReais(mediaSessao)}. Compare com o mês para ajustar estratégia durante o dia.`
      : 'Ainda sem ticket médio no turno. Assim que concluir atendimentos, acompanhe este indicador para decidir ações.',
    alertas,
  }
}

const CardFinanceiro = ({ titulo, valor, subtitulo, variacao, icone: Icone }) => (
  <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">{titulo}</p>
        <p className="text-2xl font-bold text-texto mt-1">{valor}</p>
        {subtitulo && <p className="text-xs text-texto-sec mt-1">{subtitulo}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-primaria/10 flex items-center justify-center shrink-0">
        <Icone size={18} className="text-primaria" />
      </div>
    </div>
    <p className={`text-xs font-semibold mt-3 ${calcularVariacaoClasse(variacao)}`}>{formatarVariacao(variacao)}</p>
  </div>
)

const TooltipFinanceiro = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-borda rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-texto mb-1">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {formatarReais(item.value)}
        </p>
      ))}
    </div>
  )
}

const Caixa = () => {
  const toast = useToast()
  const [resumo, setResumo] = useState(null)
  const [historico, setHistorico] = useState([])
  const [visaoGeral, setVisaoGeral] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [resumosSessao, setResumosSessao] = useState({})
  const [carregandoResumo, setCarregandoResumo] = useState({})
  const [abrindo, setAbrindo] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [saldoFinal, setSaldoFinal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [modoAbrirForm, setModoAbrirForm] = useState(false)
  const [modoFecharForm, setModoFecharForm] = useState(false)
  const [modalMovimentacao, setModalMovimentacao] = useState(null)
  const [valorMovimentacao, setValorMovimentacao] = useState('')
  const [descMovimentacao, setDescMovimentacao] = useState('')
  const [registrandoMov, setRegistrandoMov] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [resAtual, resHist, resVisao] = await Promise.allSettled([
        api.get('/api/caixa/atual'),
        api.get('/api/caixa?limite=10'),
        api.get('/api/caixa/visao-geral?meses=6'),
      ])
      setResumo(resAtual.status === 'fulfilled' ? resAtual.value?.dados : null)
      setHistorico(resHist.status === 'fulfilled' ? (resHist.value?.dados || []) : [])
      setVisaoGeral(resVisao.status === 'fulfilled' ? (resVisao.value?.dados || null) : null)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const carregarResumoSessao = async (sessaoId) => {
    if (resumosSessao[sessaoId] || carregandoResumo[sessaoId]) return
    setCarregandoResumo((p) => ({ ...p, [sessaoId]: true }))
    try {
      const res = await api.get(`/api/caixa/${sessaoId}/resumo`)
      setResumosSessao((p) => ({ ...p, [sessaoId]: res.dados }))
    } finally {
      setCarregandoResumo((p) => ({ ...p, [sessaoId]: false }))
    }
  }

  const handleAbrir = async () => {
    setAbrindo(true)
    try {
      await api.post('/api/caixa/abrir', {
        saldoInicial: saldoInicial ? Math.round(parseFloat(saldoInicial.replace(',', '.')) * 100) : 0,
        observacoes: observacoes || undefined,
      })
      toast('Caixa aberto!', 'sucesso')
      setSaldoInicial('')
      setObservacoes('')
      setModoAbrirForm(false)
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao abrir caixa', 'erro')
    } finally {
      setAbrindo(false)
    }
  }

  const handleFechar = async () => {
    setFechando(true)
    try {
      await api.post('/api/caixa/fechar', {
        saldoFinal: saldoFinal ? Math.round(parseFloat(saldoFinal.replace(',', '.')) * 100) : undefined,
        observacoes: observacoes || undefined,
      })
      toast('Caixa fechado!', 'sucesso')
      setSaldoFinal('')
      setObservacoes('')
      setModoFecharForm(false)
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao fechar caixa', 'erro')
    } finally {
      setFechando(false)
    }
  }

  const registrarMovimentacao = async () => {
    if (!valorMovimentacao) return
    setRegistrandoMov(true)
    try {
      await api.post('/api/caixa/movimentacao', {
        tipo: modalMovimentacao,
        valor: valorMovimentacao,
        descricao: descMovimentacao || undefined,
      })
      toast(`${modalMovimentacao === 'SANGRIA' ? 'Retirada' : 'Entrada manual'} registrada!`, 'sucesso')
      setModalMovimentacao(null)
      setValorMovimentacao('')
      setDescMovimentacao('')
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao registrar movimentação', 'erro')
    } finally {
      setRegistrandoMov(false)
    }
  }

  const sessaoAberta = resumo?.sessao?.status === 'ABERTO'
  const resumoMensal = visaoGeral?.atual || null
  const serieMensal = useMemo(() => (
    Array.isArray(visaoGeral?.serieMensal)
      ? visaoGeral.serieMensal.map((item) => ({
          ...item,
          resultadoOperacional: item.receitaLiquida + item.reforcos - item.sangrias,
        }))
      : []
  ), [visaoGeral])
  const formasMesAtual = useMemo(() => (
    resumoMensal?.porFormaPagamento
      ? Object.entries(resumoMensal.porFormaPagamento).sort((a, b) => b[1] - a[1])
      : []
  ), [resumoMensal])
  const profissionaisMesAtual = useMemo(() => resumoMensal?.topProfissionais || [], [resumoMensal])
  const leituraOperacional = useMemo(
    () => obterLeituraOperacional({ sessaoAberta, resumo, resumoMensal }),
    [sessaoAberta, resumo, resumoMensal]
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Financeiro e Caixa</h1>
          <p className="text-texto-sec text-sm mt-1">Visão mensal do faturamento da barbearia com caixa operacional do dia.</p>
        </div>
        <button onClick={carregar} className="p-2 rounded-lg border border-borda text-texto-sec hover:text-texto transition-colors" title="Atualizar">
          <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-texto-sec" /></div>
      ) : (
        <>
          {/* Status atual */}
          <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-texto">{leituraOperacional.titulo}</h3>
            <p className="text-xs text-texto-sec mt-1">{leituraOperacional.descricao}</p>
            <div className="mt-3 space-y-1.5">
              {leituraOperacional.alertas.map((item) => (
                <p key={item} className="text-xs text-texto flex items-start gap-2">
                  <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-primaria shrink-0" />
                  {item}
                </p>
              ))}
            </div>
          </div>

          {/* Status atual */}
          <div className={`rounded-2xl border-2 p-5 ${sessaoAberta ? 'border-sucesso bg-green-50' : 'border-borda bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sessaoAberta ? 'bg-sucesso text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {sessaoAberta ? <LockOpen size={20} /> : <Lock size={20} />}
                </div>
                <div>
                  <p className="font-semibold text-texto">
                    Caixa {sessaoAberta ? 'Aberto' : 'Fechado'}
                  </p>
                  {sessaoAberta && (
                    <p className="text-xs text-texto-sec">
                      Aberto às {formatarDataHora(resumo.sessao.aberturaEm)} · {formatarDuracao(resumo.sessao.aberturaEm)}
                    </p>
                  )}
                </div>
              </div>

              {!sessaoAberta && !modoAbrirForm && (
                <button
                  onClick={() => setModoAbrirForm(true)}
                  className="px-4 py-2 bg-sucesso text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <LockOpen size={16} /> Abrir caixa
                </button>
              )}
              {sessaoAberta && !modoFecharForm && (
                <button
                  onClick={() => setModoFecharForm(true)}
                  className="px-4 py-2 bg-perigo/10 text-perigo text-sm font-semibold rounded-xl hover:bg-perigo/20 transition-colors flex items-center gap-2"
                >
                  <Lock size={16} /> Fechar caixa
                </button>
              )}
            </div>

            {/* Formulário abrir */}
            {modoAbrirForm && (
              <div className="mt-4 pt-4 border-t border-borda space-y-3">
                <div>
                  <label className="text-xs font-medium text-texto-sec">Saldo inicial em caixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="0,00"
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-texto-sec">Observações (opcional)</label>
                  <input
                    type="text"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: troco do dia anterior"
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setModoAbrirForm(false); setObservacoes('') }} className="flex-1 py-2 border border-borda rounded-xl text-sm text-texto-sec hover:bg-fundo transition-colors">Cancelar</button>
                  <button
                    onClick={handleAbrir}
                    disabled={abrindo}
                    className="flex-1 py-2 bg-sucesso text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {abrindo ? <Loader2 size={16} className="animate-spin" /> : <LockOpen size={16} />}
                    Confirmar abertura
                  </button>
                </div>
              </div>
            )}

            {/* Formulário fechar */}
            {modoFecharForm && (
              <div className="mt-4 pt-4 border-t border-borda space-y-3">
                <div>
                  <label className="text-xs font-medium text-texto-sec">Saldo final contado em caixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saldoFinal}
                    onChange={(e) => setSaldoFinal(e.target.value)}
                    placeholder="0,00"
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-texto-sec">Observações (opcional)</label>
                  <input
                    type="text"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: quebra de caixa de R$5"
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setModoFecharForm(false); setObservacoes('') }} className="flex-1 py-2 border border-borda rounded-xl text-sm text-texto-sec hover:bg-fundo transition-colors">Cancelar</button>
                  <button
                    onClick={handleFechar}
                    disabled={fechando}
                    className="flex-1 py-2 bg-perigo text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {fechando ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    Confirmar fechamento
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botões de ajuste manual no caixa */}
          {sessaoAberta && (
            <div className="flex gap-2">
              <button
                onClick={() => setModalMovimentacao('SANGRIA')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <ArrowDownCircle size={16} /> Retirar dinheiro do caixa
              </button>
              <button
                onClick={() => setModalMovimentacao('REFORCO')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <ArrowUpCircle size={16} /> Adicionar dinheiro ao caixa
              </button>
            </div>
          )}

          {/* Resumo da sessão atual */}
          {sessaoAberta && resumo && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
                <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Saldo inicial</p>
                <p className="text-xl font-bold text-texto mt-1">{formatarReais(resumo.sessao.saldoInicial)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
                <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Atendimentos</p>
                <p className="text-xl font-bold text-texto mt-1">{resumo.totalAtendimentos}</p>
                <p className="text-xs text-texto-sec">desde abertura</p>
              </div>
              <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
                <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Receita bruta</p>
                <p className="text-xl font-bold text-sucesso mt-1">{formatarReais(resumo.totalServicos)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
                <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Com desc./gorj.</p>
                <p className="text-xl font-bold text-primaria mt-1">{formatarReais(resumo.totalComDescontos)}</p>
              </div>
            </div>
          )}

          {resumoMensal && (
            <>
              <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-primaria" />
                  <h2 className="text-sm font-semibold text-texto">Visão gerencial do mês</h2>
                </div>
                <p className="text-sm text-texto-sec">
                  Aqui a leitura é de dono de barbearia: faturamento do mês, comparação com o mês anterior, formas de pagamento e resultado operacional.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <CardFinanceiro
                  titulo="Faturamento líquido"
                  valor={formatarReais(resumoMensal.receitaLiquida)}
                  subtitulo={`${resumoMensal.atendimentos || 0} atendimento${(resumoMensal.atendimentos || 0) !== 1 ? 's' : ''} concluído${(resumoMensal.atendimentos || 0) !== 1 ? 's' : ''}`}
                  variacao={resumoMensal.variacaoReceitaLiquida}
                  icone={DollarSign}
                />
                <CardFinanceiro
                  titulo="Ticket médio"
                  valor={formatarReais(resumoMensal.ticketMedio)}
                  subtitulo="quanto cada atendimento gerou em média"
                  variacao={resumoMensal.variacaoTicketMedio}
                  icone={TrendingUp}
                />
                <CardFinanceiro
                  titulo="Atendimentos"
                  valor={String(resumoMensal.atendimentos || 0)}
                  subtitulo="volume concluído no mês"
                  variacao={resumoMensal.variacaoAtendimentos}
                  icone={Scissors}
                />
                <CardFinanceiro
                  titulo="Resultado operacional"
                  valor={formatarReais(resumoMensal.resultadoCaixa)}
                  subtitulo="faturamento líquido + entradas manuais - retiradas"
                  variacao={null}
                  icone={Wallet}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-borda shadow-sm p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-sm font-semibold text-texto">Comparativo mês a mês</p>
                      <p className="text-xs text-texto-sec">Faturamento líquido vs resultado operacional</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={serieMensal} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${Math.round(v / 100)}`} />
                      <Tooltip content={<TooltipFinanceiro />} />
                      <Bar dataKey="receitaLiquida" name="Faturamento líquido" fill="#c18d4b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="resultadoOperacional" name="Resultado operacional" fill="#1f7a5a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
                  <p className="text-sm font-semibold text-texto">Leitura financeira do mês</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-texto-sec">Receita bruta</span>
                      <strong className="text-texto">{formatarReais(resumoMensal.receitaBruta)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-texto-sec">Descontos</span>
                      <strong className="text-red-600">-{formatarReais(resumoMensal.descontos)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-texto-sec">Gorjetas</span>
                      <strong className="text-green-600">+{formatarReais(resumoMensal.gorjetas)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-texto-sec">Entradas manuais</span>
                      <strong className="text-green-600">+{formatarReais(resumoMensal.reforcos)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-texto-sec">Retiradas</span>
                      <strong className="text-red-600">-{formatarReais(resumoMensal.sangrias)}</strong>
                    </div>
                    <div className="pt-3 border-t border-borda flex items-center justify-between">
                      <span className="text-sm font-semibold text-texto">Resultado do mês</span>
                      <strong className="text-base text-primaria">{formatarReais(resumoMensal.resultadoCaixa)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-borda">
                    <p className="text-sm font-semibold text-texto">Formas de pagamento do mês</p>
                  </div>
                  <div className="divide-y divide-borda">
                    {formasMesAtual.length > 0 ? formasMesAtual.map(([forma, valor]) => (
                      <div key={forma} className="px-5 py-3 flex items-center justify-between">
                        <span className="text-sm text-texto">{LABELS_FORMA[forma] || forma}</span>
                        <strong className="text-sm text-primaria">{formatarReais(valor)}</strong>
                      </div>
                    )) : (
                      <div className="px-5 py-8 text-sm text-texto-sec">Ainda não há pagamentos concluídos no mês.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-borda">
                    <p className="text-sm font-semibold text-texto">Quem mais faturou no mês</p>
                  </div>
                  <div className="divide-y divide-borda">
                    {profissionaisMesAtual.length > 0 ? profissionaisMesAtual.map((item, index) => (
                      <div key={`${item.nome}-${index}`} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-texto">{item.nome}</p>
                          <p className="text-xs text-texto-sec">{item.atendimentos} atendimento{item.atendimentos !== 1 ? 's' : ''}</p>
                        </div>
                        <strong className="text-sm text-primaria">{formatarReais(item.receitaLiquida)}</strong>
                      </div>
                    )) : (
                      <div className="px-5 py-8 text-sm text-texto-sec">Sem faturamento suficiente para montar ranking neste mês.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Por forma de pagamento */}
          {sessaoAberta && resumo?.porFormaPagamento && Object.keys(resumo.porFormaPagamento).length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-borda bg-fundo">
                <p className="text-sm font-semibold text-texto">Por forma de pagamento (sessão atual)</p>
              </div>
              <div className="divide-y divide-borda">
                {Object.entries(resumo.porFormaPagamento).sort((a, b) => b[1] - a[1]).map(([forma, total]) => (
                  <div key={forma} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-texto">{LABELS_FORMA[forma] || forma}</p>
                    <span className="text-sm font-semibold text-primaria">{formatarReais(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico */}
          {historico.length > 0 && (
            <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
              <button
                onClick={() => setMostrarHistorico((v) => !v)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-fundo transition-colors"
              >
                <p className="text-sm font-semibold text-texto flex items-center gap-2">
                  <Clock size={15} /> Histórico de sessões
                </p>
                {mostrarHistorico ? <ChevronUp size={16} className="text-texto-sec" /> : <ChevronDown size={16} className="text-texto-sec" />}
              </button>
              {mostrarHistorico && (
                <div className="divide-y divide-borda border-t border-borda">
                  {historico.map((s) => {
                    const resumo = resumosSessao[s.id]
                    return (
                      <div key={s.id} className="px-5 py-3">
                        <button
                          className="w-full flex items-center justify-between gap-3 text-left"
                          onClick={() => carregarResumoSessao(s.id)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${s.status === 'ABERTO' ? 'bg-sucesso' : 'bg-gray-300'}`} />
                              <p className="text-sm font-medium text-texto">{formatarDataHora(s.aberturaEm)}</p>
                            </div>
                            {s.fechamentoEm && (
                              <p className="text-xs text-texto-sec mt-0.5">Fechado: {formatarDataHora(s.fechamentoEm)}</p>
                            )}
                            {s.observacoes && <p className="text-xs text-texto-sec italic mt-0.5">{s.observacoes}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-texto-sec">Inicial: {formatarReais(s.saldoInicial)}</p>
                            {s.saldoFinal != null && (
                              <p className="text-xs font-medium text-sucesso">Final: {formatarReais(s.saldoFinal)}</p>
                            )}
                            {carregandoResumo[s.id] && <Loader2 size={12} className="animate-spin text-texto-sec mt-1 ml-auto" />}
                          </div>
                        </button>
                        {resumo && (
                          <div className="mt-2 pt-2 border-t border-borda/60 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-texto-sec">Atendimentos</span>
                              <span className="font-medium text-texto">{resumo.totalAtendimentos}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-texto-sec">Total (c/ desc/gorjeta)</span>
                              <span className="font-medium text-sucesso">{formatarReais(resumo.totalComDescontos)}</span>
                            </div>
                            {Object.entries(resumo.porFormaPagamento || {}).map(([forma, valor]) => (
                              <div key={forma} className="flex justify-between text-xs pl-2">
                                <span className="text-texto-sec">{LABELS_FORMA[forma] || forma}</span>
                                <span className="text-texto">{formatarReais(valor)}</span>
                              </div>
                            ))}
                            {(resumo.totalSangrias > 0 || resumo.totalReforcos > 0) && (
                              <>
                                {resumo.totalReforcos > 0 && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-green-600">Entradas manuais</span>
                                    <span className="font-medium text-green-600">+{formatarReais(resumo.totalReforcos)}</span>
                                  </div>
                                )}
                                {resumo.totalSangrias > 0 && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-red-600">Retiradas</span>
                                    <span className="font-medium text-red-600">-{formatarReais(resumo.totalSangrias)}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de ajuste manual */}
      {modalMovimentacao && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-texto flex items-center gap-2">
                {modalMovimentacao === 'SANGRIA'
                  ? <><ArrowDownCircle size={18} className="text-red-600" /> Retirar dinheiro do caixa</>
                  : <><ArrowUpCircle size={18} className="text-green-600" /> Adicionar dinheiro ao caixa</>}
              </h3>
              <button onClick={() => setModalMovimentacao(null)}><X size={20} className="text-texto-sec" /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-texto-sec">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorMovimentacao}
                onChange={(e) => setValorMovimentacao(e.target.value)}
                placeholder="0,00"
                className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-texto-sec">Descrição (opcional)</label>
              <input
                type="text"
                value={descMovimentacao}
                onChange={(e) => setDescMovimentacao(e.target.value)}
                placeholder={modalMovimentacao === 'SANGRIA' ? 'Ex: retirada do dia ou depósito no banco' : 'Ex: troco inicial ou ajuste de caixa'}
                className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalMovimentacao(null)} className="flex-1 py-2.5 border border-borda rounded-xl text-sm text-texto-sec hover:bg-fundo">Cancelar</button>
              <button
                onClick={registrarMovimentacao}
                disabled={!valorMovimentacao || registrandoMov}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${modalMovimentacao === 'SANGRIA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {registrandoMov ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Caixa

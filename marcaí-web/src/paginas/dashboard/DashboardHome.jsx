import { useEffect, useState } from 'react'
import {
  Calendar, TrendingUp, CheckCircle2, Clock, ArrowRight, DollarSign, Star,
  Users, Target, BadgeDollarSign, MessageSquare, Gift,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import api from '../../servicos/api'
import { formatarHora, statusAgendamento, formatarPercentual } from '../../lib/utils'
import useAuth from '../../hooks/useAuth'
import { useToast } from '../../contextos/ToastContexto'

const formatarReais = (centavos) => {
  if (centavos == null) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CardMetrica = ({ titulo, valor, subtitulo, icone: Icone, cor }) => (
  <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="text-texto-sec text-sm font-medium">{titulo}</p>
        <p className="text-2xl font-bold text-texto mt-1">{valor ?? '—'}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${cor}`}>
        <Icone size={20} className="text-white" />
      </div>
    </div>
    {subtitulo && <p className="text-xs text-texto-sec">{subtitulo}</p>}
  </div>
)

const CardMetricaCompacto = ({ titulo, valor, subtitulo, icone: Icone, cor }) => (
  <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="text-texto-sec text-sm font-medium">{titulo}</p>
        <p className="text-2xl font-bold text-texto mt-1">{valor ?? '—'}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${cor}`}>
        <Icone size={20} className="text-white" />
      </div>
    </div>
    {subtitulo && <p className="text-xs text-texto-sec">{subtitulo}</p>}
  </div>
)

const formatarDataCurta = (data) => {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const tempoDesde = (data) => {
  if (!data) return 'agora'
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000))
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${horas}h${resto > 0 ? `${resto}m` : ''}`
}

const nomeCliente = (cliente) => {
  if (!cliente) return 'Cliente'
  if (cliente.nome && cliente.nome !== cliente.telefone) return cliente.nome
  return cliente.telefone || 'Cliente'
}

const CardAtalho = ({ titulo, subtitulo, rota, icone: Icone, cor }) => (
  <Link
    to={rota}
    className="group bg-white rounded-2xl border border-borda p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all h-full flex flex-col"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-texto">{titulo}</p>
        <p className="text-xs text-texto-sec mt-1">{subtitulo}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${cor} shrink-0`}>
        <Icone size={18} className="text-white" />
      </div>
    </div>
    <div className="mt-auto pt-4 flex items-center text-xs font-semibold text-primaria group-hover:text-primaria-escura">
      Abrir agora <ArrowRight size={13} className="ml-1" />
    </div>
  </Link>
)

const CardOperacional = ({ titulo, subtitulo, total, rota, cta, icone: Icone, cor, itens = [], vazio, renderItem }) => (
  <section className="bg-white rounded-3xl border border-borda p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        <div className={`p-3 rounded-2xl ${cor} shrink-0`}>
          <Icone size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-texto">{titulo}</h2>
          <p className="text-sm text-texto-sec">{subtitulo}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xl font-bold text-texto">{total}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-texto-ter">itens</p>
      </div>
    </div>

    {itens.length === 0 ? (
      <div className="rounded-2xl bg-fundo px-4 py-5 text-sm text-texto-sec">
        {vazio}
      </div>
    ) : (
      <div className="space-y-2.5">
        {itens.slice(0, 4).map(renderItem)}
      </div>
    )}

    <Link to={rota} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primaria hover:text-primaria-escura">
      {cta} <ArrowRight size={14} />
    </Link>
  </section>
)

const BadgeStatus = ({ status }) => {
  const config = statusAgendamento[status] || { label: status, cor: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.cor}`}>
      {config.label}
    </span>
  )
}

const TooltipGrafico = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-borda rounded-xl p-3 shadow-md">
        <p className="text-xs text-texto-sec mb-1">{label}</p>
        <p className="text-sm font-bold text-texto">{payload[0].value} agendamentos</p>
      </div>
    )
  }
  return null
}

const BlocoBi = ({ titulo, subtitulo, oculto, children }) => {
  if (oculto) return null
  return (
    <section className="bg-white rounded-3xl border border-borda p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-texto">{titulo}</h2>
          <p className="text-sm text-texto-sec">{subtitulo}</p>
        </div>
        <BadgeDollarSign size={16} className="text-primaria" />
      </div>
      {children}
    </section>
  )
}

const DashboardHome = () => {
  const { tenant } = useAuth()
  const toast = useToast()
  const [metricas, setMetricas] = useState(null)
  const [financeiro, setFinanceiro] = useState(null)
  const [operacional, setOperacional] = useState(null)
  const [grafico, setGrafico] = useState([])
  const [proximosAgendamentos, setProximosAgendamentos] = useState([])
  const [aniversariantes, setAniversariantes] = useState([])
  const [ocupacao, setOcupacao] = useState({ carregando: true, disponivel: true, dados: null })
  const [retencao, setRetencao] = useState({ carregando: true, disponivel: true, dados: null })
  const [noShow, setNoShow] = useState({ carregando: true, disponivel: true, dados: null })
  const [carregando, setCarregando] = useState(true)

  const carregarOpcional = async (url, setter) => {
    try {
      const res = await api.get(url)
      setter({ carregando: false, disponivel: true, dados: res.dados || null })
    } catch (e) {
      if (e?.status === 403) {
        setter({ carregando: false, disponivel: false, dados: null })
        return
      }
      setter({ carregando: false, disponivel: true, dados: null, erro: true })
    }
  }

  const carregarDados = async () => {
    try {
      const [resMetricas, resFinanceiro, resOperacional, resGrafico, resAgendamentos] = await Promise.all([
        api.get('/api/dashboard/metricas'),
        api.get('/api/dashboard/financeiro'),
        api.get('/api/dashboard/operacional'),
        api.get('/api/dashboard/grafico?periodo=7d'),
        api.get('/api/agendamentos?limite=5&ordem=proximosPrimeiro&status=AGENDADO,CONFIRMADO'),
      ])

      setMetricas(resMetricas.dados)
      setFinanceiro(resFinanceiro.dados)
      setOperacional(resOperacional.dados)
      setGrafico(resGrafico.dados)
      setProximosAgendamentos(resAgendamentos.agendamentos || resAgendamentos.dados || [])
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
    carregarOpcional('/api/dashboard/ocupacao', setOcupacao)
    carregarOpcional('/api/dashboard/retencao', setRetencao)
    carregarOpcional('/api/dashboard/no-show-profissional', setNoShow)
    api.get('/api/clientes/aniversariantes').then(res => setAniversariantes(res.dados || [])).catch(() => {})

    const intervalo = setInterval(() => {
      carregarDados()
      carregarOpcional('/api/dashboard/ocupacao', setOcupacao)
      carregarOpcional('/api/dashboard/retencao', setRetencao)
      carregarOpcional('/api/dashboard/no-show-profissional', setNoShow)
      api.get('/api/clientes/aniversariantes').then(res => setAniversariantes(res.dados || [])).catch(() => {})
    }, 60000)

    return () => clearInterval(intervalo)
  }, [])

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-borda p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-borda rounded w-2/3 mb-3" />
              <div className="h-8 bg-borda rounded w-1/2 mb-2" />
              <div className="h-3 bg-borda rounded w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-borda p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-borda rounded w-2/3 mb-3" />
              <div className="h-8 bg-borda rounded w-1/2 mb-2" />
              <div className="h-3 bg-borda rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const dadosGrafico = grafico.map((d) => ({
    ...d,
    data: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }))

  const ocupacaoDados = ocupacao?.dados || {}
  const taxaOcupacao = ocupacaoDados.taxaOcupacao ?? ocupacaoDados.percentual ?? ocupacaoDados.ocupacao ?? null
  const horariosDisponiveis = ocupacaoDados.horasDisponiveis ?? ocupacaoDados.disponiveis ?? null
  const horasOcupadas = ocupacaoDados.horasOcupadas ?? ocupacaoDados.ocupadas ?? null
  const blocos = Array.isArray(ocupacaoDados.blocos) ? ocupacaoDados.blocos : []

  const retencaoDados = retencao?.dados || {}
  const taxaRetencao = retencaoDados.taxaRetencao ?? retencaoDados.percentual ?? retencaoDados.retencao ?? null
  const clientesAtivos = retencaoDados.clientesAtivos ?? retencaoDados.ativos ?? null
  const clientesEmRisco = retencaoDados.clientesEmRisco ?? retencaoDados.risco ?? null

  const noShowDados = noShow?.dados || {}
  const rankingNoShow = Array.isArray(noShowDados.profissionais)
    ? noShowDados.profissionais
    : Array.isArray(noShowDados)
      ? noShowDados
      : []

  const bannerOcupacao = ocupacao?.disponivel !== false || ocupacao?.carregando
  const bannerRetencao = retencao?.disponivel !== false || retencao?.carregando
  const bannerNoShow = noShow?.disponivel !== false || noShow?.carregando

  const atalhosRapidos = [
    {
      titulo: 'Agenda do dia',
      subtitulo: 'Abrir horários, encaixes e walk-ins',
      rota: '/dashboard/agenda',
      icone: Calendar,
      cor: 'bg-primaria',
    },
    {
      titulo: 'Mensagens',
      subtitulo: 'Intervir em atendimentos e vendas',
      rota: '/dashboard/mensagens',
      icone: MessageSquare,
      cor: 'bg-[#7c5a3c]',
    },
    {
      titulo: 'Clientes',
      subtitulo: 'Consultar histórico, tags e notas',
      rota: '/operacao/clientes',
      icone: Users,
      cor: 'bg-teal-500',
    },
    tenant?.membershipsAtivo
      ? {
          titulo: 'Plano mensal',
          subtitulo: 'Cobranças, ativações e créditos',
          rota: '/operacao/planos',
          icone: BadgeDollarSign,
          cor: 'bg-emerald-500',
        }
      : null,
    tenant?.fidelidadeAtivo
      ? {
          titulo: 'Fidelidade',
          subtitulo: 'Resgates e retenção de clientes',
          rota: '/operacao/fidelidade',
          icone: Gift,
          cor: 'bg-orange-500',
        }
      : null,
  ].filter(Boolean)

  const cardsOperacionais = [
    {
      chave: 'aguardandoHumano',
      titulo: 'Clientes aguardando atendente',
      subtitulo: 'Conversa escalonada precisa da sua mão agora',
      total: operacional?.aguardandoHumano?.total ?? 0,
      rota: '/dashboard/mensagens',
      cta: 'Abrir mensagens',
      icone: MessageSquare,
      cor: 'bg-alerta',
      itens: operacional?.aguardandoHumano?.itens || [],
      vazio: 'Nenhum cliente aguardando atendente. A IA está dando conta por enquanto.',
      renderItem: (item) => (
        <div key={item.id} className="rounded-2xl border border-borda px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-texto truncate">{nomeCliente(item.cliente)}</p>
              <p className="text-xs text-texto-sec truncate">{item.cliente?.telefone || 'Telefone não informado'}</p>
            </div>
            <span className="text-xs font-medium text-alerta shrink-0">há {tempoDesde(item.atualizadoEm)}</span>
          </div>
        </div>
      ),
    },
    {
      chave: 'confirmacoesPendentes',
      titulo: 'Confirmações pendentes',
      subtitulo: 'Agendamentos próximos ainda sem confirmação',
      total: operacional?.confirmacoesPendentes?.total ?? 0,
      rota: '/dashboard/agenda',
      cta: 'Ver agenda',
      icone: Clock,
      cor: 'bg-[#8c6239]',
      itens: operacional?.confirmacoesPendentes?.itens || [],
      vazio: 'Sua agenda próxima está confirmada. Nenhum agendamento pendente nesta janela.',
      renderItem: (item) => (
        <div key={item.id} className="rounded-2xl border border-borda px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-texto truncate">{nomeCliente(item.cliente)}</p>
              <p className="text-xs text-texto-sec truncate">
                {item.servico?.nome || 'Serviço'}{item.profissional?.nome ? ` · ${item.profissional.nome}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-texto">{formatarDataCurta(item.inicioEm)}</p>
              <p className="text-xs text-texto-sec">{formatarHora(item.inicioEm)}</p>
            </div>
          </div>
        </div>
      ),
    },
    operacional?.fidelidade?.disponivel
      ? {
          chave: 'fidelidade',
          titulo: 'Resgates prontos',
          subtitulo: 'Clientes que já podem usar o benefício',
          total: operacional?.fidelidade?.total ?? 0,
          rota: '/operacao/fidelidade',
          cta: 'Abrir fidelidade',
          icone: Gift,
          cor: 'bg-orange-500',
          itens: operacional?.fidelidade?.itens || [],
          vazio: 'Ainda não há clientes aptos para resgate. Continue empurrando retorno e recorrência.',
          renderItem: (item) => (
            <div key={item.clienteId} className="rounded-2xl border border-borda px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-texto truncate">{nomeCliente(item.cliente)}</p>
                  <p className="text-xs text-texto-sec truncate">
                    Benefício: {operacional?.fidelidade?.config?.descricaoResgate || 'Resgate disponível'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-orange-600 shrink-0">{item.pontos} pts</span>
              </div>
            </div>
          ),
        }
      : null,
    operacional?.assinaturas?.disponivel
      ? {
          chave: 'assinaturas',
          titulo: 'Planos para cobrar',
          subtitulo: 'Assinaturas vencendo ou já atrasadas',
          total: operacional?.assinaturas?.total ?? 0,
          rota: '/operacao/planos',
          cta: 'Abrir plano mensal',
          icone: BadgeDollarSign,
          cor: 'bg-emerald-500',
          itens: operacional?.assinaturas?.itens || [],
          vazio: 'Nenhuma cobrança urgente no plano mensal. Carteira saudável nesta janela.',
          renderItem: (item) => (
            <div key={item.id} className="rounded-2xl border border-borda px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-texto truncate">{nomeCliente(item.cliente)}</p>
                  <p className="text-xs text-texto-sec truncate">{item.planoAssinatura?.nome || 'Plano mensal'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-texto">{formatarDataCurta(item.proximaCobrancaEm)}</p>
                  <p className="text-xs text-emerald-600">{item.situacaoPagamento?.descricao || 'Cobrança próxima'}</p>
                </div>
              </div>
            </div>
          ),
        }
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Card em destaque — Faturamento do dia (visível de longe) */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm font-medium mb-1">Faturamento Hoje</p>
            <p className="text-4xl md:text-5xl font-bold tracking-tight">
              {formatarReais(financeiro?.receitaHojeCentavos)}
            </p>
            <p className="text-emerald-100 text-sm mt-2">
              {financeiro?.atendimentosConcluidos ?? 0} atendimento{(financeiro?.atendimentosConcluidos ?? 0) !== 1 ? 's' : ''} · Ticket médio {formatarReais(financeiro?.ticketMedioCentavos)}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-emerald-100">Hoje</p>
              <p className="text-lg font-bold">{metricas?.agendamentosHoje ?? 0}</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-emerald-100">Próximo</p>
              <p className="text-lg font-bold">{metricas?.proximoAgendamento ? formatarHora(metricas.proximoAgendamento.inicioEm) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Linha 1 — Métricas primárias (operacional de hoje) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <CardMetrica
          titulo="Próximo Horário"
          valor={metricas?.proximoAgendamento ? formatarHora(metricas.proximoAgendamento.inicioEm) : 'Nenhum'}
          icone={Clock}
          cor="bg-alerta"
          subtitulo={metricas?.proximoAgendamento
            ? (() => {
                const ag = metricas.proximoAgendamento
                const tel = ag.cliente?.telefone
                const nomeCliente = ag.cliente?.nome && ag.cliente.nome !== tel ? ag.cliente.nome : null
                const partes = [nomeCliente || ag.servico?.nome, ag.profissional?.nome].filter(Boolean)
                return partes.join(' · ') || '—'
              })()
            : '—'}
        />
        <CardMetrica
          titulo="Agendamentos Hoje"
          valor={metricas?.agendamentosHoje}
          icone={Calendar}
          cor="bg-primaria"
          subtitulo="No dia de hoje"
        />
        <CardMetrica
          titulo="Taxa de Confirmação"
          valor={metricas?.taxaConfirmacao !== undefined ? `${metricas.taxaConfirmacao}%` : '—'}
          icone={CheckCircle2}
          cor="bg-sucesso"
          subtitulo="Agendamentos confirmados"
        />
      </div>

      {/* Linha 2 — Métricas secundárias (visão semanal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardMetricaCompacto
          titulo="Agendamentos na Semana"
          valor={metricas?.agendamentosSemana}
          icone={TrendingUp}
          cor="bg-[#7c5a3c]"
        />
        <CardMetricaCompacto
          titulo="Receita na Semana"
          valor={formatarReais(financeiro?.receitaSemanaCentavos)}
          icone={TrendingUp}
          cor="bg-teal-500"
        />
        <CardMetricaCompacto
          titulo="Receita Prevista"
          valor={formatarReais(financeiro?.receitaAgendadaCentavos)}
          icone={Calendar}
          cor="bg-[#8c6239]"
          subtitulo="Agendados/Confirmados"
        />
        <CardMetricaCompacto
          titulo="Ticket Médio"
          valor={formatarReais(financeiro?.ticketMedioCentavos)}
          icone={Star}
          cor="bg-orange-500"
          subtitulo={`No-show: ${financeiro?.taxaNaoCompareceu ?? 0}%`}
        />
      </div>

      {aniversariantes.length > 0 && (
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎂</span>
            <h3 className="font-semibold text-texto text-sm">Aniversariantes da semana</h3>
            <span className="ml-auto text-xs text-pink-600 font-medium bg-pink-100 px-2 py-0.5 rounded-full">{aniversariantes.length}</span>
          </div>
          <div className="space-y-2">
            {aniversariantes.map(c => {
              const hoje = new Date()
              const ehHoje = c.mes === (hoje.getMonth() + 1) && c.dia === hoje.getDate()
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2 border border-pink-100">
                  <div>
                    <p className="text-sm font-medium text-texto">{c.nome}</p>
                    <p className="text-xs text-texto-sec">
                      {ehHoje ? '🎉 Hoje!' : `${String(c.dia).padStart(2,'0')}/${String(c.mes).padStart(2,'0')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const tel = (c.telefone || '').replace(/\D/g, '')
                      if (tel) {
                        window.open(`https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(`Feliz aniversário, ${c.nome.split(' ')[0]}! 🎉 A equipe da barbearia deseja um dia incrível! Que tal comemorar com um visual novo? 💈`)}`, '_blank')
                      } else {
                        toast('Cliente sem telefone cadastrado.', 'aviso')
                      }
                    }}
                    className="text-xs px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    🎁 Parabéns
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <section className="bg-white rounded-3xl border border-borda p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-texto">Ações rápidas do barbeiro</h2>
            <p className="text-sm text-texto-sec">Entradas diretas para o que mais gira operação, venda e atendimento.</p>
          </div>
          <BadgeDollarSign size={16} className="text-primaria" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-stretch">
          {atalhosRapidos.map((atalho) => (
            <CardAtalho key={atalho.rota} {...atalho} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-texto">Central do Barbeiro</h2>
            <p className="text-sm text-texto-sec">
              Prioridades do dia para atendimento, confirmação e recorrência.
              {operacional?.resumo?.pendenciasCriticas
                ? ` ${operacional.resumo.pendenciasCriticas} ponto(s) pedindo atenção agora.`
                : ' Tudo sob controle neste momento.'}
            </p>
          </div>
          <Link to="/dashboard/mensagens" className="text-sm font-semibold text-primaria hover:text-primaria-escura flex items-center gap-1">
            Ver operação <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {cardsOperacionais.map((card) => (
            <CardOperacional key={card.chave} {...card} />
          ))}
        </div>
      </section>

      {financeiro?.topProfissionais?.length > 0 && (
        <div className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
          <h2 className="text-base font-semibold text-texto mb-4">Top Profissionais - Semana</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {financeiro.topProfissionais.map((p, i) => (
              <div key={p.profissionalId} className="flex items-center gap-3 p-3 rounded-xl bg-fundo">
                <div className="w-9 h-9 rounded-full bg-primaria/15 flex items-center justify-center shrink-0">
                  <span className="text-primaria text-sm font-bold">{i + 1}º</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto truncate">{p.nome}</p>
                  <p className="text-xs text-texto-sec">{p.atendimentos} atendimentos</p>
                </div>
                <p className="text-sm font-semibold text-sucesso shrink-0">{formatarReais(p.receitaCentavos)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-borda p-5 shadow-sm">
          <h2 className="text-base font-semibold text-texto mb-4">Agendamentos - Últimos 7 dias</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dadosGrafico} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="data" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipGrafico />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#B8894D"
                strokeWidth={2.5}
                dot={{ fill: '#B8894D', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-2 bg-white rounded-2xl border border-borda p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-texto">Próximos agendamentos</h2>
            <Link to="/dashboard/agenda" className="text-xs text-primaria hover:text-primaria-escura flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          {proximosAgendamentos.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="text-borda mx-auto mb-2" />
              <p className="text-texto-sec text-sm">Nenhum agendamento próximo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proximosAgendamentos.map((ag) => (
                <div key={ag.id} className="flex items-center gap-3 p-3 rounded-xl bg-fundo hover:bg-primaria-clara/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primaria/15 flex items-center justify-center shrink-0">
                    <span className="text-primaria text-xs font-bold">
                      {ag.cliente?.nome?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-texto truncate">{ag.cliente?.nome}</p>
                    <p className="text-xs text-texto-sec truncate">{ag.servico?.nome} • {ag.profissional?.nome}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-texto">{formatarHora(ag.inicioEm)}</p>
                    <BadgeStatus status={ag.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <BlocoBi
          titulo="Ocupação da agenda"
          subtitulo="Leitura da capacidade em tempo real"
          oculto={!bannerOcupacao}
        >
          {ocupacao?.carregando ? (
            <div className="h-28 animate-pulse rounded-2xl bg-fundo" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-texto-sec mb-1">Ocupação atual</p>
                  <p className="text-4xl font-bold text-texto">{formatarPercentual(taxaOcupacao)}</p>
                </div>
                <div className="rounded-2xl bg-primaria-clara p-3 text-primaria">
                  <Target size={22} />
                </div>
              </div>
              <div className="h-2 rounded-full bg-fundo overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#111111] via-[#b8894d] to-[#d7b37c]" style={{ width: `${Math.min(Number(taxaOcupacao) || 0, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-fundo p-3">
                  <p className="text-texto-sec text-xs uppercase tracking-[0.22em]">Horas ocupadas</p>
                  <p className="font-semibold text-texto mt-1">{horasOcupadas ?? '—'}</p>
                </div>
                <div className="rounded-2xl bg-fundo p-3">
                  <p className="text-texto-sec text-xs uppercase tracking-[0.22em]">Horas livres</p>
                  <p className="font-semibold text-texto mt-1">{horariosDisponiveis ?? '—'}</p>
                </div>
              </div>
              {blocos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {blocos.slice(0, 4).map((bloco, index) => (
                    <span key={index} className="px-2.5 py-1 rounded-full bg-primaria-clara text-primaria text-xs font-medium">
                      {bloco.label || bloco.nome || bloco.hora || `Bloco ${index + 1}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </BlocoBi>

        <BlocoBi
          titulo="Retenção e retorno"
          subtitulo="Acompanha quem volta e quem está perdendo ritmo"
          oculto={!bannerRetencao}
        >
          {retencao?.carregando ? (
            <div className="h-28 animate-pulse rounded-2xl bg-fundo" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-texto-sec mb-1">Taxa de retenção</p>
                  <p className="text-4xl font-bold text-texto">{formatarPercentual(taxaRetencao)}</p>
                </div>
                <div className="rounded-2xl bg-primaria-clara p-3 text-primaria">
                  <Users size={22} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-fundo p-3">
                  <p className="text-texto-sec text-xs uppercase tracking-[0.22em]">Clientes ativos</p>
                  <p className="font-semibold text-texto mt-1">{clientesAtivos ?? '—'}</p>
                </div>
                <div className="rounded-2xl bg-fundo p-3">
                  <p className="text-texto-sec text-xs uppercase tracking-[0.22em]">Em risco</p>
                  <p className="font-semibold text-texto mt-1">{clientesEmRisco ?? '—'}</p>
                </div>
              </div>
            </div>
          )}
        </BlocoBi>

        <BlocoBi
          titulo="No-show por profissional"
          subtitulo="Mostra quem precisa de atenção comercial e operacional"
          oculto={!bannerNoShow}
        >
          {noShow?.carregando ? (
            <div className="h-28 animate-pulse rounded-2xl bg-fundo" />
          ) : rankingNoShow.length === 0 ? (
            <div className="rounded-2xl bg-fundo p-4 text-sm text-texto-sec">
              Nenhum dado disponível para esse módulo.
            </div>
          ) : (
            <div className="space-y-3">
              {rankingNoShow.slice(0, 5).map((item, index) => {
                const taxa = item.taxaNoShow ?? item.percentual ?? item.taxa ?? 0
                return (
                  <div key={item.profissionalId || item.id || index} className="rounded-2xl border border-borda p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-texto">{item.nome || item.profissional || 'Profissional'}</p>
                        <p className="text-xs text-texto-sec">{item.noShows ?? item.faltas ?? 0} faltas</p>
                      </div>
                      <p className="font-bold text-primaria">{formatarPercentual(taxa)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-fundo overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#b8894d] to-[#111111]" style={{ width: `${Math.min(Number(taxa) || 0, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </BlocoBi>
      </div>
    </div>
  )
}

export default DashboardHome

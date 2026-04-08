import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CircleAlert,
  Expand,
  Loader2,
  Minimize2,
  MonitorPlay,
  RefreshCw,
  Scissors,
  TimerReset,
  Tv2,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const MARCAI_LOGO = '/logo.svg'
const REFRESH_INTERVAL = 30000

const STATUS_META = {
  AGENDADO: {
    label: 'Agendado',
    chip: 'bg-white/8 text-white/80 border border-white/10',
  },
  CONFIRMADO: {
    label: 'Confirmado',
    chip: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
  },
  CONCLUIDO: {
    label: 'Concluído',
    chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
  },
  CANCELADO: {
    label: 'Cancelado',
    chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
  },
  NAO_COMPARECEU: {
    label: 'Não veio',
    chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
  },
  REMARCADO: {
    label: 'Remarcado',
    chip: 'bg-white/8 text-white/65 border border-white/10',
  },
}

const apiFetch = async (path) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json()
  if (!data.sucesso) throw new Error(data.erro?.mensagem || 'Erro ao carregar painel')
  return data.dados
}

const formatarAtualizacao = (data, timeZone) =>
  new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })

const resolverLogo = (tenant) => {
  if (!tenant?.logoUrl) return MARCAI_LOGO
  if (tenant.logoUrl.startsWith('http://') || tenant.logoUrl.startsWith('https://')) return tenant.logoUrl
  return `${API_URL}${tenant.logoUrl}`
}

const estaEmAtendimento = (agendamento, agora) => {
  if (['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU', 'CONCLUIDO'].includes(agendamento.status)) return false
  return new Date(agendamento.inicioEm) <= agora && new Date(agendamento.fimEm) >= agora
}

const ordenarAgendaPorProximidade = (agenda, agora) => (
  [...agenda].sort((a, b) => {
    const prioridadeA = estaEmAtendimento(a, agora) ? 0 : new Date(a.inicioEm) >= agora ? 1 : 2
    const prioridadeB = estaEmAtendimento(b, agora) ? 0 : new Date(b.inicioEm) >= agora ? 1 : 2

    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB

    if (prioridadeA === 0) return new Date(a.fimEm) - new Date(b.fimEm)
    if (prioridadeA === 1) return new Date(a.inicioEm) - new Date(b.inicioEm)
    return new Date(b.fimEm) - new Date(a.fimEm)
  })
)

const CardSecao = ({ titulo, subtitulo, acao, children }) => (
  <section className="rounded-[24px] border border-[#3a2b18] bg-[rgba(14,12,9,0.82)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:rounded-[28px] sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <h2 className="text-lg font-semibold text-[#f8ecd6]">{titulo}</h2>
        {subtitulo && <p className="mt-1 text-sm text-[#bca88a]">{subtitulo}</p>}
      </div>
      {acao}
    </div>
    {children}
  </section>
)

const LinhaAgenda = ({ agendamento, agora }) => {
  const status = STATUS_META[agendamento.status] || STATUS_META.AGENDADO
  const emCurso = estaEmAtendimento(agendamento, agora)

  return (
    <div
      className={`grid gap-3 rounded-[18px] border px-4 py-4 transition-colors sm:rounded-[22px] md:grid-cols-[96px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_140px] ${
        emCurso
          ? 'border-[#e2b26c] bg-[linear-gradient(135deg,rgba(194,145,80,0.18),rgba(23,19,16,0.92))]'
          : 'border-white/8 bg-white/[0.03]'
      }`}
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Horário</p>
        <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">{agendamento.hora}</p>
        <p className="mt-1 text-sm text-[#9f9078]">até {agendamento.fimHora}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Cliente</p>
        <p className="mt-2 truncate text-lg font-medium text-white sm:text-xl">{agendamento.clienteNome}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${status.chip}`}>
            {status.label}
          </span>
          {agendamento.presencaConfirmada && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              Chegou
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Servico</p>
        <p className="mt-2 truncate text-base text-[#f5ecdd] sm:text-lg">{agendamento.servicoNome}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Profissional</p>
        <p className="mt-2 truncate text-base text-[#f5ecdd] sm:text-lg">{agendamento.profissionalNome}</p>
      </div>

      <div className="sm:text-right">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Painel</p>
        <p className="mt-2 text-sm text-[#f5ecdd]">{emCurso ? 'Em andamento' : 'Na agenda'}</p>
        {emCurso && (
          <p className="mt-2 text-sm font-medium text-[#ffd28d]">Em atendimento agora</p>
        )}
      </div>
    </div>
  )
}

const PainelTvPublico = () => {
  const { slug, hash } = useParams()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')
  const [agora, setAgora] = useState(new Date())
  const [fullscreenAtivo, setFullscreenAtivo] = useState(typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  const [profissionalFiltro, setProfissionalFiltro] = useState('todos')
  const requisicaoEmAndamentoRef = useRef(false)
  const pollingRef = useRef(null)
  const agendaHoje = dados?.agendaHoje || []
  const profissionaisDisponiveis = [...new Map(
    agendaHoje
      .filter((agendamento) => agendamento.profissionalNome)
      .map((agendamento) => [agendamento.profissionalNome, {
        id: agendamento.profissionalId || agendamento.profissionalNome,
        nome: agendamento.profissionalNome,
      }])
  ).values()]
  const agendaFiltrada = profissionalFiltro === 'todos'
    ? agendaHoje
    : agendaHoje.filter((agendamento) => (agendamento.profissionalId || agendamento.profissionalNome) === profissionalFiltro)

  const carregarPainel = async ({ silencioso = false } = {}) => {
    if (requisicaoEmAndamentoRef.current) return
    requisicaoEmAndamentoRef.current = true
    if (silencioso) setAtualizando(true)
    else setCarregando(true)

    try {
      const resposta = await apiFetch(`/api/public/painel/${slug}/${hash}`)
      setDados(resposta)
      setErro('')
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar o painel')
    } finally {
      requisicaoEmAndamentoRef.current = false
      setCarregando(false)
      setAtualizando(false)
    }
  }

  useEffect(() => {
    carregarPainel()
    const relogio = window.setInterval(() => setAgora(new Date()), 1000)

    const agendarProximaAtualizacao = () => {
      window.clearTimeout(pollingRef.current)
      pollingRef.current = window.setTimeout(async () => {
        await carregarPainel({ silencioso: true })
        agendarProximaAtualizacao()
      }, REFRESH_INTERVAL)
    }

    const atualizarAoVoltar = () => {
      if (document.visibilityState === 'visible') carregarPainel({ silencioso: true })
    }

    agendarProximaAtualizacao()
    window.addEventListener('online', atualizarAoVoltar)
    document.addEventListener('visibilitychange', atualizarAoVoltar)

    return () => {
      window.clearInterval(relogio)
      window.clearTimeout(pollingRef.current)
      window.removeEventListener('online', atualizarAoVoltar)
      document.removeEventListener('visibilitychange', atualizarAoVoltar)
    }
  }, [slug, hash])

  useEffect(() => {
    const onFullscreen = () => setFullscreenAtivo(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  const alternarFullscreen = async () => {
    if (typeof document === 'undefined') return
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      return
    }
    await document.exitFullscreen()
  }

  if (carregando && !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090805] text-white">
        <div className="text-center">
          <img src={MARCAI_LOGO} alt="Marcai Barber" className="mx-auto mb-6 h-16 w-auto sm:mb-8 sm:h-20" />
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#d39b59]" />
          <p className="mt-4 text-sm uppercase tracking-[0.22em] text-[#b99d74]">Preparando painel da agenda</p>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090805] px-6 text-white">
        <div className="max-w-lg rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-6 text-center sm:p-8">
          <CircleAlert className="mx-auto h-10 w-10 text-rose-300" />
          <h1 className="mt-5 text-2xl font-semibold">Painel indisponível</h1>
          <p className="mt-3 text-sm text-rose-100/80">{erro || 'Não foi possível abrir esse painel agora.'}</p>
          <button
            type="button"
            onClick={() => carregarPainel()}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const tenant = dados.tenant
  const agendaOrdenada = ordenarAgendaPorProximidade(agendaFiltrada, agora)
  const timeZone = tenant?.timezone || 'America/Sao_Paulo'
  const relogio = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  })
  const logo = resolverLogo(tenant)

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#090805] text-white md:overflow-hidden">
      <style>{`
        body { background: #090805; }
        .painel-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .painel-scroll::-webkit-scrollbar-thumb { background: rgba(214, 168, 101, 0.22); border-radius: 999px; }
      `}</style>

      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,151,74,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(166,102,35,0.18),transparent_32%),linear-gradient(180deg,#0b0906_0%,#15110c_46%,#090805_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-white/5" />
        <div className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-white/5" />

        <div className="relative mx-auto max-w-[1800px] px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6">
          <header className="rounded-[24px] border border-[#3a2b18] bg-[linear-gradient(135deg,rgba(27,20,13,0.95),rgba(10,10,8,0.88))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-[32px] sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-[#4e3820] bg-white/[0.03] p-2.5 sm:h-20 sm:w-20 sm:rounded-[26px] sm:p-3">
                  <img src={logo} alt={tenant?.nome} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#4e3820] bg-[#1b150f] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#d4ab72] sm:text-[11px] sm:tracking-[0.22em]">
                    <Tv2 size={14} />
                    Painel TV
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">{tenant?.nome}</h1>
                  <p className="mt-2 text-xs text-[#bba789] sm:text-sm md:text-base">
                    {dados.janela?.dataLabel} · agenda do dia para acompanhamento no monitor
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-[20px] border border-[#4e3820] bg-[#120f0c] px-4 py-3 sm:rounded-[24px] sm:px-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#bfa57f]">Horario local</p>
                  <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{relogio}</p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => carregarPainel({ silencioso: true })}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 sm:w-auto"
                  >
                    <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={alternarFullscreen}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#4e3820] bg-[#1c1510] px-4 py-2.5 text-sm font-medium text-[#f2e2c8] transition hover:bg-[#261c13] sm:w-auto"
                  >
                    {fullscreenAtivo ? <Minimize2 size={16} /> : <Expand size={16} />}
                    {fullscreenAtivo ? 'Sair da tela cheia' : 'Tela cheia'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#c5b193] sm:mt-5 sm:gap-3 sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <TimerReset size={15} className="text-[#d39b59]" />
                Atualiza automaticamente a cada 30s
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <MonitorPlay size={15} className="text-[#d39b59]" />
                Última leitura: {formatarAtualizacao(dados.janela?.atualizadoEm, timeZone)}
              </span>
            </div>

            {erro && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {erro}
              </div>
            )}
          </header>

          <div className="mt-6">
            <CardSecao
              titulo="Agenda do dia"
              subtitulo="Visao limpa da ordem dos atendimentos para acompanhar no monitor."
              acao={
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center text-xs uppercase tracking-[0.18em] text-[#c8b08b]">
                    {agendaOrdenada.length} horários
                  </span>
                  <select
                    value={profissionalFiltro}
                    onChange={(event) => setProfissionalFiltro(event.target.value)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[#f8ecd6] outline-none transition focus:border-[#d39b59]"
                  >
                    <option value="todos">Todos os profissionais</option>
                    {profissionaisDisponiveis.map((profissional) => (
                      <option key={profissional.id} value={profissional.id}>
                        {profissional.nome}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              <div className="painel-scroll space-y-3 md:max-h-[calc(100dvh-260px)] md:overflow-y-auto md:pr-1">
                {agendaOrdenada.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center sm:px-6 sm:py-10">
                    <Scissors className="mx-auto h-10 w-10 text-[#d39b59]" />
                    <p className="mt-4 text-lg font-medium text-white sm:text-xl">
                      {profissionalFiltro === 'todos' ? 'Nenhum agendamento hoje' : 'Nenhum agendamento para esse profissional'}
                    </p>
                    <p className="mt-2 text-sm text-[#bca88a]">
                      {profissionalFiltro === 'todos'
                        ? 'Quando surgirem horários, eles vão aparecer aqui automaticamente.'
                        : 'Troque o filtro ou aguarde a próxima atualização do painel.'}
                    </p>
                  </div>
                )}

                {agendaOrdenada.map((agendamento) => (
                  <LinhaAgenda
                    key={agendamento.id}
                    agendamento={agendamento}
                    agora={agora}
                  />
                ))}
              </div>
            </CardSecao>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PainelTvPublico

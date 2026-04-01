import { useEffect, useState } from 'react'
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
    label: 'Concluido',
    chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
  },
  CANCELADO: {
    label: 'Cancelado',
    chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
  },
  NAO_COMPARECEU: {
    label: 'Nao veio',
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
  <section className="rounded-[28px] border border-[#3a2b18] bg-[rgba(14,12,9,0.82)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
    <div className="mb-4 flex items-start justify-between gap-4">
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
      className={`grid gap-3 rounded-[22px] border px-4 py-4 transition-colors md:grid-cols-[96px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_140px] ${
        emCurso
          ? 'border-[#e2b26c] bg-[linear-gradient(135deg,rgba(194,145,80,0.18),rgba(23,19,16,0.92))]'
          : 'border-white/8 bg-white/[0.03]'
      }`}
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Horario</p>
        <p className="mt-2 text-2xl font-semibold text-white">{agendamento.hora}</p>
        <p className="mt-1 text-sm text-[#9f9078]">ate {agendamento.fimHora}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Cliente</p>
        <p className="mt-2 truncate text-xl font-medium text-white">{agendamento.clienteNome}</p>
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
        <p className="mt-2 truncate text-lg text-[#f5ecdd]">{agendamento.servicoNome}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#bfa57f]">Profissional</p>
        <p className="mt-2 truncate text-lg text-[#f5ecdd]">{agendamento.profissionalNome}</p>
      </div>

      <div className="md:text-right">
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

  const carregarPainel = async ({ silencioso = false } = {}) => {
    if (silencioso) setAtualizando(true)
    else setCarregando(true)

    try {
      const resposta = await apiFetch(`/api/public/painel/${slug}/${hash}`)
      setDados(resposta)
      setErro('')
    } catch (err) {
      setErro(err.message || 'Nao foi possivel carregar o painel')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }

  useEffect(() => {
    carregarPainel()

    const polling = window.setInterval(() => carregarPainel({ silencioso: true }), REFRESH_INTERVAL)
    const relogio = window.setInterval(() => setAgora(new Date()), 1000)

    return () => {
      window.clearInterval(polling)
      window.clearInterval(relogio)
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
          <img src={MARCAI_LOGO} alt="Marcai Barber" className="mx-auto mb-8 h-20 w-auto" />
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#d39b59]" />
          <p className="mt-4 text-sm uppercase tracking-[0.22em] text-[#b99d74]">Preparando painel da agenda</p>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090805] px-6 text-white">
        <div className="max-w-lg rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-8 text-center">
          <CircleAlert className="mx-auto h-10 w-10 text-rose-300" />
          <h1 className="mt-5 text-2xl font-semibold">Painel indisponivel</h1>
          <p className="mt-3 text-sm text-rose-100/80">{erro || 'Nao foi possivel abrir esse painel agora.'}</p>
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
  const agendaHoje = dados.agendaHoje || []
  const agendaOrdenada = ordenarAgendaPorProximidade(agendaHoje, agora)
  const timeZone = tenant?.timezone || 'America/Sao_Paulo'
  const relogio = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  })
  const logo = resolverLogo(tenant)

  return (
    <div className="min-h-screen overflow-hidden bg-[#090805] text-white">
      <style>{`
        body { background: #090805; }
        .painel-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .painel-scroll::-webkit-scrollbar-thumb { background: rgba(214, 168, 101, 0.22); border-radius: 999px; }
      `}</style>

      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,151,74,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(166,102,35,0.18),transparent_32%),linear-gradient(180deg,#0b0906_0%,#15110c_46%,#090805_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-white/5" />
        <div className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-white/5" />

        <div className="relative mx-auto max-w-[1800px] px-4 py-4 md:px-8 md:py-6">
          <header className="rounded-[32px] border border-[#3a2b18] bg-[linear-gradient(135deg,rgba(27,20,13,0.95),rgba(10,10,8,0.88))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] border border-[#4e3820] bg-white/[0.03] p-3">
                  <img src={logo} alt={tenant?.nome} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#4e3820] bg-[#1b150f] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#d4ab72]">
                    <Tv2 size={14} />
                    Painel TV
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{tenant?.nome}</h1>
                  <p className="mt-2 text-sm text-[#bba789] md:text-base">
                    {dados.janela?.dataLabel} · agenda do dia para acompanhamento no monitor
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="rounded-[24px] border border-[#4e3820] bg-[#120f0c] px-5 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#bfa57f]">Horario local</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{relogio}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => carregarPainel({ silencioso: true })}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={alternarFullscreen}
                    className="inline-flex items-center gap-2 rounded-full border border-[#4e3820] bg-[#1c1510] px-4 py-2.5 text-sm font-medium text-[#f2e2c8] transition hover:bg-[#261c13]"
                  >
                    {fullscreenAtivo ? <Minimize2 size={16} /> : <Expand size={16} />}
                    {fullscreenAtivo ? 'Sair da tela cheia' : 'Tela cheia'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#c5b193]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <TimerReset size={15} className="text-[#d39b59]" />
                Atualiza automaticamente a cada 30s
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <MonitorPlay size={15} className="text-[#d39b59]" />
                Ultima leitura: {formatarAtualizacao(dados.janela?.atualizadoEm, timeZone)}
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
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[#c8b08b]">
                  {agendaHoje.length} horarios
                </span>
              }
            >
              <div className="painel-scroll max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
                {agendaHoje.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
                    <Scissors className="mx-auto h-10 w-10 text-[#d39b59]" />
                    <p className="mt-4 text-xl font-medium text-white">Nenhum agendamento hoje</p>
                    <p className="mt-2 text-sm text-[#bca88a]">Quando surgirem horarios, eles vao aparecer aqui automaticamente.</p>
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

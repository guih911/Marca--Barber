import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Clock, User2, Scissors, ListChecks, ArrowLeft, Phone } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json()
  if (!data.sucesso) throw new Error(data.erro?.mensagem || 'Erro')
  return data.dados
}

const formatarHora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

const ETAPAS = { INICIAL: 'INICIAL', DIGITANDO: 'DIGITANDO', BUSCANDO: 'BUSCANDO', RESULTADO: 'RESULTADO', CONFIRMADO: 'CONFIRMADO', SEM_AGENDAMENTO: 'SEM_AGENDAMENTO', ERRO: 'ERRO' }

const Totem = () => {
  const { slug } = useParams()
  const [etapa, setEtapa] = useState(ETAPAS.INICIAL)
  const [telefone, setTelefone] = useState('')
  const [agendamento, setAgendamento] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [tenant, setTenant] = useState(null)
  const inputRef = useRef(null)

  // Reset automático após 30s na tela de resultado ou erro
  useEffect(() => {
    if ([ETAPAS.CONFIRMADO, ETAPAS.SEM_AGENDAMENTO, ETAPAS.ERRO].includes(etapa)) {
      const t = setTimeout(() => resetar(), 30000)
      return () => clearTimeout(t)
    }
  }, [etapa])

  useEffect(() => {
    if (slug) {
      fetch(`${API_URL}/api/public/${slug}/info`)
        .then(r => r.json())
        .then(d => { if (d.sucesso) setTenant(d.dados.tenant) })
        .catch(() => {})
    }
  }, [slug])

  const resetar = () => {
    setEtapa(ETAPAS.INICIAL)
    setTelefone('')
    setAgendamento(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleDigito = (d) => {
    if (telefone.length >= 11) return
    const novo = telefone + d
    setTelefone(novo)
    if (novo.length >= 10) {
      buscarAgendamento(novo)
    }
  }

  const handleApagar = () => {
    setTelefone((prev) => prev.slice(0, -1))
  }

  const buscarAgendamento = async (tel) => {
    setEtapa(ETAPAS.BUSCANDO)
    try {
      const agora = new Date()
      const inicio = new Date(agora.getTime() - 60 * 60 * 1000).toISOString() // 1h antes
      const fim = new Date(agora.getTime() + 3 * 60 * 60 * 1000).toISOString() // 3h depois
      const dados = await apiFetch(`/api/public/check-in?slug=${slug}&telefone=${encodeURIComponent(tel)}&inicio=${inicio}&fim=${fim}`)
      if (dados?.agendamento) {
        setAgendamento(dados.agendamento)
        setEtapa(ETAPAS.RESULTADO)
      } else {
        setEtapa(ETAPAS.SEM_AGENDAMENTO)
      }
    } catch {
      setEtapa(ETAPAS.SEM_AGENDAMENTO)
    }
  }

  const confirmarChegada = async () => {
    if (!agendamento?.id) return
    setConfirmando(true)
    try {
      await apiFetch('/api/public/check-in/confirmar', {
        method: 'PATCH',
        body: {
          slug,
          telefone,
          agendamentoId: agendamento.id,
        },
      })
      setEtapa(ETAPAS.CONFIRMADO)
    } catch {
      setEtapa(ETAPAS.ERRO)
    } finally {
      setConfirmando(false)
    }
  }

  const formatarTel = (tel) => {
    if (!tel) return ''
    if (tel.length <= 2) return `(${tel}`
    if (tel.length <= 7) return `(${tel.slice(0,2)}) ${tel.slice(2)}`
    if (tel.length <= 11) return `(${tel.slice(0,2)}) ${tel.slice(2,7)}-${tel.slice(7)}`
    return tel
  }

  const TECLADO = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['⌫','0','OK'],
  ]

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center p-6 select-none">
      {/* Logo / Nome da barbearia */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-3xl bg-primaria/20 border-2 border-primaria flex items-center justify-center mx-auto mb-4">
          <Scissors size={36} className="text-primaria" />
        </div>
        <h1 className="text-3xl font-bold text-white">{tenant?.nome || 'Barbearia'}</h1>
        <p className="text-white/50 mt-1">Check-in digital</p>
      </div>

      {/* ETAPA: INICIAL */}
      {etapa === ETAPAS.INICIAL && (
        <div className="text-center">
          <p className="text-white/80 text-xl mb-8">Tem agendamento hoje?</p>
          <button
            onClick={() => { setEtapa(ETAPAS.DIGITANDO); setTimeout(() => inputRef.current?.focus(), 100) }}
            className="bg-primaria hover:bg-primaria-escura text-white text-2xl font-bold px-12 py-6 rounded-3xl transition-colors shadow-xl"
          >
            Fazer check-in
          </button>
        </div>
      )}

      {/* ETAPA: DIGITANDO (teclado numérico) */}
      {(etapa === ETAPAS.DIGITANDO || etapa === ETAPAS.BUSCANDO) && (
        <div className="w-full max-w-sm">
          <p className="text-white/80 text-lg text-center mb-6">Digite seu telefone</p>

          {/* Display do número */}
          <div className="bg-white/10 rounded-2xl px-6 py-4 text-center mb-6 border border-white/10">
            <span className="text-white text-3xl font-mono tracking-widest">
              {formatarTel(telefone) || <span className="text-white/30">(__) _____-____</span>}
            </span>
          </div>

          {/* Teclado */}
          {etapa === ETAPAS.BUSCANDO ? (
            <div className="flex justify-center py-8">
              <Loader2 size={40} className="animate-spin text-primaria" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {TECLADO.flat().map((tecla) => (
                <button
                  key={tecla}
                  onClick={() => {
                    if (tecla === '⌫') handleApagar()
                    else if (tecla === 'OK') { if (telefone.length >= 8) buscarAgendamento(telefone) }
                    else handleDigito(tecla)
                  }}
                  className={`py-5 rounded-2xl text-2xl font-bold transition-all active:scale-95 ${
                    tecla === '⌫' ? 'bg-white/10 text-white/60 hover:bg-white/20 text-xl' :
                    tecla === 'OK' ? 'bg-primaria text-white hover:bg-primaria-escura shadow-lg' :
                    'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {tecla}
                </button>
              ))}
            </div>
          )}

          <button onClick={resetar} className="w-full mt-6 text-white/40 text-sm flex items-center justify-center gap-2 hover:text-white/60 transition-colors">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* ETAPA: RESULTADO — agendamento encontrado */}
      {etapa === ETAPAS.RESULTADO && agendamento && (
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl p-6 text-center shadow-2xl mb-6">
            <div className="w-16 h-16 rounded-full bg-primaria/15 flex items-center justify-center mx-auto mb-4">
              <User2 size={28} className="text-primaria" />
            </div>
            <h2 className="text-xl font-bold text-texto mb-1">{agendamento.cliente?.nome || 'Cliente'}</h2>
            <p className="text-texto-sec text-sm mb-4">Seu agendamento de hoje:</p>

            <div className="bg-fundo rounded-2xl p-4 space-y-2.5 text-left">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-primaria shrink-0" />
                <div>
                  <p className="text-xs text-texto-sec">Horário</p>
                  <p className="font-semibold text-texto">{formatarHora(agendamento.inicioEm)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Scissors size={16} className="text-primaria shrink-0" />
                <div>
                  <p className="text-xs text-texto-sec">Serviço</p>
                  <p className="font-semibold text-texto">{agendamento.servico?.nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User2 size={16} className="text-primaria shrink-0" />
                <div>
                  <p className="text-xs text-texto-sec">Profissional</p>
                  <p className="font-semibold text-texto">{agendamento.profissional?.nome}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={confirmarChegada}
            disabled={confirmando}
            className="w-full py-5 bg-sucesso text-white text-xl font-bold rounded-3xl transition-colors disabled:opacity-70 shadow-xl flex items-center justify-center gap-3"
          >
            {confirmando ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
            {confirmando ? 'Confirmando...' : 'Confirmar chegada'}
          </button>

          <button onClick={resetar} className="w-full mt-4 text-white/40 text-sm flex items-center justify-center gap-2 hover:text-white/60 transition-colors">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* ETAPA: CONFIRMADO */}
      {etapa === ETAPAS.CONFIRMADO && (
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} className="text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Chegada confirmada! ✅</h2>
          <p className="text-white/60 text-lg mb-8">
            {agendamento?.profissional?.nome
              ? `O ${agendamento.profissional.nome} já foi avisado. Por favor, aguarde.`
              : 'Por favor, aguarde.'}
          </p>
          <p className="text-white/30 text-sm">Voltando ao início em instantes...</p>
          <button onClick={resetar} className="mt-6 text-white/40 text-sm hover:text-white/60">Início</button>
        </div>
      )}

      {/* ETAPA: SEM AGENDAMENTO */}
      {etapa === ETAPAS.SEM_AGENDAMENTO && (
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mx-auto mb-6">
            <ListChecks size={42} className="text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Nenhum agendamento encontrado</h2>
          <p className="text-white/60 text-base mb-4">
            Não encontramos agendamento para este número nas próximas horas.
          </p>
          <p className="text-white/50 text-sm mb-8">Fale com a recepção ou agende pelo WhatsApp.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetar}
              className="px-8 py-4 bg-white/15 text-white text-lg font-medium rounded-2xl hover:bg-white/25 transition-colors"
            >
              <ArrowLeft size={18} className="inline mr-2" />Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ETAPA: ERRO */}
      {etapa === ETAPAS.ERRO && (
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-6">
            <Phone size={40} className="text-red-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Não foi possível confirmar agora</h2>
          <p className="text-white/60 text-base mb-8">
            Chame a recepção para concluir seu check-in.
          </p>
          <button
            onClick={resetar}
            className="px-8 py-4 bg-white/15 text-white text-lg font-medium rounded-2xl hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={18} className="inline mr-2" />Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}

export default Totem

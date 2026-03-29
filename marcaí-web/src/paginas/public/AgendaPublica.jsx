import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Calendar, Clock, User, Scissors, CheckCircle2, ChevronLeft, Phone, UserCircle2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const data = await res.json()
  if (!data.sucesso) throw new Error(data.erro?.mensagem || 'Erro')
  return data.dados
}

const formatarReais = (centavos) =>
  centavos != null
    ? (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''

const formatarHora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

const formatarDataExibicao = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Sao_Paulo',
  })

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function gerarDias(baseDate, quantidade = 14) {
  const dias = []
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + i)
    dias.push(d.toISOString().split('T')[0])
  }
  return dias
}

// ─── Cores da marca ─────────────────────────────────────────────────────────
const C = {
  bg: '#111111',
  bgCard: '#161616',
  bgSelected: '#1a1208',
  bgHeader: '#0a0a0a',
  bgInput: '#1a1a1a',
  bgSummary: '#161616',
  gold: '#B8894D',
  goldDim: 'rgba(184,137,77,0.15)',
  border: '#2a2a2a',
  borderStrong: '#333',
  borderHeader: '#222',
  textPrimary: '#ffffff',
  textSecondary: '#aaa',
  textDim: '#888',
  textOnGold: '#ffffff',
}

// ─── Etapas ────────────────────────────────────────────────────────────────────
// 1. Serviço → 2. Profissional → 3. Data/Hora → 4. Dados pessoais → 5. Confirmado

const AgendaPublica = () => {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  const telParam = searchParams.get('tel') || searchParams.get('telefone') || ''
  const nomeParam = searchParams.get('nome') || ''

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [servicos, setServicos] = useState([])
  const [profissionais, setProfissionais] = useState([])

  // Seleções
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [data, setData] = useState('')
  const [slot, setSlot] = useState(null)
  const [nome, setNome] = useState(nomeParam)
  const [telefone, setTelefone] = useState(telParam)

  const [etapa, setEtapa] = useState(1)
  const [slots, setSlots] = useState([])
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [confirmado, setConfirmado] = useState(null)
  const [erroAgendamento, setErroAgendamento] = useState('')

  const dias = gerarDias(new Date(), 14)

  // Carrega info do tenant
  useEffect(() => {
    apiFetch(`/api/public/${slug}/info`)
      .then((dados) => {
        setTenant(dados.tenant)
        setServicos(dados.servicos)
        setProfissionais(dados.profissionais)
      })
      .catch((e) => setErro(e.message || 'Barbearia não encontrada'))
      .finally(() => setCarregando(false))
  }, [slug])

  // Carrega slots quando data, serviço e profissional estão definidos
  useEffect(() => {
    if (!data || !servicoId) return
    setCarregandoSlots(true)
    setSlot(null)
    const params = new URLSearchParams({ servicoId, data })
    if (profissionalId) params.set('profissionalId', profissionalId)
    apiFetch(`/api/public/${slug}/slots?${params}`)
      .then((s) => setSlots(s))
      .catch(() => setSlots([]))
      .finally(() => setCarregandoSlots(false))
  }, [data, servicoId, profissionalId, slug])

  const profsFiltrados = servicoId
    ? profissionais.filter((p) => p.servicoIds.includes(servicoId))
    : profissionais

  const servicoSel = servicos.find((s) => s.id === servicoId)
  const profSel = profissionais.find((p) => p.id === profissionalId) ||
    (slot ? profissionais.find((p) => p.id === slot.profissional?.id) : null)

  const confirmar = async () => {
    setErroAgendamento('')
    if (!nome.trim() || !telefone.trim()) {
      setErroAgendamento('Preencha seu nome e telefone.')
      return
    }
    setEnviando(true)
    try {
      const pidFinal = profissionalId || slot?.profissional?.id
      await apiFetch(`/api/public/${slug}/agendar`, {
        method: 'POST',
        body: JSON.stringify({ nome, telefone, servicoId, profissionalId: pidFinal, inicio: slot.inicio }),
      })
      setConfirmado({ slot, servico: servicoSel, profissional: profSel, nome })
      setEtapa(5)
    } catch (e) {
      setErroAgendamento(e.message || 'Erro ao confirmar agendamento. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
        <Loader2 size={32} className="spin" style={{ color: C.gold }} />
      </div>
    )
  }

  // ─── Erro ─────────────────────────────────────────────────────────────────────
  if (erro) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✂️</div>
          <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Barbearia não encontrada</p>
          <p style={{ color: C.textDim, fontSize: 13 }}>{erro}</p>
        </div>
      </div>
    )
  }

  // ─── Render principal ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .fade-in { animation: fadeIn 0.25s ease }
        @keyframes popIn { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }
        .pop-in { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) }
        .agenda-input {
          width: 100%;
          background: ${C.bgInput};
          border: 1px solid ${C.borderStrong};
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 14px;
          color: ${C.textPrimary};
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        .agenda-input::placeholder { color: ${C.textDim}; }
        .agenda-input:focus { border-color: ${C.gold}; }
        .agenda-input:-webkit-autofill,
        .agenda-input:-webkit-autofill:hover,
        .agenda-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px ${C.bgInput} inset;
          -webkit-text-fill-color: ${C.textPrimary};
          caret-color: ${C.textPrimary};
        }
        .slot-pill {
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
        }
        .slot-pill:hover { transform: scale(1.03); }
        .day-pill { transition: background 0.15s, border-color 0.15s; }
        .card-sel { transition: background 0.15s, border-color 0.15s; }
        .btn-back { transition: background 0.15s; }
        .btn-back:hover { background: #1e1e1e !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '16px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {tenant?.logoUrl ? (
            <img
              src={`${API_URL}${tenant.logoUrl}`}
              alt={tenant.nome}
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}` }}
            />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.goldDim, border: `1.5px solid ${C.gold}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Scissors size={18} style={{ color: C.gold }} />
            </div>
          )}
          <div>
            <h1 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 15, lineHeight: 1.2, margin: 0 }}>
              {tenant?.nome}
            </h1>
            <p style={{ color: C.textDim, fontSize: 11, margin: 0, marginTop: 2 }}>Agendamento online</p>
          </div>
        </div>
      </div>

      {/* ── Barra de progresso ── */}
      {etapa < 5 && (
        <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '10px 20px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {[1, 2, 3, 4].map((e) => (
              <div key={e} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: e < etapa ? C.gold : e === etapa ? C.goldDim : 'transparent',
                  border: `1.5px solid ${e <= etapa ? C.gold : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {e < etapa ? (
                    <span style={{ color: C.textOnGold, fontSize: 10, fontWeight: 700 }}>✓</span>
                  ) : (
                    <span style={{ color: e === etapa ? C.gold : C.textDim, fontSize: 10, fontWeight: 700 }}>{e}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 480, margin: '6px auto 0', display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4].map((e) => (
              <div key={e} style={{
                flex: 1, height: 3, borderRadius: 4,
                background: e <= etapa ? C.gold : C.border,
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '20px 16px 32px', boxSizing: 'border-box' }}>

        {/* ════ Etapa 1: Serviço ════ */}
        {etapa === 1 && (
          <div className="fade-in">
            <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scissors size={18} style={{ color: C.gold }} />
              Escolha o serviço
            </h2>
            {servicos.map((s) => {
              const sel = servicoId === s.id
              return (
                <div
                  key={s.id}
                  className="card-sel"
                  onClick={() => { setServicoId(s.id); setProfissionalId(''); setData(''); setSlot(null); setEtapa(2) }}
                  style={{
                    background: sel ? C.bgSelected : C.bgCard,
                    border: `1.5px solid ${sel ? C.gold : C.border}`,
                    borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>{s.nome}</p>
                      <p style={{ color: C.textDim, fontSize: 12, margin: '3px 0 0' }}>{s.duracaoMinutos} min</p>
                    </div>
                    {s.precoCentavos != null && (
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>
                        {formatarReais(s.precoCentavos)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ════ Etapa 2: Profissional ════ */}
        {etapa === 2 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <button
                className="btn-back"
                onClick={() => setEtapa(1)}
                style={{
                  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} style={{ color: C.textSecondary }} />
              </button>
              <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} style={{ color: C.gold }} />
                Escolha o profissional
              </h2>
            </div>

            {/* Qualquer profissional */}
            <div
              className="card-sel"
              onClick={() => { setProfissionalId(''); setEtapa(3) }}
              style={{
                background: !profissionalId ? C.bgSelected : C.bgCard,
                border: `1.5px solid ${!profissionalId ? C.gold : C.border}`,
                borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
              }}
            >
              <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>Qualquer profissional</p>
              <p style={{ color: C.textDim, fontSize: 12, margin: '3px 0 0' }}>Mostrar todos os horários disponíveis</p>
            </div>

            {profsFiltrados.map((p) => {
              const sel = profissionalId === p.id
              return (
                <div
                  key={p.id}
                  className="card-sel"
                  onClick={() => { setProfissionalId(p.id); setEtapa(3) }}
                  style={{
                    background: sel ? C.bgSelected : C.bgCard,
                    border: `1.5px solid ${sel ? C.gold : C.border}`,
                    borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {p.avatarUrl ? (
                    <img
                      src={`${API_URL}${p.avatarUrl}`}
                      alt={p.nome}
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${sel ? C.gold : C.border}`, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: sel ? C.goldDim : '#1e1e1e',
                      border: `1.5px solid ${sel ? C.gold : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: sel ? C.gold : C.textSecondary, fontWeight: 700, fontSize: 15,
                    }}>
                      {p.nome[0].toUpperCase()}
                    </div>
                  )}
                  <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>{p.nome}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ════ Etapa 3: Data e Hora ════ */}
        {etapa === 3 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <button
                className="btn-back"
                onClick={() => setEtapa(2)}
                style={{
                  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} style={{ color: C.textSecondary }} />
              </button>
              <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} style={{ color: C.gold }} />
                Escolha a data e hora
              </h2>
            </div>

            {/* Seletor de dias */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
              {dias.map((d) => {
                const dt = new Date(d + 'T12:00:00-03:00')
                const sel = data === d
                return (
                  <div
                    key={d}
                    className="day-pill"
                    onClick={() => setData(d)}
                    style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 12, cursor: 'pointer', minWidth: 52,
                      background: sel ? C.gold : C.bgCard,
                      border: `1.5px solid ${sel ? C.gold : C.border}`,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: sel ? 'rgba(255,255,255,0.8)' : C.textDim, marginBottom: 2 }}>
                      {DIAS_SEMANA[dt.getDay()]}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: sel ? '#fff' : C.textPrimary, lineHeight: 1.1 }}>
                      {dt.getDate()}
                    </span>
                    <span style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.7)' : C.textDim, marginTop: 2 }}>
                      {MESES[dt.getMonth()]}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Slots */}
            {!data && (
              <p style={{ textAlign: 'center', color: C.textDim, fontSize: 13, padding: '24px 0' }}>
                Selecione uma data acima
              </p>
            )}
            {data && carregandoSlots && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <Loader2 size={24} className="spin" style={{ color: C.gold }} />
              </div>
            )}
            {data && !carregandoSlots && slots.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ color: C.textSecondary, fontSize: 13, margin: 0 }}>Nenhum horário disponível nesta data.</p>
                <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Tente outro dia.</p>
              </div>
            )}
            {data && !carregandoSlots && slots.length > 0 && (
              <div>
                <p style={{ color: C.textDim, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} style={{ color: C.gold }} />
                  {slots.length} horário{slots.length !== 1 ? 's' : ''} disponível{slots.length !== 1 ? 'is' : ''}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {slots.map((s) => {
                    const sel = slot?.inicio === s.inicio && slot?.profissional?.id === s.profissional?.id
                    return (
                      <div
                        key={`${s.inicio}-${s.profissional?.id}`}
                        className="slot-pill"
                        onClick={() => setSlot(s)}
                        style={{
                          background: sel ? C.bgSelected : C.bgCard,
                          border: `1.5px solid ${sel ? C.gold : C.border}`,
                          borderRadius: 12, padding: '10px 6px', cursor: 'pointer', textAlign: 'center',
                        }}
                      >
                        <p style={{ color: sel ? C.gold : C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>
                          {formatarHora(s.inicio)}
                        </p>
                        {!profissionalId && s.profissional && (
                          <p style={{ color: C.textDim, fontSize: 11, margin: '3px 0 0' }}>
                            {s.profissional.nome.split(' ')[0]}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {slot && (
                  <button
                    onClick={() => setEtapa(4)}
                    style={{
                      width: '100%', marginTop: 16, background: C.gold, color: C.textOnGold,
                      border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                      fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Continuar →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ Etapa 4: Dados pessoais ════ */}
        {etapa === 4 && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <button
                className="btn-back"
                onClick={() => setEtapa(3)}
                style={{
                  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} style={{ color: C.textSecondary }} />
              </button>
              <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0 }}>Seus dados</h2>
            </div>

            {/* Resumo do agendamento */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 18,
            }}>
              <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Resumo
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Scissors size={14} style={{ color: C.gold, flexShrink: 0 }} />
                  <span style={{ color: C.textPrimary, fontSize: 13, fontWeight: 600, flex: 1 }}>{servicoSel?.nome}</span>
                  {servicoSel?.precoCentavos != null && (
                    <span style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>{formatarReais(servicoSel.precoCentavos)}</span>
                  )}
                </div>
                {profSel && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={14} style={{ color: C.textDim, flexShrink: 0 }} />
                    <span style={{ color: C.textSecondary, fontSize: 13 }}>{profSel.nome}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={14} style={{ color: C.textDim, flexShrink: 0 }} />
                  <span style={{ color: C.textSecondary, fontSize: 13 }}>{formatarDataExibicao(slot.inicio)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={14} style={{ color: C.textDim, flexShrink: 0 }} />
                  <span style={{ color: C.textSecondary, fontSize: 13 }}>{formatarHora(slot.inicio)}</span>
                </div>
              </div>
            </div>

            {/* Campos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
              <div>
                <label style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <UserCircle2 size={13} style={{ color: C.gold }} /> Seu nome
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como prefere ser chamado?"
                  className="agenda-input"
                />
              </div>
              <div>
                <label style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Phone size={13} style={{ color: C.gold }} /> WhatsApp
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="agenda-input"
                />
              </div>
            </div>

            {erroAgendamento && (
              <div style={{
                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 12, padding: '11px 14px', marginBottom: 14,
              }}>
                <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{erroAgendamento}</p>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={enviando}
              style={{
                width: '100%', background: enviando ? 'rgba(184,137,77,0.5)' : C.gold,
                color: C.textOnGold, border: 'none', borderRadius: 12, padding: '13px',
                fontWeight: 700, fontSize: 15, cursor: enviando ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit', transition: 'background 0.2s',
              }}
            >
              {enviando
                ? <><Loader2 size={18} className="spin" /> Confirmando...</>
                : 'Confirmar agendamento'
              }
            </button>
          </div>
        )}

        {/* ════ Etapa 5: Confirmado ════ */}
        {etapa === 5 && confirmado && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 16 }}>

            {/* Ícone de sucesso */}
            <div
              className="pop-in"
              style={{
                width: 72, height: 72, borderRadius: '50%', marginBottom: 20,
                background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={40} style={{ color: '#4ade80' }} />
            </div>

            <h2 style={{ color: C.textPrimary, fontWeight: 800, fontSize: 22, margin: '0 0 6px' }}>
              Agendamento Confirmado!
            </h2>
            <p style={{ color: C.textDim, fontSize: 14, margin: '0 0 24px' }}>
              Até lá, {confirmado.nome.split(' ')[0]}! ✂️
            </p>

            {/* Detalhes */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '16px', width: '100%', textAlign: 'left',
              marginBottom: 20, boxSizing: 'border-box',
            }}>
              <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>
                Detalhes do agendamento
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: C.goldDim, border: `1px solid rgba(184,137,77,0.3)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Scissors size={15} style={{ color: C.gold }} />
                  </div>
                  <div>
                    <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Serviço</p>
                    <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: '2px 0 0' }}>{confirmado.servico?.nome}</p>
                  </div>
                </div>
                {confirmado.profissional && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: '#1a1a1a', border: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User size={15} style={{ color: C.textSecondary }} />
                    </div>
                    <div>
                      <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Profissional</p>
                      <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: '2px 0 0' }}>{confirmado.profissional.nome}</p>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: '#1a1a1a', border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Calendar size={15} style={{ color: C.textSecondary }} />
                  </div>
                  <div>
                    <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Data e hora</p>
                    <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: '2px 0 0' }}>
                      {formatarDataExibicao(confirmado.slot.inicio)}, {formatarHora(confirmado.slot.inicio)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Don IA / WhatsApp */}
            <div style={{
              background: 'linear-gradient(135deg, #0d1f12 0%, #0a1a10 100%)',
              border: '1.5px solid rgba(37,211,102,0.25)',
              borderRadius: 16, padding: '16px 18px', width: '100%',
              textAlign: 'left', boxSizing: 'border-box', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>💬</div>
                <div>
                  <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>
                    Precisa remarcar ou tem dúvidas?
                  </p>
                  <p style={{ color: 'rgba(200,255,200,0.7)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                    Converse com o <strong style={{ color: '#fff' }}>Don</strong>, nosso assistente no WhatsApp. Ele confirma, remarca e responde na hora!
                  </p>
                </div>
              </div>
            </div>

            <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>
              Uma confirmação foi registrada. Você pode receber uma mensagem no WhatsApp.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

export default AgendaPublica

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Calendar, Clock, User, Scissors, ChevronLeft, Phone } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? ''

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

// ─── Máscara de telefone brasileiro ─────────────────────────────────────────
const mascaraTelefone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ─── Agrupar slots por período ──────────────────────────────────────────────
const agruparSlotsPorPeriodo = (slots) => {
  const grupos = { manha: [], tarde: [], noite: [] }
  for (const s of slots) {
    const hora = new Date(s.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false })
    const h = parseInt(hora, 10)
    if (h < 12) grupos.manha.push(s)
    else if (h < 18) grupos.tarde.push(s)
    else grupos.noite.push(s)
  }
  return grupos
}

// ─── Etapas ────────────────────────────────────────────────────────────────────
// 1. Serviço → 2. Profissional → 3. Data/Hora → 4. Dados pessoais (novos) → WhatsApp

const AgendaPublica = () => {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  // Cliente retornante? (tel + nome na URL)
  const telUrl = searchParams.get('tel') || ''
  const nomeUrl = searchParams.get('nome') || ''
  const clienteRetornante = !!(telUrl && nomeUrl)

  const totalEtapas = clienteRetornante ? 3 : 4

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

  // Dados pessoais (novo cliente)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')

  const [etapa, setEtapa] = useState(1)
  const [slots, setSlots] = useState([])
  const [carregandoSlots, setCarregandoSlots] = useState(false)

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

  // Auto-seleciona hoje ao entrar na etapa 3
  useEffect(() => {
    if (etapa === 3 && !data && dias.length > 0) {
      setData(dias[0])
    }
  }, [etapa]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const redirecionarWhatsApp = (slotEscolhido, nome, telefone) => {
    const profEscolhido = profissionalId
      ? profissionais.find((p) => p.id === profissionalId)
      : slotEscolhido.profissional
    const servicoEscolhido = servicos.find((s) => s.id === servicoId)
    const dataFormatada = formatarDataExibicao(slotEscolhido.inicio)
    const horaFormatada = formatarHora(slotEscolhido.inicio)

    const linhas = [
      `Olá! Escolhi pelo site:`,
      `Serviço: ${servicoEscolhido?.nome}`,
      profEscolhido ? `Profissional: ${profEscolhido.nome}` : '',
      `Data: ${dataFormatada} às ${horaFormatada}`,
    ]

    // Para novos clientes, inclui nome e telefone
    if (!clienteRetornante && nome) {
      linhas.push(`Nome: ${nome}`)
      if (telefone) linhas.push(`Telefone: ${telefone}`)
    }

    const mensagem = linhas.filter(Boolean).join('\n')
    const numero = (tenant?.whatsappNumero || tenant?.telefone || '').replace(/\D/g, '')
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank')
  }

  const avancarAposSlot = () => {
    if (clienteRetornante) {
      redirecionarWhatsApp(slot, nomeUrl, telUrl)
    } else {
      setEtapa(4)
    }
  }

  const confirmarDadosPessoais = () => {
    const telLimpo = telefoneCliente.replace(/\D/g, '')
    const telComCodigo = telLimpo.length === 11 ? `55${telLimpo}` : telLimpo
    redirecionarWhatsApp(slot, nomeCliente, telComCodigo)
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

  // ─── Render de seção de slots por período ────────────────────────────────────
  const renderGrupoSlots = (titulo, slotsGrupo) => {
    if (slotsGrupo.length === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {titulo}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {slotsGrupo.map((s) => {
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
      </div>
    )
  }

  // Encontrar próximo dia útil para sugestão
  const proximoDiaUtil = () => {
    const idx = dias.indexOf(data)
    if (idx < 0 || idx >= dias.length - 1) return null
    return dias[idx + 1]
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
      {etapa <= totalEtapas && (
        <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '10px 20px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: totalEtapas }, (_, i) => i + 1).map((e) => (
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
            {Array.from({ length: totalEtapas }, (_, i) => i + 1).map((e) => (
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
              onClick={() => { setProfissionalId(''); setData(''); setSlot(null); setEtapa(3) }}
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
                  onClick={() => { setProfissionalId(p.id); setData(''); setSlot(null); setEtapa(3) }}
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
                const dow = dt.getDay()
                const isFimDeSemana = dow === 0 || dow === 6
                return (
                  <div
                    key={d}
                    className="day-pill"
                    onClick={() => setData(d)}
                    style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 12, cursor: 'pointer', minWidth: 52,
                      background: sel ? C.gold : C.bgCard,
                      border: `1.5px solid ${sel ? C.gold : isFimDeSemana ? C.border : 'rgba(184,137,77,0.3)'}`,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: sel ? 'rgba(255,255,255,0.8)' : C.textDim, marginBottom: 2 }}>
                      {DIAS_SEMANA[dow]}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: sel ? '#fff' : C.textPrimary, lineHeight: 1.1 }}>
                      {dt.getDate()}
                    </span>
                    <span style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.7)' : C.textDim, marginTop: 2 }}>
                      {MESES[dt.getMonth()]}
                    </span>
                    {!sel && !isFimDeSemana && (
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.gold, marginTop: 3, opacity: 0.6 }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Slots */}
            {data && carregandoSlots && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <Loader2 size={24} className="spin" style={{ color: C.gold }} />
              </div>
            )}
            {data && !carregandoSlots && slots.length === 0 && (() => {
              const proximo = proximoDiaUtil()
              return (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ color: C.textSecondary, fontSize: 13, margin: 0 }}>Nenhum horário disponível nesta data.</p>
                  {proximo ? (
                    <p
                      onClick={() => setData(proximo)}
                      style={{ color: C.gold, fontSize: 13, marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Tentar {(() => {
                        const dt = new Date(proximo + 'T12:00:00-03:00')
                        return `${DIAS_SEMANA[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()]}`
                      })()}
                    </p>
                  ) : (
                    <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Tente outro dia.</p>
                  )}
                </div>
              )
            })()}
            {data && !carregandoSlots && slots.length > 0 && (() => {
              const grupos = agruparSlotsPorPeriodo(slots)
              return (
                <div>
                  <p style={{ color: C.textDim, fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} style={{ color: C.gold }} />
                    {slots.length} horário{slots.length !== 1 ? 's' : ''} disponível{slots.length !== 1 ? 'is' : ''}
                  </p>
                  {renderGrupoSlots('Manhã', grupos.manha)}
                  {renderGrupoSlots('Tarde', grupos.tarde)}
                  {renderGrupoSlots('Noite', grupos.noite)}
                  {slot && (
                    <button
                      onClick={avancarAposSlot}
                      style={{
                        width: '100%', marginTop: 8, background: clienteRetornante ? '#25D366' : C.gold, color: '#fff',
                        border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                        fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {clienteRetornante ? 'Confirmar pelo WhatsApp' : 'Continuar'}
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ════ Etapa 4: Dados pessoais (apenas novos clientes) ════ */}
        {etapa === 4 && !clienteRetornante && (
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
              <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={18} style={{ color: C.gold }} />
                Seus dados
              </h2>
            </div>

            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 20 }}>
              Para confirmar seu agendamento, precisamos do seu nome e telefone.
            </p>

            {/* Nome */}
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</span>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Seu nome"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: C.bgCard, border: `1.5px solid ${C.border}`,
                  color: C.textPrimary, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = C.gold }}
                onBlur={(e) => { e.target.style.borderColor = C.border }}
              />
            </label>

            {/* Telefone */}
            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Telefone</span>
              <input
                type="tel"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(mascaraTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: C.bgCard, border: `1.5px solid ${C.border}`,
                  color: C.textPrimary, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = C.gold }}
                onBlur={(e) => { e.target.style.borderColor = C.border }}
              />
            </label>

            {/* Resumo */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Resumo</p>
              <p style={{ color: C.textPrimary, fontSize: 13, margin: '4px 0' }}>
                {servicos.find((s) => s.id === servicoId)?.nome}
              </p>
              <p style={{ color: C.textSecondary, fontSize: 12, margin: '4px 0' }}>
                {profissionalId
                  ? profissionais.find((p) => p.id === profissionalId)?.nome
                  : slot?.profissional?.nome || 'Qualquer profissional'}
              </p>
              {slot && (
                <p style={{ color: C.textSecondary, fontSize: 12, margin: '4px 0' }}>
                  {formatarDataExibicao(slot.inicio)} às {formatarHora(slot.inicio)}
                </p>
              )}
            </div>

            <button
              onClick={confirmarDadosPessoais}
              disabled={!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10}
              style={{
                width: '100%', background: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10) ? '#1a3d2a' : '#25D366',
                color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                fontSize: 15, cursor: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10) ? 0.5 : 1,
                transition: 'opacity 0.2s, background 0.2s',
              }}
            >
              Confirmar pelo WhatsApp
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default AgendaPublica

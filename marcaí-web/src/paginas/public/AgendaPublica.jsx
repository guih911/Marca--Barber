import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Calendar, Clock, User, Scissors, ChevronLeft, Phone, CheckCircle } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const MARCAI_LOGO = '/logo.svg'

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

const formatarDataHoraCompleta = (iso) =>
  new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
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
  goldLight: 'rgba(184,137,77,0.25)',
  border: '#2a2a2a',
  borderStrong: '#333',
  borderHeader: '#222',
  textPrimary: '#ffffff',
  textSecondary: '#aaa',
  textDim: '#888',
  textOnGold: '#ffffff',
  green: '#25D366',
  greenDim: 'rgba(37,211,102,0.15)',
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

// ─── Chave localStorage por barbearia ───────────────────────────────────────
const chaveLocal = (slug) => `marcai_usuario_${slug}`

const lerDadosLocais = (slug) => {
  try {
    const salvo = localStorage.getItem(chaveLocal(slug))
    if (!salvo) return null
    const parsed = JSON.parse(salvo)
    if (parsed?.nome && parsed?.telefone) return parsed
    return null
  } catch {
    return null
  }
}

const salvarDadosLocais = (slug, dados) => {
  try {
    localStorage.setItem(chaveLocal(slug), JSON.stringify(dados))
  } catch {
    // localStorage indisponível — sem persistência
  }
}

const limparDadosLocais = (slug) => {
  try {
    localStorage.removeItem(chaveLocal(slug))
  } catch {}
}

// ─── Etapas: 1=Serviço 2=Profissional 3=Data/Hora 4=Dados pessoais 5=Sucesso ─

const AgendaPublica = () => {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  // Dados do tenant / catálogo
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [servicos, setServicos] = useState([])
  const [profissionais, setProfissionais] = useState([])

  // Seleções de agendamento
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [data, setData] = useState('')
  const [slot, setSlot] = useState(null)

  // Dados pessoais (novo cliente)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')

  // Dados salvos no localStorage
  const [dadosSalvos, setDadosSalvos] = useState(null)

  // Meus agendamentos
  const [meusAgs, setMeusAgs] = useState([])
  const [meusAgsCarregando, setMeusAgsCarregando] = useState(false)

  // Assinatura/plano do cliente (serviços inclusos)
  const [assinatura, setAssinatura] = useState(null)

  // Navegação e estado
  const [etapa, setEtapa] = useState(1)
  const [slots, setSlots] = useState([])
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [agendando, setAgendando] = useState(false)
  const [erroAgendamento, setErroAgendamento] = useState(null)
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null)

  const dias = gerarDias(new Date(), 14)

  // Usuário retornante (dados no localStorage)
  const clienteConhecido = !!(dadosSalvos?.nome && dadosSalvos?.telefone)
  // Etapas visíveis na barra de progresso (sem a tela de sucesso)
  const totalEtapas = clienteConhecido ? 3 : 4

  // ── Carrega info do tenant ───────────────────────────────────────────────
  useEffect(() => {
    // Prioridade: localStorage → URL params (gerados pelo bot com ?tel=&nome=)
    const dadosLocal = lerDadosLocais(slug)
    const telUrl = searchParams.get('tel') || ''
    const nomeUrl = searchParams.get('nome') || ''
    if (dadosLocal) {
      setDadosSalvos(dadosLocal)
    } else if (telUrl && nomeUrl) {
      const dadosUrl = { nome: decodeURIComponent(nomeUrl), telefone: decodeURIComponent(telUrl) }
      setDadosSalvos(dadosUrl)
      salvarDadosLocais(slug, dadosUrl) // migra URL params para localStorage
    }

    apiFetch(`/api/public/${slug}/info`)
      .then((dados) => {
        setTenant(dados.tenant)
        setServicos(dados.servicos)
        setProfissionais(dados.profissionais)
      })
      .catch((e) => setErro(e.message || 'Barbearia não encontrada'))
      .finally(() => setCarregando(false))
  }, [slug])

  // ── Carrega meus agendamentos e verifica assinatura quando cliente é conhecido
  useEffect(() => {
    const tel = dadosSalvos?.telefone
    if (!tel || !slug) return
    setMeusAgsCarregando(true)
    const telLimpo = tel.replace(/\D/g, '')

    // Busca agendamentos e assinatura em paralelo
    Promise.all([
      apiFetch(`/api/public/${slug}/meus-agendamentos?tel=${telLimpo}`).catch(() => []),
      apiFetch(`/api/public/${slug}/verificar-assinatura?tel=${telLimpo}`).catch(() => null),
    ]).then(([ags, assinaturaData]) => {
      setMeusAgs(ags || [])
      setAssinatura(assinaturaData?.temPlano ? assinaturaData.assinatura : null)
    }).finally(() => setMeusAgsCarregando(false))
  }, [dadosSalvos, slug])

  // ── Auto-seleciona hoje ao entrar na etapa 3 ─────────────────────────────
  useEffect(() => {
    if (etapa === 3 && !data && dias.length > 0) setData(dias[0])
  }, [etapa]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carrega slots ─────────────────────────────────────────────────────────
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

  // ── Confirma agendamento via API ─────────────────────────────────────────
  const confirmarAgendamento = async (nome, telefone) => {
    setAgendando(true)
    setErroAgendamento(null)
    try {
      const telLimpo = telefone.replace(/\D/g, '')
      const telComCodigo = telLimpo.startsWith('55') && telLimpo.length >= 12 ? telLimpo : `55${telLimpo}`

      const profIdFinal = profissionalId || slot?.profissional?.id
      if (!profIdFinal) throw new Error('Profissional não identificado. Volte e selecione um horário.')

      const dados = await apiFetch(`/api/public/${slug}/agendar`, {
        method: 'POST',
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telComCodigo,
          servicoId,
          profissionalId: profIdFinal,
          inicio: slot.inicio,
        }),
      })

      // Salva dados no localStorage para próximas visitas
      const dadosNovos = { nome: nome.trim(), telefone: telComCodigo }
      salvarDadosLocais(slug, dadosNovos)
      setDadosSalvos(dadosNovos)
      setAgendamentoConfirmado(dados)
      setEtapa(5)
      // Recarrega lista de agendamentos após confirmar
      apiFetch(`/api/public/${slug}/meus-agendamentos?tel=${telComCodigo}`)
        .then((d) => setMeusAgs(d || [])).catch(() => {})
    } catch (e) {
      setErroAgendamento(e.message || 'Não foi possível confirmar. Tente novamente.')
    } finally {
      setAgendando(false)
    }
  }

  // ── Avança após escolher slot ──────────────────────────────────────────
  const avancarAposSlot = () => {
    if (clienteConhecido) {
      // Usuário já conhecido — confirma direto com dados do localStorage
      confirmarAgendamento(dadosSalvos.nome, dadosSalvos.telefone)
    } else {
      setEtapa(4)
    }
  }

  // ── Confirmar na etapa 4 (dados pessoais) ─────────────────────────────
  const confirmarDadosPessoais = () => {
    confirmarAgendamento(nomeCliente, telefoneCliente)
  }

  // ── Resetar para novo agendamento ─────────────────────────────────────
  const reiniciar = () => {
    setServicoId('')
    setProfissionalId('')
    setData('')
    setSlot(null)
    setSlots([])
    setNomeCliente('')
    setTelefoneCliente('')
    setErroAgendamento(null)
    setAgendamentoConfirmado(null)
    setEtapa(1)
  }

  // ── Trocar usuário (limpa localStorage) ───────────────────────────────
  const trocarUsuario = () => {
    limparDadosLocais(slug)
    setDadosSalvos(null)
    setNomeCliente('')
    setTelefoneCliente('')
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
        <Loader2 size={32} className="spin" style={{ color: C.gold }} />
      </div>
    )
  }

  // ─── Erro ─────────────────────────────────────────────────────────────────
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

  // ─── Render de slots por período ─────────────────────────────────────────
  const renderGrupoSlots = (titulo, slotsGrupo) => {
    if (slotsGrupo.length === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {titulo}
        </p>
        <div className="slot-grid">
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

  const proximoDiaUtil = () => {
    const idx = dias.indexOf(data)
    if (idx < 0 || idx >= dias.length - 1) return null
    return dias[idx + 1]
  }

  // ─── Render principal ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .fade-in { animation: fadeIn 0.25s ease }
        @keyframes popIn { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }
        .pop-in { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) }
        .slot-pill { transition: background 0.15s, border-color 0.15s, transform 0.1s; }
        .slot-pill:hover { transform: scale(1.03); }
        .day-pill { transition: background 0.15s, border-color 0.15s; }
        .card-sel { transition: background 0.15s, border-color 0.15s; }
        .btn-back { transition: background 0.15s; }
        .btn-back:hover { background: #1e1e1e !important; }
        .btn-link { background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        input:focus { outline: none; border-color: #B8894D !important; }
        .public-header-shell,
        .public-appointments-shell,
        .public-progress-shell,
        .public-content-shell {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
        }
        .public-header-shell {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .public-brand-block {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }
        .public-brand-logo {
          width: 116px;
          max-width: 38vw;
          height: auto;
          display: block;
          object-fit: contain;
          flex-shrink: 0;
          filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.35));
        }
        .public-brand-copy {
          min-width: 0;
        }
        .public-brand-kicker {
          color: #B8894D;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin: 0 0 4px;
        }
        .public-user-badge {
          text-align: right;
          flex-shrink: 0;
        }
        .appointment-card {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .appointment-card-meta {
          text-align: right;
          flex-shrink: 0;
        }
        .slot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
          gap: 8px;
        }
        @media (max-width: 420px) {
          .public-header-shell {
            flex-wrap: wrap;
            align-items: flex-start;
          }
          .public-brand-block {
            width: 100%;
          }
          .public-brand-logo {
            width: 104px;
            max-width: 44vw;
          }
          .public-user-badge {
            width: 100%;
            text-align: left;
          }
          .appointment-card {
            flex-wrap: wrap;
          }
          .appointment-card-meta {
            width: 100%;
            padding-left: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '16px 20px' }}>
        <div className="public-header-shell">
          <div className="public-brand-block">
            <img
              src={MARCAI_LOGO}
              alt="Marcaí Barber"
              className="public-brand-logo"
            />
            <div className="public-brand-copy">
              <p className="public-brand-kicker">Agendamento online</p>
              <h1 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 15, lineHeight: 1.2, margin: 0 }}>
                {tenant?.nome}
              </h1>
              <p style={{ color: C.textDim, fontSize: 11, margin: '4px 0 0' }}>
                Escolha seu horário em poucos passos.
              </p>
            </div>
          </div>
          {/* Badge de usuário retornante */}
          {clienteConhecido && etapa < 5 && (
            <div className="public-user-badge">
              <p style={{ color: C.gold, fontSize: 12, fontWeight: 600, margin: 0 }}>
                Olá, {dadosSalvos.nome.split(' ')[0]}!
              </p>
              <button
                className="btn-link"
                onClick={trocarUsuario}
                style={{ color: C.textDim, fontSize: 10, textDecoration: 'underline' }}
              >
                Não é você?
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Meus agendamentos ── */}
      {clienteConhecido && etapa < 5 && (meusAgsCarregando || meusAgs.length > 0) && (
        <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '12px 20px' }}>
          <div className="public-appointments-shell">
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              📅 Meus agendamentos
            </p>
            {meusAgsCarregando ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="spin" style={{ color: C.gold }} />
                <span style={{ color: C.textDim, fontSize: 12 }}>Carregando...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meusAgs.map((ag) => (
                  <div key={ag.id} className="appointment-card" style={{
                    background: C.bgCard, border: `1px solid ${C.border}`,
                    borderRadius: 12, padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: C.goldDim, border: `1.5px solid ${C.gold}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {ag.profissionalAvatar
                        ? <img src={`${API_URL}${ag.profissionalAvatar}`} alt={ag.profissional} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Scissors size={14} style={{ color: C.gold }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ag.servico}
                      </p>
                      <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>
                        com {ag.profissional.split(' ')[0]}
                      </p>
                    </div>
                    <div className="appointment-card-meta">
                      <p style={{ color: C.gold, fontWeight: 700, fontSize: 12, margin: 0 }}>{ag.horaFormatada}</p>
                      <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>{ag.dataFormatada}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Barra de progresso (oculta na tela de sucesso) ── */}
      {etapa <= totalEtapas && (
        <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '10px 20px' }}>
          <div className="public-progress-shell" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
          <div className="public-progress-shell" style={{ marginTop: 6, display: 'flex', gap: 6 }}>
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
      <div className="public-content-shell" style={{ flex: 1, padding: '20px 16px 32px', boxSizing: 'border-box' }}>

        {/* ════ Etapa 1: Serviço ════ */}
        {etapa === 1 && (
          <div className="fade-in">
            <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scissors size={18} style={{ color: C.gold }} />
              Escolha o serviço
            </h2>
            {servicos.map((s) => {
              const sel = servicoId === s.id
              // Verifica se o serviço está incluso no plano do cliente
              const creditoPlano = assinatura?.servicosComCredito?.find((c) => c.servicoId === s.id)
              const inclusoNoPlano = creditoPlano && creditoPlano.creditosRestantes > 0
              return (
                <div
                  key={s.id}
                  className="card-sel"
                  onClick={() => {
                    const profsDoServico = profissionais.filter((p) => p.servicoIds.includes(s.id))
                    setServicoId(s.id)
                    setData('')
                    setSlot(null)
                    if (profsDoServico.length === 1) {
                      // Único profissional — auto-seleciona e pula etapa 2
                      setProfissionalId(profsDoServico[0].id)
                      setEtapa(3)
                    } else {
                      setProfissionalId('')
                      setEtapa(2)
                    }
                  }}
                  style={{
                    background: sel ? C.bgSelected : inclusoNoPlano ? 'rgba(37,211,102,0.08)' : C.bgCard,
                    border: `1.5px solid ${sel ? C.gold : inclusoNoPlano ? C.green : C.border}`,
                    borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>{s.nome}</p>
                      <p style={{ color: C.textDim, fontSize: 12, margin: '3px 0 0' }}>{s.duracaoMinutos} min</p>
                    </div>
                    {inclusoNoPlano ? (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>Incluso no plano</span>
                        <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>
                          {creditoPlano.creditosRestantes}x restante{creditoPlano.creditosRestantes > 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : s.precoCentavos != null && (
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
                onClick={() => {
                  // Se há só 1 profissional para o serviço, etapa 2 foi pulada — volta para etapa 1
                  const profsDoServico = profissionais.filter((p) => p.servicoIds.includes(servicoId))
                  setEtapa(profsDoServico.length === 1 ? 1 : 2)
                }}
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
                    <>
                      {/* Resumo do slot selecionado */}
                      <div style={{
                        background: C.bgCard, border: `1px solid ${C.border}`,
                        borderRadius: 12, padding: '12px 14px', marginTop: 8, marginBottom: 10,
                      }}>
                        <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Selecionado</p>
                        <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 13, margin: 0 }}>
                          {formatarDataExibicao(slot.inicio)} às {formatarHora(slot.inicio)}
                        </p>
                        {slot.profissional && (
                          <p style={{ color: C.textDim, fontSize: 12, margin: '2px 0 0' }}>
                            com {slot.profissional.nome}
                          </p>
                        )}
                      </div>

                      {/* Botão de continuar / confirmar */}
                      <button
                        onClick={avancarAposSlot}
                        disabled={agendando}
                        style={{
                          width: '100%', marginTop: 4,
                          background: agendando ? '#333' : C.gold,
                          color: '#fff', border: 'none', borderRadius: 12,
                          padding: '13px', fontWeight: 700, fontSize: 15,
                          cursor: agendando ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                      >
                        {agendando ? (
                          <><Loader2 size={18} className="spin" /> Confirmando...</>
                        ) : clienteConhecido ? (
                          `Confirmar agendamento`
                        ) : (
                          'Continuar'
                        )}
                      </button>

                      {/* Erro de agendamento */}
                      {erroAgendamento && (
                        <div style={{
                          marginTop: 12, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                          borderRadius: 10, padding: '10px 14px',
                        }}>
                          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>⚠️ {erroAgendamento}</p>
                        </div>
                      )}

                      {/* Info de usuário retornante */}
                      {clienteConhecido && (
                        <p style={{ color: C.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                          Agendando como <strong style={{ color: C.textSecondary }}>{dadosSalvos.nome.split(' ')[0]}</strong> •{' '}
                          <button className="btn-link" onClick={trocarUsuario} style={{ color: C.gold, fontSize: 12, textDecoration: 'underline' }}>
                            Não sou eu
                          </button>
                        </p>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ════ Etapa 4: Dados pessoais (apenas novos clientes) ════ */}
        {etapa === 4 && !clienteConhecido && (
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
              Apenas no primeiro agendamento. Nas próximas vezes, não precisará preencher novamente.
            </p>

            {/* Nome */}
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</span>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: C.bgCard, border: `1.5px solid ${C.border}`,
                  color: C.textPrimary, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
              />
            </label>

            {/* Telefone */}
            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>WhatsApp</span>
              <input
                type="tel"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(mascaraTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: C.bgCard, border: `1.5px solid ${C.border}`,
                  color: C.textPrimary, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
              />
              <span style={{ color: C.textDim, fontSize: 11, marginTop: 4, display: 'block' }}>
                A confirmação será enviada por WhatsApp
              </span>
            </label>

            {/* Resumo */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Resumo</p>
              <p style={{ color: C.textPrimary, fontSize: 13, margin: '4px 0', fontWeight: 600 }}>
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

            {/* Erro */}
            {erroAgendamento && (
              <div style={{
                marginBottom: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>⚠️ {erroAgendamento}</p>
              </div>
            )}

            <button
              onClick={confirmarDadosPessoais}
              disabled={!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10 || agendando}
              style={{
                width: '100%',
                background: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10 || agendando) ? '#1a1a1a' : C.gold,
                color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                fontSize: 15,
                cursor: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10 || agendando) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: (!nomeCliente.trim() || telefoneCliente.replace(/\D/g, '').length < 10) ? 0.5 : 1,
                transition: 'opacity 0.2s, background 0.2s',
              }}
            >
              {agendando ? (
                <><Loader2 size={18} className="spin" /> Confirmando...</>
              ) : (
                'Confirmar agendamento'
              )}
            </button>
          </div>
        )}

        {/* ════ Etapa 5: Sucesso ════ */}
        {etapa === 5 && agendamentoConfirmado && (
          <div className="fade-in" style={{ textAlign: 'center', paddingTop: 16 }}>
            {/* Ícone de sucesso animado */}
            <div className="pop-in" style={{
              width: 72, height: 72, borderRadius: '50%',
              background: C.greenDim, border: `2px solid ${C.green}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={36} style={{ color: C.green }} />
            </div>

            <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 20, margin: '0 0 6px' }}>
              Agendamento confirmado!
            </h2>
            <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 28px' }}>
              Até lá! Esperamos por você. 💈
            </p>

            {/* Card com detalhes */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '20px', marginBottom: 24, textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: C.goldDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Scissors size={16} style={{ color: C.gold }} />
                </div>
                <div>
                  <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Serviço</p>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>{agendamentoConfirmado.servico}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: C.goldDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <User size={16} style={{ color: C.gold }} />
                </div>
                <div>
                  <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Profissional</p>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>{agendamentoConfirmado.profissional}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: C.goldDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Calendar size={16} style={{ color: C.gold }} />
                </div>
                <div>
                  <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Data e hora</p>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>
                    {agendamentoConfirmado.inicioEm ? formatarDataHoraCompleta(agendamentoConfirmado.inicioEm) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso de WhatsApp */}
            <div style={{
              background: C.greenDim, border: `1px solid rgba(37,211,102,0.3)`,
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <p style={{ color: '#86efac', fontSize: 13, margin: 0, textAlign: 'left' }}>
                Enviamos uma confirmação para o seu WhatsApp. Fique atento aos lembretes!
              </p>
            </div>

            {/* Botão: Agendar outro */}
            <button
              onClick={reiniciar}
              style={{
                width: '100%', background: C.bgCard, color: C.textPrimary,
                border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Fazer outro agendamento
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default AgendaPublica

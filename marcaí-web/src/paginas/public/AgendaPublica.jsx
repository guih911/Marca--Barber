import { useState, useEffect } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Calendar, Clock, User, Scissors, ChevronLeft, Phone, CheckCircle, MapPin, Search, ExternalLink } from 'lucide-react'

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

const resolverMediaUrl = (path = '') => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const caminho = path.startsWith('/') ? path : `/${path}`
  const base = API_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  try {
    return new URL(caminho, `${base}/`).toString()
  } catch {
    return `${base}${caminho}`
  }
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

const formatarTelefoneExibicao = (valor = '') => {
  const digitos = valor.replace(/\D/g, '')
  const semCodigo = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return mascaraTelefone(semCodigo)
}

const formatarDataInput = (valor) => {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toISOString().slice(0, 10)
}

const normalizarTextoComparacao = (valor = '') =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

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

// ─── Tela de Login OTP ──────────────────────────────────────────────────────
const TelaLoginOTP = ({ slug, onLogin, tenant }) => {
  const [telefone, setTelefone] = useState('')
  const [codigo, setCodigo] = useState('')
  const [etapaOTP, setEtapaOTP] = useState('inicio') // inicio | codigo
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const enviarCodigo = async (tel) => {
    const digitos = (tel || telefone).replace(/\D/g, '')
    if (digitos.length < 10) { setErro('Telefone inválido'); return }
    setEnviando(true)
    setErro('')
    try {
      await apiFetch(`/api/public/${slug}/enviar-codigo`, {
        method: 'POST',
        body: JSON.stringify({ telefone: digitos }),
      })
      if (!tel) setTelefone(digitos)
      setEtapaOTP('codigo')
    } catch (e) {
      setErro(e.message || 'Erro ao enviar código')
    } finally {
      setEnviando(false)
    }
  }

  const verificarCodigo = async () => {
    if (codigo.length < 4) { setErro('Digite o código de 4 dígitos'); return }
    setEnviando(true)
    setErro('')
    try {
      const digitos = telefone.replace(/\D/g, '')
      const res = await apiFetch(`/api/public/${slug}/verificar-codigo`, {
        method: 'POST',
        body: JSON.stringify({ telefone: digitos, codigo }),
      })
      const telFinal = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
      const dados = { nome: res.cliente?.nome || '', telefone: telFinal, autenticado: true }
      salvarDadosLocais(slug, dados)
      onLogin(dados)
    } catch (e) {
      setErro(e.message || 'Código inválido')
    } finally {
      setEnviando(false)
    }
  }

  // Número do WhatsApp da barbearia (pra mostrar pro cliente)
  const whatsappNumero = tenant?.whatsappNumero
    ? tenant.whatsappNumero.replace(/^55/, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    : null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {tenant?.logoUrl ? (
            <img src={resolverMediaUrl(tenant.logoUrl)} alt={tenant.nome} style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', marginBottom: 12 }} />
          ) : (
            <div style={{ width: 56, height: 56, background: C.gold, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Scissors size={24} style={{ color: '#fff' }} />
            </div>
          )}
          <h1 style={{ color: C.textPrimary, fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{tenant?.nome || 'Barbearia'}</h1>
          <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Agende seu horário em segundos 💈</p>
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          {etapaOTP === 'inicio' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, background: C.greenDim, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Phone size={22} style={{ color: C.green }} />
                </div>
                <p style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Entre com seu WhatsApp</p>
                <p style={{ color: C.textDim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Digite seu número e enviaremos um código de verificação no seu WhatsApp. Rápido e seguro!
                </p>
              </div>

              <input
                value={telefone}
                onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={15}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`,
                  background: C.bg, color: C.textPrimary, fontSize: 16, outline: 'none', boxSizing: 'border-box',
                  textAlign: 'center', fontWeight: 600,
                }}
              />

              {erro && <p style={{ color: '#ef4444', fontSize: 12, margin: '10px 0 0', textAlign: 'center' }}>{erro}</p>}

              <button
                onClick={() => enviarCodigo()}
                disabled={enviando || telefone.replace(/\D/g, '').length < 10}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', marginTop: 16,
                  background: telefone.replace(/\D/g, '').length >= 10 ? C.green : C.border,
                  color: telefone.replace(/\D/g, '').length >= 10 ? '#fff' : C.textDim,
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {enviando ? (
                  <><Loader2 size={16} className="spin" /> Enviando...</>
                ) : (
                  'Receber código no WhatsApp'
                )}
              </button>

              <p style={{ color: C.textDim, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                Primeiro acesso? Sem problema! Vamos criar sua conta automaticamente.
              </p>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Código enviado! 📱</p>
                <p style={{ color: C.textDim, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Verifique seu WhatsApp e digite o código de 4 dígitos abaixo
                </p>
              </div>

              <input
                className="public-otp-input"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                inputMode="numeric"
                style={{
                  width: '100%', padding: '18px', borderRadius: 12, border: `1.5px solid ${codigo.length >= 4 ? C.gold : C.border}`,
                  background: C.bg, color: C.textPrimary, fontSize: 32, fontWeight: 700,
                  textAlign: 'center', letterSpacing: 16, outline: 'none', boxSizing: 'border-box',
                }}
                autoFocus
              />

              {erro && <p style={{ color: '#ef4444', fontSize: 12, margin: '10px 0 0', textAlign: 'center' }}>{erro}</p>}

              <button
                onClick={verificarCodigo}
                disabled={enviando || codigo.length < 4}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', marginTop: 16,
                  background: codigo.length >= 4 ? C.gold : C.border,
                  color: codigo.length >= 4 ? C.textOnGold : C.textDim,
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: enviando ? 0.6 : 1,
                }}
              >
                {enviando ? 'Verificando...' : 'Entrar'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
                <button
                  onClick={() => enviarCodigo(telefone)}
                  disabled={enviando}
                  style={{ background: 'transparent', border: 'none', color: C.gold, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Reenviar código
                </button>
                <button
                  onClick={() => { setEtapaOTP('inicio'); setCodigo(''); setErro('') }}
                  style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 12, cursor: 'pointer' }}
                >
                  Trocar número
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Etapas: 1=Serviço 2=Profissional 3=Data/Hora 4=Dados pessoais 5=Sucesso ─

const AgendaPublica = () => {
  const { slug } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Dados do tenant / catálogo
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [servicos, setServicos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [galeria, setGaleria] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('detalhes')
  const [buscaProfissional, setBuscaProfissional] = useState('')

  // Seleções de agendamento
  const [servicoId, setServicoId] = useState('')
  const [servicoIds, setServicoIds] = useState([])
  const [profissionalId, setProfissionalId] = useState('')
  const [data, setData] = useState('')
  const [slot, setSlot] = useState(null)

  // Dados pessoais (novo cliente)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [clienteConsultado, setClienteConsultado] = useState(null)
  const [consultandoCliente, setConsultandoCliente] = useState(false)
  const [erroCliente, setErroCliente] = useState(null)

  // Dados salvos no localStorage
  const [dadosSalvos, setDadosSalvos] = useState(null)
  const [perfilCliente, setPerfilCliente] = useState(null)
  const [perfilCarregando, setPerfilCarregando] = useState(false)
  const [perfilSalvando, setPerfilSalvando] = useState(false)
  const [perfilErro, setPerfilErro] = useState(null)
  const [pacotesCliente, setPacotesCliente] = useState([])

  // Meus agendamentos
  const [meusAgs, setMeusAgs] = useState([])
  const [meusAgsCarregando, setMeusAgsCarregando] = useState(false)

  // Histórico
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoLista, setHistoricoLista] = useState([])
  const [historicoCarregando, setHistoricoCarregando] = useState(false)

  // Assinatura/plano do cliente (serviços inclusos)
  const [assinatura, setAssinatura] = useState(null)

  // Reagendamento
  const [reagendando, setReagendando] = useState(null) // agendamento sendo reagendado
  const [reagendandoSlot, setReagendandoSlot] = useState(null)
  const [reagendandoData, setReagendandoData] = useState('')
  const [reagendandoSlots, setReagendandoSlots] = useState([])
  const [reagendandoCarregando, setReagendandoCarregando] = useState(false)
  const [reagendandoSalvando, setReagendandoSalvando] = useState(false)
  const [reagendandoErro, setReagendandoErro] = useState(null)

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
  const instagramRede = tenant?.redesSociais?.find((rede) => rede.tipo === 'instagram')
  const whatsappHref = tenant?.whatsappNumero ? `https://wa.me/${tenant.whatsappNumero.replace(/\D/g, '')}` : null
  const diaAtualNormalizado = normalizarTextoComparacao(
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }),
  )
  const telClienteLimpo = dadosSalvos?.telefone ? dadosSalvos.telefone.replace(/\D/g, '') : ''

  // ── Carrega info do tenant ───────────────────────────────────────────────
  useEffect(() => {
    // Prioridade: localStorage → URL params (gerados pelo bot com ?tel=&nome=)
    const dadosLocal = lerDadosLocais(slug)
    const telUrl = searchParams.get('tel') || ''
    const nomeUrl = searchParams.get('nome') || ''
    if (dadosLocal) {
      setDadosSalvos(dadosLocal)
      setTelefoneCliente(formatarTelefoneExibicao(dadosLocal.telefone || ''))
      setNomeCliente(dadosLocal.nome || '')
    } else if (telUrl && nomeUrl) {
      const dadosUrl = { nome: decodeURIComponent(nomeUrl), telefone: decodeURIComponent(telUrl) }
      setDadosSalvos(dadosUrl)
      setTelefoneCliente(formatarTelefoneExibicao(dadosUrl.telefone))
      setNomeCliente(dadosUrl.nome || '')
      salvarDadosLocais(slug, dadosUrl) // migra URL params para localStorage
    } else if (telUrl) {
      setTelefoneCliente(formatarTelefoneExibicao(decodeURIComponent(telUrl)))
    }

    apiFetch(`/api/public/${slug}/info`)
      .then((dados) => {
        setTenant(dados.tenant)
        setServicos(dados.servicos)
        setProfissionais(dados.profissionais)
        setGaleria(dados.galeria || [])
      })
      .catch((e) => setErro(e.message || 'Barbearia não encontrada'))
      .finally(() => setCarregando(false))
  }, [slug])

  useEffect(() => {
    if (location.pathname.endsWith('/details')) setAbaAtiva('detalhes')
    else if (location.pathname.endsWith('/profissionais')) setAbaAtiva('profissionais')
    else if (location.pathname.endsWith('/agendar')) setAbaAtiva('agendar')
    else if (location.pathname.endsWith('/conta')) setAbaAtiva('conta')
    else setAbaAtiva('detalhes')
  }, [location.pathname])

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

  useEffect(() => {
    if (!telClienteLimpo || !slug) return
    setPerfilCarregando(true)

    Promise.all([
      apiFetch(`/api/public/${slug}/perfil?tel=${telClienteLimpo}`).catch(() => null),
      apiFetch(`/api/public/${slug}/pacotes`).catch(() => []),
    ])
      .then(([perfilData, pacotesData]) => {
        if (perfilData) {
          setPerfilCliente({
            nome: perfilData.nome || '',
            telefone: perfilData.telefone || dadosSalvos?.telefone || '',
            email: perfilData.email || '',
            dataNascimento: formatarDataInput(perfilData.dataNascimento),
            instagram: perfilData.instagram || '',
            tipoCortePreferido: perfilData.tipoCortePreferido || '',
            preferencias: perfilData.preferencias || '',
          })
        }
        setPacotesCliente(Array.isArray(pacotesData) ? pacotesData : [])
      })
      .finally(() => setPerfilCarregando(false))
  }, [telClienteLimpo, slug, dadosSalvos?.telefone])

  // ── Auto-seleciona hoje ao entrar na etapa 3 ─────────────────────────────
  useEffect(() => {
    if (etapa === 3 && !data && dias.length > 0) setData(dias[0])
  }, [etapa]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carrega slots (combo ou single) ──────────────────────────────────────
  useEffect(() => {
    if (!data || (!servicoId && servicoIds.length === 0)) return
    setCarregandoSlots(true)
    setSlot(null)

    const isCombo = servicoIds.length > 1
    let url
    if (isCombo) {
      const params = new URLSearchParams({ servicoIds: servicoIds.join(','), data })
      if (profissionalId) params.set('profissionalId', profissionalId)
      url = `/api/public/${slug}/slots-combo?${params}`
    } else {
      const sid = servicoIds[0] || servicoId
      const params = new URLSearchParams({ servicoId: sid, data })
      if (profissionalId) params.set('profissionalId', profissionalId)
      url = `/api/public/${slug}/slots?${params}`
    }

    apiFetch(url)
      .then((s) => setSlots(s))
      .catch(() => setSlots([]))
      .finally(() => setCarregandoSlots(false))
  }, [data, servicoId, servicoIds, profissionalId, slug])

  // ── Reagendamento: carrega slots quando muda data ──────────────────────
  useEffect(() => {
    if (!reagendando || !reagendandoData) return
    setReagendandoCarregando(true)
    setReagendandoSlot(null)
    const params = new URLSearchParams({ servicoId: reagendando.servicoId, profissionalId: reagendando.profissionalId, data: reagendandoData })
    apiFetch(`/api/public/${slug}/slots?${params}`)
      .then((s) => setReagendandoSlots(s))
      .catch(() => setReagendandoSlots([]))
      .finally(() => setReagendandoCarregando(false))
  }, [reagendandoData, reagendando, slug])

  const iniciarReagendamento = (ag) => {
    setReagendando({ id: ag.id, servicoId: ag.servicoId, profissionalId: ag.profissionalId, servico: ag.servico, profissional: ag.profissional })
    setReagendandoData(gerarDias(new Date(), 14)[0])
    setReagendandoSlot(null)
    setReagendandoErro(null)
  }

  const confirmarReagendamento = async () => {
    if (!reagendandoSlot || !reagendando) return
    setReagendandoSalvando(true)
    setReagendandoErro(null)
    try {
      const telLimpo = dadosSalvos.telefone.replace(/\D/g, '')
      await apiFetch(`/api/public/${slug}/reagendar`, {
        method: 'POST',
        body: JSON.stringify({
          agendamentoId: reagendando.id,
          telefone: telLimpo,
          novoInicio: reagendandoSlot.inicio,
        }),
      })
      // Recarrega agendamentos
      const ags = await apiFetch(`/api/public/${slug}/meus-agendamentos?tel=${telLimpo}`).catch(() => [])
      setMeusAgs(ags || [])
      setReagendando(null)
    } catch (e) {
      setReagendandoErro(e.message || 'Não foi possível reagendar.')
    } finally {
      setReagendandoSalvando(false)
    }
  }

  const profsFiltrados = servicoIds.length > 0
    ? profissionais.filter((p) => servicoIds.every(id => p.servicoIds.includes(id)))
    : servicoId
      ? profissionais.filter((p) => p.servicoIds.includes(servicoId))
      : profissionais

  const termoProfissional = buscaProfissional.trim().toLowerCase()
  const profissionaisVisiveis = termoProfissional
    ? profsFiltrados.filter((p) => p.nome.toLowerCase().includes(termoProfissional))
    : profsFiltrados

  // ── Confirma agendamento via API ─────────────────────────────────────────
  const confirmarAgendamento = async (nome, telefone) => {
    setAgendando(true)
    setErroAgendamento(null)
    try {
      const telLimpo = telefone.replace(/\D/g, '')
      const telComCodigo = telLimpo.startsWith('55') && telLimpo.length >= 12 ? telLimpo : `55${telLimpo}`

      const profIdFinal = profissionalId || slot?.profissional?.id
      if (!profIdFinal) throw new Error('Profissional não identificado. Volte e selecione um horário.')

      const bodyAgendar = {
        nome: nome.trim(),
        telefone: telComCodigo,
        profissionalId: profIdFinal,
        inicio: slot.inicio,
      }
      if (servicoIds.length > 1) {
        bodyAgendar.servicoIds = servicoIds
      } else {
        bodyAgendar.servicoId = servicoIds[0] || servicoId
      }

      const dados = await apiFetch(`/api/public/${slug}/agendar`, {
        method: 'POST',
        body: JSON.stringify(bodyAgendar),
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

  const consultarClientePorTelefone = async () => {
    const telLimpo = telefoneCliente.replace(/\D/g, '')
    if (telLimpo.length < 10) {
      setErroCliente('Informe um WhatsApp válido.')
      return
    }

    setConsultandoCliente(true)
    setErroCliente(null)
    try {
      const dados = await apiFetch(`/api/public/${slug}/cliente?tel=${telLimpo}`)
      if (dados?.existe && dados.cliente) {
        setClienteConsultado({ existe: true, nome: dados.cliente.nome, telefone: dados.cliente.telefone })
        setNomeCliente(dados.cliente.nome || '')
      } else {
        setClienteConsultado({ existe: false, telefone: telLimpo })
        setNomeCliente('')
      }
    } catch (e) {
      setErroCliente(e.message || 'Não foi possível validar esse número.')
    } finally {
      setConsultandoCliente(false)
    }
  }

  const editarTelefone = () => {
    setClienteConsultado(null)
    setErroCliente(null)
    if (!dadosSalvos) setNomeCliente('')
  }

  // ── Avança após escolher slot ──────────────────────────────────────────
  const avancarAposSlot = () => {
    if (clienteConhecido) {
      // Usuário já conhecido — confirma direto com dados do localStorage
      confirmarAgendamento(dadosSalvos.nome, dadosSalvos.telefone)
    } else {
      setClienteConsultado(null)
      setErroCliente(null)
      setEtapa(4)
    }
  }

  // ── Confirmar na etapa 4 (dados pessoais) ─────────────────────────────
  const confirmarDadosPessoais = () => {
    if (!clienteConsultado) {
      setErroCliente('Valide seu WhatsApp antes de confirmar.')
      return
    }
    confirmarAgendamento(nomeCliente, telefoneCliente)
  }

  const salvarPerfilCliente = async () => {
    if (!perfilCliente || !telClienteLimpo) return
    setPerfilSalvando(true)
    setPerfilErro(null)
    try {
      const atualizado = await apiFetch(`/api/public/${slug}/perfil`, {
        method: 'PATCH',
        body: JSON.stringify({
          tel: telClienteLimpo,
          telefone: telClienteLimpo,
          nome: perfilCliente.nome,
          email: perfilCliente.email,
          dataNascimento: perfilCliente.dataNascimento || null,
          instagram: perfilCliente.instagram,
          tipoCortePreferido: perfilCliente.tipoCortePreferido,
          preferencias: perfilCliente.preferencias,
        }),
      })

      const novosDados = {
        nome: atualizado.nome || dadosSalvos?.nome || '',
        telefone: atualizado.telefone || dadosSalvos?.telefone || '',
      }
      salvarDadosLocais(slug, novosDados)
      setDadosSalvos(novosDados)
      setPerfilCliente({
        nome: atualizado.nome || '',
        telefone: atualizado.telefone || '',
        email: atualizado.email || '',
        dataNascimento: formatarDataInput(atualizado.dataNascimento),
        instagram: atualizado.instagram || '',
        tipoCortePreferido: atualizado.tipoCortePreferido || '',
        preferencias: atualizado.preferencias || '',
      })
    } catch (e) {
      setPerfilErro(e.message || 'Não foi possível salvar seu perfil.')
    } finally {
      setPerfilSalvando(false)
    }
  }

  const avancarEtapaServico = () => {
    const primeiroId = servicoIds[0]
    setServicoId(primeiroId)
    const profPreSelecionadoValido = profissionais.some((p) => p.id === profissionalId && servicoIds.every((id) => p.servicoIds.includes(id)))
    if (!profPreSelecionadoValido) setProfissionalId('')
    setBuscaProfissional('')
    setEtapa(2)
  }

  const avancarEtapaProfissional = () => {
    setData('')
    setSlot(null)
    setEtapa(3)
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
    setClienteConsultado(null)
    setErroCliente(null)
    setErroAgendamento(null)
    setAgendamentoConfirmado(null)
    setEtapa(1)
    setAbaAtiva('agendar')
  }

  // ── Trocar usuário (limpa localStorage) ───────────────────────────────
  const trocarUsuario = () => {
    limparDadosLocais(slug)
    setDadosSalvos(null)
    setNomeCliente('')
    setTelefoneCliente('')
    setClienteConsultado(null)
    setErroCliente(null)
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
        .public-tabs-shell {
          display: flex;
          gap: 8px;
        }
        .details-hero {
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at top left, rgba(184,137,77,0.28), transparent 38%), linear-gradient(145deg, #1b1712 0%, #121212 58%, #0d0d0d 100%);
          border: 1px solid ${C.borderStrong};
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
        }
        .details-hero-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .details-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .details-contact-grid,
        .details-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .details-hours-row {
          display: grid;
          grid-template-columns: minmax(118px, 148px) 1fr;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 16px;
        }
        .details-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }
        .details-gallery-card-feature {
          grid-column: span 2;
        }
        .details-gallery-media-feature {
          aspect-ratio: 1.8 / 1;
        }
        .details-gallery-media {
          aspect-ratio: 1 / 1;
        }
        @media (max-width: 520px) {
          .public-content-shell {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
        @media (max-width: 420px) {
          .public-content-shell {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
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
          .public-tabs-shell {
            gap: 6px;
          }
          .details-hero {
            border-radius: 20px;
            padding: 16px;
          }
          .details-hero-top {
            align-items: flex-start;
          }
          .details-stats-grid {
            grid-template-columns: 1fr;
          }
          .details-contact-grid,
          .details-info-grid {
            grid-template-columns: 1fr;
          }
          .details-hours-row {
            grid-template-columns: 1fr;
            gap: 10px;
            padding: 12px;
          }
          .details-gallery-grid {
            grid-template-columns: 1fr 1fr;
          }
          .details-gallery-card-feature {
            grid-column: span 2;
          }
          .public-otp-input {
            font-size: 28px !important;
            letter-spacing: 12px !important;
            padding: 16px !important;
          }
        }
        @media (max-width: 360px) {
          .public-brand-logo {
            width: 92px;
          }
          .public-tabs-shell button {
            font-size: 11px !important;
            padding: 10px 8px !important;
          }
          .details-hero-top {
            flex-direction: column;
          }
          .details-gallery-grid {
            grid-template-columns: 1fr;
          }
          .details-gallery-card-feature {
            grid-column: span 1;
          }
          .details-gallery-media-feature,
          .details-gallery-media {
            aspect-ratio: 1 / 1;
          }
          .public-otp-input {
            font-size: 24px !important;
            letter-spacing: 10px !important;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '16px 20px' }}>
        <div className="public-header-shell">
          <div className="public-brand-block">
            <img
              src={tenant?.logoUrl ? resolverMediaUrl(tenant.logoUrl) : MARCAI_LOGO}
              alt={tenant?.nome || 'Marcaí Barber'}
              className="public-brand-logo"
            />
            <div className="public-brand-copy">
              <p className="public-brand-kicker">
                {abaAtiva === 'detalhes'
                  ? 'Detalhes da barbearia'
                  : abaAtiva === 'profissionais'
                    ? 'Escolha seu barbeiro'
                    : abaAtiva === 'conta'
                      ? 'Área do cliente'
                      : 'Agendamento online'}
              </p>
              <h1 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 15, lineHeight: 1.2, margin: 0 }}>
                {tenant?.nome}
              </h1>
              <p style={{ color: C.textDim, fontSize: 11, margin: '4px 0 0' }}>
                {tenant?.horarioFuncionamento || 'Escolha seu horário em poucos passos.'}
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

      <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '10px 20px' }}>
        <div className="public-content-shell public-tabs-shell">
          {[
            { id: 'detalhes', label: 'Detalhes' },
            { id: 'profissionais', label: 'Profissionais' },
            { id: 'agendar', label: 'Agendar' },
            { id: 'conta', label: 'Minha conta' },
          ].map((aba) => {
            const ativa = abaAtiva === aba.id
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${ativa ? C.gold : C.border}`,
                  background: ativa ? C.bgSelected : C.bgCard,
                  color: ativa ? C.gold : C.textSecondary,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {aba.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Meus agendamentos + Histórico ── */}
      {clienteConhecido && etapa < 5 && abaAtiva === 'agendar' && (
        <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.borderHeader}`, padding: '12px 20px' }}>
          <div className="public-appointments-shell">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                📅 Meus agendamentos
              </p>
              <button
                onClick={() => {
                  setHistoricoAberto(true)
                  if (historicoLista.length === 0) {
                    setHistoricoCarregando(true)
                    const telLimpo = (dadosSalvos?.telefone || '').replace(/\D/g, '')
                    apiFetch(`/api/public/${slug}/historico?tel=${telLimpo}`)
                      .then(d => setHistoricoLista(d || []))
                      .catch(() => setHistoricoLista([]))
                      .finally(() => setHistoricoCarregando(false))
                  }
                }}
                style={{
                  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '4px 10px', fontSize: 10, fontWeight: 600, color: C.textDim,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                }}
              >
                <Clock size={10} style={{ marginRight: 4 }} />
                Histórico
              </button>
            </div>
            {meusAgsCarregando ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="spin" style={{ color: C.gold }} />
                <span style={{ color: C.textDim, fontSize: 12 }}>Carregando...</span>
              </div>
            ) : meusAgs.length === 0 ? (
              <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Nenhum agendamento futuro. Agende abaixo! 👇</p>
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
                        ? <img src={resolverMediaUrl(ag.profissionalAvatar)} alt={ag.profissional} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    <div className="appointment-card-meta" style={{ textAlign: 'right' }}>
                      <p style={{ color: C.gold, fontWeight: 700, fontSize: 12, margin: 0 }}>{ag.horaFormatada}</p>
                      <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>{ag.dataFormatada}</p>
                      <button
                        onClick={() => iniciarReagendamento(ag)}
                        style={{
                          marginTop: 4, padding: '3px 10px', fontSize: 10, fontWeight: 700,
                          background: 'transparent', color: C.gold, border: `1px solid ${C.gold}`,
                          borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                        }}
                      >
                        Reagendar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de histórico ── */}
      {historicoAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setHistoricoAberto(false)}>
          <div style={{
            background: C.bg, borderTop: `2px solid ${C.gold}`, borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', padding: '20px 16px 24px',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0 }}>Histórico de atendimentos</p>
              <button onClick={() => setHistoricoAberto(false)} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {historicoCarregando ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8 }}>
                <Loader2 size={16} className="spin" style={{ color: C.gold }} />
                <span style={{ color: C.textDim, fontSize: 13 }}>Carregando...</span>
              </div>
            ) : historicoLista.length === 0 ? (
              <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 30 }}>Nenhum atendimento anterior encontrado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historicoLista.map((h) => (
                  <div key={h.id} style={{
                    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: h.status === 'CONCLUIDO' ? 'rgba(37,211,102,0.15)' : h.status === 'CANCELADO' ? 'rgba(239,68,68,0.15)' : C.goldDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {h.status === 'CONCLUIDO' ? <CheckCircle size={16} style={{ color: C.green }} />
                        : h.status === 'CANCELADO' ? <Calendar size={16} style={{ color: '#ef4444' }} />
                        : <Scissors size={14} style={{ color: C.gold }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 13, margin: 0 }}>{h.servico}</p>
                      <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>
                        {h.profissional} — {h.dataFormatada}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {h.nota && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', marginBottom: 2 }}>
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{ color: n <= h.nota ? '#facc15' : C.border, fontSize: 10 }}>★</span>
                          ))}
                        </div>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: h.status === 'CONCLUIDO' ? 'rgba(37,211,102,0.15)' : h.status === 'CANCELADO' ? 'rgba(239,68,68,0.15)' : C.goldDim,
                        color: h.status === 'CONCLUIDO' ? C.green : h.status === 'CANCELADO' ? '#ef4444' : C.gold,
                      }}>
                        {h.status === 'CONCLUIDO' ? 'Concluído' : h.status === 'CANCELADO' ? 'Cancelado' : 'Faltou'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de reagendamento ── */}
      {reagendando && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setReagendando(null)}>
          <div style={{
            background: C.bg, borderTop: `2px solid ${C.gold}`, borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', padding: '20px 16px 24px',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0 }}>Reagendar</p>
                <p style={{ color: C.textDim, fontSize: 12, margin: '2px 0 0' }}>
                  {reagendando.servico} com {reagendando.profissional?.split(' ')[0]}
                </p>
              </div>
              <button onClick={() => setReagendando(null)} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Seletor de dia */}
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Escolha o novo dia</p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              {gerarDias(new Date(), 14).map((d) => {
                const dt = new Date(d + 'T12:00:00')
                const sel = reagendandoData === d
                return (
                  <button key={d} onClick={() => setReagendandoData(d)} style={{
                    flexShrink: 0, width: 52, padding: '8px 0', borderRadius: 10, border: sel ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: sel ? C.bgSelected : 'transparent', cursor: 'pointer', textAlign: 'center',
                  }}>
                    <p style={{ color: sel ? C.gold : C.textDim, fontSize: 10, fontWeight: 600, margin: 0 }}>{DIAS_SEMANA[dt.getDay()]}</p>
                    <p style={{ color: sel ? C.textPrimary : C.textSecondary, fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{dt.getDate()}</p>
                    <p style={{ color: sel ? C.gold : C.textDim, fontSize: 9, margin: '1px 0 0' }}>{MESES[dt.getMonth()]}</p>
                  </button>
                )
              })}
            </div>

            {/* Slots disponíveis */}
            {reagendandoCarregando ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }}>
                <Loader2 size={16} className="spin" style={{ color: C.gold }} />
                <span style={{ color: C.textDim, fontSize: 13 }}>Carregando horários...</span>
              </div>
            ) : reagendandoSlots.length === 0 ? (
              <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum horário disponível neste dia.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {reagendandoSlots.map((s, i) => {
                  const sel = reagendandoSlot?.inicio === s.inicio
                  return (
                    <button key={i} onClick={() => setReagendandoSlot(s)} style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: sel ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
                      background: sel ? C.bgSelected : 'transparent',
                      color: sel ? C.gold : C.textSecondary,
                    }}>
                      {formatarHora(s.inicio)}
                    </button>
                  )
                })}
              </div>
            )}

            {reagendandoErro && (
              <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{reagendandoErro}</p>
            )}

            <button
              onClick={confirmarReagendamento}
              disabled={!reagendandoSlot || reagendandoSalvando}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14,
                background: reagendandoSlot ? C.gold : C.border, color: reagendandoSlot ? C.textOnGold : C.textDim,
                cursor: reagendandoSlot ? 'pointer' : 'not-allowed', opacity: reagendandoSalvando ? 0.6 : 1,
              }}
            >
              {reagendandoSalvando ? 'Reagendando...' : 'Confirmar novo horário'}
            </button>
          </div>
        </div>
      )}

      {/* ── Barra de progresso (oculta na tela de sucesso) ── */}
      {abaAtiva === 'agendar' && etapa <= totalEtapas && (
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
      <div className="public-content-shell" style={{ flex: 1, padding: '20px 16px 112px', boxSizing: 'border-box' }}>

        {abaAtiva === 'detalhes' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="details-hero">
              <div style={{
                position: 'absolute',
                top: -38,
                right: -24,
                width: 132,
                height: 132,
                borderRadius: '50%',
                background: 'rgba(184,137,77,0.08)',
                filter: 'blur(2px)',
              }} />
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
                <div className="details-hero-top">
                  <img
                    src={tenant?.logoUrl ? resolverMediaUrl(tenant.logoUrl) : MARCAI_LOGO}
                    alt={tenant?.nome}
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 22,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.24)',
                      background: '#0f0f0f',
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#d5b38a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6, margin: 0 }}>Sua próxima visita começa aqui</p>
                    <h2 style={{ color: C.textPrimary, fontSize: 24, lineHeight: 1.1, margin: '6px 0 8px' }}>{tenant?.nome}</h2>
                    {tenant?.horarioFuncionamento && (
                      <p style={{ color: '#d2d2d2', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                        Atendimento {tenant.horarioFuncionamento}
                      </p>
                    )}
                  </div>
                </div>

                <div className="details-stats-grid">
                  <div style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: C.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 6px' }}>Profissionais</p>
                    <p style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, margin: 0 }}>{profissionais.length}</p>
                  </div>
                  <div style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: C.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 6px' }}>Serviços</p>
                    <p style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, margin: 0 }}>{servicos.length}</p>
                  </div>
                  <div style={{ padding: 14, borderRadius: 16, background: 'rgba(184,137,77,0.1)', border: '1px solid rgba(184,137,77,0.22)' }}>
                    <p style={{ color: '#d7b389', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 6px' }}>Experiência</p>
                    <p style={{ color: C.textPrimary, fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {tenant?.comodidades?.length ? `${tenant.comodidades.length} comodidades` : 'Atendimento premium'}
                    </p>
                  </div>
                </div>

                {(tenant?.endereco || whatsappHref || instagramRede || tenant?.linkMaps) && (
                  <div className="details-contact-grid">
                    {(tenant?.endereco || tenant?.linkMaps) && (
                      <div style={{ padding: 16, borderRadius: 18, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(184,137,77,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MapPin size={17} style={{ color: C.gold }} />
                          </div>
                          <div>
                            <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>Onde estamos</p>
                            {tenant?.endereco && <p style={{ color: '#d2d2d2', fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>{tenant.endereco}</p>}
                            {tenant?.linkMaps && (
                              <a href={tenant.linkMaps} target="_blank" rel="noreferrer" style={{ color: '#f0c893', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, textDecoration: 'none', fontWeight: 700, flexWrap: 'wrap' }}>
                                Abrir no mapa <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(whatsappHref || instagramRede) && (
                      <div style={{ padding: 16, borderRadius: 18, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>Contato rápido</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {whatsappHref && (
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                flex: 1,
                                minWidth: 140,
                                padding: '12px 14px',
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, rgba(37,211,102,0.2), rgba(37,211,102,0.08))',
                                border: '1px solid rgba(37,211,102,0.28)',
                                color: '#b6f3c9',
                                fontSize: 13,
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                            >
                              <Phone size={15} /> WhatsApp
                            </a>
                          )}
                          {instagramRede && (
                            <a
                              href={instagramRede.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                flex: 1,
                                minWidth: 140,
                                padding: '12px 14px',
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, rgba(184,137,77,0.22), rgba(184,137,77,0.07))',
                                border: '1px solid rgba(184,137,77,0.32)',
                                color: '#f0c893',
                                fontSize: 13,
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                            >
                              <ExternalLink size={15} /> Instagram
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {Array.isArray(tenant?.horarioDetalhado) && tenant.horarioDetalhado.length > 0 && (
              <div style={{ background: 'linear-gradient(180deg, rgba(22,22,22,0.98), rgba(18,18,18,0.98))', border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div>
                    <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, margin: 0 }}>Rotina da barbearia</p>
                    <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 18, margin: '4px 0 0' }}>Horário de funcionamento</p>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 999, background: C.goldDim, color: '#f0c893', fontSize: 11, fontWeight: 700 }}>
                    Atualizado por dia
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tenant.horarioDetalhado.map((dia) => {
                    const isHoje = normalizarTextoComparacao(dia.dia) === diaAtualNormalizado
                    return (
                      <div
                        className="details-hours-row"
                        key={dia.dia}
                        style={{
                          background: isHoje ? 'rgba(184,137,77,0.12)' : 'rgba(255,255,255,0.02)',
                          border: isHoje ? '1px solid rgba(184,137,77,0.24)' : `1px solid ${C.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p style={{ color: C.textPrimary, fontSize: 13, fontWeight: 700, margin: 0 }}>{dia.dia}</p>
                          {isHoje && <span style={{ color: '#f0c893', fontSize: 11, fontWeight: 700 }}>Hoje</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {dia.fechado ? (
                            <span style={{ color: C.textDim, fontSize: 12, fontWeight: 600 }}>Fechado</span>
                          ) : (
                            dia.faixas.map((faixa, index) => (
                              <span
                                key={`${dia.dia}-${index}`}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 999,
                                  background: 'rgba(0,0,0,0.18)',
                                  border: `1px solid ${C.border}`,
                                  color: C.textSecondary,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {faixa.inicio} às {faixa.fim}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="details-info-grid" style={{ gap: 14 }}>
              {Array.isArray(tenant?.comodidades) && tenant.comodidades.length > 0 && (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Comodidades</p>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>Tudo o que melhora sua experiência durante o atendimento.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tenant.comodidades.map((item) => (
                      <span key={item} style={{ padding: '9px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 12, fontWeight: 600 }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(tenant?.pagamentos) && tenant.pagamentos.length > 0 && (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Formas de pagamento</p>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>Escolha a forma mais prática para fechar seu atendimento.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tenant.pagamentos.map((item) => (
                      <span key={item} style={{ padding: '9px 11px', borderRadius: 999, background: 'rgba(184,137,77,0.08)', border: '1px solid rgba(184,137,77,0.18)', color: '#e9c08e', fontSize: 12, fontWeight: 700 }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(tenant?.redesSociais) && tenant.redesSociais.length > 0 && (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Redes sociais</p>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>Veja trabalhos recentes, novidades e acompanhe a rotina da casa.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tenant.redesSociais.map((rede) => (
                      <a
                        key={rede.tipo}
                        href={rede.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${C.border}`,
                          color: C.textSecondary,
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {rede.label} <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {Array.isArray(galeria) && galeria.length > 0 && (
              <div style={{ background: 'linear-gradient(180deg, rgba(22,22,22,0.98), rgba(16,16,16,0.98))', border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, margin: 0 }}>Inspiração visual</p>
                    <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 18, margin: '4px 0 0' }}>Galeria de trabalhos</p>
                  </div>
                  <div style={{ color: C.textDim, fontSize: 12 }}>{galeria.length} fotos</div>
                </div>
                <div className="details-gallery-grid">
                  {galeria.map((foto, index) => (
                    <div
                      key={foto.id}
                      className={index === 0 ? 'details-gallery-card-feature' : ''}
                      style={{
                        borderRadius: 18,
                        overflow: 'hidden',
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      <div className={index === 0 ? 'details-gallery-media-feature' : 'details-gallery-media'} style={{ background: '#0f0f0f' }}>
                        <img src={resolverMediaUrl(foto.fotoUrl)} alt={foto.titulo || foto.servicoNome || 'Foto da galeria'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      {(foto.titulo || foto.servicoNome || foto.profissional) && (
                        <div style={{ padding: 12 }}>
                          <p style={{ color: C.textPrimary, fontSize: 13, fontWeight: 700, margin: 0 }}>{foto.titulo || foto.servicoNome || 'Trabalho recente'}</p>
                          {(foto.profissional || foto.servicoNome) && (
                            <p style={{ color: C.textDim, fontSize: 11, margin: '5px 0 0' }}>{[foto.profissional, foto.servicoNome].filter(Boolean).join(' • ')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setAbaAtiva('agendar')}
              style={{
                width: '100%',
                padding: '16px 0',
                borderRadius: 16,
                border: 'none',
                background: 'linear-gradient(135deg, #c39257, #a9783f)',
                color: C.textOnGold,
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 18px 26px rgba(184,137,77,0.18)',
              }}
            >
              Ir para o agendamento
            </button>
          </div>
        )}

        {abaAtiva === 'conta' && (
          clienteConhecido ? (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, margin: 0 }}>Minha conta</p>
                    <h2 style={{ color: C.textPrimary, fontSize: 20, margin: '6px 0 0' }}>{perfilCliente?.nome || dadosSalvos?.nome || 'Cliente'}</h2>
                  </div>
                  <button
                    className="btn-link"
                    onClick={trocarUsuario}
                    style={{ color: C.textDim, fontSize: 12, textDecoration: 'underline' }}
                  >
                    Sair
                  </button>
                </div>

                {perfilCarregando && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textDim, fontSize: 12 }}>
                    <Loader2 size={14} className="spin" style={{ color: C.gold }} />
                    Carregando seu perfil...
                  </div>
                )}

                {perfilCliente && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</span>
                      <input
                        type="text"
                        value={perfilCliente.nome}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, nome: e.target.value }))}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>WhatsApp</span>
                      <input
                        type="text"
                        value={formatarTelefoneExibicao(perfilCliente.telefone || dadosSalvos?.telefone || '')}
                        disabled
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bgCard, border: `1px solid ${C.border}`, color: C.textDim, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>E-mail</span>
                      <input
                        type="email"
                        value={perfilCliente.email}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="voce@email.com"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Data de nascimento</span>
                      <input
                        type="date"
                        value={perfilCliente.dataNascimento}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, dataNascimento: e.target.value }))}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Instagram</span>
                      <input
                        type="text"
                        value={perfilCliente.instagram}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, instagram: e.target.value }))}
                        placeholder="@seuperfil"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Corte preferido</span>
                      <input
                        type="text"
                        value={perfilCliente.tipoCortePreferido}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, tipoCortePreferido: e.target.value }))}
                        placeholder="Ex: degradê baixo"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box' }}
                      />
                    </label>

                    <label style={{ display: 'block' }}>
                      <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Preferências</span>
                      <textarea
                        value={perfilCliente.preferencias}
                        onChange={(e) => setPerfilCliente((prev) => ({ ...prev, preferencias: e.target.value }))}
                        placeholder="Ex: prefiro atendimento à noite"
                        rows={3}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </label>

                    {perfilErro && <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{perfilErro}</p>}

                    <button
                      onClick={salvarPerfilCliente}
                      disabled={perfilSalvando || !perfilCliente.nome.trim()}
                      style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: perfilSalvando ? C.border : C.gold, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {perfilSalvando ? 'Salvando...' : 'Salvar perfil'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
                <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 10px' }}>Meus agendamentos</p>
                {meusAgsCarregando ? (
                  <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Carregando...</p>
                ) : meusAgs.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Você não tem horários futuros no momento.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {meusAgs.map((ag) => (
                      <div key={ag.id} style={{ padding: 12, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                        <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 13, margin: 0 }}>{ag.servico}</p>
                        <p style={{ color: C.textSecondary, fontSize: 12, margin: '4px 0 0' }}>{ag.profissional}</p>
                        <p style={{ color: C.gold, fontSize: 12, margin: '4px 0 0' }}>{ag.dataFormatada} às {ag.horaFormatada}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: 0 }}>Histórico</p>
                  <button
                    onClick={() => {
                      setHistoricoAberto(true)
                      if (historicoLista.length === 0) {
                        setHistoricoCarregando(true)
                        apiFetch(`/api/public/${slug}/historico?tel=${telClienteLimpo}`)
                          .then((d) => setHistoricoLista(d || []))
                          .catch(() => setHistoricoLista([]))
                          .finally(() => setHistoricoCarregando(false))
                      }
                    }}
                    style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, color: C.gold, fontSize: 12, fontWeight: 700, padding: '8px 10px', cursor: 'pointer' }}
                  >
                    Ver histórico
                  </button>
                </div>
                <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Acompanhe seus atendimentos anteriores e avaliações.</p>
              </div>

              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
                <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 10px' }}>Minha assinatura</p>
                {assinatura ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ padding: 12, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                      <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 13, margin: 0 }}>{assinatura.planoNome || 'Plano ativo'}</p>
                      <p style={{ color: C.textDim, fontSize: 12, margin: '4px 0 0' }}>Créditos disponíveis neste ciclo</p>
                    </div>
                    {assinatura.servicosComCredito?.map((item) => (
                      <div key={item.servicoId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                        <span style={{ color: C.textSecondary, fontSize: 12 }}>{item.servicoNome}</span>
                        <span style={{ color: C.gold, fontWeight: 700, fontSize: 12 }}>{item.creditosRestantes} restante(s)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Você não tem assinatura ativa nesta barbearia.</p>
                )}
              </div>

              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
                <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 10px' }}>Combos e pacotes</p>
                {pacotesCliente.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Nenhum combo ativo disponível no momento.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pacotesCliente.map((pacote) => (
                      <div key={pacote.id} style={{ padding: 12, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                        <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 13, margin: 0 }}>{pacote.nome}</p>
                        {pacote.descricao && <p style={{ color: C.textDim, fontSize: 12, margin: '4px 0 0' }}>{pacote.descricao}</p>}
                        <p style={{ color: C.gold, fontSize: 12, margin: '6px 0 0' }}>
                          {pacote.tipo === 'DESCONTO' && pacote.descontoPorcent
                            ? `${pacote.descontoPorcent}% de desconto`
                            : formatarReais(pacote.precoCentavos)}
                        </p>
                        <p style={{ color: C.textSecondary, fontSize: 12, margin: '6px 0 0' }}>{pacote.servicos.map((s) => s.nome).join(' + ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <TelaLoginOTP
              slug={slug}
              tenant={tenant}
              onLogin={(dados) => {
                setDadosSalvos(dados)
                setTelefoneCliente(formatarTelefoneExibicao(dados.telefone || ''))
                setNomeCliente(dados.nome || '')
              }}
            />
          )
        )}

        {abaAtiva === 'profissionais' && (
          <div className="fade-in">
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} style={{ color: C.gold }} />
                Profissionais
              </h2>
              <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>Veja quem atende e escolha com quem quer agendar.</p>
            </div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Buscar profissional</span>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ color: C.textDim, position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  value={buscaProfissional}
                  onChange={(e) => setBuscaProfissional(e.target.value)}
                  placeholder="Digite o nome do profissional"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    borderRadius: 12,
                    background: C.bgCard,
                    border: `1.5px solid ${C.border}`,
                    color: C.textPrimary,
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profissionaisVisiveis.length === 0 && (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, textAlign: 'center' }}>
                  <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Nenhum profissional encontrado.</p>
                </div>
              )}
              {profissionaisVisiveis.map((p) => (
                <div key={p.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {p.avatarUrl ? (
                    <img src={resolverMediaUrl(p.avatarUrl)} alt={p.nome} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${C.border}` }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.bgSelected, border: `1px solid ${C.gold}`, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {p.nome[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>{p.nome}</p>
                    <p style={{ color: C.textDim, fontSize: 12, margin: '4px 0 0' }}>Profissional disponível para agendamento.</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfissionalId(p.id)
                      setAbaAtiva('agendar')
                      setEtapa(1)
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${C.gold}`,
                      background: C.bgSelected,
                      color: C.gold,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Agendar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ Etapa 1: Serviço ════ */}
        {abaAtiva === 'agendar' && etapa === 1 && (
          <div className="fade-in">
            <h2 style={{ color: C.textPrimary, fontWeight: 700, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scissors size={18} style={{ color: C.gold }} />
              Escolha o(s) serviço(s)
            </h2>
            <p style={{ color: C.textDim, fontSize: 12, marginBottom: 16 }}>Selecione um ou mais serviços</p>
            {servicos.map((s) => {
              const sel = servicoIds.includes(s.id)
              const creditoPlano = assinatura?.servicosComCredito?.find((c) => c.servicoId === s.id)
              const inclusoNoPlano = creditoPlano && creditoPlano.creditosRestantes > 0
              return (
                <div
                  key={s.id}
                  className="card-sel"
                  onClick={() => {
                    setServicoIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                    setData('')
                    setSlot(null)
                  }}
                  style={{
                    background: sel ? C.bgSelected : inclusoNoPlano ? 'rgba(37,211,102,0.08)' : C.bgCard,
                    border: `1.5px solid ${sel ? C.gold : inclusoNoPlano ? C.green : C.border}`,
                    borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? C.gold : C.border}`,
                        background: sel ? C.gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {sel && <CheckCircle size={12} style={{ color: '#fff' }} />}
                      </div>
                      <div>
                        <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>{s.nome}</p>
                        <p style={{ color: C.textDim, fontSize: 12, margin: '3px 0 0' }}>{s.duracaoMinutos} min</p>
                      </div>
                    </div>
                    {inclusoNoPlano ? (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>Incluso</span>
                        <p style={{ color: C.textDim, fontSize: 11, margin: '2px 0 0' }}>{creditoPlano.creditosRestantes}x</p>
                      </div>
                    ) : s.precoCentavos != null && (
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>{formatarReais(s.precoCentavos)}</span>
                    )}
                  </div>
                </div>
              )
            })}
            {servicoIds.length > 0 && (
              <>
                {servicoIds.length > 1 && (
                  <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                    <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>
                      {servicoIds.length} serviços — {servicoIds.reduce((t, id) => t + (servicos.find(s => s.id === id)?.duracaoMinutos || 0), 0)} min total
                      {(() => { const total = servicoIds.reduce((t, id) => t + (servicos.find(s => s.id === id)?.precoCentavos || 0), 0); return total ? ` — ${formatarReais(total)}` : '' })()}
                    </p>
                  </div>
                )}
                <button
                  onClick={avancarEtapaServico}
                  style={{
                    width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                    background: C.gold, color: C.textOnGold, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Continuar
                </button>
              </>
            )}
          </div>
        )}

        {/* ════ Etapa 2: Profissional ════ */}
        {abaAtiva === 'agendar' && etapa === 2 && (
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

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Buscar profissional</span>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ color: C.textDim, position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  value={buscaProfissional}
                  onChange={(e) => setBuscaProfissional(e.target.value)}
                  placeholder="Digite o nome do profissional"
                  style={{
                    width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12,
                    background: C.bgCard, border: `1.5px solid ${C.border}`, color: C.textPrimary,
                    fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
            </label>

            {profissionaisVisiveis.map((p) => {
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
                      src={resolverMediaUrl(p.avatarUrl)}
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
            {profissionaisVisiveis.length === 0 && (
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <p style={{ color: C.textDim, fontSize: 13, margin: 0 }}>Nenhum profissional encontrado para esse serviço.</p>
              </div>
            )}
          </div>
        )}

        {/* ════ Etapa 3: Data e Hora ════ */}
        {abaAtiva === 'agendar' && etapa === 3 && (
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
        {abaAtiva === 'agendar' && etapa === 4 && !clienteConhecido && (
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
              Primeiro validamos seu WhatsApp. Se já existir cadastro, seguimos sem pedir mais nada.
            </p>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>WhatsApp</span>
              {!clienteConsultado ? (
                <>
                  <input
                    type="tel"
                    value={telefoneCliente}
                    onChange={(e) => {
                      setTelefoneCliente(mascaraTelefone(e.target.value))
                      setClienteConsultado(null)
                      setErroCliente(null)
                    }}
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
                </>
              ) : (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <p style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>{formatarTelefoneExibicao(telefoneCliente)}</p>
                    <p style={{ color: C.textDim, fontSize: 11, margin: '4px 0 0' }}>
                      {clienteConsultado.existe ? 'Cadastro encontrado' : 'Novo cliente'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={editarTelefone}
                    style={{ background: 'transparent', border: 'none', color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                </div>
              )}
            </label>

            {clienteConsultado && !clienteConsultado.existe && (
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
            )}

            {clienteConsultado?.existe && (
              <div style={{ background: C.greenDim, border: '1px solid rgba(37,211,102,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ color: '#86efac', fontSize: 13, margin: 0 }}>
                  Encontramos seu cadastro como <strong>{nomeCliente}</strong>. Vamos usar esse nome na confirmação.
                </p>
              </div>
            )}

            {/* Resumo */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Resumo</p>
              <p style={{ color: C.textPrimary, fontSize: 13, margin: '4px 0', fontWeight: 600 }}>
                {servicoIds.length > 1
                  ? servicoIds.map((id) => servicos.find((s) => s.id === id)?.nome).filter(Boolean).join(' + ')
                  : servicos.find((s) => s.id === servicoId)?.nome}
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

            {(erroCliente || erroAgendamento) && (
              <div style={{
                marginBottom: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>⚠️ {erroCliente || erroAgendamento}</p>
              </div>
            )}

            {!clienteConsultado ? (
              <button
                onClick={consultarClientePorTelefone}
                disabled={telefoneCliente.replace(/\D/g, '').length < 10 || consultandoCliente}
                style={{
                  width: '100%',
                  background: telefoneCliente.replace(/\D/g, '').length < 10 || consultandoCliente ? '#1a1a1a' : C.gold,
                  color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                  fontSize: 15, cursor: telefoneCliente.replace(/\D/g, '').length < 10 || consultandoCliente ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: telefoneCliente.replace(/\D/g, '').length < 10 ? 0.5 : 1,
                }}
              >
                {consultandoCliente ? <><Loader2 size={18} className="spin" /> Validando...</> : 'Continuar'}
              </button>
            ) : (
              <button
                onClick={confirmarDadosPessoais}
                disabled={(!clienteConsultado.existe && !nomeCliente.trim()) || agendando}
                style={{
                  width: '100%',
                  background: ((!clienteConsultado.existe && !nomeCliente.trim()) || agendando) ? '#1a1a1a' : C.gold,
                  color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700,
                  fontSize: 15,
                  cursor: ((!clienteConsultado.existe && !nomeCliente.trim()) || agendando) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (!clienteConsultado.existe && !nomeCliente.trim()) ? 0.5 : 1,
                  transition: 'opacity 0.2s, background 0.2s',
                }}
              >
                {agendando ? (
                  <><Loader2 size={18} className="spin" /> Confirmando...</>
                ) : (
                  'Confirmar agendamento'
                )}
              </button>
            )}
          </div>
        )}

        {/* ════ Etapa 5: Sucesso ════ */}
        {abaAtiva === 'agendar' && etapa === 5 && agendamentoConfirmado && (
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
                  <p style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14, margin: 0 }}>{agendamentoConfirmado.servicos || agendamentoConfirmado.servico}</p>
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

      {abaAtiva === 'agendar' && etapa < 5 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 40,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,0.92) 24%, rgba(17,17,17,0.98) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${C.borderHeader}`,
        }}>
          <div className="public-content-shell">
            <button
              onClick={() => {
                if (etapa === 1 && servicoIds.length > 0) avancarEtapaServico()
                else if (etapa === 2) avancarEtapaProfissional()
                else if (etapa === 3 && slot) avancarAposSlot()
                else if (etapa === 4 && !clienteConsultado) consultarClientePorTelefone()
                else if (etapa === 4 && clienteConsultado) confirmarDadosPessoais()
              }}
              disabled={
                (etapa === 1 && servicoIds.length === 0)
                || (etapa === 3 && !slot)
                || (etapa === 4 && !clienteConsultado && telefoneCliente.replace(/\D/g, '').length < 10)
                || (etapa === 4 && clienteConsultado && !clienteConsultado.existe && !nomeCliente.trim())
                || agendando
                || consultandoCliente
                || perfilSalvando
              }
              style={{
                width: '100%',
                padding: '15px 16px',
                borderRadius: 16,
                border: 'none',
                background: (
                  (etapa === 1 && servicoIds.length === 0)
                  || (etapa === 3 && !slot)
                  || (etapa === 4 && !clienteConsultado && telefoneCliente.replace(/\D/g, '').length < 10)
                  || (etapa === 4 && clienteConsultado && !clienteConsultado.existe && !nomeCliente.trim())
                  || agendando
                  || consultandoCliente
                ) ? C.border : 'linear-gradient(135deg, #c39257, #a9783f)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 18px 30px rgba(0,0,0,0.22)',
                opacity: agendando || consultandoCliente ? 0.7 : 1,
              }}
            >
              {etapa === 1 && (servicoIds.length > 0 ? 'Continuar para profissionais' : 'Escolha ao menos um serviço')}
              {etapa === 2 && (profissionalId ? 'Continuar para horários' : 'Ver horários disponíveis')}
              {etapa === 3 && (slot ? (clienteConhecido ? 'Confirmar agendamento' : 'Continuar para seus dados') : 'Escolha um horário')}
              {etapa === 4 && (
                !clienteConsultado
                  ? 'Valide seu WhatsApp para continuar'
                  : clienteConsultado.existe
                    ? (agendando ? 'Confirmando...' : 'Confirmar agendamento')
                    : (!nomeCliente.trim() ? 'Informe seu nome para continuar' : (agendando ? 'Confirmando...' : 'Confirmar agendamento'))
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgendaPublica

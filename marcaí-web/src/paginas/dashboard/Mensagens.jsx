import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Send, UserCheck, Bot, Phone, Mail, Pin, StickyNote, Mic, Paperclip, MoreVertical, MessageSquare, X, RotateCcw, CheckCheck, Clock, Star, PanelRightOpen, PanelRightClose, ArrowLeft, Link2 } from 'lucide-react'
import api from '../../servicos/api'
import { formatarData, formatarHora, cn, obterIniciais, formatarTelefone, statusAgendamento, normalizarTextoCorrompido } from '../../lib/utils'
import useDebounce from '../../hooks/useDebounce'
import { Input } from '../../componentes/ui/input'
import { Badge } from '../../componentes/ui/badge'
import useAuth from '../../hooks/useAuth'
import { useToast } from '../../contextos/ToastContexto'

// Separador de data no chat
const SeparadorData = ({ data }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-borda" />
    <span className="text-[11px] text-texto-sec font-medium px-3 py-1 bg-gray-100 rounded-full">
      {data}
    </span>
    <div className="flex-1 h-px bg-borda" />
  </div>
)

// Formata conteúdo substituindo URLs brutas por links legíveis
const formatarConteudo = (texto) => {
  if (!texto) return ''
  const partes = texto.split(/(https?:\/\/[^\s]+)/g)
  return partes.map((parte, i) => {
    if (/^https?:\/\//.test(parte)) {
      const decoded = (() => { try { return decodeURIComponent(parte) } catch { return parte } })()
      const isAgendamento = decoded.includes('/agendar') || decoded.includes('/agendamento')
      return (
        <a key={i} href={parte} target="_blank" rel="noopener noreferrer"
          className="underline break-all">
          {isAgendamento ? '\u{1F4C5} Link de agendamento' : decoded}
        </a>
      )
    }
    return parte
  })
}

// Bolha de mensagem
const Bolha = ({ mensagem, proximaDoMesmo }) => {
  const remetente = mensagem.remetente || ''
  const ehCliente = remetente === 'cliente'
  const ehIA = remetente === 'ia'
  const ehSistema = remetente === 'sistema'
  const ehNota = remetente.startsWith('nota_interna:')
  const ehHumano = remetente.startsWith('humano:')

  // Ignora mensagens internas de tool_call/tool_result (contexto da IA, não exibir)
  if (remetente === 'tool_call' || remetente === 'tool_result') return null

  if (ehSistema) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-texto-sec bg-gray-100 px-3 py-1 rounded-full">{normalizarTextoCorrompido(mensagem.conteudo)}</span>
      </div>
    )
  }

  // Nota interna do atendente — visível só no painel, estilo post-it
  if (ehNota) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 max-w-[75%]">
          <StickyNote size={13} className="text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-yellow-600 font-semibold uppercase tracking-wide mb-0.5">Nota interna</p>
            <p className="text-xs text-yellow-800">{normalizarTextoCorrompido(mensagem.conteudo)}</p>
            <span className="text-[10px] text-yellow-500 mt-0.5 block">{formatarHora(mensagem.criadoEm)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2.5 mb-1', !ehCliente && 'flex-row-reverse', proximaDoMesmo && 'mb-0.5')}>
      <div className="w-8 shrink-0 self-end">
        {!proximaDoMesmo && (
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
            ehIA ? 'bg-primaria text-white' : ehHumano ? 'bg-green-500 text-white' : 'bg-gray-200 text-texto-sec'
          )}>
            {ehIA ? <Bot size={14} /> : obterIniciais(mensagem.nomeRemetente || 'A')}
          </div>
        )}
      </div>

      <div className={cn('max-w-[84%] md:max-w-[70%] flex flex-col', ehCliente ? 'items-start' : 'items-end')}>
        {!proximaDoMesmo && !ehCliente && (
          <span className="text-[11px] text-texto-sec mb-1 font-medium">{ehIA ? 'Don IA' : 'Atendente'}</span>
        )}
        {!proximaDoMesmo && ehCliente && (
          <span className="text-[11px] text-texto-sec mb-1 font-medium">Cliente</span>
        )}

        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line',
          ehCliente
            ? 'bg-white border border-borda text-texto rounded-bl-sm shadow-sm'
            : ehIA
            ? 'bg-primaria text-white rounded-br-sm'
            : 'bg-green-500 text-white rounded-br-sm'
        )}>
          {ehIA
            ? formatarConteudo(normalizarTextoCorrompido(mensagem.conteudo?.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')))
            : formatarConteudo(normalizarTextoCorrompido(mensagem.conteudo))}
        </div>
        <span className="text-[10px] text-texto-sec mt-1">{formatarHora(mensagem.criadoEm)}</span>
      </div>
    </div>
  )
}

// Tempo de espera formatado
const tempoEspera = (desde) => {
  const mins = Math.floor((Date.now() - new Date(desde).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? `${m}m` : ''}`
}

// Avatar do cliente — mostra foto do WhatsApp ou iniciais como fallback
const AvatarCliente = ({ cliente, tamanho = 'md', grayscale = false, className = '' }) => {
  const [fotoError, setFotoError] = useState(false)
  const temFoto = cliente?.avatarUrl && !fotoError
  const tamanhos = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' }

  useEffect(() => {
    setFotoError(false)
  }, [cliente?.avatarUrl])

  return (
    <div className={cn('rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0', tamanhos[tamanho], grayscale && 'grayscale', className)}>
      {temFoto ? (
        <img
          src={cliente.avatarUrl}
          alt={cliente?.nome}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFotoError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primaria/15 text-primaria">
          {obterIniciais(cliente?.nome)}
        </div>
      )}
    </div>
  )
}

// Item de conversa na lista
const ItemConversa = ({ conversa, ativa, onClick }) => {
  const ultimaMensagem = conversa.mensagens?.[0]
  const ehEncerrada = conversa.status === 'ENCERRADA'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left',
        ativa ? 'bg-primaria-clara border-r-2 border-primaria' : '',
        ehEncerrada ? 'opacity-60' : ''
      )}
    >
      <div className="relative shrink-0">
        <AvatarCliente cliente={conversa.cliente} tamanho="md" grayscale={ehEncerrada} />
        {conversa.status === 'ESCALONADA' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-alerta rounded-full border-2 border-white" />
        )}
        {conversa.status === 'ATIVA' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-sucesso rounded-full border-2 border-white" />
        )}
        {ehEncerrada && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center">
            <CheckCheck size={8} className="text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <p className={cn('text-sm font-semibold truncate', ativa ? 'text-primaria' : 'text-texto')}>
            {conversa.cliente?.nome && conversa.cliente.nome !== conversa.cliente?.telefone
              ? normalizarTextoCorrompido(conversa.cliente.nome)
              : 'Cliente'}
          </p>
          <span className="text-[11px] text-texto-sec shrink-0 ml-2">{formatarHora(conversa.atualizadoEm)}</span>
        </div>
        {conversa.status === 'ESCALONADA' ? (
          <p className={cn(
            'text-xs font-medium flex items-center gap-1',
            Math.floor((Date.now() - new Date(conversa.atualizadoEm).getTime()) / 60000) > 60
              ? 'text-perigo animate-pulse'
              : 'text-alerta'
          )}>
            <Clock size={10} className="shrink-0" />
            {Math.floor((Date.now() - new Date(conversa.atualizadoEm).getTime()) / 60000) > 60 ? '🔴 ' : ''}Aguardando há {tempoEspera(conversa.atualizadoEm)}
          </p>
        ) : (
          <p className={cn('text-xs flex items-start gap-1',
            ehEncerrada ? 'text-texto-sec/60' : 'text-texto-sec'
          )}>
            {conversa.status === 'ATIVA' && <Bot size={10} className="text-primaria shrink-0 mt-0.5" />}
            {ehEncerrada && <CheckCheck size={10} className="text-gray-400 shrink-0 mt-0.5" />}
            <span className="line-clamp-2">{normalizarTextoCorrompido(ultimaMensagem?.conteudo || 'Sem mensagens')}</span>
          </p>
        )}
      </div>
    </button>
  )
}

// Painel de detalhes do cliente
const PainelCliente = ({ conversa, className = '' }) => {
  const cliente = conversa?.cliente
  const [assinatura, setAssinatura] = useState(null)
  const [historico, setHistorico] = useState([])

  useEffect(() => {
    if (!cliente?.id) return
    setAssinatura(null)
    setHistorico([])

    // Carrega assinatura ativa e histórico completo
    Promise.allSettled([
      api.get(`/api/planos/assinaturas-clientes?clienteId=${cliente.id}&status=ATIVA&limite=1`),
      api.get(`/api/agendamentos?clienteId=${cliente.id}&status=CONCLUIDO,CANCELADO,NAO_COMPARECEU&limite=10&ordem=maisRecentes`),
    ]).then(([resAs, resAg]) => {
      if (resAs.status === 'fulfilled') {
        const lista = resAs.value?.assinaturas || resAs.value?.dados || []
        setAssinatura(lista[0] || null)
      }
      if (resAg.status === 'fulfilled') {
        setHistorico(resAg.value?.agendamentos || [])
      }
    })
  }, [cliente?.id])

  if (!cliente) return null

  return (
    <div className={cn('w-72 border-l border-borda bg-white overflow-y-auto shrink-0', className)}>
      <div className="p-5">
        <div className="text-center mb-5">
          <div className="flex justify-center mb-3">
            <AvatarCliente cliente={cliente} tamanho="lg" grayscale={conversa.status === 'ENCERRADA'} />
          </div>
          <h3 className="font-semibold text-texto">
            {cliente.nome && cliente.nome !== cliente.telefone ? normalizarTextoCorrompido(cliente.nome) : 'Cliente'}
          </h3>
          {cliente.telefone && (
            <p className="text-texto-sec text-sm flex items-center justify-center gap-1 mt-1">
              <Phone size={12} /> {formatarTelefone(cliente.telefone)}
            </p>
          )}
          {cliente.email && (
            <p className="text-texto-sec text-sm flex items-center justify-center gap-1 mt-0.5">
              <Mail size={12} /> {cliente.email}
            </p>
          )}
        </div>

        <div className="mb-4 p-3 bg-fundo rounded-xl">
          <p className="text-xs text-texto-sec mb-1 font-medium uppercase">Status</p>
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full',
              conversa.status === 'ATIVA' ? 'bg-sucesso' :
              conversa.status === 'ESCALONADA' ? 'bg-alerta' : 'bg-gray-400'
            )} />
            <span className="text-sm text-texto">
              {conversa.status === 'ATIVA' ? 'IA atendendo' :
               conversa.status === 'ESCALONADA' ? 'Aguardando atendente' : 'Encerrada'}
            </span>
          </div>
        </div>

        {cliente.preferencias && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
            <p className="text-xs text-yellow-700 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
              <Star size={11} /> Preferências detectadas
            </p>
            <p className="text-xs text-yellow-800 whitespace-pre-wrap">{normalizarTextoCorrompido(cliente.preferencias)}</p>
          </div>
        )}

        {/* Assinatura e créditos do plano */}
        {assinatura && (
          <div className="mb-4 p-3 bg-primaria-clara/30 border border-primaria/20 rounded-xl">
            <p className="text-xs font-semibold text-primaria uppercase tracking-wide mb-2 flex items-center gap-1">
              <Pin size={11} /> Plano mensal ativo
            </p>
            <p className="text-xs font-medium text-texto mb-1">{assinatura.planoAssinatura?.nome}</p>
            {Array.isArray(assinatura.creditos) && assinatura.creditos.length > 0 && (
              <div className="space-y-1">
                {assinatura.creditos.map((cr) => {
                  const total = cr.creditosIniciais || 0
                  const restantes = cr.creditosRestantes || 0
                  const usados = total - restantes
                  const pct = total > 0 ? Math.round((usados / total) * 100) : 0
                  return (
                    <div key={cr.id}>
                      <div className="flex justify-between text-[11px] text-texto-sec mb-0.5">
                        <span>{cr.servico?.nome}</span>
                        <span className={restantes === 0 ? 'text-perigo font-semibold' : restantes <= 1 ? 'text-alerta font-semibold' : 'text-sucesso font-semibold'}>
                          {restantes}/{total}
                        </span>
                      </div>
                      <div className="h-1.5 bg-borda rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-perigo' : pct >= 66 ? 'bg-alerta' : 'bg-sucesso'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className={`text-[10px] mt-1.5 font-medium ${assinatura.status === 'ATIVA' ? 'text-sucesso' : 'text-alerta'}`}>
              {assinatura.status === 'ATIVA' ? '✓ Ativo' : assinatura.status}
              {assinatura.fimEm && ` · até ${new Date(assinatura.fimEm).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        )}

        {(historico.length > 0 || cliente.agendamentos?.length > 0) && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-texto uppercase tracking-wide mb-2">Histórico</p>
            <div className="space-y-2">
              {(historico.length > 0 ? historico : cliente.agendamentos?.slice(0, 5) || []).map((ag) => (
                <div key={ag.id} className="bg-fundo rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-medium text-texto">{ag.servico?.nome}</p>
                    <Badge variante={ag.status === 'CONFIRMADO' ? 'success' : ag.status === 'CANCELADO' ? 'danger' : 'default'}>
                      {statusAgendamento[ag.status]?.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-texto-sec mt-1">{formatarData(ag.inicioEm)} {formatarHora(ag.inicioEm)}</p>
                  {ag.profissional && <p className="text-[11px] text-texto-sec">{ag.profissional.nome}</p>}
                  {ag.feedbackNota && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={10} className={n <= ag.feedbackNota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                      ))}
                      {ag.feedbackComentario && (
                        <span className="text-[10px] text-texto-sec ml-1 truncate">{normalizarTextoCorrompido(ag.feedbackComentario)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-texto uppercase tracking-wide mb-2 flex items-center gap-1">
            <StickyNote size={11} /> Notas
          </p>
          <textarea
            defaultValue={cliente.notas || ''}
            onBlur={(e) => api.patch(`/api/clientes/${cliente.id}`, { notas: e.target.value })}
            placeholder="Adicione uma nota sobre este cliente..."
            rows={3}
            className="w-full text-xs px-3 py-2 rounded-xl border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none text-texto placeholder:text-texto-sec/50 bg-white"
          />
        </div>
      </div>
    </div>
  )
}

const Mensagens = () => {
  const { tenant } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [conversas, setConversas] = useState([])
  const [conversaSelecionada, setConversaSelecionada] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('ativas')
  const [carregandoConversas, setCarregandoConversas] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviandoLink, setEnviandoLink] = useState(false)
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false)
  const toast = useToast()
  const [modoNota, setModoNota] = useState(false)
  const [mostrarPainel, setMostrarPainel] = useState(false)
  const fimChat = useRef(null)
  const containerChat = useRef(null)
  const ultimaConversaId = useRef(null)
  const contMensagens = useRef(0)
  const buscaDebounced = useDebounce(busca)

  const carregarConversas = async () => {
    try {
      const res = await api.get('/api/conversas')
      setConversas(res.dados || [])
    } finally {
      setCarregandoConversas(false)
    }
  }

  const carregarConversa = async (id) => {
    const res = await api.get(`/api/conversas/${id}`)
    setConversaSelecionada(res.dados)
    setMensagens(res.dados.mensagens || [])
  }

  useEffect(() => {
    carregarConversas()
    // Atualiza lista a cada 15s independente de conversa selecionada (captura novas escalações)
    const intervaloLista = setInterval(carregarConversas, 15000)
    return () => clearInterval(intervaloLista)
  }, [])

  useEffect(() => {
    if (conversaSelecionada || conversas.length === 0 || location.state?.telefone || location.state?.clienteId) return
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      selecionarConversa(conversas[0])
    }
  }, [conversas]) // eslint-disable-line

  // Abre conversa do cliente (cria vazia se ainda não existir) vindo de cadastro de clientes, etc.
  useEffect(() => {
    const clienteId = location.state?.clienteId
    if (!clienteId) return
    let cancelado = false
    ;(async () => {
      try {
        const res = await api.get(`/api/conversas/por-cliente/${clienteId}`)
        if (cancelado || !res.dados?.id) return
        await carregarConversas()
        setConversaSelecionada(res.dados)
        setMensagens(res.dados.mensagens || [])
        navigate('/dashboard/mensagens', { replace: true, state: {} })
      } catch (e) {
        if (!cancelado) {
          toast(e?.erro?.mensagem || e?.message || 'Não foi possível abrir a conversa com este cliente.', 'erro')
        }
        navigate('/dashboard/mensagens', { replace: true, state: {} })
      }
    })()
    return () => {
      cancelado = true
    }
  }, [location.state?.clienteId, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-seleciona conversa ao navegar de outro módulo com telefone
  useEffect(() => {
    const telAlvo = location.state?.telefone
    if (!telAlvo || conversaSelecionada || conversas.length === 0) return
    if (location.state?.clienteId) return
    const normalizar = (t) => (t || '').replace(/\D/g, '')
    const match = conversas.find((c) => normalizar(c.cliente?.telefone) === normalizar(telAlvo))
    if (match) {
      selecionarConversa(match)
      return
    }
    setBusca(telAlvo)
  }, [conversas]) // eslint-disable-line

  useEffect(() => {
    if (conversaSelecionada && conversaSelecionada.status !== 'ENCERRADA') {
      const intervalo = setInterval(() => {
        carregarConversa(conversaSelecionada.id)
        carregarConversas()
      }, 3000)
      return () => clearInterval(intervalo)
    }
  }, [conversaSelecionada?.id, conversaSelecionada?.status])

  useEffect(() => {
    const container = containerChat.current
    if (!container || !mensagens.length) return

    const conversaId = conversaSelecionada?.id
    const novaConversa = conversaId !== ultimaConversaId.current
    const novasMensagens = mensagens.length > contMensagens.current

    if (novaConversa) {
      container.scrollTop = container.scrollHeight
      ultimaConversaId.current = conversaId
    } else if (novasMensagens) {
      const distanciaDoFundo = container.scrollHeight - container.scrollTop - container.clientHeight
      if (distanciaDoFundo < 150) {
        fimChat.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    contMensagens.current = mensagens.length
  }, [mensagens])

  const selecionarConversa = async (conversa) => {
    setConfirmandoEncerrar(false)
    await carregarConversa(conversa.id)
  }

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada) return
    setEnviando(true)
    try {
      if (modoNota) {
        await api.post(`/api/conversas/${conversaSelecionada.id}/notas`, { conteudo: novaMensagem })
      } else {
        await api.post(`/api/conversas/${conversaSelecionada.id}/mensagens`, { conteudo: novaMensagem })
      }
      setNovaMensagem('')
      await carregarConversa(conversaSelecionada.id)
    } finally {
      setEnviando(false)
    }
  }

  const enviarLinkAgendamento = async () => {
    if (!conversaSelecionada?.cliente?.id || !tenant?.slug) return
    const cliente = conversaSelecionada.cliente
    const base = `${window.location.origin}/b/${tenant.slug}`
    const params = new URLSearchParams()
    if (cliente.telefone) params.set('tel', cliente.telefone.replace(/\D/g, ''))
    if (cliente.nome) params.set('nome', cliente.nome)
    const link = `${base}?${params}`
    setEnviandoLink(true)
    try {
      await api.post('/api/ia/enviar-link', { clienteId: cliente.id, linkAgendamento: link })
      await carregarConversa(conversaSelecionada.id)
      toast('Link de agendamento enviado!', 'sucesso')
    } catch {
      // fallback: copia para clipboard
      navigator.clipboard.writeText(link).catch(() => {})
      toast('WhatsApp não conectado. Link copiado para a área de transferência.', 'aviso')
    } finally {
      setEnviandoLink(false)
    }
  }

  const assumirConversa = async () => {
    await api.patch(`/api/conversas/${conversaSelecionada.id}/assumir`, {})
    await carregarConversa(conversaSelecionada.id)
    await carregarConversas()
  }

  const devolverParaIA = async () => {
    await api.patch(`/api/conversas/${conversaSelecionada.id}/devolver`, {})
    await carregarConversa(conversaSelecionada.id)
    await carregarConversas()
  }

  const encerrarConversa = async () => {
    await api.patch(`/api/conversas/${conversaSelecionada.id}/encerrar`, {})
    setConfirmandoEncerrar(false)
    await carregarConversa(conversaSelecionada.id)
    await carregarConversas()
  }

  const reabrirConversa = async () => {
    await api.patch(`/api/conversas/${conversaSelecionada.id}/reabrir`, {})
    await carregarConversa(conversaSelecionada.id)
    await carregarConversas()
  }

  const conversasFiltradas = conversas.filter((c) => {
    const nome = c.cliente?.nome?.toLowerCase() || ''
    const telefone = c.cliente?.telefone || ''
    const email = c.cliente?.email?.toLowerCase() || ''
    const termoBusca = buscaDebounced.toLowerCase()
    const termoNumerico = buscaDebounced.replace(/\D/g, '')
    const matchBusca =
      nome.includes(termoBusca) ||
      email.includes(termoBusca) ||
      telefone.includes(buscaDebounced) ||
      (termoNumerico ? telefone.replace(/\D/g, '').includes(termoNumerico) : false)
    if (filtro === 'escalonadas') return matchBusca && c.status === 'ESCALONADA'
    if (filtro === 'ia') return matchBusca && c.status === 'ATIVA'
    if (filtro === 'encerradas') return matchBusca && c.status === 'ENCERRADA'
    // 'ativas' = ATIVA + ESCALONADA
    return matchBusca && c.status !== 'ENCERRADA'
  })

  const pinadas = conversasFiltradas.filter((c) => c.status === 'ESCALONADA')
  const normais = conversasFiltradas.filter((c) => c.status !== 'ESCALONADA')

  const ehEscalonada = conversaSelecionada?.status === 'ESCALONADA'
  const ehEncerrada = conversaSelecionada?.status === 'ENCERRADA'
  const totalEncerradas = conversas.filter(c => c.status === 'ENCERRADA').length
  const totalAguardando = conversas.filter(c => c.status === 'ESCALONADA').length

  const statusLabel = ehEncerrada ? 'Encerrada' : ehEscalonada ? 'Aguardando atendente' : 'IA atendendo'
  const statusColor = ehEncerrada ? 'text-gray-400' : ehEscalonada ? 'text-alerta' : 'text-sucesso'
  const statusDot = ehEncerrada ? 'bg-gray-400' : ehEscalonada ? 'bg-alerta animate-pulse' : 'bg-sucesso'

  return (
    <>
    <div className="relative flex h-[calc(100dvh-8rem)] bg-white rounded-2xl border border-borda overflow-hidden shadow-sm md:-mt-6 md:-mx-6 md:-mb-6 md:h-[calc(100vh_-_var(--header-h,_68px))]">
      {/* Coluna 1 — Lista */}
      <div
        className={cn(
          'border-r border-borda flex flex-col shrink-0 bg-white overflow-hidden',
          conversaSelecionada ? 'hidden md:flex md:w-[320px]' : 'flex w-full md:w-[320px]'
        )}
      >
        <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-texto">Mensagens</h2>
            {totalAguardando > 0 && (
              <button
                onClick={() => setFiltro('escalonadas')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-alerta/15 text-alerta text-xs font-bold hover:bg-alerta/25 transition-colors animate-pulse"
                title="Ver clientes aguardando"
              >
                {totalAguardando} aguardando
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-sec" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-9 h-9 text-sm bg-gray-50 border-transparent focus:bg-white"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-1.5 px-3 md:px-4 pb-3">
          {[
            ['ativas', 'Ativas'],
            ['ia', 'Com IA'],
            ['escalonadas', totalAguardando > 0 ? `Aguardando (${totalAguardando})` : 'Aguardando'],
            ['encerradas', totalEncerradas > 0 ? `Encerradas (${totalEncerradas})` : 'Encerradas'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltro(val)}
              className={cn(
                'text-xs py-1.5 rounded-lg font-medium transition-colors',
                filtro === val
                  ? val === 'escalonadas' && totalAguardando > 0 ? 'bg-alerta text-white' : 'bg-primaria text-white'
                  : val === 'escalonadas' && totalAguardando > 0 ? 'bg-alerta/10 text-alerta hover:bg-alerta/20' : 'bg-gray-100 text-texto-sec hover:text-texto'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {carregandoConversas ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3 px-1">
                  <div className="w-12 h-12 bg-borda rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="h-3.5 bg-borda rounded w-3/4 mb-2" />
                    <div className="h-2.5 bg-borda rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {pinadas.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-5 py-2">
                    <Pin size={11} className="text-texto-sec" />
                    <span className="text-[11px] text-texto-sec font-semibold uppercase tracking-wider">Aguardando Atendimento</span>
                  </div>
                  {pinadas.map((c) => (
                    <ItemConversa key={c.id} conversa={c} ativa={conversaSelecionada?.id === c.id} onClick={() => selecionarConversa(c)} />
                  ))}
                  <div className="h-px bg-borda mx-4 my-2" />
                </>
              )}

              {normais.length > 0 && (
                <>
                  {filtro !== 'escalonadas' && (
                    <div className="px-5 py-2">
                      <span className="text-[11px] text-texto-sec font-semibold uppercase tracking-wider">
                        {filtro === 'encerradas' ? 'Encerradas' : 'Conversas Ativas'}
                      </span>
                    </div>
                  )}
                  {normais.map((c) => (
                    <ItemConversa key={c.id} conversa={c} ativa={conversaSelecionada?.id === c.id} onClick={() => selecionarConversa(c)} />
                  ))}
                </>
              )}

              {conversasFiltradas.length === 0 && (
                <div className="p-8 text-center text-texto-sec text-sm">
                  <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                  Nenhuma conversa encontrada
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Coluna 2 — Chat */}
      {conversaSelecionada ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-3 md:px-5 py-3 md:py-4 border-b border-borda flex flex-wrap items-start sm:items-center gap-3 bg-white">
            <button
              onClick={() => {
                setConversaSelecionada(null)
                setMostrarPainel(false)
              }}
              className="md:hidden w-9 h-9 rounded-xl border border-borda flex items-center justify-center text-texto-sec hover:text-texto hover:bg-fundo transition-colors shrink-0"
              title="Voltar para conversas"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="relative">
              <AvatarCliente cliente={conversaSelecionada.cliente} tamanho="sm" grayscale={ehEncerrada} />
              <div className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white', statusDot)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-texto truncate">
                {conversaSelecionada.cliente?.nome && conversaSelecionada.cliente.nome !== conversaSelecionada.cliente?.telefone
                  ? normalizarTextoCorrompido(conversaSelecionada.cliente.nome)
                  : 'Cliente'}
              </p>
              <p className={cn('text-xs flex flex-wrap items-center gap-1', statusColor)}>
                <span className={cn('w-1.5 h-1.5 rounded-full inline-block', statusDot)} />
                {statusLabel}
                {ehEscalonada && (
                  <span className="text-alerta font-medium flex items-center gap-0.5">
                    · <Clock size={10} /> há {tempoEspera(conversaSelecionada.atualizadoEm)}
                  </span>
                )}
              </p>
            </div>

            {/* Ações do header */}
            <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
              {tenant?.slug && conversaSelecionada?.cliente && (
                <button
                  onClick={enviarLinkAgendamento}
                  disabled={enviandoLink}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-primaria/10 text-primaria transition-colors text-xs font-medium disabled:opacity-50"
                  title="Enviar link de agendamento pelo WhatsApp"
                >
                  <Link2 size={14} />
                  <span className="hidden sm:inline">{enviandoLink ? 'Enviando...' : 'Enviar link'}</span>
                </button>
              )}
              <button
                onClick={() => setMostrarPainel((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-fundo text-texto-sec transition-colors text-xs font-medium"
                title={mostrarPainel ? 'Ocultar painel do cliente' : 'Ver painel do cliente'}
              >
                {mostrarPainel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                <span>{mostrarPainel ? 'Ocultar' : 'Cliente'}</span>
              </button>
              {ehEncerrada ? (
                <button
                  onClick={reabrirConversa}
                  className="px-4 py-2 bg-sucesso/10 hover:bg-sucesso/20 text-sucesso text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Reabrir
                </button>
              ) : (
                <>
                  {!ehEscalonada ? (
                    <button
                      onClick={assumirConversa}
                      className="px-3 py-2 bg-alerta/10 hover:bg-alerta/20 text-alerta text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <UserCheck size={14} /> Assumir
                    </button>
                  ) : (
                    <button
                      onClick={devolverParaIA}
                      className="px-3 py-2 bg-primaria/10 hover:bg-primaria/20 text-primaria text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Bot size={14} /> Devolver à IA
                    </button>
                  )}

                  {/* Botão Encerrar */}
                  {confirmandoEncerrar ? (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                      <span className="text-xs text-red-600 font-medium">Encerrar?</span>
                      <button onClick={encerrarConversa} className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg hover:bg-red-600 transition-colors">Sim</button>
                      <button onClick={() => setConfirmandoEncerrar(false)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Não</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoEncerrar(true)}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Encerrar conversa"
                    >
                      <X size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {!ehEncerrada && (
            <div className="shrink-0 px-3 md:px-5 py-2.5 border-b border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-amber-50/40">
              <p className="text-[12px] text-texto leading-relaxed">
                <span className="font-semibold text-amber-950">Sugestão: </span>
                {ehEscalonada
                  ? 'Responda o cliente abaixo. Se ele só quiser marcar, use Enviar link.'
                  : 'A IA conduz a conversa. Use Assumir se precisar falar com ele agora.'}
              </p>
            </div>
          )}

          {/* Mensagens */}
          <div ref={containerChat} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-5 bg-fundo/60">
            {mensagens.length > 0 && (
              <SeparadorData data={`Hoje, ${formatarData(mensagens[0]?.criadoEm || new Date())}`} />
            )}
            {mensagens.map((m, i) => {
              const proxima = mensagens[i + 1]
              const mesmoRemetente = proxima?.remetente === m.remetente
              return <Bolha key={m.id} mensagem={m} proximaDoMesmo={mesmoRemetente} />
            })}

            {/* Banner de encerrada */}
            {ehEncerrada && (
              <div className="flex justify-center mt-4">
                <div className="bg-gray-100 rounded-2xl px-5 py-3 text-center max-w-xs">
                  <CheckCheck size={20} className="mx-auto text-gray-400 mb-1.5" />
                  <p className="text-xs text-gray-500 font-medium">Conversa encerrada</p>
                  <button onClick={reabrirConversa} className="text-xs text-primaria hover:underline mt-1">Reabrir conversa</button>
                </div>
              </div>
            )}

            <div ref={fimChat} />
          </div>

          {/* Input */}
          <div className="p-3 md:p-4 border-t border-borda bg-white">
            {ehEncerrada ? (
              <div className="text-center text-texto-sec text-sm py-1.5 flex flex-wrap items-center justify-center gap-2">
                <CheckCheck size={16} className="text-gray-400" />
                Conversa encerrada.
                <button onClick={reabrirConversa} className="text-primaria font-semibold hover:underline">Reabrir</button>
              </div>
            ) : ehEscalonada ? (
              <div className="space-y-2">
                {/* Toggle mensagem / nota interna */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
                  <button
                    onClick={() => setModoNota(false)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1',
                      !modoNota ? 'bg-white shadow-sm text-texto' : 'text-texto-sec hover:text-texto'
                    )}
                  >
                    <Send size={11} /> Mensagem
                  </button>
                  <button
                    onClick={() => setModoNota(true)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1',
                      modoNota ? 'bg-yellow-100 shadow-sm text-yellow-700' : 'text-texto-sec hover:text-texto'
                    )}
                  >
                    <StickyNote size={11} /> Nota interna
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1">
                    <Input
                      value={novaMensagem}
                      onChange={(e) => setNovaMensagem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                      placeholder={modoNota ? 'Nota visível só para atendentes...' : 'Digite sua mensagem para o cliente...'}
                      className={cn('rounded-2xl border-borda focus:bg-white', modoNota ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50')}
                    />
                  </div>
                  <button
                    onClick={enviarMensagem}
                    disabled={enviando || !novaMensagem.trim()}
                    className={cn('h-11 sm:w-10 sm:h-10 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0',
                      modoNota ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-primaria hover:bg-primaria-escura'
                    )}
                  >
                    {modoNota ? <StickyNote size={15} /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-texto-sec text-sm py-1.5 flex items-center justify-center gap-2">
                <Bot size={16} className="text-primaria" />
                IA está atendendo. Clique em <strong className="text-alerta">"Assumir"</strong> para intervir.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-fundo/40">
          <div className="text-center">
            <div className="w-20 h-20 bg-primaria/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={36} className="text-primaria" />
            </div>
            <p className="text-texto font-semibold text-lg">Selecione uma conversa</p>
            <p className="text-texto-sec text-sm mt-1">Escolha uma conversa da lista à esquerda</p>
          </div>
        </div>
      )}

      {/* Coluna 3 — Detalhes */}
      {conversaSelecionada && mostrarPainel && (
        <div className="hidden xl:block">
          <PainelCliente conversa={conversaSelecionada} />
        </div>
      )}
    </div>
    {conversaSelecionada && mostrarPainel && (
      <div
        className="xl:hidden fixed inset-0 z-[70] bg-black/45 flex items-end"
        onClick={() => setMostrarPainel(false)}
      >
        <div
          className="w-full max-h-[86vh] overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-borda">
            <p className="text-sm font-semibold text-texto">Cliente</p>
            <button
              onClick={() => setMostrarPainel(false)}
              className="w-9 h-9 rounded-xl border border-borda flex items-center justify-center text-texto-sec"
            >
              <X size={16} />
            </button>
          </div>
          <PainelCliente
            conversa={conversaSelecionada}
            className="w-full max-w-none border-l-0 h-[calc(86vh-61px)]"
          />
        </div>
      </div>
    )}
    </>
  )
}

export default Mensagens

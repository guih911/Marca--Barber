import { useEffect, useMemo, useState, useRef } from 'react'
import { api, getUser } from '../api'
import { MessageSquare, Clock, AlertTriangle, Send, Bot, User, Users, Phone, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

function parseRemetente(remetente) {
  if (!remetente) return { tipo: 'sistema', nome: 'Sistema' }
  if (remetente === 'cliente') return { tipo: 'cliente', nome: 'Cliente' }
  if (remetente === 'ia' || remetente === 'assistente') return { tipo: 'ia', nome: 'IA Don' }
  if (String(remetente).startsWith('humano:')) {
    const parts = String(remetente).split(':')
    return { tipo: 'humano', adminId: parts[1], nome: parts.slice(2).join(':') || 'Admin' }
  }
  return { tipo: 'ia', nome: remetente }
}

function SlaTimer({ atualizadoEm, slaMinutos = 30 }) {
  const [mins, setMins] = useState(0)
  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(atualizadoEm).getTime()
      setMins(Math.floor(diff / 60000))
    }
    calc()
    const t = setInterval(calc, 30000)
    return () => clearInterval(t)
  }, [atualizadoEm])

  const pct = Math.min(100, (mins / slaMinutos) * 100)
  const atrasado = mins > slaMinutos

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${atrasado ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold shrink-0 ${atrasado ? 'text-red-500' : 'text-slate-500'}`}>
        {mins}min
      </span>
    </div>
  )
}

function ChatBubble({ msg, currentAdminId }) {
  const { tipo, nome, adminId } = parseRemetente(msg.remetente)
  const isMe = tipo === 'humano' && adminId === currentAdminId
  const isCliente = tipo === 'cliente'

  const bubbleClass = isCliente
    ? 'bg-slate-100 text-slate-800 mr-8'
    : isMe
    ? 'bg-primaria text-white ml-8'
    : tipo === 'humano'
    ? 'bg-emerald-50 text-slate-800 border border-emerald-200 ml-8'
    : 'bg-amber-50 text-slate-800 border border-amber-200 ml-8'

  return (
    <div className={`flex flex-col ${isCliente ? 'items-start' : 'items-end'} gap-0.5`}>
      <span className="text-[10px] text-slate-400 px-1">
        {tipo === 'humano' ? `👤 ${nome}` : tipo === 'ia' ? '🤖 IA' : '💬 Cliente'}
        {' · '}
        {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${bubbleClass}`}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
      </div>
    </div>
  )
}

export default function Atendimento() {
  const currentUser = getUser()
  const [modo, setModo] = useState('SUPORTE')
  const [mostrarIa, setMostrarIa] = useState(false)
  const [busca, setBusca] = useState('')
  const [dados, setDados] = useState({ conversas: [], total: 0, pagina: 1, limite: 20 })
  const [tickets, setTickets] = useState({ tickets: [], atrasados: 0 })
  const [carregando, setCarregando] = useState(true)
  const [conversaAtiva, setConversaAtiva] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const messagesEndRef = useRef(null)

  const carregar = async (pagina = 1) => {
    setCarregando(true)
    try {
      const qs = new URLSearchParams({ pagina: String(pagina), limite: '20', modo, mostrarIa: String(mostrarIa) })
      if (busca) qs.set('busca', busca)
      const [respConversas, respTickets] = await Promise.all([
        api(`/api/admin/comercial/conversas?${qs}`),
        api('/api/admin/comercial/suporte/tickets?slaMinutos=30'),
      ])
      setDados(respConversas)
      setTickets(respTickets)
      if (!conversaAtiva && respConversas.conversas?.[0]) {
        setConversaAtiva(respConversas.conversas[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar(1) }, [modo, mostrarIa])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversaAtiva?.mensagens])

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil((dados.total || 0) / 20)), [dados])

  const enviar = async () => {
    if (!conversaAtiva || !texto.trim()) return
    setEnviando(true)
    try {
      await api(`/api/admin/comercial/conversas/${conversaAtiva.id}/mensagens`, {
        method: 'POST',
        body: JSON.stringify({ texto: texto.trim(), humano: true }),
      })
      setTexto('')
      await carregar(dados.pagina || 1)
    } finally {
      setEnviando(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar()
  }

  const slaAtrasados = tickets.atrasados || 0

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)] animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Atendimento & Suporte</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Resposta registrada com seu nome · {dados.total || 0} conversas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {slaAtrasados > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
              <AlertTriangle size={12} className="animate-pulse" />
              {slaAtrasados} ticket{slaAtrasados > 1 ? 's' : ''} atrasado{slaAtrasados > 1 ? 's' : ''}
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-slate-500">{tickets.tickets?.length || 0} tickets abertos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card px-3 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
        <select value={modo} onChange={e => setModo(e.target.value)} className="input-field w-auto py-1.5 text-xs">
          <option value="SUPORTE">🎧 Suporte</option>
          <option value="VENDAS">💼 Vendas</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={mostrarIa} onChange={e => setMostrarIa(e.target.checked)} className="rounded" />
          Exibir mensagens IA
        </label>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && carregar(1)}
          placeholder="Buscar cliente..."
          className="input-field flex-1 min-w-[160px] py-1.5 text-xs"
        />
        <button onClick={() => carregar(1)} className="btn-primary py-1.5 text-xs">Filtrar</button>
      </div>

      {/* Main chat layout */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Lista de conversas */}
        <div className="w-72 shrink-0 card flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="section-title">Conversas ({dados.total || 0})</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-primaria rounded-full animate-spin" />
              </div>
            ) : (dados.conversas || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Sem conversas</p>
            ) : (dados.conversas || []).map(conversa => {
              const ultimaMsg = conversa.mensagens?.[conversa.mensagens.length - 1]
              const isAtiva = conversaAtiva?.id === conversa.id
              const temAtrasado = tickets.tickets?.some(t => t.id === conversa.id && t.sla?.atrasado)
              return (
                <button
                  key={conversa.id}
                  onClick={() => setConversaAtiva(conversa)}
                  className={`w-full text-left px-3 py-3 border-b border-slate-100 transition-colors ${isAtiva ? 'bg-primaria/5 border-l-2 border-l-primaria' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate flex-1">{conversa.cliente?.nome || 'Cliente'}</p>
                    {temAtrasado && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0 ml-1" />}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conversa.tenant?.nome}</p>
                  {conversa.ultimaRespostaHumana ? (
                    <p className="text-[10px] text-emerald-600 mt-1 font-medium">👤 {conversa.ultimaRespostaHumana.adminNome}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">Sem resposta humana</p>
                  )}
                  {conversa.atualizadoEm && (
                    <SlaTimer atualizadoEm={conversa.atualizadoEm} slaMinutos={30} />
                  )}
                </button>
              )
            })}
          </div>
          {/* Paginação */}
          <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
            <button onClick={() => carregar(Math.max(1,(dados.pagina||1)-1))} disabled={(dados.pagina||1)<=1} className="p-1 rounded border border-slate-200 disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <span className="text-[10px] text-slate-500">{dados.pagina||1}/{totalPaginas}</span>
            <button onClick={() => carregar(Math.min(totalPaginas,(dados.pagina||1)+1))} disabled={(dados.pagina||1)>=totalPaginas} className="p-1 rounded border border-slate-200 disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 card flex flex-col min-h-0">
          {!conversaAtiva ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <MessageSquare size={32} className="opacity-30" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{conversaAtiva.cliente?.nome}</p>
                  <p className="text-xs text-slate-500">{conversaAtiva.cliente?.telefone} · {conversaAtiva.tenant?.nome}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${conversaAtiva.status === 'ESCALONADA' ? 'badge-amber' : 'badge-emerald'}`}>
                    {conversaAtiva.status}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(conversaAtiva.mensagens || []).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Sem mensagens</p>
                ) : (
                  <>
                    {(conversaAtiva.mensagens || []).map(msg => (
                      <ChatBubble key={msg.id} msg={msg} currentAdminId={currentUser?.id} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Reply */}
              <div className="border-t border-slate-100 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-5 h-5 bg-primaria rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                    {(currentUser?.nome || 'A')[0].toUpperCase()}
                  </div>
                  Respondendo como <strong className="text-slate-700">{currentUser?.nome || 'Admin'}</strong> · via WhatsApp Meta
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="input-field flex-1 resize-none text-sm"
                    placeholder="Digite a resposta... (Ctrl+Enter para enviar)"
                  />
                  <button
                    disabled={enviando || !texto.trim()}
                    onClick={enviar}
                    className="btn-primary px-3 self-end"
                  >
                    {enviando
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send size={16} />
                    }
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detalhes do cliente */}
        {conversaAtiva && (
          <div className="w-56 shrink-0 card p-4 flex flex-col gap-4 overflow-y-auto hidden xl:flex">
            <div>
              <p className="section-title mb-2">Cliente</p>
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 font-bold text-lg mb-2">
                {(conversaAtiva.cliente?.nome || '?')[0].toUpperCase()}
              </div>
              <p className="font-semibold text-slate-800 text-sm">{conversaAtiva.cliente?.nome}</p>
              <p className="text-xs text-slate-500">{conversaAtiva.cliente?.telefone}</p>
            </div>

            <div>
              <p className="section-title mb-2">Tenant</p>
              <p className="text-sm text-slate-700">{conversaAtiva.tenant?.nome}</p>
            </div>

            {conversaAtiva.ultimaRespostaHumana && (
              <div>
                <p className="section-title mb-2">Última resposta humana</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-primaria rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                    {(conversaAtiva.ultimaRespostaHumana.adminNome || 'A')[0]}
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{conversaAtiva.ultimaRespostaHumana.adminNome}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(conversaAtiva.ultimaRespostaHumana.criadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
            )}

            <div>
              <p className="section-title mb-2">SLA (30min)</p>
              <SlaTimer atualizadoEm={conversaAtiva.atualizadoEm} slaMinutos={30} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

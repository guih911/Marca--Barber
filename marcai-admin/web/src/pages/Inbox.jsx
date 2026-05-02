import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'
import {
  MessageCircle, Send, Search, Plus, X, Archive,
  CheckCheck, Check, Phone, User, Loader2, MessageSquare, RefreshCw
} from 'lucide-react'

function fmtHora(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const agora = new Date()
  const diffDias = Math.floor((agora - d) / 86400000)
  if (diffDias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDias === 1) return 'Ontem'
  if (diffDias < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtHoraCompleto(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ nome, size = 'md' }) {
  const inicial = (nome || '?')[0].toUpperCase()
  const cores = ['bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-indigo-500']
  const cor = cores[(nome || '').charCodeAt(0) % cores.length]
  const sz = size === 'sm' ? 'w-9 h-9 text-sm' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-base'
  return <div className={`${sz} ${cor} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>{inicial}</div>
}

function ModalNovaConversa({ onClose, onEnviado }) {
  const [phone, setPhone] = useState('')
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true); setErro('')
    try {
      await api('/api/admin/inbox/conversas', { method: 'POST', body: JSON.stringify({ phone, nome: nome || undefined, texto }) })
      onEnviado(phone.replace(/\D/g, ''))
    } catch (err) { setErro(err.message) } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={enviar} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">Nova conversa</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm mb-4">{erro}</div>}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Telefone *</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)} required
              placeholder="5511999999999" className="input-field font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">Com código do país e DDD, sem espaços</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Nome (opcional)</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contato" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Mensagem *</label>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} required rows={3} className="input-field resize-none" placeholder="Olá! Aqui é a equipe Barber Mark..." />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="btn-ghost border border-slate-200 flex-1 justify-center">Cancelar</button>
          <button type="submit" disabled={enviando} className="btn-primary flex-1 justify-center">
            {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Send size={14} /> Enviar</>}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Inbox() {
  const [conversas, setConversas] = useState([])
  const [phoneAtivo, setPhoneAtivo] = useState(null)
  const [convAtiva, setConvAtiva] = useState(null)
  const [busca, setBusca] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMsgs, setCarregandoMsgs] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [recarregando, setRecarregando] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const carregarLista = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    else setRecarregando(true)
    try {
      const data = await api(`/api/admin/inbox/conversas${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`)
      setConversas(data.conversas || [])
    } catch { } finally { setCarregando(false); setRecarregando(false) }
  }, [busca])

  const carregarConversa = useCallback(async (phone, silencioso = false) => {
    if (!silencioso) setCarregandoMsgs(true)
    try {
      const data = await api(`/api/admin/inbox/conversas/${phone}`)
      setConvAtiva(data)
      if (!silencioso) {
        await api(`/api/admin/inbox/conversas/${phone}/lida`, { method: 'PATCH' })
        setConversas(prev => prev.map(c => c.phone === phone ? { ...c, naoLidas: 0 } : c))
      }
    } catch { } finally { setCarregandoMsgs(false) }
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])

  useEffect(() => {
    const t = setInterval(() => {
      carregarLista(true)
      if (phoneAtivo) carregarConversa(phoneAtivo, true)
    }, 5000)
    return () => clearInterval(t)
  }, [phoneAtivo, carregarLista, carregarConversa])

  useEffect(() => {
    if (phoneAtivo) carregarConversa(phoneAtivo)
  }, [phoneAtivo, carregarConversa])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convAtiva?.mensagens?.length])

  const abrirConversa = async (phone) => {
    setPhoneAtivo(phone)
    inputRef.current?.focus()
  }

  const enviar = async () => {
    if (!texto.trim() || !phoneAtivo) return
    setEnviando(true); setErroEnvio('')
    try {
      await api(`/api/admin/inbox/conversas/${phoneAtivo}/enviar`, { method: 'POST', body: JSON.stringify({ texto: texto.trim() }) })
      setTexto('')
      await carregarConversa(phoneAtivo, true)
      await carregarLista(true)
    } catch (err) { setErroEnvio(err.message) } finally { setEnviando(false) }
  }

  const arquivar = async (phone) => {
    await api(`/api/admin/inbox/conversas/${phone}/arquivar`, { method: 'PATCH' })
    if (phone === phoneAtivo) { setPhoneAtivo(null); setConvAtiva(null) }
    await carregarLista(true)
  }

  const convAtualizada = conversas.find(c => c.phone === phoneAtivo)
  const totalNaoLidas = conversas.reduce((acc, c) => acc + (c.naoLidas || 0), 0)

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Inbox — WhatsApp
            {totalNaoLidas > 0 && (
              <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalNaoLidas}</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Mensagens recebidas e enviadas pelo número admin</p>
        </div>
        <button onClick={() => setModalNova(true)} className="btn-primary">
          <Plus size={15} /> Nova conversa
        </button>
      </div>

      {/* Layout */}
      <div className="flex flex-1 gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
        {/* Lista de conversas */}
        <div className="w-80 shrink-0 border-r border-slate-100 flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar contato..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria/50"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Carregando...</span>
              </div>
            ) : conversas.length === 0 ? (
              <div className="py-16 text-center px-4">
                <MessageCircle size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">Nenhuma conversa</p>
                <p className="text-xs text-slate-400 mt-1">Mensagens recebidas pelo WhatsApp admin aparecerão aqui</p>
              </div>
            ) : (
              conversas.map(c => (
                <button
                  key={c.phone}
                  onClick={() => abrirConversa(c.phone)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-slate-50 transition-colors group ${c.phone === phoneAtivo ? 'bg-primaria/5 border-l-2 border-l-primaria' : 'hover:bg-slate-50'}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar nome={c.nome} size="sm" />
                    {c.naoLidas > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{c.naoLidas > 9 ? '9+' : c.naoLidas}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${c.naoLidas > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{c.nome || c.phone}</p>
                      <span className="text-[11px] text-slate-400 shrink-0">{fmtHora(c.ultimaAtividade)}</span>
                    </div>
                    {c.ultimaMensagem && (
                      <p className={`text-xs truncate mt-0.5 ${c.naoLidas > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {c.ultimaMensagem.de === 'admin' && <span className="text-primaria font-semibold">Você: </span>}
                        {c.ultimaMensagem.texto}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-300 font-mono mt-0.5">{c.phone}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); arquivar(c.phone) }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-all"
                    title="Arquivar"
                  >
                    <Archive size={13} />
                  </button>
                </button>
              ))
            )}
          </div>

          {recarregando && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw size={11} className="animate-spin" /> Atualizando...
            </div>
          )}
        </div>

        {/* Painel de chat */}
        {!phoneAtivo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-500">Selecione uma conversa</p>
            <p className="text-sm text-slate-400 mt-1">ou inicie uma nova clicando em "Nova conversa"</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header da conversa */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-white">
              <Avatar nome={convAtualizada?.nome || convAtiva?.nome} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{convAtualizada?.nome || convAtiva?.nome || phoneAtivo}</p>
                <p className="text-xs text-slate-400 font-mono">{phoneAtivo}</p>
              </div>
              <button
                onClick={() => arquivar(phoneAtivo)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Arquivar conversa"
              >
                <Archive size={16} />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
              {carregandoMsgs ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Carregando...</span>
                </div>
              ) : !convAtiva?.mensagens?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageCircle size={28} className="text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma mensagem ainda</p>
                  <p className="text-xs text-slate-300 mt-1">Envie a primeira mensagem abaixo</p>
                </div>
              ) : (
                <>
                  {convAtiva.mensagens.map((msg, i) => {
                    const eAdmin = msg.de === 'admin'
                    const anterior = i > 0 ? convAtiva.mensagens[i - 1] : null
                    const novoBloco = !anterior || anterior.de !== msg.de
                    return (
                      <div key={msg.id} className={`flex ${eAdmin ? 'justify-end' : 'justify-start'} ${novoBloco ? 'mt-3' : 'mt-0.5'}`}>
                        <div className={`max-w-[72%] ${eAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                          {novoBloco && msg.de === 'admin' && msg.adminNome && (
                            <p className="text-[10px] text-slate-400 mb-0.5 pr-1">{msg.adminNome}</p>
                          )}
                          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${eAdmin
                            ? 'bg-primaria text-white rounded-br-sm'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                          }`}>
                            {msg.texto}
                          </div>
                          <p className={`text-[10px] mt-0.5 px-1 flex items-center gap-1 ${eAdmin ? 'text-slate-400' : 'text-slate-400'}`}>
                            {fmtHoraCompleto(msg.ts)}
                            {eAdmin && <CheckCheck size={11} className="text-primaria/60" />}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-100 bg-white">
              {erroEnvio && (
                <div className="mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <X size={12} /> {erroEnvio}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  rows={texto.split('\n').length > 3 ? 3 : Math.max(1, texto.split('\n').length)}
                  placeholder="Digite uma mensagem... (Enter para enviar)"
                  className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria/50 resize-none leading-relaxed"
                />
                <button
                  onClick={enviar}
                  disabled={enviando || !texto.trim()}
                  className="p-2.5 bg-primaria hover:bg-primaria/90 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all shadow-sm"
                >
                  {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 px-1">Shift+Enter para nova linha</p>
            </div>
          </div>
        )}
      </div>

      {modalNova && (
        <ModalNovaConversa
          onClose={() => setModalNova(false)}
          onEnviado={async (phone) => { setModalNova(false); await carregarLista(true); abrirConversa(phone) }}
        />
      )}
    </div>
  )
}

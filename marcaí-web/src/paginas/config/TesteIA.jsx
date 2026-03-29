import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, RotateCcw, ArrowLeft, Bot, User, Loader2, Info, CheckCheck } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const DICAS = [
  'Quero marcar um corte para amanhã',
  'Que horários tem disponível no sábado?',
  'Quanto custa corte e barba?',
  'Quero cancelar meu agendamento',
  'Vocês cortam cabelo infantil?',
  'Quero saber sobre o plano mensal',
]

const TesteIA = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resetando, setResetando] = useState(false)
  const [conversaId, setConversaId] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando])

  const enviar = async (msgTexto) => {
    const conteudo = (msgTexto || texto).trim()
    if (!conteudo || enviando) return

    setTexto('')
    setMensagens((prev) => [...prev, { de: 'usuario', conteudo, ts: new Date() }])
    setEnviando(true)

    try {
      const res = await api.post('/api/ia/teste', { mensagem: conteudo })
      const dados = res.dados
      if (dados?.conversaId) setConversaId(dados.conversaId)

      const resposta = dados?.resposta || '(sem resposta)'
      setMensagens((prev) => [...prev, { de: 'don', conteudo: resposta, ts: new Date() }])
    } catch {
      setMensagens((prev) => [
        ...prev,
        { de: 'don', conteudo: '⚠️ Erro ao processar. Verifique se a API está rodando.', ts: new Date(), erro: true },
      ])
    } finally {
      setEnviando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const resetar = async () => {
    if (resetando) return
    setResetando(true)
    try {
      await api.post('/api/ia/teste/resetar')
      setMensagens([])
      setConversaId(null)
      toast('Sessão de teste resetada. Começa do zero!', 'sucesso')
    } catch {
      toast('Erro ao resetar a sessão.', 'erro')
    } finally {
      setResetando(false)
    }
  }

  const formatarHora = (ts) =>
    ts instanceof Date ? ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
      {/* Header estilo WhatsApp */}
      <div className="bg-[#1a1f2e] text-white px-4 py-3 flex items-center gap-3 shrink-0 rounded-t-2xl shadow">
        <button
          onClick={() => navigate('/config/ia')}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="w-10 h-10 rounded-full bg-primaria/20 border-2 border-primaria flex items-center justify-center shrink-0">
          <Bot size={20} className="text-primaria" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">Don — Recepcionista IA</p>
          <p className="text-[11px] text-white/50 leading-tight">Simulação real · cria agendamentos de verdade</p>
        </div>

        <button
          onClick={resetar}
          disabled={resetando}
          title="Resetar sessão de teste"
          className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white bg-white/8 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {resetando ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          Resetar
        </button>
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 shrink-0">
        <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-700 leading-snug">
          Esta é uma simulação <strong>real</strong>: o Don usa ferramentas, consulta horários e cria agendamentos no banco.
          Clique em <strong>Resetar</strong> para limpar tudo ao terminar.
          {conversaId && (
            <span className="ml-1 text-amber-600">· conversa #{conversaId.slice(-6)}</span>
          )}
        </p>
      </div>

      {/* Área de mensagens */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
        style={{ background: 'linear-gradient(to bottom, #f0f4ff 0%, #e8f0fe 100%)' }}
      >
        {mensagens.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primaria/10 border-2 border-primaria/20 flex items-center justify-center mx-auto mb-4">
              <Bot size={28} className="text-primaria" />
            </div>
            <p className="text-texto font-semibold mb-1">Teste o Don ao vivo</p>
            <p className="text-texto-sec text-sm mb-6">Mande uma mensagem como se fosse um cliente novo</p>

            <div className="flex flex-wrap gap-2 justify-center">
              {DICAS.map((d) => (
                <button
                  key={d}
                  onClick={() => enviar(d)}
                  className="text-xs bg-white border border-borda text-texto-sec hover:text-primaria hover:border-primaria px-3 py-1.5 rounded-full transition-colors shadow-sm"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((msg, i) => (
          <div key={i} className={`flex ${msg.de === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            {msg.de === 'don' && (
              <div className="w-7 h-7 rounded-full bg-primaria/15 border border-primaria/25 flex items-center justify-center shrink-0 mr-1.5 mt-auto mb-1">
                <Bot size={13} className="text-primaria" />
              </div>
            )}
            <div
              className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                msg.de === 'usuario'
                  ? 'bg-primaria text-white rounded-tr-sm'
                  : msg.erro
                  ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
                  : 'bg-white border border-borda text-texto rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-snug">{msg.conteudo}</p>
              <div className={`flex items-center justify-end gap-1 mt-1 ${msg.de === 'usuario' ? 'text-white/60' : 'text-texto-sec'}`}>
                <span className="text-[10px]">{formatarHora(msg.ts)}</span>
                {msg.de === 'usuario' && <CheckCheck size={12} />}
              </div>
            </div>
            {msg.de === 'usuario' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 ml-1.5 mt-auto mb-1">
                <User size={13} className="text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start items-end gap-1.5">
            <div className="w-7 h-7 rounded-full bg-primaria/15 border border-primaria/25 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-primaria" />
            </div>
            <div className="bg-white border border-borda px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '160ms' }} />
                <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '320ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-borda px-4 py-3 shrink-0 rounded-b-2xl">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder="Digite como se fosse o cliente..."
            rows={1}
            className="flex-1 px-4 py-2.5 border border-borda rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primaria/30 max-h-32 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => enviar()}
            disabled={enviando || !texto.trim()}
            className="bg-primaria hover:bg-primaria-escura disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shrink-0"
          >
            {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] text-texto-sec mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  )
}

export default TesteIA

import { useState, useEffect } from 'react'
import { api } from '../api'
import { MessageSquare, Wifi, WifiOff, Loader2, RefreshCw, Phone, User } from 'lucide-react'

export default function Vendas() {
  const [status, setStatus] = useState('desconectado')
  const [qr, setQr] = useState(null)
  const [conversas, setConversas] = useState([])
  const [loading, setLoading] = useState(false)
  const [conversaSelecionada, setConversaSelecionada] = useState(null)

  const carregarStatus = async () => {
    try {
      const s = await api('/api/admin/vendas/status')
      setStatus(s.status)
      setQr(s.qr)
    } catch {}
  }

  const carregarConversas = async () => {
    try {
      const c = await api('/api/admin/vendas/conversas')
      setConversas(c)
    } catch {}
  }

  useEffect(() => {
    carregarStatus()
    carregarConversas()
    const interval = setInterval(() => {
      carregarStatus()
      carregarConversas()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const conectar = async () => {
    setLoading(true)
    try {
      const s = await api('/api/admin/vendas/conectar', { method: 'POST' })
      setStatus(s.status)
      setQr(s.qr)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const desconectar = async () => {
    if (!confirm('Desconectar WhatsApp de vendas?')) return
    try {
      await api('/api/admin/vendas/desconectar', { method: 'POST' })
      setStatus('desconectado')
      setQr(null)
    } catch (err) {
      alert(err.message)
    }
  }

  const detalhes = conversaSelecionada
    ? conversas.find(c => c.telefone === conversaSelecionada)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Vendas WhatsApp</h1>
          <p className="text-sm text-slate-500">IA Gemini vendendo o Marcai Barber automaticamente</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            status === 'conectado' ? 'bg-emerald-100 text-emerald-700' :
            status === 'aguardando_qr' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-500'
          }`}>
            {status === 'conectado' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {status === 'conectado' ? 'Conectado' : status === 'aguardando_qr' ? 'Aguardando QR' : 'Desconectado'}
          </div>
          {status === 'conectado' ? (
            <button onClick={desconectar} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
              Desconectar
            </button>
          ) : (
            <button onClick={conectar} disabled={loading} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primaria text-white hover:bg-primaria-escura disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Conectar WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {/* QR Code */}
      {status === 'aguardando_qr' && qr && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6 flex flex-col items-center">
          <p className="text-sm text-slate-600 mb-4">Escaneie o QR Code com o WhatsApp de vendas</p>
          <img src={qr} alt="QR Code" className="w-64 h-64 rounded-lg" />
          <p className="text-xs text-slate-400 mt-3">O QR expira em alguns segundos. Se não funcionar, clique em Conectar novamente.</p>
        </div>
      )}

      {/* Conversas */}
      {status === 'conectado' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de conversas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase font-semibold">Leads ({conversas.length})</p>
              <button onClick={carregarConversas}><RefreshCw size={12} className="text-slate-400" /></button>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
              {conversas.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-400 text-center">Nenhuma conversa ainda. Quando alguem mandar mensagem, aparece aqui.</p>
              ) : conversas.map(c => (
                <button
                  key={c.telefone}
                  onClick={() => setConversaSelecionada(c.telefone)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                    conversaSelecionada === c.telefone ? 'bg-primaria/5 border-l-2 border-primaria' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                      <User size={14} className="text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">+{c.telefone}</p>
                      <p className="text-xs text-slate-400 truncate">{c.ultimaMensagem}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{c.total} msg</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalhes da conversa */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">
                {detalhes ? `+${detalhes.telefone}` : 'Selecione uma conversa'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[550px] bg-slate-50">
              {detalhes ? detalhes.mensagens.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    m.role === 'model'
                      ? 'bg-white border border-slate-200 text-slate-700'
                      : 'bg-primaria text-white'
                  }`}>
                    {m.texto}
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  <MessageSquare size={16} className="mr-2" /> Selecione um lead para ver a conversa
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desconectado */}
      {status === 'desconectado' && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MessageSquare size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">WhatsApp de vendas desconectado</h3>
          <p className="text-sm text-slate-500 mb-6">Conecte um WhatsApp para a IA comecar a vender o Marcai Barber automaticamente</p>
          <button onClick={conectar} className="px-6 py-2.5 rounded-lg bg-primaria text-white font-medium hover:bg-primaria-escura">
            Conectar WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Save, CheckCircle2, Bot, Send, Sparkles, Scissors, FlaskConical } from 'lucide-react'
import api from '../../servicos/api'
import { tomsDeVoz, opcoesAntecedencia, cn } from '../../lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import { useToast } from '../../contextos/ToastContexto'

const ConfigIA = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [config, setConfig] = useState({
    tomDeVoz: 'DESCONTRALIDO',
    mensagemBoasVindas: '',
    mensagemForaHorario: '',
    mensagemRetorno: '',
    antecedenciaCancelar: 2,
  })
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [mensagemPreview, setMensagemPreview] = useState('')
  const [historicoPreview, setHistoricoPreview] = useState([])
  const [simulando, setSimulando] = useState(false)

  useEffect(() => {
    api.get('/api/tenants/meu').then((r) => {
      const t = r.dados
      setConfig({
        tomDeVoz: t.tomDeVoz || 'DESCONTRALIDO',
        mensagemBoasVindas: t.mensagemBoasVindas || '',
        mensagemForaHorario: t.mensagemForaHorario || '',
        mensagemRetorno: t.mensagemRetorno || '',
        antecedenciaCancelar: t.antecedenciaCancelar || 2,
      })
      setCarregando(false)
    })
  }, [])

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.patch('/api/tenants/meu/configuracao-ia', config)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (e) {
      toast('Erro ao salvar', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const enviarPreview = async () => {
    if (!mensagemPreview.trim()) return
    const msg = mensagemPreview
    setMensagemPreview('')
    setHistoricoPreview((h) => [...h, { de: 'usuario', conteudo: msg }])
    setSimulando(true)
    try {
      const res = await api.post('/api/ia/simular', { mensagem: msg })
      setHistoricoPreview((h) => [...h, { de: 'ia', conteudo: res.dados.resposta }])
    } catch {
      setHistoricoPreview((h) => [...h, { de: 'ia', conteudo: 'Erro ao simular. Verifique a configuração da IA.' }])
    } finally {
      setSimulando(false)
    }
  }

  if (carregando) return <div className="p-8 text-center text-texto-sec">Carregando...</div>

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-[2rem] border border-borda bg-gradient-to-br from-[#111111] via-[#1d1916] to-[#2a2018] text-white p-6 md:p-8 shadow-card-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(184,137,77,0.28), transparent 26%), radial-gradient(circle at bottom left, rgba(255,255,255,0.07), transparent 18%)' }} />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3 text-primaria-brilho">
              <Scissors size={15} />
              <span className="text-[11px] uppercase tracking-[0.28em] font-semibold">Recepção automatizada</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl tracking-[0.14em] leading-none">DON IA</h1>
            <p className="text-sm md:text-base text-white/78 mt-3 max-w-xl">
              Ajuste a personalidade do atendimento para a sua barbearia: tom, horário fora do expediente e regras de cancelamento.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Objetivo</p>
              <p className="text-sm font-semibold">Responder, agendar e vender retorno</p>
            </div>
            <button
              onClick={() => navigate('/config/teste-ia')}
              className="flex items-center gap-2 bg-primaria hover:bg-primaria-escura text-white font-semibold px-5 py-3 rounded-2xl text-sm transition-colors shadow-primaria/30 shadow-md"
            >
              <FlaskConical size={16} />
              Testar Don agora
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={salvar} className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primaria" />
            <h2 className="text-lg font-semibold text-texto">Configurações do Don</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-3">Tom de voz</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tomsDeVoz.map((tom) => (
                <button
                  key={tom.valor}
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, tomDeVoz: tom.valor }))}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    config.tomDeVoz === tom.valor ? 'border-primaria bg-primaria-clara/40' : 'border-borda hover:border-primaria/30'
                  )}
                >
                  <p className="text-sm font-medium text-texto mb-0.5">{tom.label}</p>
                  <p className="text-[11px] text-texto-sec leading-snug">{tom.descricao}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Mensagem de boas-vindas</label>
            <textarea
              value={config.mensagemBoasVindas}
              onChange={(e) => setConfig((p) => ({ ...p, mensagemBoasVindas: e.target.value }))}
              placeholder="Bom dia! Aqui é o Don da Barbearia. Como posso te atender hoje?"
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Mensagem fora do horário</label>
            <textarea
              value={config.mensagemForaHorario}
              onChange={(e) => setConfig((p) => ({ ...p, mensagemForaHorario: e.target.value }))}
              placeholder="A barbearia está fechada agora. Me chama que eu retorno assim que a equipe abrir."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Mensagem de retorno automática</label>
            <textarea
              value={config.mensagemRetorno}
              onChange={(e) => setConfig((p) => ({ ...p, mensagemRetorno: e.target.value }))}
              placeholder={`{nome}, já faz {dias} dias desde o seu {servico}.\nQue tal agendar para manter o resultado? — {barbearia}`}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm resize-none"
            />
            <p className="text-xs text-texto-sec mt-1">
              Variáveis: <code className="bg-fundo px-1 rounded">{'{nome}'}</code>, <code className="bg-fundo px-1 rounded">{'{servico}'}</code>, <code className="bg-fundo px-1 rounded">{'{dias}'}</code>, <code className="bg-fundo px-1 rounded">{'{barbearia}'}</code>.
              Deixe vazio para geração automática pela IA.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Antecedência mínima para cancelamento</label>
            <Select value={String(config.antecedenciaCancelar)} onValueChange={(v) => setConfig((p) => ({ ...p, antecedenciaCancelar: Number(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {opcoesAntecedencia.map((o) => (
                  <SelectItem key={o.valor} value={String(o.valor)}>{o.label} de antecedência</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2">
            {sucesso && (
              <span className="flex items-center gap-1.5 text-sucesso text-sm">
                <CheckCircle2 size={16} /> Salvo
              </span>
            )}
            <button
              type="submit"
              disabled={salvando}
              className="ml-auto bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-borda shadow-sm flex flex-col overflow-hidden min-h-[560px]">
          <div className="p-4 border-b border-borda shrink-0">
            <h3 className="font-semibold text-texto flex items-center gap-2">
              <Bot size={16} className="text-primaria" /> Preview do Don
            </h3>
            <p className="text-xs text-texto-sec mt-0.5">Simule uma conversa com a configuração atual da barbearia</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-fundo space-y-3">
            {historicoPreview.length === 0 && (
              <div className="text-center text-texto-sec text-sm py-8">
                <Bot size={28} className="mx-auto text-primaria/30 mb-2" />
                <p>Digite uma mensagem para testar o Don</p>
              </div>
            )}
            {historicoPreview.map((msg, i) => (
              <div key={i} className={`flex ${msg.de === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.de === 'usuario' ? 'bg-primaria text-white rounded-tr-sm' : 'bg-white border border-borda text-texto rounded-tl-sm'}`}>
                  {msg.conteudo}
                </div>
              </div>
            ))}
            {simulando && (
              <div className="flex justify-start">
                <div className="bg-white border border-borda px-4 py-2.5 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-texto-sec rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-texto-sec rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-texto-sec rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-borda shrink-0">
            <div className="flex gap-2">
              <input
                value={mensagemPreview}
                onChange={(e) => setMensagemPreview(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarPreview()}
                placeholder="Quero marcar corte e barba para sábado"
                className="flex-1 px-4 py-2 border border-borda rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
              <button
                onClick={enviarPreview}
                disabled={simulando || !mensagemPreview.trim()}
                className="bg-primaria hover:bg-primaria-escura disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfigIA

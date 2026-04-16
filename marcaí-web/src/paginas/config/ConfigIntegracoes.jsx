import { useEffect, useRef, useState } from 'react'
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Unplug,
  AlertTriangle,
  Smartphone,
  Send,
  Zap,
  Workflow,
  Info,
  ExternalLink,
  Lock,
} from 'lucide-react'
import api from '../../servicos/api'
import { Button } from '../../componentes/ui/button'
import { cn } from '../../lib/utils'

const carregarSdkFacebook = ({ appId, apiVersion }) => new Promise((resolve, reject) => {
  if (window.FB) {
    resolve(window.FB)
    return
  }

  window.fbAsyncInit = function fbAsyncInit() {
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: false,
      version: apiVersion || 'v22.0',
    })
    resolve(window.FB)
  }

  const existente = document.getElementById('facebook-jssdk')
  if (existente) return

  const script = document.createElement('script')
  script.id = 'facebook-jssdk'
  script.async = true
  script.defer = true
  script.crossOrigin = 'anonymous'
  script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
  script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Meta.'))
  document.body.appendChild(script)
})

const ConfigIntegracoes = () => {
  const [config, setConfig] = useState(null)
  const [sendzenStatus, setSendzenStatus] = useState({ status: { conectado: false } })
  const [sendzenForm, setSendzenForm] = useState({
    apiKey: '',
    from: '',
    displayPhoneNumber: '',
    whatsappBusinessAccountId: '',
    phoneNumberId: '',
    webhookSecret: '',
  })
  const [carregando, setCarregando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [salvandoSendzen, setSalvandoSendzen] = useState(false)
  const [desconectandoSendzen, setDesconectandoSendzen] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const sessionRef = useRef({ phoneNumberId: null, wabaId: null, businessAccountId: null })

  const carregarStatusSendzen = async () => {
    try {
      const res = await api.get('/api/ia/sendzen/config')
      const dados = res?.dados || { status: { conectado: false } }
      setSendzenStatus(dados)
      setSendzenForm((atual) => ({
        ...atual,
        from: atual.from || dados?.status?.from || '',
        displayPhoneNumber: atual.displayPhoneNumber || dados?.status?.displayPhoneNumber || '',
        whatsappBusinessAccountId: atual.whatsappBusinessAccountId || dados?.status?.whatsappBusinessAccountId || '',
        phoneNumberId: atual.phoneNumberId || dados?.status?.phoneNumberId || '',
        webhookSecret: atual.webhookSecret || '',
      }))
    } catch {
      setSendzenStatus({ status: { conectado: false } })
    }
  }

  const carregar = async () => {
    setCarregando(true)
    try {
      const [metaRes] = await Promise.all([
        api.get('/api/ia/meta/config'),
        carregarStatusSendzen(),
      ])
      setConfig(metaRes?.dados || null)
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível carregar as integrações do WhatsApp.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    const intervalo = setInterval(() => {
      carregarStatusSendzen()
    }, 5000)
    return () => clearInterval(intervalo)
  }, [])

  const iniciarMetaEmbeddedSignup = async () => {
    setConectando(true)
    setErro('')
    setMensagem('')

    try {
      const cfg = config
      if (!cfg?.enabled || !cfg?.appId || !cfg?.configId) {
        throw new Error('Variáveis da Meta ainda não estão configuradas no servidor.')
      }

      sessionRef.current = { phoneNumberId: null, wabaId: null, businessAccountId: null }
      const fb = await carregarSdkFacebook(cfg)

      const messageHandler = (event) => {
        let payload = event.data
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload) } catch { return }
        }
        if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') return

        if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
          sessionRef.current = {
            phoneNumberId: payload.data?.phone_number_id || sessionRef.current.phoneNumberId,
            wabaId: payload.data?.waba_id || sessionRef.current.wabaId,
            businessAccountId: payload.data?.business_account_id || sessionRef.current.businessAccountId,
          }
        }
      }

      window.addEventListener('message', messageHandler)

      const respostaLogin = await new Promise((resolve) => {
        fb.login((response) => resolve(response), {
          config_id: cfg.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            sessionInfoVersion: 3,
          },
        })
      })

      window.removeEventListener('message', messageHandler)

      const code = respostaLogin?.authResponse?.code
      if (!code) {
        throw new Error('A Meta não retornou o code da integração. Tente novamente.')
      }

      await api.post('/api/ia/meta/embedded-signup/complete', {
        code,
        phoneNumberId: sessionRef.current.phoneNumberId,
        wabaId: sessionRef.current.wabaId,
        businessAccountId: sessionRef.current.businessAccountId,
      })

      setMensagem('Integração oficial da Meta concluída com sucesso.')
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || e?.message || 'Não foi possível concluir a integração oficial da Meta.')
    } finally {
      setConectando(false)
    }
  }

  const desconectarMeta = async () => {
    setDesconectando(true)
    setErro('')
    setMensagem('')
    try {
      await api.post('/api/ia/meta/desconectar', {})
      setMensagem('Integração oficial desconectada.')
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível desconectar a integração oficial.')
    } finally {
      setDesconectando(false)
    }
  }

  const salvarSendzen = async () => {
    setSalvandoSendzen(true)
    setErro('')
    setMensagem('')
    try {
      await api.post('/api/ia/sendzen/conectar', {
        apiKey: sendzenForm.apiKey,
        from: sendzenForm.from,
        displayPhoneNumber: sendzenForm.displayPhoneNumber,
        whatsappBusinessAccountId: sendzenForm.whatsappBusinessAccountId,
        phoneNumberId: sendzenForm.phoneNumberId,
        webhookSecret: sendzenForm.webhookSecret,
      })
      setMensagem('Configuração da Sendzen salva com sucesso.')
      setSendzenForm((atual) => ({ ...atual, apiKey: '', webhookSecret: '' }))
      await carregarStatusSendzen()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível salvar a configuração da Sendzen.')
    } finally {
      setSalvandoSendzen(false)
    }
  }

  const desconectarSendzen = async () => {
    setDesconectandoSendzen(true)
    setErro('')
    setMensagem('')
    try {
      await api.post('/api/ia/sendzen/desconectar', {})
      setMensagem('Integração da Sendzen desconectada.')
      await carregarStatusSendzen()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível desconectar a Sendzen.')
    } finally {
      setDesconectandoSendzen(false)
    }
  }

  if (carregando) {
    return (
      <div className="max-w-5xl">
        <div className="flex items-center gap-2 text-texto-sec">
          <Loader2 size={16} className="animate-spin" />
          Carregando ambientes de conectividade…
        </div>
      </div>
    )
  }

  const statusMeta = config?.status || {}
  const metaConectada = Boolean(statusMeta?.conectado)
  const sendzenConectada = Boolean(sendzenStatus?.status?.conectado)
  const webhookSendzenUrl = sendzenStatus?.status?.webhookUrl || ''

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">


      {/* Grid de Integrações */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
        
        {/* Card Meta - Official */}
        <section className="group relative flex flex-col bg-white rounded-3xl border border-borda shadow-card-sm hover:shadow-card transition-all duration-300 overflow-hidden">
          <div className="p-8 space-y-8 flex-1">
            <div className="flex justify-between items-start">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                metaConectada ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
              )}>
                <ShieldCheck size={28} />
              </div>
              <div className={cn(
                "badge border transition-colors",
                metaConectada ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"
              )}>
                {metaConectada ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {metaConectada ? 'Oficial & Ativa' : 'Pendente'}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-texto tracking-tight">Meta Business Official</h2>
              <p className="text-sm text-texto-sec leading-relaxed">
                Integração direta com o WhatsApp Business Platform (API Oficial). 
                Oferece a maior estabilidade, selo de verificação e suporte a alto volume.
              </p>
            </div>

            {!config?.enabled && (
              <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 flex gap-3 text-xs text-red-800 leading-relaxed">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>Configurações de ambiente (META_APP_ID) não detectadas. Entre em contato com o suporte técnico para ativar este módulo.</p>
              </div>
            )}

            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-texto-ter font-medium">Provedor</span>
                <span className="text-texto font-semibold">Meta Cloud API</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-texto-ter font-medium">Compliance</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  Total <ShieldCheck size={12} />
                </span>
              </div>
              {metaConectada && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/50">
                  <span className="text-texto-ter font-medium">WABA ID</span>
                  <span className="text-texto font-mono text-[10px]">{statusMeta?.whatsappBusinessAccountId?.slice(0, 12)}...</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 pt-0 flex gap-3">
            <Button 
              onClick={iniciarMetaEmbeddedSignup} 
              disabled={conectando || !config?.enabled} 
              variante={metaConectada ? "secondary" : "default"}
              className="flex-1 h-12 rounded-xl text-sm font-bold gap-2"
            >
              {conectando ? <Loader2 size={16} className="animate-spin" /> : <Workflow size={16} />}
              {metaConectada ? 'Atualizar Conexão' : 'Conectar via Meta'}
            </Button>

            {metaConectada && (
              <Button 
                variante="outline" 
                onClick={desconectarMeta} 
                disabled={desconectando} 
                className="h-12 w-12 rounded-xl p-0 shrink-0 border-destructive/20 hover:bg-destructive/10 text-destructive"
              >
                {desconectando ? <Loader2 size={16} className="animate-spin" /> : <Unplug size={18} />}
              </Button>
            )}
          </div>
        </section>

        {/* Card Sendzen - Contingency */}
        <section className="group relative flex flex-col bg-white rounded-3xl border border-borda shadow-card-sm hover:shadow-card transition-all duration-300">
          <div className="p-8 space-y-6 flex-1">
            <div className="flex justify-between items-start">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                sendzenConectada ? "bg-primaria-clara/20 text-primaria" : "bg-slate-50 text-slate-400"
              )}>
                <Send size={26} />
              </div>
              <div className={cn(
                "badge border transition-colors",
                sendzenConectada ? "bg-primaria-clara/30 border-primaria/20 text-primaria-escura" : "bg-slate-50 border-slate-100 text-slate-500"
              )}>
                {sendzenConectada ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {sendzenConectada ? 'Sendzen Ativa' : 'Modo Contingência'}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-texto tracking-tight flex items-center gap-2">
                Sendzen Gateway <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest font-bold">Backup</span>
              </h2>
              <p className="text-sm text-texto-sec leading-relaxed">
                Utilize a Sendzen como canal de contingência. Perfeito para manter sua barbearia operando durante processos de análise da Meta.
              </p>
            </div>

            <div className="bg-fundo rounded-2xl p-4 border border-borda/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-texto-ter font-bold uppercase tracking-wider">Status Remetente</p>
                <p className="text-sm font-semibold truncate">{sendzenStatus?.status?.displayPhoneNumber || sendzenStatus?.status?.from || 'Nenhum definido'}</p>
              </div>
              <div className="space-y-1 col-span-1 sm:col-span-2">
                <p className="text-[10px] text-texto-ter font-bold uppercase tracking-wider">URL do Webhook para Sendzen</p>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="text" 
                    readOnly 
                    value={webhookSendzenUrl}
                    placeholder="A URL do webhook será gerada pelo servidor"
                    className="input-base h-9 text-xs flex-1 bg-slate-50 cursor-text select-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-texto-sec mt-1">Use esta URL específica deste tenant no painel da Sendzen para receber mensagens.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-texto-ter uppercase flex items-center gap-2">
                    <Lock size={10} /> API Token
                  </label>
                  <input 
                    type="password"
                    value={sendzenForm.apiKey} 
                    onChange={(e) => setSendzenForm((p) => ({ ...p, apiKey: e.target.value }))} 
                    placeholder="sk_live_..." 
                    className="input-base h-11" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-texto-ter uppercase flex items-center gap-2">
                    <Smartphone size={10} /> Número Origem
                  </label>
                  <input 
                    value={sendzenForm.from} 
                    onChange={(e) => setSendzenForm((p) => ({ ...p, from: e.target.value }))} 
                    placeholder="55..." 
                    className="input-base h-11" 
                  />
                </div>
              </div>

              {/* Advanced toggle or simplified view */}
              <div className="pt-2">
                <details className="group/details">
                  <summary className="flex items-center gap-2 text-[11px] font-bold text-texto-ter uppercase cursor-pointer hover:text-primaria transition-colors">
                    <Info size={10} /> Configurações Avançadas
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 animate-enter">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-texto-ter uppercase">Nome de Exibição</label>
                      <input 
                        value={sendzenForm.displayPhoneNumber} 
                        onChange={(e) => setSendzenForm((p) => ({ ...p, displayPhoneNumber: e.target.value }))} 
                        placeholder="Ex.: +55 11 99999-9999" 
                        className="input-base h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-texto-ter uppercase">Phone Number ID</label>
                      <input
                        value={sendzenForm.phoneNumberId}
                        onChange={(e) => setSendzenForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
                        placeholder="ID da linha na Sendzen"
                        className="input-base h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-texto-ter uppercase">WABA ID</label>
                      <input
                        value={sendzenForm.whatsappBusinessAccountId}
                        onChange={(e) => setSendzenForm((p) => ({ ...p, whatsappBusinessAccountId: e.target.value }))}
                        placeholder="WhatsApp Business Account ID"
                        className="input-base h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-texto-ter uppercase">Webhook Secret</label>
                      <input 
                        value={sendzenForm.webhookSecret} 
                        onChange={(e) => setSendzenForm((p) => ({ ...p, webhookSecret: e.target.value }))} 
                        placeholder="Mesmo secret configurado no webhook da Sendzen" 
                        className="input-base h-11" 
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div className="p-8 pt-0 flex gap-3">
             <Button 
              onClick={salvarSendzen} 
              disabled={salvandoSendzen} 
              variante={sendzenConectada ? "secondary" : "default"}
              className="flex-1 h-12 rounded-xl text-sm font-bold gap-2"
            >
              {salvandoSendzen ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {salvandoSendzen ? 'Sincronizando…' : sendzenConectada ? 'Atualizar Configuração' : 'Ativar Sendzen'}
            </Button>

            {sendzenConectada && (
              <Button 
                variante="outline" 
                onClick={desconectarSendzen} 
                disabled={desconectandoSendzen} 
                className="h-12 w-12 rounded-xl p-0 shrink-0 border-destructive/20 hover:bg-destructive/10 text-destructive"
              >
                {desconectandoSendzen ? <Loader2 size={16} className="animate-spin" /> : <Unplug size={18} />}
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Rodapé Informativo */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Workflow size={120} />
        </div>
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0 w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <Info size={32} className="text-primaria-brilho" />
          </div>
          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold font-display">Dica de Infraestrutura</h3>
            <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
              O Don IA prioriza automaticamente a Meta Official. Caso a conexão caia ou a Meta esteja indisponível, 
              ele faz o failover para a Sendzen sem perder mensagens dos seus clientes.
            </p>
          </div>
          <a 
            href="https://www.sendzen.io/pt" 
            target="_blank" 
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl border border-white/5 transition-all text-sm font-semibold"
          >
            Documentação <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Toasts / Feedbacks */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none min-w-[320px]">
        {mensagem && (
          <div className="pointer-events-auto animate-enter rounded-2xl border border-emerald-500/20 bg-[#0c1811] text-emerald-400 p-4 shadow-2xl flex items-center gap-3">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">{mensagem}</span>
          </div>
        )}
        {erro && (
          <div className="pointer-events-auto animate-enter rounded-2xl border border-destructive/20 bg-[#1a0c0c] text-destructive p-4 shadow-2xl flex items-center gap-3">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{erro}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfigIntegracoes

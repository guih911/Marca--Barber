import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Wifi, MessageCircle, Plug2, RefreshCw } from 'lucide-react'
import api from '../servicos/api'
import { useToast } from '../contextos/ToastContexto'
import { Button } from './ui/button'
import ModalConfirmar from './ui/ModalConfirmar'

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

/**
 * Canto superior: status + botão que abre o Facebook (Embedded Signup) para conectar o WhatsApp Business.
 * Quando conectado, o pill vira um botão que abre um modal para desconectar.
 */
const ConectarWhatsappButton = () => {
  const toast = useToast()
  const [config, setConfig] = useState(null)
  const [conectado, setConectado] = useState(false)
  const [numero, setNumero] = useState(null)
  const [statusMeta, setStatusMeta] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [modal, setModal] = useState(null) // null | 'desconectar' | 'reassinar'
  const [acaoCarregando, setAcaoCarregando] = useState(false)
  const sessionRef = useRef({ phoneNumberId: null, wabaId: null, businessAccountId: null })
  const podeUsarPortal = typeof document !== 'undefined'

  const carregarStatus = useCallback(async () => {
    try {
      const metaRes = await api.get('/api/ia/meta/config')
      const c = metaRes?.dados || null
      setConfig(c)
      const ok = Boolean(c?.status?.conectado)
      setConectado(ok)
      setNumero(c?.status?.displayPhoneNumber || null)
      setStatusMeta(c?.status || null)
    } catch {
      setConfig(null)
      setConectado(false)
      setNumero(null)
      setStatusMeta(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarStatus()
    const t = setInterval(carregarStatus, 15000)
    return () => clearInterval(t)
  }, [carregarStatus])

  const iniciarConexao = async () => {
    if (!config?.enabled || !config?.appId || !config?.configId) {
      toast('Integração indisponível. Contate o suporte.', 'erro')
      return
    }
    setConectando(true)
    try {
      sessionRef.current = { phoneNumberId: null, wabaId: null, businessAccountId: null }
      const fb = await carregarSdkFacebook(config)

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
      const hrefSemHashQuery = String(window.location.href).split('#')[0].split('?')[0]
      let respostaLogin
      try {
        respostaLogin = await new Promise((resolve) => {
          fb.login((response) => resolve(response), {
            config_id: config.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              feature: 'whatsapp_embedded_signup',
              sessionInfoVersion: 3,
            },
          })
        })
        await new Promise((r) => setTimeout(r, 1600))
      } finally {
        window.removeEventListener('message', messageHandler)
      }

      const code = respostaLogin?.authResponse?.code
      if (!code) {
        throw new Error('A Meta não retornou o code. Tente de novo.')
      }

      const completo = await api.post('/api/ia/meta/embedded-signup/complete', {
        code,
        phoneNumberId: sessionRef.current.phoneNumberId,
        wabaId: sessionRef.current.wabaId,
        businessAccountId: sessionRef.current.businessAccountId,
        redirectUri: hrefSemHashQuery,
      })

      const avisos = completo?.dados?.avisos
      if (Array.isArray(avisos) && avisos.length) {
        toast(avisos.join(' '), 'aviso')
      } else {
        toast('WhatsApp conectado com sucesso.', 'sucesso')
      }
      await carregarStatus()
    } catch (e) {
      const base = e?.erro?.mensagem || e?.message || 'Não foi possível concluir a conexão.'
      const dica = e?.erro?.dica
      toast(dica ? `${base} — ${dica}` : base, 'erro')
    } finally {
      setConectando(false)
    }
  }

  const desconectar = async () => {
    setAcaoCarregando(true)
    try {
      await api.post('/api/ia/meta/desconectar', {})
      toast('WhatsApp desconectado.', 'sucesso')
      setModal(null)
      await carregarStatus()
    } catch (e) {
      const msg = e?.erro?.mensagem || e?.message || 'Não foi possível desconectar.'
      toast(msg, 'erro')
    } finally {
      setAcaoCarregando(false)
    }
  }

  const reassinarWebhook = async () => {
    setAcaoCarregando(true)
    try {
      const r = await api.post('/api/ia/meta/reassinar-webhook', {})
      toast(r?.dados?.mensagem || 'Webhook reinscrito com sucesso.', 'sucesso')
      setModal(null)
      await carregarStatus()
    } catch (e) {
      const base = e?.erro?.mensagem || e?.message || 'Não foi possível inscrever o webhook.'
      const dica = e?.erro?.dica
      toast(dica ? `${base} — ${dica}` : base, 'erro')
    } finally {
      setAcaoCarregando(false)
    }
  }

  if (carregando) {
    return (
      <div className="h-9 w-9 shrink-0 flex items-center justify-center" aria-hidden>
        <Loader2 size={16} className="animate-spin text-texto-sec" />
      </div>
    )
  }

  if (conectado) {
    const webhookOk = Boolean(statusMeta?.webhookAssinado)
    const corClasse = webhookOk
      ? 'bg-sucesso/10 text-sucesso hover:bg-sucesso/15'
      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
    const titulo = webhookOk
      ? (numero || 'WhatsApp conectado')
      : 'Conectado, mas o recebimento de mensagens precisa de atenção. Toque para ajustar.'
    return (
      <>
        <button
          type="button"
          onClick={() => setModal('opcoes')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold transition-colors ${corClasse}`}
          title={titulo}
        >
          <Wifi size={13} className="shrink-0" />
          <span className="whitespace-nowrap">
            {webhookOk
              ? (numero ? `Conectado · ${numero}` : 'WhatsApp conectado')
              : 'Conectado · webhook pendente'}
          </span>
        </button>

        {modal === 'opcoes' && podeUsarPortal && createPortal(
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
              <div className="p-5 space-y-3">
                <h3 className="font-semibold text-texto text-base">WhatsApp conectado</h3>
                {numero && (
                  <p className="text-sm text-texto-sec">
                    Número conectado:{' '}
                    <span className="font-medium text-texto">{numero}</span>
                  </p>
                )}
                {!webhookOk && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 space-y-1">
                    <p className="font-medium">
                      O recebimento de mensagens ainda não está liberado pela Meta.
                    </p>
                    <p>
                      Envio de mensagens funciona, mas o WhatsApp ainda não está enviando o
                      webhook para a IA. Tente “Reinscrever webhook”. Se continuar, desconecte e
                      conecte de novo aceitando todas as permissões, ou peça ao suporte para
                      configurar o token do BSP.
                    </p>
                    {statusMeta?.webhookErro ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer opacity-80 hover:opacity-100">
                          Ver detalhe técnico
                        </summary>
                        <p className="mt-1 break-words opacity-80 leading-relaxed">
                          {statusMeta.webhookErro}
                        </p>
                      </details>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  {!webhookOk && (
                    <Button
                      type="button"
                      onClick={reassinarWebhook}
                      disabled={acaoCarregando}
                      className="w-full justify-center gap-2"
                    >
                      {acaoCarregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Reinscrever webhook
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal('desconectar')}
                    disabled={acaoCarregando}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Plug2 size={14} />
                    Desconectar WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="w-full inline-flex items-center justify-center rounded-xl border border-borda text-texto-sec hover:text-texto px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {modal === 'desconectar' && (
          <ModalConfirmar
            titulo="Desconectar WhatsApp?"
            mensagem={
              numero
                ? `Vamos remover a integração do número ${numero}. A IA deixará de enviar e receber mensagens até você conectar de novo.`
                : 'Vamos remover a integração com a Meta. A IA deixará de enviar e receber mensagens até você conectar de novo.'
            }
            labelConfirmar={acaoCarregando ? 'Desconectando…' : 'Desconectar'}
            labelCancelar="Voltar"
            corBotao="perigo"
            carregando={acaoCarregando}
            onConfirmar={desconectar}
            onCancelar={() => setModal('opcoes')}
          />
        )}
      </>
    )
  }

  if (!config?.enabled) {
    return null
  }

  return (
    <Button
      type="button"
      onClick={iniciarConexao}
      disabled={conectando}
      className="h-9 rounded-full text-[11px] md:text-xs font-semibold gap-1.5 px-3 sm:px-4 shadow-sm shrink-0"
    >
      {conectando ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={15} strokeWidth={2.25} />}
      <span>Conectar WhatsApp</span>
    </Button>
  )
}

export default ConectarWhatsappButton

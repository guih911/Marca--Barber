import { useState, useEffect, useRef, useCallback } from 'react'
import {
  apiConfigMeta, apiSalvarConfigMeta, apiTemplates,
  apiCriarTemplate, apiExcluirTemplate, api
} from '../api'
import {
  CheckCircle2, XCircle, AlertTriangle, Wifi, MessageCircle,
  Plug2, RefreshCw, Plus, Trash2, Copy, MessageSquare, Loader2
} from 'lucide-react'

// ─── Facebook SDK loader ────────────────────────────────────────────────────
function carregarSdkFacebook({ appId, apiVersion }) {
  return new Promise((resolve, reject) => {
    if (window.FB) { resolve(window.FB); return }
    window.fbAsyncInit = function () {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: apiVersion || 'v22.0' })
      resolve(window.FB)
    }
    if (document.getElementById('facebook-jssdk')) return
    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Meta.'))
    document.body.appendChild(script)
  })
}

// ─── Botão de conexão ────────────────────────────────────────────────────────
function BotaoConectar({ onConectado }) {
  const [metaCfg, setMetaCfg] = useState(null)
  const [status, setStatus] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [reassinando, setReassindo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [modalOpcoes, setModalOpcoes] = useState(false)
  const sessionRef = useRef({ phoneNumberId: null, wabaId: null, businessAccountId: null })

  const carregar = useCallback(async () => {
    try {
      const data = await api('/api/admin/integracoes/meta/config')
      setMetaCfg(data)
      setStatus(data.status)
      setErroCarga(false)
    } catch { setMetaCfg(null); setErroCarga(true) } finally { setCarregando(false) }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 15000)
    return () => clearInterval(t)
  }, [carregar])

  const conectar = async () => {
    if (!metaCfg?.enabled || !metaCfg?.appId || !metaCfg?.configId) {
      setAviso('Integração indisponível. Variáveis META não configuradas no servidor.')
      return
    }
    setConectando(true)
    setAviso('')
    try {
      sessionRef.current = { phoneNumberId: null, wabaId: null, businessAccountId: null }
      const fb = await carregarSdkFacebook(metaCfg)

      const messageHandler = (event) => {
        let payload = event.data
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { return } }
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

      const hrefBase = String(window.location.href).split('#')[0].split('?')[0]
      let loginResp
      try {
        loginResp = await new Promise((resolve) => {
          fb.login((response) => resolve(response), {
            config_id: metaCfg.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { feature: 'whatsapp_embedded_signup', sessionInfoVersion: 3 },
          })
        })
        await new Promise(r => setTimeout(r, 1600))
      } finally {
        window.removeEventListener('message', messageHandler)
      }

      const code = loginResp?.authResponse?.code
      if (!code) throw new Error('Meta não retornou o code. Tente novamente.')

      const resp = await api('/api/admin/integracoes/meta/complete', {
        method: 'POST',
        body: JSON.stringify({
          code,
          phoneNumberId: sessionRef.current.phoneNumberId,
          wabaId: sessionRef.current.wabaId,
          businessAccountId: sessionRef.current.businessAccountId,
          redirectUri: hrefBase,
        }),
      })

      if (resp.avisos?.length) setAviso(resp.avisos.join(' · '))
      await carregar()
      onConectado?.()
    } catch (e) {
      setAviso(e?.message || 'Não foi possível concluir a conexão.')
    } finally {
      setConectando(false)
    }
  }

  const desconectar = async () => {
    setDesconectando(true)
    try {
      await api('/api/admin/integracoes/meta/desconectar', { method: 'POST' })
      await carregar()
      setModalOpcoes(false)
    } catch (e) { setAviso(e?.message || 'Erro ao desconectar') } finally { setDesconectando(false) }
  }

  const reassinarWebhook = async () => {
    setReassindo(true)
    try {
      const r = await api('/api/admin/integracoes/meta/webhook/reassinar', { method: 'POST' })
      setAviso(r?.mensagem || 'Webhook reinscrito.')
      await carregar()
    } catch (e) { setAviso(e?.message || 'Erro ao reinscrever webhook') } finally { setReassindo(false) }
  }

  if (carregando) {
    return (
      <div className="card p-6 flex items-center gap-3 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Verificando integração Meta...</span>
      </div>
    )
  }

  const conectado = status?.conectado
  const webhookOk = Boolean(status?.webhookAssinado)

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-[#25D366]" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">WhatsApp Business — Admin</h2>
            <p className="text-xs text-slate-500">Número oficial Marcaí para comunicação com tenants</p>
          </div>
        </div>
        {conectado ? (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${webhookOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <Wifi size={12} />
            {webhookOk
              ? (status.displayPhoneNumber ? `Conectado · ${status.displayPhoneNumber}` : 'Conectado')
              : 'Conectado · webhook pendente'
            }
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            <XCircle size={12} />
            Não conectado
          </span>
        )}
      </div>

      {/* Status detalhado quando conectado */}
      {conectado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Número</p>
              <p className="font-semibold text-slate-800">{status.displayPhoneNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Nome verificado</p>
              <p className="font-semibold text-slate-800">{status.verifiedName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Webhook</p>
              <p className={`font-semibold text-sm ${webhookOk ? 'text-emerald-700' : 'text-amber-600'}`}>
                {webhookOk ? '✓ Assinado' : '⚠ Pendente'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Conectado em</p>
              <p className="font-semibold text-slate-800 text-xs">
                {status.conectadoEm ? new Date(status.conectadoEm).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
          {!webhookOk && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mt-2">
              <p className="font-semibold">Recebimento de mensagens pendente</p>
              <p className="mt-0.5">{status.webhookErro || 'Clique em "Reinscrever webhook" abaixo.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Aviso / erro */}
      {aviso && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800 text-sm">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        {!conectado ? (
          <button
            onClick={conectar}
            disabled={conectando || !metaCfg?.enabled}
            className="btn-primary gap-2"
          >
            {conectando
              ? <><Loader2 size={15} className="animate-spin" /> Conectando...</>
              : <><MessageCircle size={15} /> Conectar WhatsApp</>
            }
          </button>
        ) : (
          <>
            {!webhookOk && (
              <button
                onClick={reassinarWebhook}
                disabled={reassinando}
                className="btn-ghost border border-slate-200 gap-2"
              >
                {reassinando
                  ? <><Loader2 size={14} className="animate-spin" /> Resinscrevendo...</>
                  : <><RefreshCw size={14} /> Reinscrever webhook</>
                }
              </button>
            )}
            <button
              onClick={() => setModalOpcoes(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
            >
              <Plug2 size={14} /> Desconectar
            </button>
          </>
        )}
        {!erroCarga && !metaCfg?.enabled && metaCfg !== null && (
          <p className="text-xs text-slate-400 self-center">
            Variáveis META_APP_ID/META_APP_SECRET/META_EMBEDDED_SIGNUP_CONFIG_ID não configuradas no servidor.
          </p>
        )}
        {erroCarga && (
          <p className="text-xs text-red-400 self-center">Não foi possível verificar a configuração do servidor.</p>
        )}
      </div>

      {/* Modal desconectar */}
      {modalOpcoes && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalOpcoes(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-2">Desconectar WhatsApp?</h3>
            <p className="text-sm text-slate-500 mb-4">
              A integração será removida. Disparos em massa pararão de funcionar até reconectar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalOpcoes(false)} className="btn-ghost border border-slate-200 flex-1 justify-center">Cancelar</button>
              <button
                onClick={desconectar}
                disabled={desconectando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                {desconectando ? <Loader2 size={14} className="animate-spin" /> : <Plug2 size={14} />}
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Templates ───────────────────────────────────────────────────────────────
function SecaoTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', corpo: '' })
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(null)

  const carregar = () => {
    setLoading(true)
    apiTemplates().then(setTemplates).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(carregar, [])

  const criar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.corpo.trim()) { setErro('Preencha nome e corpo.'); return }
    setCriando(true); setErro('')
    try {
      await apiCriarTemplate(form)
      setModal(false); setForm({ nome: '', corpo: '' }); carregar()
    } catch (err) { setErro(err.message) } finally { setCriando(false) }
  }

  const excluir = async (id, nome) => {
    if (!confirm(`Excluir template "${nome}"?`)) return
    try { await apiExcluirTemplate(id); carregar() } catch (err) { alert(err.message) }
  }

  const copiar = (texto, id) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(id); setTimeout(() => setCopiado(null), 2000)
    })
  }

  const VARS = ['{nome}', '{plano}', '{slug}']

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
            <MessageSquare size={14} className="text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Templates de mensagem</p>
            <p className="text-xs text-slate-500">{templates.length} template{templates.length !== 1 ? 's' : ''} · usados nos disparos</p>
          </div>
        </div>
        <button onClick={() => { setModal(true); setErro('') }} className="btn-primary">
          <Plus size={15} /> Novo template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-slate-200 border-t-primaria rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center">
          <MessageSquare size={28} className="text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum template criado</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {templates.map(tpl => (
            <div key={tpl.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{tpl.nome}</p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap line-clamp-3 leading-relaxed">{tpl.corpo}</p>
                  <p className="text-[11px] text-slate-400 mt-2">{new Date(tpl.criadoEm).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copiar(tpl.corpo, tpl.id)}
                    className={`p-2 rounded-lg border transition-all ${copiado === tpl.id ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => excluir(tpl.id, tpl.nome)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setModal(false)}>
          <form onSubmit={criar} className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-4">Novo template</h3>
            {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm mb-4">{erro}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">Nome</label>
                <input value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Ex: Boas-vindas, Pagamento pendente..." className="input-field" required />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mensagem</label>
                  <div className="flex items-center gap-1">
                    {VARS.map(v => (
                      <button key={v} type="button" onClick={() => setForm(p => ({...p, corpo: p.corpo + v}))} className="text-[11px] font-mono bg-primaria/10 text-primaria px-1.5 py-0.5 rounded hover:bg-primaria/20 transition-colors">{v}</button>
                    ))}
                  </div>
                </div>
                <textarea value={form.corpo} onChange={e => setForm(p => ({...p, corpo: e.target.value}))} rows={5} className="input-field resize-none" placeholder={'Olá {nome}! 👋\n\nAqui é a equipe Marcaí.'} required />
                {form.corpo && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] text-slate-400 font-semibold mb-1">Preview</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {form.corpo.replace(/\{nome\}/g, 'Barbearia X').replace(/\{plano\}/g, 'SALAO').replace(/\{slug\}/g, 'barbearia-x')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setModal(false)} className="btn-ghost border border-slate-200 flex-1 justify-center">Cancelar</button>
              <button type="submit" disabled={criando} className="btn-primary flex-1 justify-center">
                {criando ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : <><Plus size={15} /> Criar</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function IntegracoesMeta() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Integrações — Meta WhatsApp</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Conecte o número WhatsApp do admin via Facebook para envio e recebimento de mensagens com tenants
        </p>
      </div>
      <BotaoConectar />
      <SecaoTemplates />
    </div>
  )
}

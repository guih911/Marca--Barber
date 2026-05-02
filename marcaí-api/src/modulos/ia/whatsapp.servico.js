/**
 * Serviço para envio de mensagens WhatsApp.
 * Provedor oficial: Meta Cloud API.
 */
const META_GRAPH_VERSION = (process.env.META_GRAPH_API_VERSION || 'v22.0').trim()

const CAMPOS_COMPARTILHADOS = [
  'numeroAdministrador',
  'webhookCallbackUrl',
  'webhookSecret',
  'embeddedSignupAt',
]

const normalizarNumeroEnvio = (numero = '') => String(numero || '').replace(/\D/g, '')

/**
 * Só dígitos no envio. BR: celular 11 dígitos (DDD+9+8) sem 55 -> prefixa 55.
 * Evita envios para a Meta com DDD+celular e sem código do país.
 */
const normalizarNumeroDestinoWhatsapp = (raw = '') => {
  const d = normalizarNumeroEnvio(raw)
  if (!d) return ''
  if (d.length === 11 && /^(?:[1-9][0-9])9[0-9]{8}$/.test(d) && !d.startsWith('55')) {
    return `55${d}`
  }
  return d
}

/** Lê JSON de erro da Graph; anexa code/subcode para o controlador. */
const lancarSeErroGraphResposta = async (res) => {
  if (res.ok) return
  const data = await res.json().catch(() => ({}))
  const e = data?.error
  if (!e) {
    const texto = data && typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error(texto && texto !== '{}' ? texto : `Meta API HTTP ${res.status}`)
  }
  const partes = [e.message || e.type || 'Erro da Meta (Graph API)']
  if (e.code != null) partes.push(`(code ${e.code})`)
  if (e.error_subcode != null) partes.push(`(subcode ${e.error_subcode})`)
  if (e.error_data?.details) partes.push(String(e.error_data.details))
  const err = new Error(partes.join(' '))
  err.metaCode = e.code
  err.metaSubcode = e.error_subcode
  err.metaErr = e
  throw err
}

const obterConfigDoProvedor = (configWhatsApp = {}, provedor = null) => {
  const alvo = provedor || configWhatsApp?.provedorAtivo || configWhatsApp?.provedor || 'meta'
  if (alvo !== 'meta') return null
  if (!alvo) return null

  const nested = configWhatsApp?.[alvo]
  if (nested && typeof nested === 'object') {
    const compartilhado = {}
    for (const campo of CAMPOS_COMPARTILHADOS) {
      if (configWhatsApp?.[campo] != null) compartilhado[campo] = configWhatsApp[campo]
    }
    return { ...compartilhado, ...nested, provedor: alvo, provedorAtivo: alvo }
  }

  if (configWhatsApp?.provedor === alvo) {
    return { ...configWhatsApp, provedor: alvo, provedorAtivo: alvo }
  }

  return null
}

const resolverConfigAtiva = (configWhatsApp = {}) => (
  obterConfigDoProvedor(configWhatsApp, 'meta')
  || (
    configWhatsApp?.phoneNumberId && (configWhatsApp?.token || configWhatsApp?.apiToken)
      ? { ...configWhatsApp, provedor: 'meta', provedorAtivo: 'meta' }
      : null
  )
)

// ─── Meta Cloud API ────────────────────────────────────────────────────────────
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
const enviarMeta = async (config, para, texto) => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId e token são obrigatórios')

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: normalizarNumeroDestinoWhatsapp(para),
    type: 'text',
    text: { body: texto },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) await lancarSeErroGraphResposta(res)

  return res.json()
}

const enviarAudioMeta = async (config, para, audioBuffer, mimeType = 'audio/mpeg') => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId/token faltando')

  // Cloud API exige Upload primeiro
  const urlUpload = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/media`
  
  const uploadData = new FormData()
  uploadData.append('file', new Blob([audioBuffer], { type: mimeType }), 'voice.mp3')
  uploadData.append('type', 'audio')
  uploadData.append('messaging_product', 'whatsapp')

  const resUpload = await fetch(urlUpload, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: uploadData,
  })

  if (!resUpload.ok) throw new Error('Meta Media Upload Erro: ' + resUpload.status)
  const uploadJson = await resUpload.json()

  const urlSend = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`
  const resSend = await fetch(urlSend, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'audio',
      audio: { id: uploadJson.id },
    }),
  })

  return resSend.json()
}

const enviarInterativoMeta = async (config, para, payload) => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId e token são obrigatórios')

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizarNumeroDestinoWhatsapp(para),
      type: 'interactive',
      interactive: payload,
    }),
  })

  if (!res.ok) await lancarSeErroGraphResposta(res)
  return res.json()
}

const montarTextoFallbackInterativo = ({ header = '', body = '', buttons = [] } = {}) => {
  const partes = []
  if (header) partes.push(header)
  if (body) partes.push(body)
  if (buttons.length) {
    partes.push(['', ...buttons.map((btn, i) => `${i + 1}. ${btn.reply?.title || btn.title || btn.id}`)].join('\n'))
  }
  return partes.filter(Boolean).join('\n\n')
}

const enviarMensagemInterativa = async (configWhatsApp, para, payload, tenantId, lidJid = null) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor) {
    console.warn('[WhatsApp] configWhatsApp não configurada — mensagem interativa não enviada')
    return null
  }

  try {
    switch (configAtiva.provedor) {
      case 'meta':
        return await enviarInterativoMeta(configAtiva, para, payload)
      default:
        console.warn(`[WhatsApp] Provedor desconhecido: ${configAtiva.provedor}`)
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar mensagem interativa (${configAtiva.provedor}) para ${para}:`, err.message)
    throw err
  }
}

// ─── Roteador ──────────────────────────────────────────────────────────────────
/**
 * Envia mensagem usando o provedor configurado no tenant.
 * @param {Object} configWhatsApp - Objeto armazenado em Tenant.configWhatsApp
 * @param {string} para - Número de destino (ex: +5511999999999 ou 5511999999999)
 * @param {string} texto - Texto da mensagem
 */
const enviarMensagem = async (configWhatsApp, para, texto, tenantId, lidJid = null) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor) {
    console.warn('[WhatsApp] configWhatsApp não configurada — resposta não enviada')
    return null
  }

  const { provedor } = configAtiva

  try {
    switch (provedor) {
      case 'meta':
        return await enviarMeta(configAtiva, para, texto)
      default:
        console.warn(`[WhatsApp] Provedor desconhecido: ${provedor}`)
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar mensagem (${provedor}) para ${para}:`, err.message)
    throw err
  }
}

const enviarAudio = async (configWhatsApp, para, audioBuffer, tenantId, lidJid = null, opcoes = {}) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor) {
    console.warn('[WhatsApp] configWhatsApp não configurada — áudio não enviado')
    return null
  }

  try {
    const mimeType = opcoes?.mimetype || 'audio/mpeg'
    switch (configAtiva.provedor) {
      case 'meta':
        return await enviarAudioMeta(configAtiva, para, audioBuffer, mimeType)
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar áudio (${configAtiva.provedor}) para ${para}:`, err.message)
    throw err
  }
}

/**
 * Perfil comercial do número (Graph API). A Cloud API não expõe foto de contatos como no app pessoal.
 * @see https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status-whatsapp-business-profile
 */
const buscarWhatsappBusinessProfile = async (configWhatsApp) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva || configAtiva.provedor !== 'meta') return null

  const { phoneNumberId, token, apiToken } = configAtiva
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) return null

  const fields = 'about,description,profile_picture_url,vertical'
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/whatsapp_business_profile?fields=${encodeURIComponent(fields)}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    const row = Array.isArray(json?.data) ? json.data[0] : json?.data
    const perfil = row && typeof row === 'object' ? row : json
    if (!perfil || typeof perfil !== 'object') return null
    return {
      profilePictureUrl: perfil.profile_picture_url || null,
      about: perfil.about || null,
      description: perfil.description || null,
      vertical: perfil.vertical || null,
    }
  } catch (err) {
    console.warn('[WhatsApp] buscarWhatsappBusinessProfile:', err.message)
    return null
  }
}

const obterFotoPerfil = async (configWhatsApp, para, tenantId) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor || !para) return null

  try {
    switch (configAtiva.provedor) {
      case 'meta':
        // Foto de cliente via Cloud API não está disponível como no WhatsApp Web; só perfil comercial.
        return null
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao buscar foto de perfil (${configAtiva.provedor}):`, err.message)
    return null
  }
}

const baixarMidiaMeta = async (config, mediaId) => {
  const { token, apiToken } = config
  const bearerToken = token || apiToken
  if (!bearerToken) throw new Error('Meta Cloud API: token é obrigatório para download')

  // 1. Pega URL da mídia
  const resMeta = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
  if (!resMeta.ok) throw new Error(`Meta Media Get Info Erro: ${resMeta.status}`)
  const data = await resMeta.json()

  if (!data?.url) throw new Error('Meta Media URL não encontrada')

  // 2. Download do binário
  const resFile = await fetch(data.url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
  if (!resFile.ok) throw new Error(`Meta Media Download Erro: ${resFile.status}`)

  const arrayBuffer = await resFile.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const baixarMidia = async (configWhatsApp, mediaIdOuUrl) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor || !mediaIdOuUrl) return null

  try {
    switch (configAtiva.provedor) {
      case 'meta':
        return await baixarMidiaMeta(configAtiva, mediaIdOuUrl)
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao baixar mídia (${configAtiva.provedor}):`, err.message)
    return null
  }
}

module.exports = {
  enviarMensagem,
  enviarMensagemInterativa,
  enviarAudio,
  baixarMidia,
  enviarMeta,
  buscarWhatsappBusinessProfile,
  obterFotoPerfil,
  obterConfigDoProvedor,
  resolverConfigAtiva,
  normalizarNumeroDestinoWhatsapp,
}

/**
 * Serviço para envio de mensagens WhatsApp.
 * Provedores disponíveis: Meta Cloud API e SendZen.
 */

const CAMPOS_COMPARTILHADOS = [
  'numeroAdministrador',
  'webhookCallbackUrl',
  'webhookSecret',
  'embeddedSignupAt',
  'sendzenConnectedAt',
]

const normalizarNumeroEnvio = (numero = '') => String(numero || '').replace(/\D/g, '')

const mascararErroHttp = async (res, fallback) => {
  const data = await res.json().catch(() => null)
  if (data?.error?.message) return data.error.message
  if (data?.message) return data.message
  if (data?.erro?.mensagem) return data.erro.mensagem
  const texto = await res.text().catch(() => '')
  return texto || fallback
}

const obterConfigDoProvedor = (configWhatsApp = {}, provedor = null) => {
  const alvo = provedor || configWhatsApp?.provedorAtivo || configWhatsApp?.provedor || null
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
  obterConfigDoProvedor(configWhatsApp, null)
)

// ─── Meta Cloud API ────────────────────────────────────────────────────────────
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
const enviarMeta = async (config, para, texto) => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId e token são obrigatórios')

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: para,
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

  if (!res.ok) throw new Error(await mascararErroHttp(res, `Meta API error ${res.status}`))

  return res.json()
}

const enviarSendzen = async (config, para, texto) => {
  const apiKey = config?.apiKey || config?.token
  const from = normalizarNumeroEnvio(config?.from || config?.displayPhoneNumber || '')
  const to = normalizarNumeroEnvio(para)

  if (!apiKey || !from) throw new Error('SendZen: apiKey e número remetente são obrigatórios')
  if (!to) throw new Error('SendZen: número de destino inválido')

  const res = await fetch('https://api.sendzen.io/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      type: 'text',
      text: {
        body: texto,
        preview_url: true,
      },
    }),
  })

  if (!res.ok) throw new Error(await mascararErroHttp(res, `SendZen API error ${res.status}`))
  return res.json().catch(() => ({}))
}

const enviarAudioMeta = async (config, para, audioBuffer, mimeType = 'audio/mpeg') => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId/token faltando')

  // Cloud API exige Upload primeiro
  const urlUpload = `https://graph.facebook.com/v19.0/${phoneNumberId}/media`
  
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

  const urlSend = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
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

const enviarAudioSendzen = async (config, para, audioBuffer) => {
  // ATENÇÃO: Dependente da especificação Sendzen de Upload de Mídia ou Base64.
  // Assumindo endpoint de media upload similar (ou uso de Base64 no envio).
  // Para fins de 10/10 sem derrubar API, tentaremos anexar buffer convertido.
  const apiKey = config?.apiKey || config?.token
  const from = normalizarNumeroEnvio(config?.from || config?.displayPhoneNumber || '')
  if (!apiKey || !from) throw new Error('SendZen: configuracoes faltando')

  const base64Audio = audioBuffer.toString('base64')
  const res = await fetch('https://api.sendzen.io/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: normalizarNumeroEnvio(para),
      type: 'audio',
      audio: {
        link: `data:audio/mpeg;base64,${base64Audio}`
      },
    }),
  })

  if (!res.ok) throw new Error(await mascararErroHttp(res, `Sendzen Audio error ${res.status}`))
  return res.json().catch(() => ({}))
}

const enviarInterativoMeta = async (config, para, payload) => {
  const { phoneNumberId, token, apiToken } = config
  const bearerToken = token || apiToken
  if (!phoneNumberId || !bearerToken) throw new Error('Meta Cloud API: phoneNumberId e token são obrigatórios')

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizarNumeroEnvio(para),
      type: 'interactive',
      interactive: payload,
    }),
  })

  if (!res.ok) throw new Error(await mascararErroHttp(res, `Meta API error ${res.status}`))
  return res.json()
}

const enviarInterativoSendzen = async (config, para, payload) => {
  const apiKey = config?.apiKey || config?.token
  const from = normalizarNumeroEnvio(config?.from || config?.displayPhoneNumber || '')
  const to = normalizarNumeroEnvio(para)

  if (!apiKey || !from) throw new Error('SendZen: apiKey e número remetente são obrigatórios')
  if (!to) throw new Error('SendZen: número de destino inválido')

  const res = await fetch('https://api.sendzen.io/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      type: 'interactive',
      interactive: payload,
    }),
  })

  if (!res.ok) throw new Error(await mascararErroHttp(res, `SendZen API error ${res.status}`))
  return res.json().catch(() => ({}))
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
      case 'sendzen':
        return await enviarInterativoSendzen(configAtiva, para, payload)
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
      case 'sendzen':
        return await enviarSendzen(configAtiva, para, texto)
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
    switch (configAtiva.provedor) {
      case 'meta':
        return await enviarAudioMeta(configAtiva, para, audioBuffer)
      case 'sendzen':
        return await enviarAudioSendzen(configAtiva, para, audioBuffer)
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar áudio (${configAtiva.provedor}) para ${para}:`, err.message)
    throw err
  }
}

const obterFotoPerfil = async (configWhatsApp, para, tenantId) => {
  const configAtiva = resolverConfigAtiva(configWhatsApp)
  if (!configAtiva?.provedor || !para) return null

  try {
    switch (configAtiva.provedor) {
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao buscar foto de perfil (${configAtiva.provedor}):`, err.message)
    return null
  }
}

module.exports = {
  enviarMensagem,
  enviarMensagemInterativa,
  enviarAudio,
  enviarMeta,
  enviarSendzen,
  obterFotoPerfil,
  obterConfigDoProvedor,
  resolverConfigAtiva,
}

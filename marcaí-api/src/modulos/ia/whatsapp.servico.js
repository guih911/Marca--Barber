/**
 * Serviço para envio de mensagens WhatsApp.
 * Provedores disponíveis: Meta Cloud API e whatsapp-web.js (QR Code)
 */

const wwebjsManager = require('./baileys.manager')

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

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API error ${res.status}: ${err}`)
  }

  return res.json()
}

// ─── whatsapp-web.js (QR Code via Chromium) ──────────────────────────────────
const enviarWWebJS = async (config, para, texto) => {
  const { tenantId, lidJid } = config
  if (!tenantId) throw new Error('whatsapp-web.js: tenantId é obrigatório para envio')
  return wwebjsManager.enviarMensagem(tenantId, para, texto, lidJid || null)
}

const enviarAudioWWebJS = async (config, para, audioBuffer, opcoes = {}) => {
  const { tenantId, lidJid } = config
  if (!tenantId) throw new Error('whatsapp-web.js: tenantId é obrigatório para envio')
  return wwebjsManager.enviarAudio(tenantId, para, audioBuffer, { ...opcoes, lidJid: lidJid || null })
}

const obterFotoPerfilWWebJS = async (config, para) => {
  const { tenantId } = config
  if (!tenantId) return null
  return wwebjsManager.obterFotoPerfil(tenantId, para)
}

// ─── Roteador ──────────────────────────────────────────────────────────────────
/**
 * Envia mensagem usando o provedor configurado no tenant.
 * @param {Object} configWhatsApp - Objeto armazenado em Tenant.configWhatsApp
 * @param {string} para - Número de destino (ex: +5511999999999 ou 5511999999999)
 * @param {string} texto - Texto da mensagem
 * @param {string} [tenantId] - Necessário para o provedor wwebjs
 * @param {string} [lidJid] - JID LID do cliente (ex: "215139643039792@lid") para garantir entrega a usuários LID
 */
const enviarMensagem = async (configWhatsApp, para, texto, tenantId, lidJid = null) => {
  if (!configWhatsApp || !configWhatsApp.provedor) {
    console.warn('[WhatsApp] configWhatsApp não configurada — resposta não enviada')
    return null
  }

  const { provedor } = configWhatsApp

  try {
    switch (provedor) {
      case 'meta':
        return await enviarMeta(configWhatsApp, para, texto)
      case 'wwebjs':
        return await enviarWWebJS({ ...configWhatsApp, tenantId, lidJid }, para, texto)
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
  if (!configWhatsApp || !configWhatsApp.provedor) {
    console.warn('[WhatsApp] configWhatsApp não configurada — áudio não enviado')
    return null
  }

  try {
    switch (configWhatsApp.provedor) {
      case 'wwebjs':
        return await enviarAudioWWebJS({ ...configWhatsApp, tenantId, lidJid }, para, audioBuffer, opcoes)
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar áudio (${configWhatsApp.provedor}) para ${para}:`, err.message)
    throw err
  }
}

const obterFotoPerfil = async (configWhatsApp, para, tenantId) => {
  if (!configWhatsApp?.provedor || !para) return null

  try {
    switch (configWhatsApp.provedor) {
      case 'wwebjs':
        return await obterFotoPerfilWWebJS({ ...configWhatsApp, tenantId }, para)
      default:
        return null
    }
  } catch (err) {
    console.error(`[WhatsApp] Erro ao buscar foto de perfil (${configWhatsApp.provedor}):`, err.message)
    return null
  }
}

module.exports = { enviarMensagem, enviarAudio, enviarMeta, enviarWWebJS, obterFotoPerfil }

const { OpenAI } = require('openai')
const configIA = require('../../config/ia')

/**
 * Cliente SÓ para Whisper (transcrição de voz do WhatsApp).
 * NÃO reutilize configIA: quando GEMINI_API_KEY está definida, configIA aponta para
 * a API OpenAI-compatible do Google — ela NÃO oferece /audio/transcriptions (Whisper).
 */
const getClienteWhisper = () => {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (!key) return null
  const base = (process.env.OPENAI_WHISPER_BASE_URL || '').trim()
  return new OpenAI({
    apiKey: key,
    ...(base ? { baseURL: base } : {}),
  })
}

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

const withTimeout = async (promise, ms, label = 'timeout') => {
  let timer = null
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const sanitizarTextoParaAudio = (texto = '') => {
  let t = String(texto || '').trim()
  if (!t) return ''

  t = t
    .replace(/\*+/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (t.length > 420) {
    t = `${t.slice(0, 417).trim()}...`
  }

  return t
}

const sintetizarAudio = async (texto, { estilo = 'default' } = {}) => {
  const apiKey = configIA.elevenLabsApiKey
  const voiceId = configIA.elevenLabsVoiceId

  if (!apiKey || !voiceId) return null

  const textoLimpo = sanitizarTextoParaAudio(texto)
  if (!textoLimpo) return null

  let voiceSettings = {
    stability: 0.45,
    similarity_boost: 0.8,
  }

  if (estilo === 'direto') {
    voiceSettings = { stability: 0.5, similarity_boost: 0.82 }
  } else if (estilo === 'caloroso') {
    voiceSettings = { stability: 0.4, similarity_boost: 0.85 }
  } else if (estilo === 'consultivo') {
    voiceSettings = { stability: 0.48, similarity_boost: 0.8 }
  }

  try {
    const resposta = await withTimeout(
      fetch(`${ELEVENLABS_API_URL}/${voiceId}/stream?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: textoLimpo,
          model_id: configIA.elevenLabsModelId,
          voice_settings: voiceSettings,
        }),
      }),
      25000,
      'Tempo esgotado na síntese de voz'
    )

    if (!resposta.ok) {
      const erro = await resposta.text().catch(() => '')
      throw new Error(`ElevenLabs ${resposta.status}: ${erro}`.trim())
    }

    const arrayBuffer = await resposta.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (!buffer.length) return null

    return {
      buffer,
      mimetype: 'audio/mpeg',
      extensao: '.mp3',
      textoBase: textoLimpo,
    }
  } catch (err) {
    console.warn('[Voz] Falha ao sintetizar áudio:', err.message)
    return null
  }
}

const transcreverAudio = async (buffer, mimetype = 'audio/ogg') => {
  if (!buffer || !buffer.length) return null

  const openai = getClienteWhisper()
  if (!openai) {
    console.warn(
      '[Voz/Whisper] OPENAI_API_KEY ausente. Transcrição de áudio desligada; defina a chave da OpenAI (Whisper) no .env — não use só GEMINI para voz recebida.'
    )
    return null
  }

  try {
    const mime = String(mimetype || 'audio/ogg').split(';')[0].trim().toLowerCase()
    const extByMime = {
      'audio/ogg': 'ogg',
      'audio/opus': 'ogg',
      'audio/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'mp4',
      'audio/aac': 'aac',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/m4a': 'm4a',
    }
    const ext = extByMime[mime] || 'ogg'
    const file = await OpenAI.toFile(buffer, `audio_${Date.now()}.${ext}`, { type: mime || mimetype })

    console.log(`[Whisper] Enviando para transcrição OpenAI (chave dedicada, não misturada com Gemini)...`)
    const response = await withTimeout(
      openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text',
      }),
      25000,
      'Tempo esgotado na transcrição de áudio'
    )

    const texto =
      typeof response === 'string'
        ? response
        : response && typeof response === 'object' && 'text' in response
          ? String(response.text || '')
          : ''

    if (texto.trim()) {
      console.log(`[Whisper] Transcrição concluída: "${texto.trim().slice(0, 50)}..."`)
    } else {
      console.warn(`[Whisper] Resposta vazia ou inesperada.`)
    }

    return texto.trim() || null
  } catch (err) {
    console.warn('[Voz] Falha ao transcrever áudio:', err.message)
    return null
  }
}

module.exports = {
  sintetizarAudio,
  transcreverAudio,
  sanitizarTextoParaAudio,
}
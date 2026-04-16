const configIA = require('../../config/ia')

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

module.exports = {
  sintetizarAudio,
  sanitizarTextoParaAudio,
}
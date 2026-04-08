const configIA = require('../../config/ia')

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

const sintetizarAudio = async (texto) => {
  const apiKey = configIA.elevenLabsApiKey
  const voiceId = configIA.elevenLabsVoiceId

  if (!apiKey || !voiceId) return null

  const textoLimpo = String(texto || '').trim()
  if (!textoLimpo) return null

  const resposta = await fetch(`${ELEVENLABS_API_URL}/${voiceId}/stream?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: textoLimpo,
      model_id: configIA.elevenLabsModelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    }),
  })

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
  }
}

module.exports = {
  sintetizarAudio,
}

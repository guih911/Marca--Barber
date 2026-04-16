const fs = require('fs')
const os = require('os')
const path = require('path')
const OpenAI = require('openai')

const apiKey = process.env.OPENAI_API_KEY
const baseURL = process.env.OPENAI_BASE_URL
const modeloAudio = process.env.OPENAI_AUDIO_MODEL || 'gpt-4o-mini-transcribe'

const clienteOpenAI = apiKey ? new OpenAI({ apiKey, baseURL }) : null

const EXTENSOES = {
  'audio/ogg': '.ogg',
  'audio/ogg; codecs=opus': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/webm': '.webm',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
}

const obterExtensao = (mimeType = '') => EXTENSOES[String(mimeType || '').toLowerCase()] || '.ogg'

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

const transcreverAudioBuffer = async (buffer, { mimeType, fileName } = {}) => {
  if (!clienteOpenAI) {
    throw new Error('OpenAI não configurado para transcrição de áudio')
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Áudio vazio para transcrição')
  }

  const maxBytes = 12 * 1024 * 1024
  if (buffer.length > maxBytes) {
    throw new Error('Áudio muito grande para transcrição')
  }

  const extensao = path.extname(fileName || '') || obterExtensao(mimeType)
  const caminhoTemporario = path.join(
    os.tmpdir(),
    `marcai-audio-${Date.now()}-${Math.random().toString(36).slice(2)}${extensao}`
  )

  try {
    await fs.promises.writeFile(caminhoTemporario, buffer)

    const resposta = await withTimeout(
      clienteOpenAI.audio.transcriptions.create({
        file: fs.createReadStream(caminhoTemporario),
        model: modeloAudio,
        language: 'pt',
      }),
      30000,
      'Tempo esgotado na transcrição do áudio'
    )

    const texto = String(resposta?.text || '').trim()
    if (!texto) return null

    return texto
  } catch (err) {
    const msg = err?.message || 'Falha ao transcrever áudio'
    throw new Error(`Transcrição de áudio falhou: ${msg}`)
  } finally {
    fs.promises.unlink(caminhoTemporario).catch(() => {})
  }
}

module.exports = {
  transcreverAudioBuffer,
}
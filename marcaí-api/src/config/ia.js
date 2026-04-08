require('dotenv').config()

module.exports = {
  provider: 'anthropic',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  modeloAnthropic: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
  modeloAnthropicComplexo: process.env.ANTHROPIC_MODEL_COMPLEXO || 'claude-3-7-sonnet-latest',
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.GEMINI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : process.env.OPENAI_BASE_URL,
  modelo: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
  maxTokens: 4096,
  tempoInatividade: 120,
}

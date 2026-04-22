require('dotenv').config()

/** LLM principal: Anthropic (Claude). Ver ANTHROPIC_MODEL no .env. */
module.exports = {
  /** Opcional: reservado para outro stack; a Don usa só Anthropic. */
  provider: process.env.LLM_PROVIDER || 'anthropic',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  modeloAnthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  modeloAnthropicComplexo: process.env.ANTHROPIC_MODEL_COMPLEXO || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.GEMINI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : process.env.OPENAI_BASE_URL,
  modelo: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
  maxTokens: 4096,
  tempoInatividade: 120,
}

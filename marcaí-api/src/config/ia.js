require('dotenv').config()

module.exports = {
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  modelo: 'gemini-2.5-flash',
  // Aumentado de 1024 para 4096 - evita cortar mensagens com lista de horários/serviços
  maxTokens: 4096,
  // A protecao contra raciocinio vazado fica no limparRaciocinio() do ia.servico.js.
  // thinking_config nao e suportado pela API OpenAI-compatible do Gemini.
  thinkingBudget: -1,
  tempoInatividade: 120,
}

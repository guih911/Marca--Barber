require('dotenv').config()

module.exports = {
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  modelo: 'gemini-2.5-flash',
  maxTokens: 1024,
  // Desabilita thinking do Gemini 2.5 Flash — evita raciocínio interno vazar na resposta ao cliente
  // NOTA: thinking_config não é suportado pela API OpenAI-compatible do Gemini, causa 400.
  // A proteção contra raciocínio vazado é feita pela função limparRaciocinio() no ia.servico.js.
  thinkingBudget: -1, // -1 = desativado (0 causava envio de extra_body rejeitado pela API)
  // Tempo máximo de inatividade de uma conversa ATIVA em minutos (2h)
  tempoInatividade: 120,
}

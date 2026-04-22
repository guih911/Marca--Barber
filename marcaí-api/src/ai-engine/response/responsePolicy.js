const FRASES_ROBOTICAS = [
  /como posso te ajudar\??/gi,
  /estou aqui para ajudar/gi,
  /fico a disposicao/gi,
  /assistente virtual/gi,
  /recepcionista virtual/gi,
]

const removerDuplicidadeFrases = (texto = '') => {
  const partes = String(texto || '')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const vistos = new Set()
  const resultado = []

  for (const parte of partes) {
    const chave = parte.toLowerCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)
    resultado.push(parte)
  }

  return resultado.join(' ')
}

const truncarEmLimite = (texto = '', max = 420) => {
  const conteudo = String(texto || '').trim()
  if (conteudo.length <= max) return conteudo

  const recorte = conteudo.slice(0, max)
  const ultimaPontuacao = Math.max(recorte.lastIndexOf('.'), recorte.lastIndexOf('?'), recorte.lastIndexOf('!'))
  if (ultimaPontuacao > 80) return recorte.slice(0, ultimaPontuacao + 1).trim()
  return `${recorte.trimEnd()}...`
}

const aplicarPoliticaResposta = (texto = '', { maxLength = 420 } = {}) => {
  let resposta = String(texto || '').trim()
  if (!resposta) return resposta

  for (const regex of FRASES_ROBOTICAS) {
    resposta = resposta.replace(regex, 'me diz o que você precisa')
  }

  resposta = removerDuplicidadeFrases(resposta)
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return truncarEmLimite(resposta, maxLength)
}

module.exports = {
  aplicarPoliticaResposta,
}

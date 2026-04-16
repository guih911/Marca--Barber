const banco = require('../../config/banco')

const normalizar = (texto = '') =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const truncar = (texto = '', max = 420) => {
  const t = String(texto || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t
}

const primeiraPalavra = (nome = '') => String(nome || '').trim().split(/\s+/)[0] || null

const detectarSinaisMensagem = (mensagem = '') => {
  const n = normalizar(mensagem)

  const urgencia =
    /\b(agora|correndo|rapido|rapida|urgente|ja|ainda hoje|hoje ainda|to atrasado|estou atrasado)\b/.test(n)

  const indecisao =
    /\b(acho|talvez|nao sei|nao sei se|qual voce indica|o que voce acha|to em duvida|em duvida)\b/.test(n)

  const emocional =
    /\b(valeu|obrigado|obrigada|top|show|perfeito|fechou|demorou|maravilha)\b/.test(n)

  const tecnico =
    /\b(valor|preco|pix|cartao|endereco|horario|horarios|regras|politica|cancelamento|plano|link)\b/.test(n)

  const saudacao = /^(oi|ola|opa|e ai|fala|salve|bom dia|boa tarde|boa noite)\b/.test(n)

  return { urgencia, indecisao, emocional, tecnico, saudacao }
}

const inferirTom = ({ cliente, mensagem = '', aprendizado = null }) => {
  const sinais = detectarSinaisMensagem(mensagem)
  const primeiroNome = primeiraPalavra(cliente?.nome)

  let tom = 'premium_direto'

  if (sinais.indecisao) tom = 'consultivo'
  else if (sinais.emocional) tom = 'caloroso'
  else if (sinais.urgencia) tom = 'direto'
  else if (sinais.saudacao) tom = 'acolhedor'

  if (aprendizado?.diaPreferido || aprendizado?.horarioPreferido !== null) {
    tom = tom === 'direto' ? 'direto' : 'premium_direto'
  }

  return {
    tom,
    primeiroNome,
    sinais,
  }
}

const limparTextoRobozado = (texto = '') => {
  let t = String(texto || '').trim()
  if (!t) return t

  const substituicoes = [
    [/\bcomo posso te ajudar\??/gi, 'me diz o que você precisa'],
    [/\bestou aqui para ajudar\b/gi, 'te ajudo por aqui'],
    [/\bficamos a disposicao\b/gi, 'qualquer coisa, me chama por aqui'],
    [/\bsegue o link abaixo\b/gi, 'se preferir, posso te mandar o link também'],
    [/\bpor gentileza\b/gi, ''],
    [/\bvoc[eê]\s+pode agendar pelo link ou me fala aqui\b/gi, 'se preferir, eu já organizo por aqui'],
    [/\bassistente virtual\b/gi, 'consultor virtual'],
    [/\brecepcionista virtual\b/gi, 'consultor virtual'],
    [/\bcomo posso ajudar\??/gi, 'me diz o que você precisa'],
    [/\bposso verificar a disponibilidade para voce\??/gi, 'já vejo um horário pra você'],
  ]

  for (const [pattern, replacement] of substituicoes) {
    t = t.replace(pattern, replacement)
  }

  t = t.replace(/\s{2,}/g, ' ').trim()
  return t
}

const humanizarResposta = ({ texto, cliente, mensagemCliente = '', contexto = {} }) => {
  const base = limparTextoRobozado(texto)
  if (!base) return base

  const { tom, primeiroNome, sinais } = inferirTom({
    cliente,
    mensagem: mensagemCliente,
    aprendizado: contexto?.aprendizadoCliente || null,
  })

  let resposta = base

  if (tom === 'direto') {
    resposta = resposta
      .replace(/^oi[,!.\s-]*/i, '')
      .replace(/^ol[aá][,!.\s-]*/i, '')
      .trim()
  }

  if (tom === 'acolhedor' && primeiroNome && !new RegExp(`\\b${primeiroNome}\\b`, 'i').test(resposta)) {
    resposta = `${primeiroNome}, ${resposta.charAt(0).toLowerCase()}${resposta.slice(1)}`
  }

  if (tom === 'caloroso' && primeiroNome && !new RegExp(`\\b${primeiroNome}\\b`, 'i').test(resposta)) {
    resposta = `${primeiroNome}, ${resposta.charAt(0).toLowerCase()}${resposta.slice(1)}`
  }

  if (tom === 'consultivo' && !sinais.tecnico && !/[?]\s*$/.test(resposta)) {
    resposta = `${resposta} O que faz mais sentido pra você?`
  }

  if (tom === 'premium_direto') {
    resposta = resposta
      .replace(/\bposso te ajudar com agendamento\??/gi, 'se quiser, já vejo um horário pra você')
      .replace(/\bqualquer dúvida estou à disposição\b/gi, 'qualquer coisa, me chama')
  }

  resposta = resposta
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\?/g, '?')
    .replace(/\s+\!/g, '!')
    .trim()

  return truncar(resposta, 420)
}

const decidirFormatoResposta = async ({
  cliente,
  mensagemCliente = '',
  respostaTexto = '',
  ehAudioEntrada = false,
  contexto = {},
}) => {
  const texto = String(respostaTexto || '').trim()
  const msg = String(mensagemCliente || '').trim()
  const tamanho = texto.length
  const sinais = detectarSinaisMensagem(msg)

  let clientePrefereAudio = false
  let clienteUsaMuitoAudio = false

  if (cliente?.preferencias?.canalPreferido === 'AUDIO') clientePrefereAudio = true
  if (cliente?.preferencias?.usaAudioComFrequencia) clienteUsaMuitoAudio = true

  let enviarAudio = false

  if (ehAudioEntrada && tamanho > 0 && tamanho <= 180 && !sinais.tecnico) {
    enviarAudio = true
  }

  if ((clientePrefereAudio || clienteUsaMuitoAudio) && tamanho > 0 && tamanho <= 160 && !sinais.tecnico) {
    enviarAudio = true
  }

  if (contexto?.momento === 'CONFIRMACAO_AGENDAMENTO' && tamanho <= 180) {
    enviarAudio = true
  }

  if (sinais.urgencia && tamanho <= 140) {
    enviarAudio = true
  }

  if (/\n/.test(texto) || tamanho > 220 || sinais.tecnico) {
    enviarAudio = false
  }

  return {
    enviarTexto: true,
    enviarAudio,
    motivo: enviarAudio ? 'audio_contextual' : 'texto_padrao',
  }
}

const atualizarPreferenciaCanal = async ({ clienteId, usouAudio = false }) => {
  if (!clienteId) return

  try {
    const cliente = await banco.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, preferencias: true },
    })
    if (!cliente) return

    const preferencias = cliente.preferencias || {}
    const totalAudiosRecebidos = Number(preferencias.totalAudiosRecebidos || 0) + (usouAudio ? 1 : 0)

    const novasPreferencias = {
      ...preferencias,
      totalAudiosRecebidos,
      usaAudioComFrequencia: totalAudiosRecebidos >= 3,
      canalPreferido: usouAudio ? (preferencias.canalPreferido || 'AUDIO') : (preferencias.canalPreferido || 'TEXTO'),
      atualizadoEmHumanizacao: new Date().toISOString(),
    }

    await banco.cliente.update({
      where: { id: clienteId },
      data: { preferencias: novasPreferencias },
    })
  } catch (err) {
    console.warn('[Humanizacao] Falha ao atualizar preferencia de canal:', err.message)
  }
}

module.exports = {
  detectarSinaisMensagem,
  inferirTom,
  humanizarResposta,
  decidirFormatoResposta,
  atualizarPreferenciaCanal,
}

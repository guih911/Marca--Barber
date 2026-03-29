/**
 * Gerenciador de sessões whatsapp-web.js por tenant.
 * Mantém um Map de clientes ativos em memória: tenantId → sessão
 * Sessões são persistidas no disco via LocalAuth (.wwebjs_auth/<tenantId>).
 */
const { Client, LocalAuth } = require('whatsapp-web.js')
const QRCode = require('qrcode')

const STATUS = {
  INICIANDO: 'iniciando',
  AGUARDANDO_QR: 'aguardando_qr',
  CONECTADO: 'conectado',
  DESCONECTADO: 'desconectado',
}

// tenantId → { client, status, qr (string), onMensagem }
const sessoes = new Map()

// "tenantId:numero" → JID real vindo do msg.from (evita erro "No LID for user")
const jidMap = new Map()

// Debounce de mensagens rápidas: acumula textos enviados em rajada e dispara um único callback
// "tenantId:jid" → { timeout, texts, meta }
const pendingMessages = new Map()

const coletarCandidatosDoContato = (contact) => {
  const numeros = new Set()
  ;[
    contact?.number,
    contact?.id?.user,
    contact?.id?._serialized?.split?.('@')?.[0],
  ].forEach((valor) => {
    gerarCandidatosNumero(valor).forEach((candidato) => numeros.add(candidato))
  })
  return numeros
}

const buscarFotoDoContato = async (sessao, contactId) => {
  if (!contactId) return null

  const contato = await sessao.client.getContactById(contactId).catch(() => null)
  const fotoContato = await contato?.getProfilePicUrl?.().catch(() => null)
  if (fotoContato) return fotoContato

  return await sessao.client.getProfilePicUrl(contactId).catch(() => null)
}

const escolherNumeroMaisCompleto = (...numeros) => (
  numeros
    .map((numero) => normalizarNumeroTelefone(numero))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || ''
)

const normalizarNumeroTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')
const gerarCandidatosNumero = (telefone = '') => {
  const base = normalizarNumeroTelefone(telefone)
  if (!base) return []

  const candidatos = new Set([base])

  if (base.startsWith('55')) {
    const nacional = base.slice(2)
    candidatos.add(nacional)

    if (nacional.length === 10) {
      candidatos.add(`55${nacional.slice(0, 2)}9${nacional.slice(2)}`)
      candidatos.add(`${nacional.slice(0, 2)}9${nacional.slice(2)}`)
    }

    if (nacional.length === 11 && nacional[2] === '9') {
      candidatos.add(`55${nacional.slice(0, 2)}${nacional.slice(3)}`)
      candidatos.add(`${nacional.slice(0, 2)}${nacional.slice(3)}`)
    }
  } else if (base.length === 10) {
    candidatos.add(`55${base}`)
    candidatos.add(`55${base.slice(0, 2)}9${base.slice(2)}`)
  } else if (base.length === 11 && base[2] === '9') {
    candidatos.add(`55${base}`)
    candidatos.add(`55${base.slice(0, 2)}${base.slice(3)}`)
  }

  return [...candidatos]
}
const DEBOUNCE_MS = 1500 // aguarda 1.5s após a última mensagem antes de processar

/**
 * Cria ou reaproveita a sessão de um tenant.
 * @param {string} tenantId
 * @param {Function} onMensagem - async (telefone, texto, nome) => void
 * @returns {Object} sessão atual
 */
const iniciarSessao = (tenantId, onMensagem) => {
  if (sessoes.has(tenantId)) {
    const s = sessoes.get(tenantId)
    // Atualiza callback caso o servidor tenha reiniciado
    if (onMensagem) s.onMensagem = onMensagem
    return s
  }

  const sessao = { client: null, status: STATUS.INICIANDO, qr: null, onMensagem }
  sessoes.set(tenantId, sessao)

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: tenantId }),
    puppeteer: {
      // Em Docker, usa o Chromium do sistema (definido por PUPPETEER_EXECUTABLE_PATH)
      // Em desenvolvimento, usa o Chromium do próprio Puppeteer (undefined = padrão)
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
      ],
    },
  })

  sessao.client = client

  client.on('qr', (qr) => {
    sessao.qr = qr
    sessao.status = STATUS.AGUARDANDO_QR
    console.log(`[WWebJS] QR gerado — tenant ${tenantId}`)
  })

  client.on('ready', () => {
    sessao.status = STATUS.CONECTADO
    sessao.qr = null
    console.log(`[WWebJS] Conectado — tenant ${tenantId}`)
  })

  client.on('authenticated', () => {
    console.log(`[WWebJS] Autenticado — tenant ${tenantId}`)
  })

  client.on('auth_failure', (msg) => {
    console.error(`[WWebJS] Falha de autenticação — tenant ${tenantId}:`, msg)
    sessao.status = STATUS.DESCONECTADO
    sessoes.delete(tenantId)
  })

  client.on('disconnected', (reason) => {
    console.log(`[WWebJS] Desconectado (${reason}) — tenant ${tenantId}. Reconectando em 10s...`)
    sessao.status = STATUS.DESCONECTADO
    sessoes.delete(tenantId)
    // Reconecta automaticamente após 10 segundos
    setTimeout(() => {
      const cb = sessao.onMensagem
      if (cb) {
        console.log(`[WWebJS] Tentando reconexão — tenant ${tenantId}`)
        iniciarSessao(tenantId, cb)
      }
    }, 10000)
  })

  // Evento 'message' = somente mensagens RECEBIDAS (não enviadas pelo bot)
  client.on('message', async (msg) => {
    // Proteção anti-echo: ignora mensagens enviadas pelo próprio número do bot
    if (msg.fromMe) return

    // Ignora grupos
    if (msg.from.endsWith('@g.us')) return

    const texto = msg.body
    if (!texto) return

    const jidNumero = msg.from.split('@')[0]

    // Salva o JID real para usar no envio (evita erro "No LID for user")
    const contact = await msg.getContact().catch(() => null)
    const nome = contact?.pushname || ''
    const numeroFormatadoContato = await contact?.getFormattedNumber?.().catch(() => null)

    // Usa contact.number (número real) quando disponível — msg.from pode ser LID em versões novas do WhatsApp
    const numeroReal = escolherNumeroMaisCompleto(
      numeroFormatadoContato,
      contact?.id?.user,
      contact?.id?._serialized?.split?.('@')?.[0],
      contact?.number,
      jidNumero
    )
    const telefone = numeroReal.startsWith('+') ? numeroReal : `+${numeroReal}`

    // Salva o JID real mapeado pelo número real (para envio posterior)
    jidMap.set(`${tenantId}:${jidNumero}`, msg.from)
    jidMap.set(`${tenantId}:${numeroReal}`, msg.from)
    gerarCandidatosNumero(numeroReal).forEach((candidato) => jidMap.set(`${tenantId}:${candidato}`, msg.from))

    // Busca foto de perfil do WhatsApp (melhor esforço — não falha se indisponível)
    const fotoPerfil =
      await contact?.getProfilePicUrl?.().catch(() => null) ||
      await sessao.client.getProfilePicUrl(msg.from).catch(() => null)

    console.log(`[WWebJS] Mensagem recebida de ${telefone} — tenant ${tenantId}: "${texto}"`)

    // Debounce: acumula mensagens enviadas em rajada e processa como uma só
    const pendingKey = `${tenantId}:${msg.from}`
    const existing = pendingMessages.get(pendingKey) || { texts: [], meta: {} }

    clearTimeout(existing.timeout)
    existing.texts.push(texto)
    existing.meta = { telefone, nome, fotoPerfil }

    existing.timeout = setTimeout(async () => {
      pendingMessages.delete(pendingKey)
      const textoFinal = existing.texts.join('\n')
      const cb = sessoes.get(tenantId)?.onMensagem
      if (cb) {
        try {
          await cb(existing.meta.telefone, textoFinal, existing.meta.nome, existing.meta.fotoPerfil)
        } catch (err) {
          console.error(`[WWebJS] Erro ao processar mensagem:`, err.message)
        }
      } else {
        console.warn(`[WWebJS] Nenhum callback registrado para tenant ${tenantId}`)
      }
    }, DEBOUNCE_MS)

    pendingMessages.set(pendingKey, existing)
  })

  client.initialize().catch((err) => {
    console.error(`[WWebJS] Erro ao inicializar — tenant ${tenantId}:`, err.message)
    sessao.status = STATUS.DESCONECTADO
    sessoes.delete(tenantId)
  })

  return sessao
}

/**
 * Retorna o status e QR (como base64 PNG) da sessão de um tenant.
 */
const obterStatus = async (tenantId) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao) return { status: STATUS.DESCONECTADO, qr: null }

  let qrBase64 = null
  if (sessao.qr) {
    qrBase64 = await QRCode.toDataURL(sessao.qr).catch(() => null)
  }

  return { status: sessao.status, qr: qrBase64 }
}

/**
 * Envia mensagem de texto via sessão do tenant.
 * @param {string} tenantId
 * @param {string} para - formato E.164 ex: +5511999999999
 * @param {string} texto
 */
const enviarMensagem = async (tenantId, para, texto) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO) {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code primeiro.')
  }
  const numero = para.replace(/^\+/, '')

  // Usa JID real salvo do msg.from para evitar erro "No LID for user"
  const jidReal = jidMap.get(`${tenantId}:${numero}`)
  const chatId = jidReal || `${numero}@c.us`

  try {
    return await sessao.client.sendMessage(chatId, texto)
  } catch (err) {
    // Detached Frame = sessão travada, não adianta tentar novamente
    if (err.message && err.message.includes('detached Frame')) {
      console.warn(`[WWebJS] Frame detached — reiniciando sessão do tenant ${tenantId}`)
      sessao.status = STATUS.DESCONECTADO
      sessoes.delete(tenantId)
      const cb = sessao.onMensagem
      if (cb) setTimeout(() => iniciarSessao(tenantId, cb), 3000)
      throw new Error('WhatsApp reconectando. Tente novamente em alguns segundos.')
    }
    // Fallback: tenta via getChatById
    try {
      const chat = await sessao.client.getChatById(chatId)
      return await chat.sendMessage(texto)
    } catch (err2) {
      console.error(`[WWebJS] Falha ao enviar para ${para}:`, err2.message)
      throw err2
    }
  }
}

/**
 * Destrói a sessão do tenant (desconecta e limpa).
 */
const obterFotoPerfil = async (tenantId, para) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO) return null

  const candidatos = gerarCandidatosNumero(para)
  const idsTentados = new Set()
  for (const numero of candidatos) {
    const jidReal = jidMap.get(`${tenantId}:${numero}`)
    const chatIds = [jidReal, `${numero}@c.us`].filter(Boolean)

    for (const chatId of chatIds) {
      if (idsTentados.has(chatId)) continue
      idsTentados.add(chatId)

      const foto = await buscarFotoDoContato(sessao, chatId)
      if (foto) return foto
    }

    try {
      const numeroId = await sessao.client.getNumberId(numero)
      const jid = numeroId?._serialized || numeroId?.id?._serialized
      if (!jid) continue

      if (idsTentados.has(jid)) continue
      idsTentados.add(jid)

      const foto = await buscarFotoDoContato(sessao, jid)
      if (foto) return foto
    } catch {}
  }

  const contatos = await sessao.client.getContacts().catch(() => [])
  const contatoCorrespondente = contatos.find((contact) => {
    const numerosContato = coletarCandidatosDoContato(contact)
    return candidatos.some((candidato) => numerosContato.has(candidato))
  })

  if (contatoCorrespondente?.id?._serialized) {
    return await buscarFotoDoContato(sessao, contatoCorrespondente.id._serialized)
  }

  return null
}

const destruirSessao = async (tenantId) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao) return
  await sessao.client.destroy().catch(() => {})
  sessoes.delete(tenantId)
}

module.exports = { iniciarSessao, obterStatus, enviarMensagem, obterFotoPerfil, destruirSessao, STATUS }

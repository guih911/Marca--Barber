/**
 * Gerenciador de sessões WhatsApp via Baileys (@whiskeysockets/baileys).
 * Leve, sem Puppeteer/Chrome, multi-tenant com QR Code.
 *
 * Exporta a mesma interface: { iniciarSessao, obterStatus, enviarMensagem, obterFotoPerfil, destruirSessao, STATUS }
 */
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, isLidUser, USyncQuery, USyncUser, USyncContactProtocol } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const path = require('path')
const fs = require('fs')

const STATUS = {
  INICIANDO: 'iniciando',
  AGUARDANDO_QR: 'aguardando_qr',
  CONECTADO: 'conectado',
  DESCONECTADO: 'desconectado',
}

// tenantId → { sock, status, qr (string), onMensagem, authState }
const sessoes = new Map()

// Debounce de mensagens rápidas: acumula textos enviados em rajada e dispara um único callback
// "tenantId:jid" → { timeout, texts, meta }
const pendingMessages = new Map()
const DEBOUNCE_MS = 1500

// Mapa de número → JID real (para envio quando WhatsApp usa LID)
// "tenantId:numero" → jid real (ex: "215139643039792@lid" ou "5511999999999@s.whatsapp.net")
const jidMap = new Map()

// Mapa de LID → número real do telefone
// "tenantId:lid" → "5562993050931"
const lidToPhone = new Map()

const AUTH_DIR = path.join(process.cwd(), '.baileys_auth')

// Garante diretório de auth existe
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })

const normalizarNumero = (telefone = '') => String(telefone || '').replace(/\D/g, '')

/**
 * Resolve um LID para o número real de telefone via protocolo USync do WhatsApp.
 * @param {Object} sock - Socket Baileys conectado
 * @param {string} lid - JID no formato LID (ex: "215139643039792@lid")
 * @returns {string|null} - Número real (ex: "5562993050931") ou null
 */
const resolverLIDParaTelefone = async (sock, lid) => {
  try {
    const lidUser = lid.replace('@lid', '')
    const query = new USyncQuery()
      .withContactProtocol(new USyncContactProtocol())
      .withUser(new USyncUser().withLid(lidUser))

    const result = await sock.executeUSyncQuery(query)
    if (result?.list?.[0]?.id) {
      const phoneJid = result.list[0].id
      const phone = phoneJid.replace('@s.whatsapp.net', '')
      console.log(`[Baileys] LID resolvido: ${lidUser} → ${phone}`)
      return phone
    }
  } catch (err) {
    console.error(`[Baileys] Erro ao resolver LID ${lid}:`, err.message)
  }
  return null
}

/**
 * Cria ou reaproveita a sessão de um tenant.
 */
const iniciarSessao = async (tenantId, onMensagem) => {
  if (sessoes.has(tenantId)) {
    const s = sessoes.get(tenantId)
    if (onMensagem) s.onMensagem = onMensagem
    // Se já conectado, retorna
    if (s.status === STATUS.CONECTADO && s.sock) return s
    // Se está iniciando/aguardando QR, retorna sessão existente
    if (s.status === STATUS.INICIANDO || s.status === STATUS.AGUARDANDO_QR) return s
    // Desconectado — limpa e recria abaixo
    try { s.sock?.end() } catch {}
    sessoes.delete(tenantId)
  }

  const sessao = { sock: null, status: STATUS.INICIANDO, qr: null, onMensagem }
  sessoes.set(tenantId, sessao)

  try {
    const authDir = path.join(AUTH_DIR, tenantId)
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestBaileysVersion()

    // Logger silencioso para Baileys (pino-compatible)
    const noop = () => {}
    const silentChild = () => silentLogger
    const silentLogger = { level: 'silent', info: noop, error: noop, warn: noop, debug: noop, trace: noop, fatal: noop, child: silentChild }

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      printQRInTerminal: false,
      browser: ['Marcai', 'Chrome', '22.0'],
      generateHighQualityLinkPreview: false,
      logger: silentLogger,
    })

    sessao.sock = sock

    // Mapeia LIDs → números reais via contatos
    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        if (c.lid && c.id?.endsWith('@s.whatsapp.net')) {
          const lid = c.lid.replace('@lid', '')
          const phone = c.id.replace('@s.whatsapp.net', '')
          lidToPhone.set(`${tenantId}:${lid}`, phone)
          jidMap.set(`${tenantId}:${phone}`, c.lid)
          console.log(`[Baileys] LID mapeado: ${lid} → ${phone}`)
        }
      }
    })

    sock.ev.on('contacts.update', (contacts) => {
      for (const c of contacts) {
        if (c.lid && c.id?.endsWith('@s.whatsapp.net')) {
          const lid = c.lid.replace('@lid', '')
          const phone = c.id.replace('@s.whatsapp.net', '')
          lidToPhone.set(`${tenantId}:${lid}`, phone)
          jidMap.set(`${tenantId}:${phone}`, c.lid)
        }
      }
    })

    // Salva credenciais quando atualizadas
    sock.ev.on('creds.update', saveCreds)

    // Evento de conexão
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        sessao.qr = qr
        sessao.status = STATUS.AGUARDANDO_QR
        console.log(`[Baileys] QR gerado — tenant ${tenantId}`)
      }

      if (connection === 'open') {
        sessao.status = STATUS.CONECTADO
        sessao.qr = null
        console.log(`[Baileys] Conectado — tenant ${tenantId}`)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(`[Baileys] Desconectado (${statusCode}) — tenant ${tenantId}${shouldReconnect ? '. Reconectando...' : '. Logout.'}`)

        sessao.status = STATUS.DESCONECTADO
        sessao.sock = null

        if (shouldReconnect) {
          sessoes.delete(tenantId)
          setTimeout(() => {
            const cb = sessao.onMensagem
            if (cb) iniciarSessao(tenantId, cb)
          }, 5000)
        } else {
          sessoes.delete(tenantId)
        }
      }
    })

    // Mensagens recebidas
    sock.ev.on('messages.upsert', async (upsert) => {
      const messages = upsert.messages || upsert
      const type = upsert.type || 'notify'
      if (type !== 'notify') return

      for (const msg of messages) {
        // Ignora mensagens enviadas pelo bot
        if (msg.key.fromMe) continue
        // Ignora grupos
        if (msg.key.remoteJid?.endsWith('@g.us')) continue
        // Ignora status/broadcast
        if (msg.key.remoteJid === 'status@broadcast') continue

        const texto = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || msg.message?.videoMessage?.caption
          || ''
        if (!texto) continue

        const jid = msg.key.remoteJid
        const nome = msg.pushName || ''

        // Resolve número real — pode vir como @s.whatsapp.net ou @lid (Linked ID)
        let numero = ''
        let lidOriginal = null
        if (jid.endsWith('@s.whatsapp.net')) {
          numero = jid.replace('@s.whatsapp.net', '')
        } else if (jid.endsWith('@lid')) {
          const lidId = jid.replace('@lid', '')
          lidOriginal = lidId
          // 1. Cache local
          const mapeado = lidToPhone.get(`${tenantId}:${lidId}`)
          if (mapeado) {
            numero = mapeado
          } else {
            // 2. Resolve via USync (protocolo real do WhatsApp)
            const resolved = await resolverLIDParaTelefone(sock, jid)
            if (resolved) {
              numero = resolved
              lidToPhone.set(`${tenantId}:${lidId}`, numero)
            } else {
              // 3. Último recurso: usa LID como identificador
              numero = lidId
            }
          }
        } else {
          numero = jid.replace(/@.*/, '')
        }

        const telefone = numero ? `+${numero}` : ''
        if (!telefone) continue

        console.log(`[Baileys] Mensagem de ${telefone} (${jid}): "${texto.substring(0, 50)}" — tenant ${tenantId}`)

        // Salva mapeamento número → JID para envio
        jidMap.set(`${tenantId}:${numero}`, jid)

        // Debounce: acumula mensagens rápidas
        const pendingKey = `${tenantId}:${jid}`
        const existing = pendingMessages.get(pendingKey) || { texts: [], meta: {} }

        clearTimeout(existing.timeout)
        existing.texts.push(texto)
        existing.meta = { telefone, nome, lidOriginal }

        existing.timeout = setTimeout(async () => {
          pendingMessages.delete(pendingKey)
          const textoFinal = existing.texts.join('\n')
          const cb = sessoes.get(tenantId)?.onMensagem

          // Foto de perfil (melhor esforço)
          let fotoPerfil = null
          try {
            fotoPerfil = await sock.profilePictureUrl(jid, 'image')
          } catch {}

          if (cb) {
            try {
              await cb(existing.meta.telefone, textoFinal, existing.meta.nome, fotoPerfil, existing.meta.lidOriginal)
            } catch (err) {
              console.error(`[Baileys] Erro ao processar mensagem:`, err.message)
            }
          }
        }, DEBOUNCE_MS)

        pendingMessages.set(pendingKey, existing)
      }
    })
  } catch (err) {
    console.error(`[Baileys] Erro ao iniciar sessão — tenant ${tenantId}:`, err.message)
    sessao.status = STATUS.DESCONECTADO
    sessoes.delete(tenantId)
  }

  return sessao
}

/**
 * Retorna o status e QR (como base64 PNG data URL) da sessão de um tenant.
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
 * Retorna o número de WhatsApp conectado para este tenant (ex: "5561936182253").
 */
const obterNumeroConectado = (tenantId) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao?.sock?.user?.id) return null
  // sock.user.id é "5561936182253:4@s.whatsapp.net" — extraímos só o número
  return sessao.sock.user.id.split(':')[0]
}

/**
 * Envia mensagem de texto via sessão do tenant.
 */
const enviarMensagem = async (tenantId, para, texto) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO || !sessao.sock) {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code primeiro.')
  }

  const numero = normalizarNumero(para)

  // Usa JID real mapeado (pode ser @lid) ou fallback para @s.whatsapp.net
  const jidReal = jidMap.get(`${tenantId}:${numero}`) || `${numero}@s.whatsapp.net`

  return await sessao.sock.sendMessage(jidReal, { text: texto })
}

/**
 * Obtém foto de perfil de um contato.
 */
const obterFotoPerfil = async (tenantId, para) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO || !sessao.sock) return null

  const numero = normalizarNumero(para)
  const jidReal = jidMap.get(`${tenantId}:${numero}`) || `${numero}@s.whatsapp.net`

  try {
    return await sessao.sock.profilePictureUrl(jidReal, 'image')
  } catch {
    return null
  }
}

/**
 * Destrói a sessão do tenant (desconecta e limpa).
 */
const destruirSessao = async (tenantId) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao) return
  try {
    await sessao.sock?.logout()
  } catch {}
  sessao.sock = null
  sessoes.delete(tenantId)
  console.log(`[Baileys] Sessão destruída — tenant ${tenantId}`)
}

module.exports = { iniciarSessao, obterStatus, enviarMensagem, obterFotoPerfil, destruirSessao, obterNumeroConectado, STATUS }

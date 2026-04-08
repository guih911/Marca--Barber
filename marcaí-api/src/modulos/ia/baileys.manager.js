/**
 * Gerenciador de sessões WhatsApp via Baileys (@whiskeysockets/baileys).
 * Leve, sem Puppeteer/Chrome, multi-tenant com QR Code.
 *
 * Exporta a mesma interface: { iniciarSessao, obterStatus, enviarMensagem, obterFotoPerfil, destruirSessao, STATUS }
 */
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, isLidUser, USyncQuery, USyncUser, USyncContactProtocol, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const path = require('path')
const fs = require('fs')
const { transcreverAudioBuffer } = require('./transcricao.servico')

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

const lerStreamEmBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const transcreverAudioMensagem = async (msg) => {
  const audioMessage = msg.message?.audioMessage || msg.message?.pttMessage
  if (!audioMessage) return null

  const stream = await downloadContentFromMessage(audioMessage, 'audio')
  const buffer = await lerStreamEmBuffer(stream)
  const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus'
  const texto = await transcreverAudioBuffer(buffer, { mimeType, fileName: `whatsapp-audio${mimeType.includes('mp4') ? '.m4a' : '.ogg'}` })
  return texto || null
}

/**
 * Resolve um LID para o número real de telefone via protocolo USync do WhatsApp.
 * @param {Object} sock - Socket Baileys conectado
 * @param {string} lid - JID no formato LID (ex: "215139643039792@lid")
 * @returns {string|null} - Número real (ex: "5562993050931") ou null
 */
const resolverLIDParaTelefone = async (sock, lid) => {
  const lidUser = lid.replace('@lid', '')

  // Tentativa 1: USyncQuery (protocolo nativo do WhatsApp para LID → número)
  try {
    const query = new USyncQuery()
      .withContactProtocol(new USyncContactProtocol())
      .withUser(new USyncUser().withLid(lidUser))

    const result = await sock.executeUSyncQuery(query)
    const item = result?.list?.[0]
    // A estrutura do resultado pode variar entre versões do Baileys
    const phoneJid = item?.id || item?.phone || item?.contact?.id
    if (phoneJid) {
      // Remove sufixo @s.whatsapp.net e dispositivo (ex: :4)
      const phone = String(phoneJid).replace('@s.whatsapp.net', '').replace(/:.*/, '')
      if (/^\d{10,15}$/.test(phone)) {
        console.log(`[Baileys] LID resolvido via USync: ${lidUser} → ${phone}`)
        return phone
      }
    }
  } catch (err) {
    console.warn(`[Baileys] USync falhou para ${lid}: ${err.message}`)
  }

  // Tentativa 2: sock.contacts (cache interno do Baileys populado por contacts.upsert)
  try {
    const contacts = sock?.contacts || {}
    for (const [jid, contact] of Object.entries(contacts)) {
      if (!jid.endsWith('@s.whatsapp.net')) continue
      const cLid = String(contact.lid || '').replace('@lid', '')
      if (cLid === lidUser) {
        const phone = jid.replace('@s.whatsapp.net', '').replace(/:.*/, '')
        if (/^\d{10,15}$/.test(phone)) {
          console.log(`[Baileys] LID resolvido via sock.contacts: ${lidUser} → ${phone}`)
          return phone
        }
      }
    }
  } catch {}

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
    const processarContatoLID = (c) => {
      // Formato padrão: c.lid = "215139643039792@lid", c.id = "5562993050931@s.whatsapp.net"
      const lidJid = c.lid || c.lidJid || c.linkedId
      const phoneJid = c.id || c.jid || c.phoneJid
      if (!lidJid || !phoneJid) return
      if (!String(phoneJid).endsWith('@s.whatsapp.net')) return
      const lid = String(lidJid).replace('@lid', '').replace(/:.*/, '')
      const phone = String(phoneJid).replace('@s.whatsapp.net', '').replace(/:.*/, '')
      if (!/^\d{10,15}$/.test(phone) || !/^\d+$/.test(lid)) return
      if (lidToPhone.get(`${tenantId}:${lid}`) !== phone) {
        lidToPhone.set(`${tenantId}:${lid}`, phone)
        jidMap.set(`${tenantId}:${phone}`, lidJid)
        // Também indexa o LID com prefixo 55 para lookups de lembretes/automações
        if (!lid.startsWith('55')) {
          jidMap.set(`${tenantId}:55${lid}`, lidJid)
        }
        console.log(`[Baileys] LID mapeado: ${lid} → ${phone}`)
      }
    }

    sock.ev.on('contacts.upsert', (contacts) => { contacts.forEach(processarContatoLID) })
    sock.ev.on('contacts.update', (contacts) => { contacts.forEach(processarContatoLID) })

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

        console.log(`[Baileys] Desconectado (${statusCode}) — tenant ${tenantId}${shouldReconnect ? '. Reconectando...' : '. Logout — limpando auth para permitir novo QR.'}`)

        sessao.status = STATUS.DESCONECTADO
        sessao.sock = null

        if (shouldReconnect) {
          sessoes.delete(tenantId)
          setTimeout(() => {
            const cb = sessao.onMensagem
            if (cb) iniciarSessao(tenantId, cb)
          }, 5000)
        } else {
          // Logout: limpa credenciais para que o próximo iniciarSessao gere QR novo
          sessoes.delete(tenantId)
          const authDir = path.join(AUTH_DIR, tenantId)
          try {
            fs.rmSync(authDir, { recursive: true, force: true })
            console.log(`[Baileys] Auth limpo para tenant ${tenantId} — próxima conexão gera QR novo`)
          } catch (e) {
            console.warn(`[Baileys] Falha ao limpar auth: ${e.message}`)
          }
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

        // Mensagens de mídia sem legenda — envia marcador para a IA responder adequadamente
        const ehAudio = !!(msg.message?.audioMessage || msg.message?.pttMessage)
        const ehFigurinha = !!msg.message?.stickerMessage
        const ehDocumento = !!(msg.message?.documentMessage || msg.message?.documentWithCaptionMessage)

        if (!texto && !ehAudio && !ehFigurinha && !ehDocumento) continue

        let textoFinal = texto || (ehAudio ? '[ÁUDIO]' : ehFigurinha ? '[FIGURINHA]' : '[DOCUMENTO]')

        if (!texto && ehAudio) {
          try {
            const transcricao = await transcreverAudioMensagem(msg)
            if (transcricao) {
              textoFinal = transcricao
              console.log(`[Baileys] Áudio transcrito com sucesso — tenant ${tenantId}`)
            }
          } catch (err) {
            console.warn(`[Baileys] Falha ao transcrever áudio — tenant ${tenantId}: ${err.message}`)
          }
        }

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

          // 0. senderPn (Baileys v7+) — campo mais direto: número real no próprio evento
          const senderPn = msg.key?.senderPn
            ? String(msg.key.senderPn).replace('@s.whatsapp.net', '').replace(/:.*/, '')
            : null
          if (senderPn && /^\d{10,15}$/.test(senderPn)) {
            numero = senderPn
            lidToPhone.set(`${tenantId}:${lidId}`, numero)
            console.log(`[Baileys] LID resolvido via senderPn: ${lidId} → ${numero}`)
          }

          if (!numero) {
            // 1. Cache local
            const mapeado = lidToPhone.get(`${tenantId}:${lidId}`)
            if (mapeado) {
              numero = mapeado
            } else {
              // 2. Resolve via USync com até 3 tentativas (contacts.upsert pode chegar logo depois)
              for (let tentativa = 0; tentativa < 3; tentativa++) {
                if (tentativa > 0) await new Promise((r) => setTimeout(r, 1200))
                // Re-verifica cache (contacts.upsert pode ter chegado no intervalo)
                const cached = lidToPhone.get(`${tenantId}:${lidId}`)
                if (cached) { numero = cached; break }
                const resolved = await resolverLIDParaTelefone(sock, jid)
                if (resolved) {
                  numero = resolved
                  lidToPhone.set(`${tenantId}:${lidId}`, numero)
                  break
                }
              }

              // 3. Tenta resolver via onWhatsApp (converte LID → número real)
              if (!numero) {
                try {
                  const check = await sock.onWhatsApp(jid)
                  if (check && check.length > 0 && check[0].exists) {
                    const resolvedJid = check[0].jid
                    if (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) {
                      numero = resolvedJid.replace('@s.whatsapp.net', '')
                      lidToPhone.set(`${tenantId}:${lidId}`, numero)
                      jidMap.set(`${tenantId}:${numero}`, jid)
                      console.log(`[Baileys] LID resolvido via onWhatsApp: ${lidId} → ${numero}`)
                    }
                  }
                } catch {}
              }

              // 4. Último recurso: usa LID como identificador temporário
              if (!numero) {
                console.warn(`[Baileys] AVISO: não conseguiu resolver LID ${lidId} — usando como fallback`)
                numero = lidId
              }
            }
          }
        } else {
          numero = jid.replace(/@.*/, '')
        }

        const telefone = numero ? `+${numero}` : ''
        if (!telefone) continue

        console.log(`[Baileys] Mensagem de ${telefone} (${jid}): "${textoFinal.substring(0, 50)}" — tenant ${tenantId}`)

        // Salva mapeamento número → JID para envio
        jidMap.set(`${tenantId}:${numero}`, jid)
        // Se o número não tem prefixo 55 (LID ou número sem código), indexa também com 55 para lookups de lembretes
        if (!numero.startsWith('55')) {
          jidMap.set(`${tenantId}:55${numero}`, jid)
        }

        // Debounce: acumula mensagens rápidas
        const pendingKey = `${tenantId}:${jid}`
        const existing = pendingMessages.get(pendingKey) || { texts: [], meta: {} }

        clearTimeout(existing.timeout)
        existing.texts.push(textoFinal)
        existing.meta = { telefone, nome, lidOriginal, ehAudio }

        existing.timeout = setTimeout(async () => {
          pendingMessages.delete(pendingKey)
          const textoParaEnviar = existing.texts.join('\n')
          const cb = sessoes.get(tenantId)?.onMensagem

          // Foto de perfil (melhor esforço)
          let fotoPerfil = null
          try {
            fotoPerfil = await sock.profilePictureUrl(jid, 'image')
          } catch {}

          if (cb) {
            try {
              await cb(existing.meta.telefone, textoParaEnviar, existing.meta.nome, fotoPerfil, existing.meta.lidOriginal, { ehAudio: Boolean(existing.meta.ehAudio) })
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
 * @param {string} tenantId
 * @param {string} para - Número do destinatário (qualquer formato)
 * @param {string} texto - Texto da mensagem
 * @param {string} [lidJid] - JID LID opcional (ex: "215139643039792@lid") para usuários LID
 *   Usado como fallback quando o jidMap não tem entrada (ex: após restart do servidor).
 */
const enviarMensagem = async (tenantId, para, texto, lidJid = null) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO || !sessao.sock) {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code primeiro.')
  }

  const numero = normalizarNumero(para)

  // Prioridade: 1) jidMap (populado quando cliente envia mensagem), 2) lidJid (vem do banco),
  // 3) fallback @s.whatsapp.net (funciona para contas não-LID)
  let jidReal = jidMap.get(`${tenantId}:${numero}`)
  if (!jidReal && lidJid) {
    // Normaliza: aceita só o número LID ou o JID completo
    jidReal = lidJid.includes('@') ? lidJid : `${lidJid}@lid`
    // Também popula o jidMap para próximas chamadas desta sessão
    jidMap.set(`${tenantId}:${numero}`, jidReal)
    console.log(`[Baileys] JID resolvido via lidJid do banco: ${numero} → ${jidReal}`)
  }
  if (!jidReal) {
    // Verifica o JID real via onWhatsApp (resolve 9º dígito e LIDs)
    try {
      const check = await sessao.sock.onWhatsApp(`${numero}@s.whatsapp.net`)
      if (check && check.length > 0 && check[0].exists) {
        jidReal = check[0].jid
        jidMap.set(`${tenantId}:${numero}`, jidReal)
        if (jidReal !== `${numero}@s.whatsapp.net`) {
          console.log(`[Baileys] JID corrigido via onWhatsApp: ${numero} → ${jidReal}`)
        }
      } else {
        jidReal = `${numero}@s.whatsapp.net`
      }
    } catch {
      jidReal = `${numero}@s.whatsapp.net`
    }
  }

  console.log(`[Baileys] Enviando para ${jidReal} — tenant ${tenantId}`)
  const resultado = await sessao.sock.sendMessage(jidReal, { text: texto })
  console.log(`[Baileys] Resultado envio:`, resultado?.status, resultado?.key?.id ? 'msgId=' + resultado.key.id : 'sem key')
  return resultado
}

const enviarAudio = async (tenantId, para, audioBuffer, { mimetype = 'audio/mpeg', ptt = true, lidJid = null } = {}) => {
  const sessao = sessoes.get(tenantId)
  if (!sessao || sessao.status !== STATUS.CONECTADO || !sessao.sock) {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code primeiro.')
  }

  const numero = normalizarNumero(para)
  let jidReal = jidMap.get(`${tenantId}:${numero}`)

  if (!jidReal && lidJid) {
    jidReal = lidJid
    jidMap.set(`${tenantId}:${numero}`, jidReal)
  }

  if (!jidReal) {
    try {
      const check = await sessao.sock.onWhatsApp(`${numero}@s.whatsapp.net`)
      if (check && check.length > 0 && check[0].exists) {
        jidReal = check[0].jid
        jidMap.set(`${tenantId}:${numero}`, jidReal)
      } else {
        jidReal = `${numero}@s.whatsapp.net`
      }
    } catch {
      jidReal = `${numero}@s.whatsapp.net`
    }
  }

  console.log(`[Baileys] Enviando áudio para ${jidReal} — tenant ${tenantId}`)
  return sessao.sock.sendMessage(jidReal, {
    audio: audioBuffer,
    mimetype,
    ptt,
  })
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
  if (sessao) {
    try {
      sessao.sock?.ev?.removeAllListeners()
      await sessao.sock?.logout()
    } catch {}
    sessao.sock = null
  }
  sessoes.delete(tenantId)

  // Limpa auth para permitir novo QR na próxima conexão
  const authDir = path.join(AUTH_DIR, tenantId)
  try {
    fs.rmSync(authDir, { recursive: true, force: true })
  } catch {}
  console.log(`[Baileys] Sessão destruída e auth limpo — tenant ${tenantId}`)
}

module.exports = { iniciarSessao, obterStatus, enviarMensagem, enviarAudio, obterFotoPerfil, destruirSessao, obterNumeroConectado, STATUS }

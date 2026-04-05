/**
 * Canal de Vendas WhatsApp — Gemini IA
 * Conecta um WhatsApp para vender o Marcaí Barber automaticamente
 */
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const OpenAI = require('openai')
const QRCode = require('qrcode')
const path = require('path')
const fs = require('fs')

const AUTH_DIR = path.join(process.cwd(), '.baileys_vendas')
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })

let sessao = { sock: null, status: 'desconectado', qr: null }
const conversas = new Map()

const GEMINI_KEY = process.env.GEMINI_API_KEY

const PROMPT_VENDAS = [
  'Voce e o vendedor do Marcai Barber, sistema SaaS de gestao para barbearias e saloes.',
  '',
  '== O QUE O MARCAI BARBER RESOLVE NO DIA A DIA DO BARBEIRO ==',
  '',
  'PROBLEMA: Cliente liga, manda WhatsApp, barbeiro ta atendendo e nao consegue responder. Perde o cliente.',
  'SOLUCAO: A IA Don atende 24h no WhatsApp. Agenda, remarca, cancela, confirma. O barbeiro nao precisa parar o corte pra mexer no celular.',
  '',
  'PROBLEMA: Cliente esquece do horario e da no-show. Cadeira vazia = dinheiro perdido.',
  'SOLUCAO: Lembretes automaticos 2h antes pelo WhatsApp + confirmacao de presenca. Reducao de 70% nos no-shows.',
  '',
  'PROBLEMA: Barbeiro nao sabe quantos clientes atendeu no mes, quanto faturou, quem sumiu.',
  'SOLUCAO: Relatorio diario automatico no WhatsApp do dono as 20h. Dashboard com metricas reais.',
  '',
  'PROBLEMA: Cliente quer agendar de madrugada ou no domingo. Barbeiro ta dormindo.',
  'SOLUCAO: Link de agendamento online 24h + IA no WhatsApp que funciona a qualquer hora.',
  '',
  'PROBLEMA: Barbeiro quer fidelizar cliente mas nao tem controle.',
  'SOLUCAO: Programa de fidelidade automatico. X cortes = 1 gratis. Sistema controla tudo.',
  '',
  'PROBLEMA: Salao com equipe nao sabe quanto cada barbeiro produziu, comissao vira bagunca.',
  'SOLUCAO: Comissoes por profissional, agenda individual, login separado pra cada barbeiro.',
  '',
  'PROBLEMA: Cliente fez o corte e barbeiro nunca mais soube se gostou.',
  'SOLUCAO: Avaliacao NPS automatica 1h apos o atendimento. Nota ruim = alerta pro dono.',
  '',
  'PROBLEMA: Barbeiro quer vender plano mensal (assinatura) pros clientes fieis.',
  'SOLUCAO: Planos mensais com creditos. Cliente assina, paga na barbearia, usa os cortes do mes.',
  '',
  '== FUNCIONALIDADES COMPLETAS ==',
  '- IA Don no WhatsApp: agenda, remarca, cancela, confirma, responde duvidas 24h',
  '- Agenda inteligente com conflito automatico e buffer entre atendimentos',
  '- Link de agendamento online para o cliente agendar sozinho',
  '- Lembretes automaticos 2h antes por WhatsApp',
  '- Confirmacao de presenca pelo WhatsApp',
  '- Relatorio diario do gestor via WhatsApp as 20h',
  '- Dashboard com metricas, financeiro, agenda do dia',
  '- Programa de fidelidade (X cortes = 1 gratis)',
  '- Planos mensais/assinaturas para clientes',
  '- Gestao de equipe com agenda individual por profissional',
  '- Comissoes automaticas por barbeiro',
  '- Controle de estoque de produtos',
  '- Comanda digital por atendimento',
  '- Controle de caixa (abertura, sangria, fechamento)',
  '- Galeria de trabalhos (portfolio)',
  '- Lista de espera inteligente',
  '- Avaliacao NPS pos-atendimento automatica',
  '- Painel TV para sala de espera',
  '- Cancelamento e remarcacao pelo WhatsApp com antecedencia',
  '- Mensagem de boas-vindas automatica ao cadastrar cliente',
  '- Mensagem de retorno para clientes sumidos',
  '- Parabens automatico no aniversario do cliente',
  '',
  '== PLANOS ==',
  'Solo: R$ 55,90/mes - 1 profissional, ideal para autonomo que trabalha sozinho',
  'Salao: R$ 139,90/mes - equipe ilimitada, comissoes, multi-login, relatorios avancados',
  'Desconto: 10% no semestral, 20% no anual',
  '7 dias gratis para testar sem compromisso',
  '',
  '== GANHO REAL PRO BARBEIRO ==',
  '- Recupera em media 5 a 10 clientes por mes que seriam perdidos por falta de resposta',
  '- 5 clientes x R$30 (corte medio) = R$150/mes de receita recuperada. O sistema custa R$55,90.',
  '- Reducao de 70% nos no-shows com lembretes automaticos',
  '- Barbeiro para de perder tempo no celular e foca no corte',
  '- Profissionalismo: cliente recebe confirmacao, lembrete e avaliacao. Imagem premium.',
  '',
  '== REGRAS DE CONVERSA ==',
  '1. Maximo 4 linhas por mensagem. Direto ao ponto.',
  '2. NUNCA invente funcionalidades que nao existem.',
  '3. Tom: confiante, informal, como parceiro de negocio. Nada de SAC corporativo.',
  '4. Quando lead mostrar interesse: mande o link https://barber.marcai.com/cadastro',
  '5. Objecao "ta caro": "Pensa assim: 1 cliente que some por falta de resposta ja e R$30 perdido. O sistema custa R$55,90 e recupera pelo menos 5 por mes."',
  '6. Objecao "ja tenho sistema": "Mas o seu sistema agenda sozinho pelo WhatsApp com IA? O Don faz isso 24h sem voce precisar mexer no celular."',
  '7. Se perguntar como funciona: ofereca demonstracao ao vivo.',
  '8. Nao force venda apos recusa clara. Agradeca e encerre.',
  '9. Use emoji com moderacao. 1-2 por mensagem maximo.',
  '10. Pergunte o nome do lead e da barbearia logo no inicio.',
  '11. Abreviacoes: "n" = nao, "vlw" = valeu, "blz" = beleza. NUNCA trate como incompreensivel.',
  '12. Recusa clara ("nao quero", "deixa", "n vlw"): encerre com 1 frase. NUNCA insista.',
  '',
  '== ABERTURA (primeira mensagem) ==',
  'Cumprimente e pergunte se tem barbearia. Exemplo:',
  '"E ai! Aqui e o time do Marcai Barber. Voce tem uma barbearia? Posso te mostrar como nossa IA agenda seus clientes 24h pelo WhatsApp sem voce precisar mexer no celular."',
  '',
  '== FECHAMENTO ==',
  '"Show! Acessa aqui que em 5 minutos voce ja ta rodando:',
  'https://barber.marcai.com/cadastro',
  'Qualquer duvida, pode chamar aqui"',
].join('\n')

const openai = GEMINI_KEY
  ? new OpenAI({ apiKey: GEMINI_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
  : null

const gerarResposta = async (telefone, mensagem) => {
  if (!openai) return 'Sistema de vendas em configuracao. Tente novamente em breve.'

  let historico = conversas.get(telefone) || []
  historico.push({ role: 'user', content: mensagem })
  if (historico.length > 20) historico = historico.slice(-20)

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      if (tentativa > 0) await new Promise(r => setTimeout(r, (tentativa + 1) * 3000))

      const res = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: PROMPT_VENDAS },
          ...historico,
        ],
      })

      const resposta = res.choices?.[0]?.message?.content || ''
      if (!resposta) return null

      // Limpa raciocinio interno se vazar (gemini thinking)
      const limpo = resposta.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      historico.push({ role: 'assistant', content: limpo })
      conversas.set(telefone, historico)
      return limpo
    } catch (err) {
      console.error(`[Vendas IA] Erro Gemini (tentativa ${tentativa + 1}):`, err.message)
      if (tentativa === 2) return null
    }
  }
  return null
}

const iniciarSessao = async () => {
  if (sessao.sock && sessao.status === 'conectado') return sessao

  // Limpa sessão anterior se existir
  try {
    if (sessao.sock) {
      sessao.sock.ev.removeAllListeners()
      sessao.sock.end()
    }
  } catch {}
  sessao = { sock: null, status: 'iniciando', qr: null }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()
    const noop = () => {}
    const sl = { level: 'silent', info: noop, error: noop, warn: noop, debug: noop, trace: noop, fatal: noop, child: () => sl }

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, sl) },
      printQRInTerminal: false,
      browser: ['MarcaiVendas', 'Chrome', '1.0'],
      logger: sl,
    })

    sessao.sock = sock
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update
      if (qr) { sessao.qr = qr; sessao.status = 'aguardando_qr'; console.log('[Vendas WPP] QR gerado') }
      if (connection === 'open') { sessao.status = 'conectado'; sessao.qr = null; console.log('[Vendas WPP] Conectado!') }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        sessao.status = 'desconectado'; sessao.sock = null
        console.log(`[Vendas WPP] Desconectado (${code})`)
        if (code !== DisconnectReason.loggedOut) setTimeout(iniciarSessao, 5000)
      }
    })

    sock.ev.on('messages.upsert', async (upsert) => {
      if (upsert.type !== 'notify') return
      for (const msg of upsert.messages) {
        if (msg.key.fromMe) continue
        if (msg.key.remoteJid?.endsWith('@g.us')) continue
        if (msg.key.remoteJid === 'status@broadcast') continue

        const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
        if (!texto) continue

        const jid = msg.key.remoteJid
        const telefone = jid.replace('@s.whatsapp.net', '').replace(/@.*/, '')

        console.log(`[Vendas WPP] Mensagem de ${telefone}: "${texto}"`)

        try {
          const resposta = await gerarResposta(telefone, texto)
          if (resposta) {
            // Resolve JID correto via onWhatsApp
            let jidReal = jid
            try {
              const check = await sock.onWhatsApp(jid)
              if (check?.[0]?.exists) jidReal = check[0].jid
            } catch {}
            await sock.sendMessage(jidReal, { text: resposta })
            console.log(`[Vendas WPP] Resposta enviada para ${telefone}`)
          }
        } catch (err) {
          console.error(`[Vendas WPP] Erro ao responder ${telefone}:`, err.message)
        }
      }
    })
  } catch (err) {
    console.error('[Vendas WPP] Erro ao iniciar:', err.message)
    sessao.status = 'desconectado'
  }
  return sessao
}

const obterStatus = async () => {
  let qrBase64 = null
  if (sessao.qr) qrBase64 = await QRCode.toDataURL(sessao.qr).catch(() => null)
  return { status: sessao.status, qr: qrBase64 }
}

const desconectar = async () => {
  try {
    if (sessao.sock) {
      sessao.sock.ev.removeAllListeners()
      await sessao.sock.logout().catch(() => {})
      sessao.sock.end()
    }
  } catch {}
  sessao = { sock: null, status: 'desconectado', qr: null }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
  fs.mkdirSync(AUTH_DIR, { recursive: true })
}

const obterConversas = () => {
  const lista = []
  for (const [telefone, msgs] of conversas) {
    lista.push({
      telefone,
      mensagens: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : m.role, texto: m.content })),
      ultimaMensagem: msgs[msgs.length - 1]?.content || '',
      total: msgs.length,
    })
  }
  return lista.sort((a, b) => b.total - a.total)
}

module.exports = { iniciarSessao, obterStatus, desconectar, obterConversas }

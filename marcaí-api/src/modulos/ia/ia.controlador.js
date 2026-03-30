const iaServico = require('./ia.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const whatsappServico = require('./whatsapp.servico')
const wwebjsManager = require('./baileys.manager')
const { iniciarCronLembretes } = require('./lembretes.servico')
const { processarComandoAdmin, eNumeroAdministrador } = require('./admin-config.servico')
const banco = require('../../config/banco')

// Serializa processamento por número — evita respostas duplicadas em rajadas de mensagens
const filaProcessamento = new Map()
const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

const processarWebhookSerializado = (chave, fn) => {
  const anterior = filaProcessamento.get(chave) || Promise.resolve()
  // Propaga o resultado (ou o erro) para o chamador — não engole silenciosamente
  const proxima = anterior.then(() => fn())
  // Versão "sem falha" na fila: erros são logados mas não quebram a cadeia para a próxima mensagem
  const naFila = proxima.catch((err) => {
    console.error('[Webhook] Erro no processamento serializado:', err.message)
  })
  filaProcessamento.set(chave, naFila)
  naFila.finally(() => {
    if (filaProcessamento.get(chave) === naFila) filaProcessamento.delete(chave)
  })
  return proxima // retorna a promise original (com erro propagado) para o chamador
}

// Lógica central compartilhada por todos os webhooks
const processarWebhook = async ({ tenantId, telefone, mensagem, nome, canal = 'WHATSAPP', configWhatsApp, avatarUrl, lidWhatsapp }) => {
  // Ignora mensagens vazias ou sem telefone (proteção para todos os pontos de entrada)
  if (!mensagem?.trim() || !telefone?.trim()) return null

  if (canal === 'WHATSAPP' && eNumeroAdministrador(configWhatsApp, telefone)) {
    const respostaAdmin = await processarComandoAdmin({ tenantId, mensagem })
    if (respostaAdmin) {
      if (configWhatsApp) {
        await whatsappServico.enviarMensagem(configWhatsApp, telefone, respostaAdmin, tenantId)
      }
      return { tipo: 'admin', resposta: respostaAdmin }
    }
  }

  const cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefone, nome, lidWhatsapp)
  const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, canal)

  const telefoneAtual = normalizarTelefone(cliente.telefone)
  const telefoneRecebido = normalizarTelefone(telefone)
  if (telefoneRecebido && telefoneRecebido.length > telefoneAtual.length) {
    await banco.cliente.update({ where: { id: cliente.id }, data: { telefone } }).catch(() => {})
    cliente.telefone = telefone
  }

  // Atualiza foto de perfil do WhatsApp se chegou uma nova ou tenta buscar na sessão conectada.
  const avatarSincronizado =
    avatarUrl ||
    await whatsappServico.obterFotoPerfil(configWhatsApp, telefone, tenantId)

  if (avatarSincronizado && avatarSincronizado !== cliente.avatarUrl) {
    await banco.cliente.update({ where: { id: cliente.id }, data: { avatarUrl: avatarSincronizado } }).catch(() => {})
    cliente.avatarUrl = avatarSincronizado
  }

  // Mensagem de boas-vindas automática — na primeira mensagem OU quando conversa ficou inativa por 2h+
  const ultimaMsg = await banco.mensagem.findFirst({ where: { conversaId: conversa.id }, orderBy: { criadoEm: 'desc' }, select: { criadoEm: true } })
  const minutosDesdeUltimaMsg = ultimaMsg ? (Date.now() - new Date(ultimaMsg.criadoEm).getTime()) / 60000 : Infinity
  const conversaNova = !ultimaMsg // nenhuma mensagem = conversa nova
  const conversaReativada = minutosDesdeUltimaMsg > 120 // 2h sem mensagem = nova sessão
  if ((conversaNova || conversaReativada) && canal === 'WHATSAPP' && configWhatsApp) {
    const tenant = await buscarTenant(tenantId)
    const appUrl = process.env.APP_URL || 'https://app.marcai.com.br'
    const hash = tenant.hashPublico || tenant.slug
    const nomeCliente = cliente.nome && cliente.nome !== cliente.telefone ? cliente.nome : null
    const primeiroNome = nomeCliente ? nomeCliente.split(' ')[0] : null
    const h = parseInt(new Date().toLocaleString('pt-BR', { hour: 'numeric', hour12: false, timeZone: tenant.timezone || 'America/Sao_Paulo' }))
    const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'

    // Busca último serviço concluído para recomendar
    const ultimoServico = await banco.agendamento.findFirst({
      where: { tenantId, clienteId: cliente.id, status: 'CONCLUIDO' },
      include: { servico: true, profissional: true },
      orderBy: { inicioEm: 'desc' },
    })

    let boasVindas
    if (primeiroNome && ultimoServico?.servico) {
      // Cliente recorrente com histórico — recomenda último serviço
      const profNome = ultimoServico.profissional?.nome?.split(' ')[0] || ''
      boasVindas = `${saudacao}, ${primeiroNome}! 👋\n\nQue tal agendar seu próximo ${ultimoServico.servico.nome.toLowerCase()}?${profNome ? ` Da última vez foi com o ${profNome} e ficou show!` : ''} ✂️\n\nResponda "quero" que o Don agenda pra você, ou escolha pelo site:\n🗓️ ${appUrl}/b/${hash}`
    } else if (primeiroNome) {
      // Cliente conhecido sem histórico
      boasVindas = `${saudacao}, ${primeiroNome}! 👋 Bem-vindo de volta à ${tenant.nome}.\n\nAgende pelo site ou responda aqui que o Don, nosso assistente de IA, te ajuda na hora. ✂️\n\n🗓️ ${appUrl}/b/${hash}`
    } else {
      // Cliente novo
      boasVindas = `${saudacao}! 👋 Bem-vindo à ${tenant.nome}.\n\nAgende pelo site ou responda aqui que o Don, nosso assistente de IA, te ajuda na hora. ✂️\n\n🗓️ ${appUrl}/b/${hash}`
    }

    await whatsappServico.enviarMensagem(configWhatsApp, telefone, boasVindas, tenantId)
    await banco.mensagem.create({ data: { conversaId: conversa.id, remetente: 'ia', conteudo: boasVindas } })
  }

  // Conversa em atendimento humano: só salva a mensagem, não processa IA
  if (conversa.status === 'ESCALONADA') {
    await banco.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
    })
    return { tipo: 'escalonada' }
  }

  const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, mensagem)

  // Envia resposta de volta pelo WhatsApp
  if (resultado.resposta && configWhatsApp) {
    await whatsappServico.enviarMensagem(configWhatsApp, telefone, resultado.resposta, tenantId)
  }

  return { tipo: 'ia', resposta: resultado.resposta, conversaId: conversa.id }
}

// Busca tenant e sua config de WhatsApp
const buscarTenant = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw { status: 404, mensagem: 'Tenant não encontrado' }
  return tenant
}

// ─── Webhook interno (legado / testes) ────────────────────────────────────────
// POST /api/ia/webhook
const webhook = async (req, res, next) => {
  try {
    const { telefone, mensagem, canal = 'WHATSAPP', tenantId: tenantIdBody, nome } = req.body
    const tenantId = tenantIdBody || req.headers['x-tenant-id']
    if (!tenantId) return res.status(400).json({ sucesso: false, erro: { mensagem: 'tenantId é obrigatório' } })

    const tenant = await buscarTenant(tenantId)
    const chave = `${tenantId}:${telefone}`
    const resultado = await processarWebhookSerializado(chave, () =>
      processarWebhook({ tenantId, telefone, mensagem, nome, canal, configWhatsApp: tenant.configWhatsApp })
    )

    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

// ─── Meta Cloud API ────────────────────────────────────────────────────────────
// GET /api/ia/webhook/meta/:tenantId — verificação do webhook pela Meta
const verificarWebhookMeta = (req, res) => {
  const { tenantId } = req.params
  const modo = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (modo === 'subscribe' && token === tenantId) {
    return res.status(200).send(challenge)
  }

  res.status(403).json({ erro: 'Token de verificação inválido' })
}

// POST /api/ia/webhook/meta/:tenantId — mensagens recebidas
const webhookMeta = async (req, res, next) => {
  try {
    const { tenantId } = req.params

    // Meta exige 200 imediato para evitar retry
    res.status(200).json({ sucesso: true })

    const entry = req.body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const messageObj = changes?.messages?.[0]

    if (!messageObj || messageObj.type !== 'text') return

    const telefone = messageObj.from // E.164 sem +
    const mensagem = messageObj.text?.body
    const nome = changes?.contacts?.[0]?.profile?.name

    if (!mensagem) return

    const tenant = await buscarTenant(tenantId)
    const chave = `${tenantId}:${telefone}`
    await processarWebhookSerializado(chave, () =>
      processarWebhook({ tenantId, telefone: `+${telefone}`, mensagem, nome, canal: 'WHATSAPP', configWhatsApp: tenant.configWhatsApp })
    )
  } catch (erro) {
    console.error('[Webhook Meta]', erro)
  }
}

// ─── whatsapp-web.js (QR Code via Chromium) ──────────────────────────────────

// POST /api/ia/wwebjs/iniciar — inicia sessão e retorna QR Code (base64 PNG)
const iniciarWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId

    // Registra callback para mensagens recebidas via cliente JS
    const onMensagem = async (telefone, texto, nome, avatarUrl) => {
      const tenant = await buscarTenant(tenantId)
      const chave = `${tenantId}:${telefone}`
      await processarWebhookSerializado(chave, () =>
        processarWebhook({
          tenantId, telefone, mensagem: texto, nome, avatarUrl,
          canal: 'WHATSAPP', configWhatsApp: tenant.configWhatsApp,
        })
      )
    }

    // Cria/reaproveita sessão whatsapp-web.js
    await wwebjsManager.iniciarSessao(tenantId, onMensagem)

    // Aguarda até 15s para o QR aparecer (ou já estar conectado)
    let tentativas = 0
    while (tentativas < 15) {
      const { status, qr } = await wwebjsManager.obterStatus(tenantId)

      if (status === wwebjsManager.STATUS.CONECTADO) {
        return res.json({ sucesso: true, dados: { status: 'conectado', qr: null } })
      }

      if (status === wwebjsManager.STATUS.AGUARDANDO_QR && qr) {
        return res.json({ sucesso: true, dados: { status: 'aguardando_qr', qr } })
      }

      await new Promise((r) => setTimeout(r, 1000))
      tentativas++
    }

    // Ainda iniciando
    const { status } = await wwebjsManager.obterStatus(tenantId)
    res.json({ sucesso: true, dados: { status, qr: null } })
  } catch (erro) {
    console.error('[WWebJS iniciar]', erro)
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

// POST /api/ia/wwebjs/status — verifica status da sessão
const statusWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const { status, qr } = await wwebjsManager.obterStatus(tenantId)
    res.json({ sucesso: true, dados: { status, qr } })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

// POST /api/ia/wwebjs/desconectar — destrói a sessão
const desconectarWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    await wwebjsManager.destruirSessao(tenantId)
    res.json({ sucesso: true })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

// ─── Startup: recarrega sessões whatsapp-web.js salvas no disco ──────────────
const inicializarSessoesWWebJS = async () => {
  try {
    const tenants = await banco.tenant.findMany({
      where: { configWhatsApp: { path: ['provedor'], equals: 'wwebjs' } },
      select: { id: true, nome: true },
    })

    if (tenants.length === 0) return

    console.log(`[WWebJS] Recarregando ${tenants.length} sessão(ões)...`)

    for (const tenant of tenants) {
      const tenantId = tenant.id

      const onMensagem = async (telefone, texto, nome, avatarUrl, lidWhatsapp) => {
        console.log(`[Don] Processando mensagem de ${telefone}${lidWhatsapp ? ` (LID: ${lidWhatsapp})` : ''}: "${texto.substring(0, 50)}"`)
        try {
          const t = await buscarTenant(tenantId)
          const chave = `${tenantId}:${telefone}`
          await processarWebhookSerializado(chave, () =>
            processarWebhook({
              tenantId,
              telefone,
              mensagem: texto,
              nome,
              avatarUrl,
              lidWhatsapp,
              canal: 'WHATSAPP',
              configWhatsApp: t.configWhatsApp,
            })
          )
          console.log(`[Don] Resposta enviada para ${telefone}`)
        } catch (err) {
          console.error(`[Don] ERRO ao processar mensagem de ${telefone}:`, err.message, err.stack?.split('\n').slice(0, 3).join(' | '))
        }
      }

      await wwebjsManager.iniciarSessao(tenantId, onMensagem)
      console.log(`[WWebJS] Sessão registrada para tenant "${tenant.nome}" (${tenantId})`)
    }
  } catch (err) {
    console.error('[WWebJS] Erro ao recarregar sessões:', err.message)
  }
}

// ─── Simular (painel) ─────────────────────────────────────────────────────────
const simular = async (req, res, next) => {
  try {
    const resultado = await iaServico.simularConversa(req.usuario.tenantId, req.body.mensagem)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

// ─── Teste real do Don (usa processarWebhook com cliente de teste) ─────────────
const TELEFONE_TESTE = '+5511900000001'
const NOME_TESTE = 'Cliente Teste'

const testeCliente = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const { mensagem } = req.body

    // Chama o fluxo real, sem configWhatsApp para não tentar enviar pelo WhatsApp
    const chave = `teste:${tenantId}`
    const resultado = await processarWebhookSerializado(chave, () =>
      processarWebhook({ tenantId, telefone: TELEFONE_TESTE, mensagem, nome: NOME_TESTE, canal: 'WHATSAPP', configWhatsApp: null })
    )

    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

// ─── Resetar sessão de teste (apaga cliente + dados gerados) ──────────────────
const resetarTesteCliente = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId

    const cliente = await banco.cliente.findFirst({
      where: { tenantId, telefone: TELEFONE_TESTE },
      select: { id: true },
    })

    if (cliente) {
      // Cancela agendamentos do cliente de teste
      await banco.agendamento.updateMany({
        where: { tenantId, clienteId: cliente.id, status: { in: ['AGENDADO', 'CONFIRMADO'] } },
        data: { status: 'CANCELADO' },
      })

      // Apaga mensagens das conversas
      const conversas = await banco.conversa.findMany({
        where: { tenantId, clienteId: cliente.id },
        select: { id: true },
      })
      const conversaIds = conversas.map((c) => c.id)
      if (conversaIds.length > 0) {
        await banco.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } })
        await banco.conversa.deleteMany({ where: { id: { in: conversaIds } } })
      }

      // Remove o cliente de teste
      await banco.cliente.delete({ where: { id: cliente.id } })
    }

    res.json({ sucesso: true, dados: { mensagem: 'Sessão de teste resetada com sucesso.' } })
  } catch (erro) {
    next(erro)
  }
}

// Envia link de agendamento para um cliente via WhatsApp bot
const enviarLinkAgendamento = async (req, res, next) => {
  try {
    const { clienteId, linkAgendamento, mensagem } = req.body
    if (!clienteId || !linkAgendamento) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'clienteId e linkAgendamento são obrigatórios' } })
    }

    const tenantId = req.usuario.tenantId
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { configWhatsApp: true, nome: true } })
    if (!tenant?.configWhatsApp) {
      return res.status(422).json({ sucesso: false, erro: { mensagem: 'WhatsApp não está conectado. Conecte em Configurações → Integrações.' } })
    }

    const cliente = await banco.cliente.findFirst({ where: { id: clienteId, tenantId } })
    if (!cliente?.telefone) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Cliente não encontrado ou sem telefone.' } })
    }

    const texto = mensagem ||
      `Olá${cliente.nome ? `, ${cliente.nome.split(' ')[0]}` : ''}! 👋\n` +
      `Você pode agendar pelo link abaixo, ou se preferir, é só responder aqui e o *Don*, nosso assistente de IA, te ajuda a marcar diretamente pelo WhatsApp! 😊\n\n` +
      `🗓️ ${linkAgendamento}\n\n` +
      `— ${tenant.nome}`

    await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, texto, tenantId)
    res.json({ sucesso: true, dados: { mensagem: 'Link enviado via WhatsApp!' } })
  } catch (erro) {
    next(erro)
  }
}

module.exports = {
  webhook,
  verificarWebhookMeta,
  webhookMeta,
  iniciarWWebJS,
  statusWWebJS,
  desconectarWWebJS,
  simular,
  testeCliente,
  resetarTesteCliente,
  enviarLinkAgendamento,
  inicializarSessoesWWebJS,
  iniciarCronLembretes,
}

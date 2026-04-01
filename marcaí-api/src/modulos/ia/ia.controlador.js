const iaServico = require('./ia.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const whatsappServico = require('./whatsapp.servico')
const wwebjsManager = require('./baileys.manager')
const { iniciarCronLembretes } = require('./lembretes.servico')
const { processarComandoAdmin, eNumeroAdministrador } = require('./admin-config.servico')
const {
  limparDadosTesteCliente,
  rodarSuiteWhatsAppBrasil,
} = require('./ia.teste.servico')
const banco = require('../../config/banco')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')

// Serializa processamento por numero para evitar respostas duplicadas em rajadas.
const filaProcessamento = new Map()
const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

const processarWebhookSerializado = (chave, fn) => {
  const anterior = filaProcessamento.get(chave) || Promise.resolve()
  const proxima = anterior.then(() => fn())
  const naFila = proxima.catch((err) => {
    console.error('[Webhook] Erro no processamento serializado:', err.message)
  })

  filaProcessamento.set(chave, naFila)
  naFila.finally(() => {
    if (filaProcessamento.get(chave) === naFila) filaProcessamento.delete(chave)
  })

  return proxima
}

// Logica central compartilhada por todos os webhooks.
const processarWebhook = async ({
  tenantId,
  telefone,
  mensagem,
  nome,
  canal = 'WHATSAPP',
  configWhatsApp,
  avatarUrl,
  lidWhatsapp,
}) => {
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

  logClienteTrace('webhook_recebido', {
    tenantId,
    canal,
    telefoneRecebido: telefone,
    nomeRecebido: nome || null,
    lidWhatsappRecebido: lidWhatsapp || null,
    tamanhoMensagem: String(mensagem || '').trim().length,
  })

  const cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefone, nome, lidWhatsapp)
  const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, canal)

  logClienteTrace('webhook_cliente_e_conversa_resolvidos', {
    tenantId,
    canal,
    telefoneRecebido: telefone,
    lidWhatsappRecebido: lidWhatsapp || null,
    cliente: resumirCliente(cliente),
    conversa: {
      id: conversa.id,
      status: conversa.status,
      clienteId: conversa.clienteId,
    },
  })

  const telefoneAtual = normalizarTelefone(cliente.telefone)
  const telefoneRecebido = normalizarTelefone(telefone)
  // Atualiza se: recebeu número real (12-13 dígitos BR) E o atual é LID (>13 dígitos, não começa com 55)
  const atualEhLid = telefoneAtual.length > 13 && !telefoneAtual.startsWith('55')
  const recebidoEhReal = telefoneRecebido && telefoneRecebido.length >= 12 && telefoneRecebido.length <= 13 && telefoneRecebido.startsWith('55')
  if (recebidoEhReal && (atualEhLid || telefoneRecebido.length > telefoneAtual.length)) {
    await banco.cliente.update({ where: { id: cliente.id }, data: { telefone } }).catch(() => {})
    cliente.telefone = telefone
    console.log(`[IA] Telefone atualizado: LID ${telefoneAtual} → real ${telefoneRecebido}`)
  }

  const avatarSincronizado =
    avatarUrl ||
    await whatsappServico.obterFotoPerfil(configWhatsApp, telefone, tenantId)

  if (avatarSincronizado && avatarSincronizado !== cliente.avatarUrl) {
    await banco.cliente.update({ where: { id: cliente.id }, data: { avatarUrl: avatarSincronizado } }).catch(() => {})
    cliente.avatarUrl = avatarSincronizado
  }

  // A primeira resposta sai sempre da IA.
  // Isso evita duas saudacoes seguidas e reduz a sensacao de script.

  if (conversa.status === 'ESCALONADA') {
    await banco.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
    })
    return { tipo: 'escalonada' }
  }

  const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, mensagem)

  if (configWhatsApp) {
    // Envia o link proativo PRIMEIRO (se existir), depois a resposta do LLM.
    // Isso garante que o cliente recebe o link antes da saudação — padrão Anotaí.
    if (resultado.mensagemProativa) {
      await whatsappServico.enviarMensagem(configWhatsApp, telefone, resultado.mensagemProativa, tenantId)
    }
    if (resultado.resposta) {
      await whatsappServico.enviarMensagem(configWhatsApp, telefone, resultado.resposta, tenantId)
    }
  }

  return {
    tipo: 'ia',
    resposta: resultado.resposta,
    mensagemProativa: resultado.mensagemProativa || null,
    conversaId: conversa.id,
    escalonado: Boolean(resultado.escalonado),
    encerrado: Boolean(resultado.encerrado),
  }
}

const buscarTenant = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw { status: 404, mensagem: 'Tenant nao encontrado' }
  return tenant
}

// POST /api/ia/webhook
const webhook = async (req, res, next) => {
  try {
    const {
      telefone,
      mensagem,
      canal = 'WHATSAPP',
      tenantId: tenantIdBody,
      nome,
      lidWhatsapp,
      avatarUrl,
    } = req.body
    const tenantId = tenantIdBody || req.headers['x-tenant-id']
    if (!tenantId) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'tenantId e obrigatorio' } })
    }

    const tenant = await buscarTenant(tenantId)
    const chave = `${tenantId}:${telefone}`
    const resultado = await processarWebhookSerializado(chave, () =>
      processarWebhook({
        tenantId,
        telefone,
        mensagem,
        nome,
        lidWhatsapp,
        avatarUrl,
        canal,
        configWhatsApp: tenant.configWhatsApp,
      })
    )

    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

// GET /api/ia/webhook/meta/:tenantId
const verificarWebhookMeta = (req, res) => {
  const { tenantId } = req.params
  const modo = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (modo === 'subscribe' && token === tenantId) {
    return res.status(200).send(challenge)
  }

  res.status(403).json({ erro: 'Token de verificacao invalido' })
}

// POST /api/ia/webhook/meta/:tenantId
const webhookMeta = async (req, res) => {
  try {
    const { tenantId } = req.params

    res.status(200).json({ sucesso: true })

    const entry = req.body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const messageObj = changes?.messages?.[0]

    if (!messageObj || messageObj.type !== 'text') return

    const telefone = messageObj.from
    const mensagem = messageObj.text?.body
    const nome = changes?.contacts?.[0]?.profile?.name

    if (!mensagem) return

    const tenant = await buscarTenant(tenantId)
    const chave = `${tenantId}:${telefone}`
    await processarWebhookSerializado(chave, () =>
      processarWebhook({
        tenantId,
        telefone: `+${telefone}`,
        mensagem,
        nome,
        canal: 'WHATSAPP',
        configWhatsApp: tenant.configWhatsApp,
      })
    )
  } catch (erro) {
    console.error('[Webhook Meta]', erro)
  }
}

// POST /api/ia/wwebjs/iniciar
const iniciarWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId

    const onMensagem = async (telefone, texto, nome, avatarUrl, lidWhatsapp) => {
      const tenant = await buscarTenant(tenantId)
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
          configWhatsApp: tenant.configWhatsApp,
        })
      )
    }

    await wwebjsManager.iniciarSessao(tenantId, onMensagem)

    let tentativas = 0
    while (tentativas < 15) {
      const { status, qr } = await wwebjsManager.obterStatus(tenantId)

      if (status === wwebjsManager.STATUS.CONECTADO) {
        return res.json({ sucesso: true, dados: { status: 'conectado', qr: null } })
      }

      if (status === wwebjsManager.STATUS.AGUARDANDO_QR && qr) {
        return res.json({ sucesso: true, dados: { status: 'aguardando_qr', qr } })
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      tentativas += 1
    }

    const { status } = await wwebjsManager.obterStatus(tenantId)
    res.json({ sucesso: true, dados: { status, qr: null } })
  } catch (erro) {
    console.error('[WWebJS iniciar]', erro)
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

// POST /api/ia/wwebjs/status
const statusWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const { status, qr } = await wwebjsManager.obterStatus(tenantId)
    res.json({ sucesso: true, dados: { status, qr } })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

// POST /api/ia/wwebjs/desconectar
const desconectarWWebJS = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    await wwebjsManager.destruirSessao(tenantId)
    res.json({ sucesso: true })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const inicializarSessoesWWebJS = async () => {
  try {
    const tenants = await banco.tenant.findMany({
      where: { configWhatsApp: { path: ['provedor'], equals: 'wwebjs' } },
      select: { id: true, nome: true },
    })

    if (tenants.length === 0) return

    console.log(`[WWebJS] Recarregando ${tenants.length} sessao(oes)...`)

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
          console.error(
            `[Don] ERRO ao processar mensagem de ${telefone}:`,
            err.message,
            err.stack?.split('\n').slice(0, 3).join(' | ')
          )
        }
      }

      await wwebjsManager.iniciarSessao(tenantId, onMensagem)
      console.log(`[WWebJS] Sessao registrada para tenant "${tenant.nome}" (${tenantId})`)
    }
  } catch (err) {
    console.error('[WWebJS] Erro ao recarregar sessoes:', err.message)
  }
}

const simular = async (req, res, next) => {
  try {
    const resultado = await iaServico.simularConversa(req.usuario.tenantId, req.body.mensagem)
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const TELEFONE_TESTE = '+5511900000001'
const NOME_TESTE = 'Cliente Teste'

const testeCliente = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const { mensagem, telefone = TELEFONE_TESTE, lidWhatsapp = null } = req.body
    const nome = Object.prototype.hasOwnProperty.call(req.body, 'nome')
      ? req.body.nome
      : NOME_TESTE

    const chave = `teste:${tenantId}:${telefone}`
    const resultado = await processarWebhookSerializado(chave, () =>
      processarWebhook({
        tenantId,
        telefone,
        mensagem,
        nome,
        lidWhatsapp,
        canal: 'WHATSAPP',
        configWhatsApp: null,
      })
    )

    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const resetarTesteCliente = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const { telefone = TELEFONE_TESTE, lidWhatsapp = null } = req.body || {}

    await limparDadosTesteCliente({ tenantId, telefone, lidWhatsapp })

    res.json({ sucesso: true, dados: { mensagem: 'Sessao de teste resetada com sucesso.' } })
  } catch (erro) {
    next(erro)
  }
}

const suiteTesteCliente = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const filtros = Array.isArray(req.body?.filtros)
      ? req.body.filtros
      : String(req.body?.filtros || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)

    const resultado = await rodarSuiteWhatsAppBrasil({
      tenantId,
      filtros,
      processarTurno: ({ telefone, nome, lidWhatsapp, mensagem }) =>
        processarWebhook({
          tenantId,
          telefone,
          mensagem,
          nome,
          lidWhatsapp,
          canal: 'WHATSAPP',
          configWhatsApp: null,
        }),
    })

    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

const enviarLinkAgendamento = async (req, res, next) => {
  try {
    const { clienteId, linkAgendamento, mensagem } = req.body
    if (!clienteId || !linkAgendamento) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'clienteId e linkAgendamento sao obrigatorios' } })
    }

    const tenantId = req.usuario.tenantId
    const tenant = await banco.tenant.findUnique({
      where: { id: tenantId },
      select: { configWhatsApp: true, nome: true },
    })

    if (!tenant?.configWhatsApp) {
      return res.status(422).json({
        sucesso: false,
        erro: { mensagem: 'WhatsApp nao esta conectado. Conecte em Configuracoes > Integracoes.' },
      })
    }

    const cliente = await banco.cliente.findFirst({ where: { id: clienteId, tenantId } })
    if (!cliente?.telefone) {
      return res.status(404).json({ sucesso: false, erro: { mensagem: 'Cliente nao encontrado ou sem telefone.' } })
    }

    const texto = mensagem ||
      `Ola${cliente.nome ? `, ${cliente.nome.split(' ')[0]}` : ''}! 👋\n` +
      `Voce pode agendar pelo link abaixo, ou se preferir, e so responder aqui e o Don, nosso assistente de IA, te ajuda a marcar direto pelo WhatsApp.\n\n` +
      `🗓️ ${linkAgendamento}\n\n` +
      `- ${tenant.nome}`

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
  suiteTesteCliente,
  enviarLinkAgendamento,
  inicializarSessoesWWebJS,
  iniciarCronLembretes,
  processarWebhookInterno: processarWebhook,
}

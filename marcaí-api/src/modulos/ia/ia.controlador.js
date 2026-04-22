const crypto = require('crypto')
const iaServico = require('./ia.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const whatsappServico = require('./whatsapp.servico')
const { iniciarCronLembretes } = require('./lembretes.servico')
const { processarComandoAdmin, eNumeroAdministrador } = require('./admin-config.servico')
const engine = require('./engine')
const {
  limparDadosTesteCliente,
  rodarSuiteWhatsAppBrasil,
} = require('./ia.teste.servico')
const banco = require('../../config/banco')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')
const { sintetizarAudio, transcreverAudio } = require('./voz.servico')
const {
  humanizarResposta,
  decidirFormatoResposta,
  atualizarPreferenciaCanal,
  inferirTom,
} = require('./humanizacao.servico')

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0'
const META_APP_ID = process.env.META_APP_ID || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''
const META_EMBEDDED_SIGNUP_CONFIG_ID = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || ''
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || ''
const META_WEBHOOK_CALLBACK_URL = process.env.META_WEBHOOK_CALLBACK_URL || ''
const SENDZEN_WEBHOOK_CALLBACK_URL = process.env.SENDZEN_WEBHOOK_CALLBACK_URL || ''
const SENDZEN_WEBHOOK_SECRET = process.env.SENDZEN_WEBHOOK_SECRET || ''
const APP_URL = process.env.APP_URL || ''

// Serializa processamento por numero para evitar respostas duplicadas em rajadas.
const filaProcessamento = new Map()
const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')
const nomePareceTelefone = (nome = '') => /^\+?\d[\d\s()\-]{5,}$/.test(String(nome || '').trim())
const telefonePareceReal = (telefone = '') => {
  const digitos = normalizarTelefone(telefone)
  return digitos.startsWith('55') && digitos.length >= 12 && digitos.length <= 13
}
const telefonePareceLid = (telefone = '') => {
  const digitos = normalizarTelefone(telefone)
  return digitos.length > 13 && !digitos.startsWith('55')
}
const extrairTelefoneCadastroDaMensagem = (mensagem = '') => {
  const digitos = normalizarTelefone(mensagem)
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return `+${digitos}`
  return null
}
const nomeCadastroConfiavel = (cliente) => {
  const nome = String(cliente?.nome || '').trim()
  if (!nome) return false
  if (nome === cliente?.telefone) return false
  if (nomePareceTelefone(nome)) return false
  if (/^(cliente|cliente teste|teste|whatsapp|novo cliente)$/i.test(nome)) return false
  return true
}
const obterPendenciasCadastro = (cliente) => {
  const faltaNome = !nomeCadastroConfiavel(cliente)
  const faltaTelefone = !telefonePareceReal(cliente?.telefone) || telefonePareceLid(cliente?.telefone)
  return { faltaNome, faltaTelefone }
}
const montarMensagemCadastroPendente = ({ faltaNome, faltaTelefone, intencaoJaVeio = false }) => {
  const prefixo = intencaoJaVeio
    ? 'Blz. Antes de prosseguir com seu cadastro, '
    : 'Blz. Antes de prosseguir com seu cadastro, '

  if (faltaNome && faltaTelefone) {
    return `${prefixo}me informa seu nome e seu WhatsApp com DDD?`
  }
  if (faltaNome) {
    return `${prefixo}me informa seu nome?`
  }
  if (faltaTelefone) {
    return `${prefixo}me passa seu WhatsApp com DDD pra eu salvar certinho?`
  }
  return null
}
const parseHorarioMinutos = (valor = '') => {
  const [hora, minuto] = String(valor || '00:00').split(':').map(Number)
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null
  return hora * 60 + minuto
}
const formatarHorarioCurto = (minutos = 0) => {
  const hora = String(Math.floor(minutos / 60)).padStart(2, '0')
  const minuto = String(minutos % 60).padStart(2, '0')
  return `${hora}h${minuto === '00' ? '' : minuto}`
}
const obterResumoFuncionamentoAgora = async (tenantId, timezone = 'America/Sao_Paulo') => {
  const profs = await banco.profissional.findMany({ where: { tenantId, ativo: true }, select: { horarioTrabalho: true } })
  const agoraLocal = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const diaAtual = agoraLocal.getDay()
  const minutosAgora = agoraLocal.getHours() * 60 + agoraLocal.getMinutes()
  const nomesDias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

  const obterJanelasDia = (dia) => {
    const janelas = []
    for (const prof of profs) {
      const h = prof.horarioTrabalho?.[dia] || prof.horarioTrabalho?.[String(dia)]
      if (!h?.ativo) continue
      const inicio = parseHorarioMinutos(h.inicio)
      const fim = parseHorarioMinutos(h.fim)
      if (inicio == null || fim == null) continue
      janelas.push({ inicio, fim })
    }
    return janelas
  }

  const hoje = obterJanelasDia(diaAtual)
  const menorInicioHoje = hoje.length ? Math.min(...hoje.map((j) => j.inicio)) : null
  const maiorFimHoje = hoje.length ? Math.max(...hoje.map((j) => j.fim)) : null

  let statusHoje = 'SEM_EXPEDIENTE'
  if (hoje.length) {
    if (minutosAgora < menorInicioHoje) statusHoje = 'ANTES_DE_ABRIR'
    else if (minutosAgora >= maiorFimHoje) statusHoje = 'ENCERRADO'
    else statusHoje = 'ABERTO'
  }

  let proximoDia = null
  for (let offset = 1; offset <= 7; offset += 1) {
    const dia = (diaAtual + offset) % 7
    const janelas = obterJanelasDia(dia)
    if (!janelas.length) continue
    const menorInicio = Math.min(...janelas.map((j) => j.inicio))
    proximoDia = {
      dia,
      offset,
      label: offset === 1 ? 'amanhã' : nomesDias[dia],
      inicioMinutos: menorInicio,
      inicioFormatado: formatarHorarioCurto(menorInicio),
    }
    break
  }

  return { statusHoje, proximoDia }
}

const conversaTemContextoRecenteDeAgendamento = async (conversaId) => {
  const recentes = await banco.mensagem.findMany({
    where: { conversaId, remetente: { in: ['cliente', 'ia'] } },
    orderBy: { criadoEm: 'desc' },
    take: 6,
    select: { remetente: true, conteudo: true },
  })

  const texto = recentes
    .reverse()
    .map((m) => String(m.conteudo || '').toLowerCase())
    .join('\n')

  const mencionouDiaOuRemarcacao = /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|amanha|amanhã|remarc\w*)\b/.test(texto)
  const iaOfereceuSlot = /(tenho .{0,80}\b\d{1,2}:\d{2}\b.*(\bserve\?|\bda certo\?))/i.test(texto)
  const clientePerguntouFaixa = /\b(ultimo|último|primeiro)\s+horari\w*\b/.test(texto)

  return mencionouDiaOuRemarcacao || iaOfereceuSlot || clientePerguntouFaixa
}

const conversaTemContextoRecenteDeRemarcacao = async (conversaId) => {
  const recentes = await banco.mensagem.findMany({
    where: { conversaId, remetente: { in: ['cliente', 'ia', 'tool_result'] } },
    orderBy: { criadoEm: 'desc' },
    take: 10,
    select: { remetente: true, conteudo: true },
  })

  const texto = recentes
    .reverse()
    .map((m) => String(m.conteudo || '').toLowerCase())
    .join('\n')

  return /remarc/.test(texto) || /buscaragendamentoscliente/i.test(texto)
}

const mensagemPareceRefinoDeHorario = (mensagem = '') => {
  const n = String(mensagem || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return /\b(hoje|hj|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|ultimo horario|primeiro horario|mais tarde|mais cedo|fim do dia|manha|tarde|noite)\b/.test(n)
    || /\b\d{1,2}(:\d{2})?\b/.test(n)
    || /\b\d{1,2}\s*h(rs?)?\b/.test(n)
}

const mensagemClienteDuplicadaRecente = async (conversaId, conteudo) => {
  const ultimaIgual = await banco.mensagem.findFirst({
    where: {
      conversaId,
      remetente: 'cliente',
      conteudo,
    },
    orderBy: { criadoEm: 'desc' },
    select: { criadoEm: true },
  })

  if (!ultimaIgual) return false
  return Date.now() - new Date(ultimaIgual.criadoEm).getTime() < 15000
}

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

const obterMetaPublicConfig = () => ({
  enabled: Boolean(META_APP_ID && META_APP_SECRET && META_EMBEDDED_SIGNUP_CONFIG_ID && META_WEBHOOK_VERIFY_TOKEN),
  appId: META_APP_ID || null,
  configId: META_EMBEDDED_SIGNUP_CONFIG_ID || null,
  apiVersion: META_API_VERSION,
  webhookCallbackUrl: META_WEBHOOK_CALLBACK_URL || null,
})

const chamarGraphApi = async (path, { method = 'GET', accessToken, query = {}, body } = {}) => {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${path.replace(/^\//, '')}`)

  Object.entries(query || {}).forEach(([chave, valor]) => {
    if (valor != null && valor !== '') url.searchParams.set(chave, String(valor))
  })

  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body) headers['Content-Type'] = 'application/json'

  const resposta = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Meta Graph error ${resposta.status}`)
  }

  return dados
}

const trocarCodePorTokenMeta = async (code) => {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
  url.searchParams.set('client_id', META_APP_ID)
  url.searchParams.set('client_secret', META_APP_SECRET)
  url.searchParams.set('code', code)

  const resposta = await fetch(url)
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    throw new Error(dados?.error?.message || `Meta OAuth error ${resposta.status}`)
  }
  return dados
}

const resolverTenantMeta = async ({ tenantId = null, phoneNumberId = null, wabaId = null }) => {
  if (tenantId) {
    return buscarTenant(tenantId)
  }

  if (!phoneNumberId && !wabaId) return null

  return banco.tenant.findFirst({
    where: {
      OR: [
        phoneNumberId ? { configWhatsApp: { path: ['phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['wabaId'], equals: String(wabaId) } } : undefined,
        phoneNumberId ? { configWhatsApp: { path: ['meta', 'phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['meta', 'wabaId'], equals: String(wabaId) } } : undefined,
      ].filter(Boolean),
    },
  })
}

const resolverTenantSendzen = async ({ tenantId = null, phoneNumberId = null, wabaId = null, from = null }) => {
  if (tenantId) return buscarTenant(tenantId)

  const numero = normalizarTelefone(from)
  if (!phoneNumberId && !wabaId && !numero) return null

  return banco.tenant.findFirst({
    where: {
      OR: [
        phoneNumberId ? { configWhatsApp: { path: ['phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['whatsappBusinessAccountId'], equals: String(wabaId) } } : undefined,
        numero ? { configWhatsApp: { path: ['from'], equals: numero } } : undefined,
        phoneNumberId ? { configWhatsApp: { path: ['sendzen', 'phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['sendzen', 'whatsappBusinessAccountId'], equals: String(wabaId) } } : undefined,
        numero ? { configWhatsApp: { path: ['sendzen', 'from'], equals: numero } } : undefined,
      ].filter(Boolean),
    },
  })
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
  ehAudio = false,
}) => {
  if (!mensagem?.trim() || !telefone?.trim()) return null
  let cliente = null

  const enviarRespostaWhatsapp = async (texto, { preferirAudio = false, momento = 'ATENDIMENTO' } = {}) => {
    if (!configWhatsApp || !texto) return

    const textoHumanizado = humanizarResposta({
      texto,
      cliente,
      mensagemCliente: mensagem,
      contexto: {
        momento,
        aprendizadoCliente: cliente?.preferencias || null,
      },
    })

    const formato = await decidirFormatoResposta({
      cliente,
      mensagemCliente: mensagem,
      respostaTexto: textoHumanizado,
      ehAudioEntrada: ehAudio,
      contexto: { momento },
    }).catch(() => ({ enviarTexto: true, enviarAudio: false, motivo: 'fallback' }))

    const tomInferido = inferirTom({
      cliente,
      mensagem,
      aprendizado: cliente?.preferencias || null,
    })

    const estiloAudio = ({
      direto: 'direto',
      premium_direto: 'direto',
      caloroso: 'caloroso',
      acolhedor: 'caloroso',
      consultivo: 'consultivo',
    })[tomInferido?.tom] || 'default'

    const deveTentarAudio = Boolean(preferirAudio || formato?.enviarAudio)

    if (deveTentarAudio) {
      try {
        console.log(`[Voz] Tentando sintetizar áudio para resposta...`)
        const audio = await sintetizarAudio(textoHumanizado, { estilo: estiloAudio })
        if (audio?.buffer?.length) {
          console.log(`[Voz] Áudio sintetizado ok (${audio.buffer.length} bytes), enviando...`)
          await whatsappServico.enviarAudio(configWhatsApp, telefone, audio.buffer, tenantId, lidWhatsapp ? `${lidWhatsapp}@lid` : null, {
            mimetype: audio.mimetype,
            ptt: true,
          })
          return
        }
        console.warn(`[Voz] Síntese de áudio retornou buffer vazio ou nulo.`)
      } catch (erroAudio) {
        console.warn(`[Voz] Falha ao sintetizar/enviar áudio para ${telefone}: ${erroAudio.message}`)
      }
    }

    console.log(`[Voz] Enviando resposta final em TEXTO (fallback ou preferência).`)
    await whatsappServico.enviarMensagem(configWhatsApp, telefone, textoHumanizado, tenantId, lidWhatsapp ? `${lidWhatsapp}@lid` : null)
  }

  if (canal === 'WHATSAPP' && eNumeroAdministrador(configWhatsApp, telefone)) {
    const respostaAdmin = await processarComandoAdmin({ tenantId, mensagem })
    if (respostaAdmin) {
      await enviarRespostaWhatsapp(respostaAdmin, { momento: 'ADMIN' })
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

  cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefone, nome, lidWhatsapp, {
    confiarNome: false,
    usarNomeParaMerge: true,
  })
  const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, canal)

  if (ehAudio) {
    atualizarPreferenciaCanal({ clienteId: cliente.id, usouAudio: true }).catch(() => {})
  }

  if (await mensagemClienteDuplicadaRecente(conversa.id, mensagem)) {
    console.log('[Webhook] Mensagem duplicada recente ignorada para evitar resposta repetida')
    return { tipo: 'duplicada' }
  }

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

  let instrucaoCapturaCadastro = ''
  const telefoneInformadoNoTexto = extrairTelefoneCadastroDaMensagem(mensagem)
  if (telefoneInformadoNoTexto && (!telefonePareceReal(cliente.telefone) || telefonePareceLid(cliente.telefone))) {
    cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefoneInformadoNoTexto, nome || cliente.nome, null)
    instrucaoCapturaCadastro = `\n[Sistema: o cliente acabou de informar o WhatsApp com DDD (${telefoneInformadoNoTexto}). Continue exatamente do ponto em que a conversa parou e nao peca o telefone novamente.]`
    logClienteTrace('telefone_capturado_pelo_texto', {
      tenantId,
      telefoneOriginal: telefone,
      telefoneCapturado: telefoneInformadoNoTexto,
      cliente: resumirCliente(cliente),
    })
  }

  if (conversa.status === 'ESCALONADA') {
    await banco.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
    })
    return { tipo: 'escalonada' }
  }

  // ═══ ENGINE v4 — backend faz tudo que é crítico ═══
  let intencao = engine.detectar(mensagem)
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  const mensagemNormalizada = String(mensagem || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const pediuHoje = /\b(hoje|hj|ainda hoje|hoje ainda|mais tarde hoje)\b/.test(mensagemNormalizada)
  const pediuAgendamentoGenerico = /\b(agend\w*|marc\w*|horari\w*|hora\w*)\b/.test(mensagemNormalizada)
  const resumoFuncionamento = await obterResumoFuncionamentoAgora(tenantId, tenant?.timezone || 'America/Sao_Paulo')
  const temContextoRecenteDeAgendamento = await conversaTemContextoRecenteDeAgendamento(conversa.id)
  const temContextoRecenteDeRemarcacao = await conversaTemContextoRecenteDeRemarcacao(conversa.id)

  if (!intencao && temContextoRecenteDeRemarcacao && mensagemPareceRefinoDeHorario(mensagem)) {
    intencao = 'REMARCAR'
  }

  if (resumoFuncionamento.statusHoje === 'ENCERRADO' && pediuHoje) {
    const prox = resumoFuncionamento.proximoDia
    const resposta = prox
      ? `Hoje já encerramos por aqui. O próximo dia com atendimento é ${prox.label}, a partir das ${prox.inicioFormatado}. Se quiser, já vejo um horário pra você nesse dia.`
      : 'Hoje já encerramos por aqui. Se quiser, me diz um dia e horário que eu vejo a próxima vaga pra você.'

    await banco.mensagem.createMany({
      data: [
        { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
        { conversaId: conversa.id, remetente: 'ia', conteudo: resposta },
      ],
    })
    if (configWhatsApp) await whatsappServico.enviarMensagem(configWhatsApp, telefone, resposta, tenantId)
    console.log('[Engine] Bloqueio de sugestão para hoje após encerramento')
    return { tipo: 'engine', resposta, conversaId: conversa.id }
  }

  if (resumoFuncionamento.statusHoje === 'ENCERRADO' && pediuAgendamentoGenerico && !pediuHoje && !temContextoRecenteDeAgendamento) {
    const prox = resumoFuncionamento.proximoDia
    const resposta = prox
      ? `Boa! Hoje já encerramos por aqui. Quer que eu veja ${prox.label} ou outro dia pra você?`
      : 'Boa! Hoje já encerramos por aqui. Me diz um dia que eu vejo a próxima vaga pra você.'

    await banco.mensagem.createMany({
      data: [
        { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
        { conversaId: conversa.id, remetente: 'ia', conteudo: resposta },
      ],
    })
    if (configWhatsApp) await whatsappServico.enviarMensagem(configWhatsApp, telefone, resposta, tenantId)
    console.log('[Engine] Redirecionamento de agendamento genérico após encerramento')
    return { tipo: 'engine', resposta, conversaId: conversa.id }
  }

  // SAUDAÇÃO FIXA: primeiro contato + cliente com nome + saudação simples → envia template direto sem IA
  const ehSaudacaoSimples = /^(oi|ol[aá]|e\s*a[ií]|fala|salve|bom\s*dia|boa\s*tarde|boa\s*noite|hey|eae|opa)\s*[!?.,]*$/i.test(mensagem.trim())
  const nomeCliente = cliente?.nome && cliente.nome !== cliente.telefone ? cliente.nome : null
  const { faltaNome, faltaTelefone } = obterPendenciasCadastro(cliente)
  const cadastroConfiavel = !faltaNome && !faltaTelefone
  const ultimaMsgIA = await banco.mensagem.findFirst({
    where: { conversaId: conversa.id, remetente: 'ia' },
    orderBy: { criadoEm: 'desc' },
  })
  const ehNovaSessao = !ultimaMsgIA || (Date.now() - new Date(ultimaMsgIA.criadoEm).getTime() > 2 * 60 * 60 * 1000)

  // A saudacao inicial deve ser centralizada no ia.servico para manter
  // persona, regras de link e contexto premium em um unico lugar.
  if (false && ehSaudacaoSimples && ehNovaSessao && tenant) {
    // Monta horário de funcionamento
    const profs = await banco.profissional.findMany({ where: { tenantId, ativo: true }, select: { horarioTrabalho: true } })
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
    let menorI = '23:59', maiorF = '00:00'
    const diasAtivos = new Set()
    for (const p of profs) {
      if (!p.horarioTrabalho) continue
      for (let d = 0; d < 7; d++) {
        const h = p.horarioTrabalho[d] || p.horarioTrabalho[String(d)]
        if (h?.ativo) { diasAtivos.add(d); if (h.inicio < menorI) menorI = h.inicio; if (h.fim > maiorF) maiorF = h.fim }
      }
    }
    const diasOrd = [...diasAtivos].sort((a, b) => a - b)
    const rangeDias = diasOrd.length >= 5 ? `${DIAS[diasOrd[0]]}–${DIAS[diasOrd[diasOrd.length - 1]]}` : diasOrd.map(d => DIAS[d]).join(', ')
    const fmtH = (h) => h.replace(':00', 'h').replace(':', 'h')
    const horarioFunc = `${rangeDias} ${fmtH(menorI)} às ${fmtH(maiorF)}`

    // Monta link
    const appUrl = process.env.APP_URL || 'https://barber.marcaí.com'
    const linkSlug = tenant.hashPublico || tenant.slug
    const telDigitos = (cliente.telefone || '').replace(/\D/g, '')
    const telReal = telDigitos.startsWith('55') && telDigitos.length >= 12 && telDigitos.length <= 13
    let link = `${appUrl}/b/${linkSlug}`
    if (telReal) {
      link += `?tel=${encodeURIComponent(cliente.telefone)}`
      if (nomeCliente) link += `&nome=${encodeURIComponent(nomeCliente)}`
    }

    // Diferenciais
    const labelDif = { sinuca: 'sinuca', wifi: 'Wi-Fi', tv: 'TV', estacionamento: 'estacionamento', cafezinho: 'cafezinho', cerveja: 'cerveja/drinks', ar_condicionado: 'ar-condicionado', musica_ao_vivo: 'música ao vivo', venda_produtos: 'venda de produtos' }
    const difs = Array.isArray(tenant.diferenciais) ? tenant.diferenciais.map(d => labelDif[d] || d) : []

    const nomeIA = tenant.nomeIA || 'Don Barber'
    const saudacaoBase = cadastroConfiavel && nomeCliente
      ? `Oi, ${nomeCliente}! Aqui é o ${nomeIA}, da ${tenant.nome} 💈\n📅 Nosso horário de funcionamento é de ${horarioFunc}\n${difs.length > 0 ? '\n✨ Temos ' + difs.join(', ') + '.\n' : ''}\nSe quiser, eu já vejo seu horário por aqui.`
      : `Oi! Aqui é o ${nomeIA}, da ${tenant.nome} 💈\n📅 Nosso horário de funcionamento é de ${horarioFunc}\n${difs.length > 0 ? '\n✨ Temos ' + difs.join(', ') + '.\n' : ''}\nSe quiser, eu já vejo seu horário por aqui.`
    const saudacao = saudacaoBase

    await banco.mensagem.createMany({
      data: [
        { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
        { conversaId: conversa.id, remetente: 'ia', conteudo: saudacao },
      ],
    })
    await enviarRespostaWhatsapp(saudacao, { momento: 'SAUDACAO' })
    console.log('[Engine] Saudação fixa enviada (sem LLM)')
    return { tipo: 'engine', resposta: saudacao, conversaId: conversa.id }
  }

  if (intencao) console.log(`[Engine] ${intencao} | ${cliente.nome || cliente.telefone}`)

  // Respostas diretas sem LLM (áudio, figurinha, reclamação, localização, pagamento)
  const direta = intencao ? engine.respostaDireta(intencao, { tenant }) : null
  if (direta?.pular && direta.resposta) {
    await banco.mensagem.createMany({
      data: [
        { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
        { conversaId: conversa.id, remetente: 'ia', conteudo: direta.resposta },
      ],
    })
    if (direta.tool) {
      try {
        await iaServico.executarFerramentaDireta(tenantId, direta.tool, { clienteId: cliente.id, conversaId: conversa.id })
      } catch {}
    }
    await enviarRespostaWhatsapp(direta.resposta, { preferirAudio: true, momento: 'RESPOSTA_DIRETA' })
    console.log(`[Engine] Resposta direta: ${intencao} (sem LLM)`)
    return { tipo: 'engine', resposta: direta.resposta, conversaId: conversa.id }
  }

  // Engine busca dados reais antes da IA
  const dadosEngineBase = intencao
    ? await engine.buscarDadosReais(intencao, { tenantId, clienteId: cliente.id, timezone: tenant?.timezone, tenant, mensagem })
    : ''
  const dadosEngine = `${dadosEngineBase || ''}${instrucaoCapturaCadastro}`.trim()

  // Escolhe modelo: Haiku (rápido) ou Sonnet (complexo)
  const usarComplexo = engine.deveUsarModeloComplexo(mensagem, intencao)
  if (usarComplexo) console.log(`[Engine] Usando modelo complexo (Sonnet) para: "${mensagem.substring(0, 50)}"`)

  // ═══ CHAMA A IA (com dados reais + modelo adequado) ═══
  const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, mensagem, dadosEngine, usarComplexo)

  if (configWhatsApp) {
    if (resultado.mensagemProativa) {
      if (resultado.mensagemProativaInterativa) {
        await whatsappServico.enviarMensagemInterativa(
          configWhatsApp,
          telefone,
          resultado.mensagemProativaInterativa,
          tenantId,
          lidWhatsapp ? `${lidWhatsapp}@lid` : null
        )
      } else {
        await enviarRespostaWhatsapp(resultado.mensagemProativa, { momento: 'SAUDACAO' })
      }
    }
    if (resultado.resposta) {
      await enviarRespostaWhatsapp(resultado.resposta, { preferirAudio: true, momento: resultado.encerrado ? 'ENCERRAMENTO' : resultado.escalonado ? 'ESCALACAO' : 'ATENDIMENTO' })
    }
  }

  return {
    tipo: 'ia',
    intencao,
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

const obterWebhookSendzenBaseUrl = (valor = null) => {
  const fallback = APP_URL ? `${String(APP_URL).replace(/\/+$/, '')}/api/ia/webhook/sendzen` : ''
  const origem = String(valor || SENDZEN_WEBHOOK_CALLBACK_URL || fallback || '').trim()
  if (!origem) return null

  try {
    const url = new URL(origem)
    const partes = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
    const indiceSendzen = partes.lastIndexOf('sendzen')
    if (indiceSendzen >= 0) {
      url.pathname = `/${partes.slice(0, indiceSendzen + 1).join('/')}`
    }
    return url.toString()
  } catch {
    const normalizado = origem.replace(/\/+$/, '')
    const match = normalizado.match(/^(.*\/api\/ia\/webhook\/sendzen)(?:\/[^/]+)?$/)
    return match?.[1] || normalizado
  }
}

const construirWebhookSendzenCallbackUrl = (tenantId = null, baseUrl = null) => {
  const urlBase = obterWebhookSendzenBaseUrl(baseUrl)
  if (!urlBase) return null
  if (!tenantId) return urlBase

  try {
    const url = new URL(urlBase)
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(String(tenantId))}`
    return url.toString()
  } catch {
    return `${urlBase.replace(/\/+$/, '')}/${encodeURIComponent(String(tenantId))}`
  }
}

const obterSendzenPublicConfig = (tenantId = null) => ({
  enabled: true,
  webhookCallbackUrl: construirWebhookSendzenCallbackUrl(tenantId),
  webhookSecretConfigurado: Boolean(SENDZEN_WEBHOOK_SECRET),
})

const normalizarSegredoWebhookSendzen = (valor = '') => String(valor || '').replace(/^Bearer\s+/i, '').trim()

const extrairValoresAssinaturaWebhookSendzen = (req) => {
  const candidatos = [
    req.headers['x-sendzen-secret'],
    req.headers['x-webhook-secret'],
    req.headers['authorization'],
    req.headers['x-sendzen-signature'],
    req.headers['x-sendzen-signature-256'],
    req.headers['x-webhook-signature'],
    req.headers['x-webhook-signature-256'],
    req.headers['x-hub-signature'],
    req.headers['x-hub-signature-256'],
    req.body?.secret,
    req.body?.webhookSecret,
  ]

  return candidatos
    .flatMap((valor) => (Array.isArray(valor) ? valor : [valor]))
    .map((valor) => normalizarSegredoWebhookSendzen(valor))
    .filter(Boolean)
}

const gerarAssinaturasWebhookSendzen = (segredo = '', rawBody = null) => {
  const segredoNormalizado = normalizarSegredoWebhookSendzen(segredo)
  if (!segredoNormalizado || !rawBody) return new Set()

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''))
  const assinaturas = new Set()

  for (const algoritmo of ['sha256', 'sha1']) {
    for (const encoding of ['hex', 'base64']) {
      const digest = crypto.createHmac(algoritmo, segredoNormalizado).update(payload).digest(encoding)
      assinaturas.add(digest)
      assinaturas.add(`${algoritmo}=${digest}`)
      assinaturas.add(`${algoritmo}:${digest}`)
    }
  }

  return assinaturas
}

const validarWebhookSendzen = ({ req, segredo = '' }) => {
  const segredoNormalizado = normalizarSegredoWebhookSendzen(segredo)
  if (!segredoNormalizado) return { verificado: true, modo: 'sem_secret' }

  const valores = extrairValoresAssinaturaWebhookSendzen(req)
  if (!valores.length) {
    return { verificado: false, modo: 'sem_assinatura', detalhe: 'Nenhum header/body de assinatura reconhecido foi enviado.' }
  }

  if (valores.includes(segredoNormalizado)) {
    return { verificado: true, modo: 'secret_direto' }
  }

  const assinaturasAceitas = gerarAssinaturasWebhookSendzen(segredoNormalizado, req.rawBody)
  if (valores.some((valor) => assinaturasAceitas.has(valor))) {
    return { verificado: true, modo: 'hmac' }
  }

  return { verificado: false, modo: 'assinatura_nao_confirmada', detalhe: 'Assinatura recebida não pôde ser validada com o secret configurado.' }
}

const PAYLOADS_BOTOES_WHATSAPP = {
  AGENDAR: 'AGENDAR',
  VER_HORARIOS: 'VER_HORARIOS',
  VER_SERVICOS: 'VER_SERVICOS',
  LINK_AGENDAMENTO: 'LINK_AGENDAMENTO',
  FALAR_ATENDENTE: 'FALAR_ATENDENTE',
  CONFIRMAR_AGENDAMENTO: 'CONFIRMAR_AGENDAMENTO',
  REMARCAR_AGENDAMENTO: 'REMARCAR_AGENDAMENTO',
  CANCELAR_AGENDAMENTO: 'CANCELAR_AGENDAMENTO',
}

const clonarObjeto = (valor) => (valor && typeof valor === 'object' ? JSON.parse(JSON.stringify(valor)) : {})

const obterConfigProvedor = (cfg = {}, provedor = null) => (
  whatsappServico.obterConfigDoProvedor(cfg || {}, provedor)
)

const preservarCamposCompartilhados = (base = {}, destino = {}) => {
  const campos = ['numeroAdministrador']
  for (const campo of campos) {
    if (base?.[campo] != null && destino?.[campo] == null) destino[campo] = base[campo]
  }
  return destino
}

const normalizarConfigWhatsAppPersistida = (cfg = {}) => {
  const base = clonarObjeto(cfg)
  const normalizado = preservarCamposCompartilhados(base, {})

  const metaLegada = base?.meta || (
    base?.phoneNumberId || base?.wabaId || base?.businessAccountId || base?.appId || base?.apiToken || base?.verifiedName
      ? {
          token: base?.token || null,
          apiToken: base?.apiToken || null,
          appId: base?.appId || null,
          configId: base?.configId || null,
          phoneNumberId: base?.phoneNumberId || null,
          wabaId: base?.wabaId || null,
          businessAccountId: base?.businessAccountId || null,
          displayPhoneNumber: base?.displayPhoneNumber || null,
          verifiedName: base?.verifiedName || null,
          webhookVerifyToken: base?.webhookVerifyToken || null,
          webhookCallbackUrl: base?.webhookCallbackUrl || null,
          embeddedSignupAt: base?.embeddedSignupAt || null,
        }
      : null
  )

  const sendzenLegada = base?.sendzen || (
    base?.from || base?.apiKey || base?.whatsappBusinessAccountId
      ? {
          apiKey: base?.apiKey || null,
          token: base?.token || null,
          from: base?.from || null,
          displayPhoneNumber: base?.displayPhoneNumber || null,
          whatsappBusinessAccountId: base?.whatsappBusinessAccountId || null,
          phoneNumberId: base?.phoneNumberId || null,
          webhookSecret: base?.webhookSecret || null,
          webhookCallbackUrl: base?.webhookCallbackUrl || null,
          sendzenConnectedAt: base?.sendzenConnectedAt || null,
        }
      : null
  )

  if (metaLegada) normalizado.meta = metaLegada
  if (sendzenLegada) normalizado.sendzen = sendzenLegada
  const ativo = ['sendzen', 'meta'].includes(base?.provedorAtivo)
    ? base.provedorAtivo
    : ['sendzen', 'meta'].includes(base?.provedor)
      ? base.provedor
      : (sendzenLegada ? 'sendzen' : null) || (metaLegada ? 'meta' : null)
  if (ativo) {
    normalizado.provedorAtivo = ativo
    normalizado.provedor = ativo
  }

  return normalizado
}

const construirConfigWhatsApp = ({ cfgAtual = {}, provedorAtivo = null, meta = undefined, sendzen = undefined }) => {
  const base = normalizarConfigWhatsAppPersistida(cfgAtual)
  const novoConfig = preservarCamposCompartilhados(base, {})

  if (meta !== undefined) {
    if (meta) novoConfig.meta = meta
  } else if (base.meta) {
    novoConfig.meta = base.meta
  }

  if (sendzen !== undefined) {
    if (sendzen) novoConfig.sendzen = sendzen
  } else if (base.sendzen) {
    novoConfig.sendzen = base.sendzen
  }

  const ordemPreferencia = [provedorAtivo, base.provedorAtivo, base.provedor, 'sendzen', 'meta']
    .filter((item) => ['sendzen', 'meta'].includes(item))
  const ativoResolvido = ordemPreferencia.find((item) => Boolean(novoConfig?.[item]))
  if (ativoResolvido) {
    novoConfig.provedorAtivo = ativoResolvido
    novoConfig.provedor = ativoResolvido
  }

  return Object.keys(novoConfig).length ? novoConfig : null
}

const traduzirPayloadBotao = (texto = '') => {
  const valor = String(texto || '').trim()
  switch (valor) {
    case PAYLOADS_BOTOES_WHATSAPP.AGENDAR:
      return 'quero agendar um horário'
    case PAYLOADS_BOTOES_WHATSAPP.VER_HORARIOS:
      return 'quais horários vocês têm hoje?'
    case PAYLOADS_BOTOES_WHATSAPP.VER_SERVICOS:
      return 'quais serviços vocês têm disponíveis?'
    case PAYLOADS_BOTOES_WHATSAPP.LINK_AGENDAMENTO:
      return 'me manda o link de agendamento'
    case PAYLOADS_BOTOES_WHATSAPP.FALAR_ATENDENTE:
      return 'quero falar com um atendente'
    case PAYLOADS_BOTOES_WHATSAPP.CONFIRMAR_AGENDAMENTO:
      return 'confirmar meu agendamento'
    case PAYLOADS_BOTOES_WHATSAPP.REMARCAR_AGENDAMENTO:
      return 'quero buscar outro horário'
    case PAYLOADS_BOTOES_WHATSAPP.CANCELAR_AGENDAMENTO:
      return 'quero cancelar meu agendamento'
    default:
      return valor
  }
}

const extrairTextoMensagemRecebida = async (messageObj = {}, configWhatsApp = null) => {
  console.log(`[Webhook] Raw message type: ${messageObj?.type}`, JSON.stringify(messageObj))
  
  if (messageObj?.type === 'text' && messageObj?.text?.body) return { texto: messageObj.text.body, ehAudio: false }

  if (messageObj?.type === 'audio') {
    const mediaId = messageObj?.audio?.id
    const mediaUrl = messageObj?.audio?.link
    const idOuUrl = mediaId || mediaUrl
    console.log(`[Voz] Áudio recebido: id/url=${idOuUrl}, type=${messageObj?.type}`)

    if (idOuUrl && configWhatsApp) {
      try {
        console.log(`[Voz] Baixando mídia...`)
        const buffer = await whatsappServico.baixarMidia(configWhatsApp, idOuUrl)
        if (buffer) {
          console.log(`[Voz] Transcrevendo buffer (${buffer.length} bytes)...`)
          const transcricao = await transcreverAudio(buffer, messageObj?.audio?.mime_type)
          if (transcricao) {
            console.log(`[Voz] Transcrição concluída: "${transcricao.slice(0, 50)}..."`)
            return { texto: transcricao, ehAudio: true }
          }
        }
      } catch (err) {
        console.warn('[Voz] Falha ao processar áudio recebido:', err.message)
      }
    }
  }

  if (messageObj?.type === 'button') {
    return { 
      texto: traduzirPayloadBotao(messageObj?.button?.payload || messageObj?.button?.text || ''), 
      ehAudio: false 
    }
  }

  if (messageObj?.type === 'interactive') {
    const buttonReply = messageObj?.interactive?.button_reply
    const listReply = messageObj?.interactive?.list_reply
    if (buttonReply?.id || buttonReply?.title) {
      return { texto: traduzirPayloadBotao(buttonReply.id || buttonReply.title), ehAudio: false }
    }
    if (listReply?.id || listReply?.title) {
      return { texto: traduzirPayloadBotao(listReply.id || listReply.title), ehAudio: false }
    }
  }

  return null
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
    const resultado = await processarWebhookSerializado(chave, async () => {
      // Se já veio transcrito no corpo (ex: testes ou integrações externas), usamos direto
      let msgFinal = mensagem
      let audioFlag = false

      if (req.body?.messageObj) {
        const extraido = await extrairTextoMensagemRecebida(req.body.messageObj, tenant.configWhatsApp)
        if (extraido?.texto) {
          msgFinal = extraido.texto
          audioFlag = extraido.ehAudio
        }
      }

      return processarWebhook({
        tenantId,
        telefone,
        mensagem: msgFinal,
        nome,
        lidWhatsapp,
        avatarUrl,
        canal,
        configWhatsApp: tenant.configWhatsApp,
        ehAudio: audioFlag,
      })
    })

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
  const tokenEsperado = tenantId || META_WEBHOOK_VERIFY_TOKEN

  if (modo === 'subscribe' && tokenEsperado && token === tokenEsperado) {
    return res.status(200).send(challenge)
  }

  res.status(403).json({ erro: 'Token de verificacao invalido' })
}

// POST /api/ia/webhook/meta/:tenantId
const webhookMeta = async (req, res) => {
  try {
    res.status(200).json({ sucesso: true })

    const entradas = Array.isArray(req.body?.entry) ? req.body.entry : []

    for (const entry of entradas) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []

      for (const change of changes) {
        const valor = change?.value || {}
        const metadata = valor?.metadata || {}
        const phoneNumberId = metadata?.phone_number_id || null
        const wabaId = change?.value?.business_account_id || entry?.id || null
        const tenant = await resolverTenantMeta({ tenantId: req.params?.tenantId || null, phoneNumberId, wabaId })
        if (!tenant) continue

        const mensagens = Array.isArray(valor?.messages) ? valor.messages : []
        for (const messageObj of mensagens) {
          const telefone = messageObj?.from
          const nome = valor?.contacts?.[0]?.profile?.name

          const extraido = await extrairTextoMensagemRecebida(messageObj, tenant.configWhatsApp)
          if (extraido?.texto) {
            const chave = `${tenant.id}:${telefone}`
            await processarWebhookSerializado(chave, () =>
              processarWebhook({
                tenantId: tenant.id,
                telefone: `+${telefone}`,
                mensagem: extraido.texto,
                nome,
                canal: 'WHATSAPP',
                configWhatsApp: tenant.configWhatsApp,
                ehAudio: extraido.ehAudio,
              })
            )
          }
        }
      }
    }
  } catch (erro) {
    console.error('[Webhook Meta]', erro)
  }
}

const obterConfiguracaoSendzen = async (req, res) => {
  try {
    const tenant = await buscarTenant(req.usuario.tenantId)
    const cfg = tenant.configWhatsApp || {}
    const sendzenCfg = obterConfigProvedor(cfg, 'sendzen') || {}
    const sendzen = obterSendzenPublicConfig(tenant.id)
    const apiKey = String(sendzenCfg?.apiKey || sendzenCfg?.token || '')
    const webhookUrl = construirWebhookSendzenCallbackUrl(tenant.id, sendzenCfg?.webhookCallbackUrl || sendzen.webhookCallbackUrl)

    res.json({
      sucesso: true,
      dados: {
        ...sendzen,
        status: {
          conectado: Boolean(apiKey && sendzenCfg?.from),
          provedor: 'sendzen',
          ativo: cfg?.provedorAtivo === 'sendzen' || cfg?.provedor === 'sendzen',
          from: sendzenCfg?.from || null,
          displayPhoneNumber: sendzenCfg?.displayPhoneNumber || null,
          whatsappBusinessAccountId: sendzenCfg?.whatsappBusinessAccountId || null,
          phoneNumberId: sendzenCfg?.phoneNumberId || null,
          webhookUrl,
          webhookSecretConfigurado: Boolean(sendzenCfg?.webhookSecret || sendzen.webhookSecretConfigurado),
          apiKeyMascarada: apiKey ? `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}` : null,
        },
      },
    })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const conectarSendzen = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const {
      apiKey,
      from,
      displayPhoneNumber = null,
      whatsappBusinessAccountId = null,
      phoneNumberId = null,
      webhookSecret = null,
    } = req.body || {}

    if (!apiKey || !String(apiKey).trim()) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'apiKey da Sendzen é obrigatória.' } })
    }

    const fromNormalizado = normalizarTelefone(from)
    if (!fromNormalizado) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Número remetente da Sendzen é obrigatório.' } })
    }

    const tenant = await buscarTenant(tenantId)
    const cfgAtual = tenant.configWhatsApp || {}
    const sendzenAtual = obterConfigProvedor(cfgAtual, 'sendzen') || {}
    const webhookCallbackUrl = construirWebhookSendzenCallbackUrl(tenantId, sendzenAtual.webhookCallbackUrl)
    const novoConfig = construirConfigWhatsApp({
      cfgAtual,
      provedorAtivo: 'sendzen',
      sendzen: {
        ...sendzenAtual,
        apiKey: String(apiKey).trim(),
        token: String(apiKey).trim(),
        from: fromNormalizado,
        displayPhoneNumber: displayPhoneNumber || sendzenAtual.displayPhoneNumber || `+${fromNormalizado}`,
        whatsappBusinessAccountId: whatsappBusinessAccountId ? String(whatsappBusinessAccountId) : (sendzenAtual.whatsappBusinessAccountId || null),
        phoneNumberId: phoneNumberId ? String(phoneNumberId) : (sendzenAtual.phoneNumberId || null),
        webhookSecret: webhookSecret || sendzenAtual.webhookSecret || SENDZEN_WEBHOOK_SECRET || null,
        webhookCallbackUrl,
        sendzenConnectedAt: new Date().toISOString(),
      },
    })

    await banco.tenant.update({
      where: { id: tenantId },
      data: { configWhatsApp: novoConfig },
    })

    res.json({
      sucesso: true,
      dados: {
        provedor: 'sendzen',
        from: novoConfig?.sendzen?.from || null,
        displayPhoneNumber: novoConfig?.sendzen?.displayPhoneNumber || null,
        whatsappBusinessAccountId: novoConfig?.sendzen?.whatsappBusinessAccountId || null,
        phoneNumberId: novoConfig?.sendzen?.phoneNumberId || null,
        webhookCallbackUrl: novoConfig?.sendzen?.webhookCallbackUrl || null,
      },
    })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message || 'Não foi possível salvar a configuração da Sendzen.' } })
  }
}

const desconectarSendzen = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const tenant = await buscarTenant(tenantId)
    const cfgAtual = tenant.configWhatsApp || {}
    const proximoAtivo = (cfgAtual?.provedorAtivo || cfgAtual?.provedor) === 'sendzen'
      ? (cfgAtual?.meta ? 'meta' : null)
      : (cfgAtual?.provedorAtivo || cfgAtual?.provedor || null)
    const novoConfig = construirConfigWhatsApp({
      cfgAtual,
      provedorAtivo: proximoAtivo,
      sendzen: null,
    })

    await banco.tenant.update({
      where: { id: tenantId },
      data: { configWhatsApp: novoConfig || null },
    })

    res.json({ sucesso: true, dados: { mensagem: 'Integração da Sendzen desconectada.' } })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const webhookSendzen = async (req, res) => {
  console.log('[Webhook Sendzen Bruto]', JSON.stringify(req.body))
  try {
    res.status(200).json({ sucesso: true })
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : []
    if (!entries.length) return

    const tenantFixo = req.params?.tenantId ? await buscarTenant(req.params.tenantId).catch(() => null) : null
    if (req.params?.tenantId && !tenantFixo) {
      console.warn(`[Webhook Sendzen] Tenant do path não encontrado: ${req.params.tenantId}`)
      return
    }

    const validacaoPorTenant = new Map()

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        const valor = change?.value || {}
        const metadata = valor?.metadata || {}
        const from = metadata?.display_phone_number || metadata?.phone_number_id || valor?.from || null
        const tenant = tenantFixo || await resolverTenantSendzen({
          phoneNumberId: metadata?.phone_number_id || null,
          wabaId: change?.value?.business_account_id || entry?.id || null,
          from,
        })
        if (!tenant) {
          console.warn('[Webhook Sendzen] Nenhum tenant encontrado para o payload recebido.', {
            phoneNumberId: metadata?.phone_number_id || null,
            wabaId: change?.value?.business_account_id || entry?.id || null,
            from,
          })
          continue
        }

        let validacao = validacaoPorTenant.get(tenant.id)
        if (!validacao) {
          const cfgTenant = obterConfigProvedor(tenant.configWhatsApp || {}, 'sendzen') || {}
          const secretEsperado = cfgTenant?.webhookSecret || SENDZEN_WEBHOOK_SECRET || ''
          validacao = validarWebhookSendzen({ req, segredo: secretEsperado })
          validacaoPorTenant.set(tenant.id, validacao)

          if (!validacao.verificado) {
            console.warn(`[Webhook Sendzen] Não foi possível confirmar a assinatura para o tenant ${tenant.id}. Processando mesmo assim para compatibilidade.`, {
              modo: validacao.modo,
              detalhe: validacao.detalhe || null,
            })
          }
        }

        const mensagens = Array.isArray(valor?.messages) ? valor.messages : []
        for (const messageObj of mensagens) {
          const telefone = messageObj?.from
          const nome = valor?.contacts?.[0]?.profile?.name
          const extraido = await extrairTextoMensagemRecebida(messageObj, tenant.configWhatsApp)
          if (extraido?.texto) {
            const chave = `${tenant.id}:${telefone}`
            await processarWebhookSerializado(chave, () =>
              processarWebhook({
                tenantId: tenant.id,
                telefone: `+${telefone}`,
                mensagem: extraido.texto,
                nome,
                canal: 'WHATSAPP',
                configWhatsApp: tenant.configWhatsApp,
                ehAudio: extraido.ehAudio,
              })
            )
          }
        }
      }
    }
  } catch (erro) {
    console.error('[Webhook Sendzen]', erro)
  }
}

const obterConfiguracaoMeta = async (req, res) => {
  try {
    const tenant = await buscarTenant(req.usuario.tenantId)
    const meta = obterMetaPublicConfig()
    const cfg = tenant.configWhatsApp || {}
    const metaCfg = obterConfigProvedor(cfg, 'meta') || {}

    res.json({
      sucesso: true,
      dados: {
        ...meta,
        status: {
          conectado: Boolean(metaCfg?.phoneNumberId && (metaCfg?.token || metaCfg?.apiToken)),
          provedor: 'meta',
          ativo: cfg?.provedorAtivo === 'meta' || cfg?.provedor === 'meta',
          phoneNumberId: metaCfg?.phoneNumberId || null,
          wabaId: metaCfg?.wabaId || null,
          businessAccountId: metaCfg?.businessAccountId || null,
          displayPhoneNumber: metaCfg?.displayPhoneNumber || null,
          verifiedName: metaCfg?.verifiedName || null,
          webhookUrl: META_WEBHOOK_CALLBACK_URL || null,
          webhookVerifyTokenConfigurado: Boolean(META_WEBHOOK_VERIFY_TOKEN),
        },
      },
    })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const concluirEmbeddedSignupMeta = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const { code, phoneNumberId, wabaId, businessAccountId = null } = req.body || {}

    if (!code) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Code do Embedded Signup é obrigatório.' } })
    }
    if (!META_APP_ID || !META_APP_SECRET || !META_EMBEDDED_SIGNUP_CONFIG_ID || !META_WEBHOOK_VERIFY_TOKEN) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Variáveis da Meta não configuradas no servidor.' } })
    }

    const tokenData = await trocarCodePorTokenMeta(code)
    const accessToken = tokenData.access_token
    if (!accessToken) throw new Error('A Meta não retornou access_token na troca do code.')

    let detalhesNumero = {}
    if (phoneNumberId) {
      try {
        detalhesNumero = await chamarGraphApi(String(phoneNumberId), {
          accessToken,
          query: { fields: 'display_phone_number,verified_name,id' },
        })
      } catch (erroDetalhes) {
        console.warn('[Meta Embedded Signup] Não foi possível buscar detalhes do número:', erroDetalhes.message)
      }
    }

    if (wabaId) {
      try {
        await chamarGraphApi(`${wabaId}/subscribed_apps`, { method: 'POST', accessToken })
      } catch (erroSubscribe) {
        console.warn('[Meta Embedded Signup] Não foi possível inscrever app no WABA:', erroSubscribe.message)
      }
    }

    const tenant = await buscarTenant(tenantId)
    const cfgAtual = tenant.configWhatsApp || {}
    const metaAtual = obterConfigProvedor(cfgAtual, 'meta') || {}
    const novoConfig = construirConfigWhatsApp({
      cfgAtual,
      provedorAtivo: 'meta',
      meta: {
        ...metaAtual,
      token: accessToken,
      apiToken: accessToken,
      appId: META_APP_ID,
      configId: META_EMBEDDED_SIGNUP_CONFIG_ID,
        phoneNumberId: phoneNumberId ? String(phoneNumberId) : (metaAtual.phoneNumberId || null),
        wabaId: wabaId ? String(wabaId) : (metaAtual.wabaId || null),
        businessAccountId: businessAccountId ? String(businessAccountId) : (metaAtual.businessAccountId || null),
        displayPhoneNumber: detalhesNumero.display_phone_number || metaAtual.displayPhoneNumber || null,
        verifiedName: detalhesNumero.verified_name || metaAtual.verifiedName || null,
      webhookVerifyToken: META_WEBHOOK_VERIFY_TOKEN,
        webhookCallbackUrl: META_WEBHOOK_CALLBACK_URL || metaAtual.webhookCallbackUrl || null,
      embeddedSignupAt: new Date().toISOString(),
      },
    })

    const atualizado = await banco.tenant.update({
      where: { id: tenantId },
      data: { configWhatsApp: novoConfig },
      select: { id: true, configWhatsApp: true },
    })

    res.json({
      sucesso: true,
      dados: {
        provedor: atualizado.configWhatsApp?.provedorAtivo || atualizado.configWhatsApp?.provedor || null,
        phoneNumberId: atualizado.configWhatsApp?.meta?.phoneNumberId || atualizado.configWhatsApp?.phoneNumberId || null,
        wabaId: atualizado.configWhatsApp?.meta?.wabaId || atualizado.configWhatsApp?.wabaId || null,
        displayPhoneNumber: atualizado.configWhatsApp?.meta?.displayPhoneNumber || atualizado.configWhatsApp?.displayPhoneNumber || null,
        verifiedName: atualizado.configWhatsApp?.meta?.verifiedName || atualizado.configWhatsApp?.verifiedName || null,
      },
    })
  } catch (erro) {
    console.error('[Meta Embedded Signup] Erro ao concluir integração:', erro)
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message || 'Não foi possível concluir a integração com a Meta.' } })
  }
}

const desconectarMetaOficial = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const tenant = await buscarTenant(tenantId)
    const cfgAtual = tenant.configWhatsApp || {}
    const proximoAtivo = (cfgAtual?.provedorAtivo || cfgAtual?.provedor) === 'meta'
      ? (cfgAtual?.sendzen ? 'sendzen' : null)
      : (cfgAtual?.provedorAtivo || cfgAtual?.provedor || null)
    const novoConfig = construirConfigWhatsApp({
      cfgAtual,
      provedorAtivo: proximoAtivo,
      meta: null,
    })

    await banco.tenant.update({
      where: { id: tenantId },
      data: { configWhatsApp: novoConfig || null },
    })

    res.json({ sucesso: true, dados: { mensagem: 'Integração oficial da Meta desconectada.' } })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
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
      processarTurno: ({ telefone, nome, lidWhatsapp, mensagem, ehAudio }) =>
        processarWebhook({
          tenantId,
          telefone,
          mensagem,
          nome,
          lidWhatsapp,
          ehAudio: Boolean(ehAudio),
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

    processarEvento({
      evento: 'ENVIAR_LINK_AGENDA',
      tenantId,
      cliente
    })
    res.json({ sucesso: true, dados: { mensagem: 'Link enviado via WhatsApp!' } })
  } catch (erro) {
    next(erro)
  }
}

module.exports = {
  webhook,
  obterConfiguracaoMeta,
  obterConfiguracaoSendzen,
  concluirEmbeddedSignupMeta,
  desconectarMetaOficial,
  conectarSendzen,
  desconectarSendzen,
  verificarWebhookMeta,
  webhookMeta,
  webhookSendzen,
  simular,
  testeCliente,
  resetarTesteCliente,
  suiteTesteCliente,
  enviarLinkAgendamento,
  iniciarCronLembretes,
  processarWebhookInterno: processarWebhook,
}

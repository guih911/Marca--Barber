const crypto = require('crypto')
const { domainToASCII } = require('url')
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
const { montarDecisaoIA } = require('../../ai-engine/decision/decisionEngine')
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
const META_REGISTER_PIN = String(process.env.META_REGISTER_PIN || '123456').replace(/\D/g, '').slice(0, 6)
// System User token (BSP) — usado p/ /register e /subscribed_apps quando o token do Embedded Signup não tem permissão.
// Crie em business.facebook.com → Configurações → Usuários do sistema → "Marcaí" (Admin) → Gerar token nunca expira
// com whatsapp_business_management + whatsapp_business_messaging.
const META_SYSTEM_USER_TOKEN = (process.env.META_SYSTEM_USER_TOKEN || '').trim()
const SENDZEN_WEBHOOK_CALLBACK_URL = process.env.SENDZEN_WEBHOOK_CALLBACK_URL || ''
const SENDZEN_WEBHOOK_SECRET = process.env.SENDZEN_WEBHOOK_SECRET || ''
const SENDZEN_WEBHOOK_TENANT_ID = (process.env.SENDZEN_WEBHOOK_TENANT_ID || '').trim()
const APP_URL = process.env.APP_URL || ''
const OAUTH_REDIRECT_ENV = (process.env.META_OAUTH_REDIRECT_URI || process.env.OAUTH_REDIRECT_URL || '').trim()
/** Hostnames extras (ASCII) aceitos p.ex. se APP_URL e a barra de endereço usam formas distintas (IDN vs punycode). */
const META_OAUTH_EXTRA_REDIRECT_HOSTS = (process.env.META_OAUTH_EXTRA_REDIRECT_HOSTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const hostParaOauth = (hostname) => {
  try {
    return domainToASCII(String(hostname || '').toLowerCase())
  } catch {
    return String(hostname || '').toLowerCase()
  }
}

/** Conjunto de hosts permitidos: APP_URL, OAUTH_REDIRECT, extras — evita rejeitar punycode quando .env tem IDN (ou o inverso). */
const coletarHostsOauthPermitidos = () => {
  const hosts = new Set()
  const addUrl = (s) => {
    if (!s) return
    try {
      hosts.add(hostParaOauth(new URL(s).hostname))
    } catch {
      // ignore
    }
  }
  addUrl(APP_URL)
  addUrl(OAUTH_REDIRECT_ENV)
  for (const h of META_OAUTH_EXTRA_REDIRECT_HOSTS) {
    if (h.includes('://')) addUrl(h)
    else {
      try {
        hosts.add(hostParaOauth(h))
      } catch {
        // ignore
      }
    }
  }
  return hosts
}

const hostsOauthCache = { lista: null, chave: null }
const obterHostsOauthPermitidos = () => {
  const chave = `${APP_URL}|${OAUTH_REDIRECT_ENV}|${META_OAUTH_EXTRA_REDIRECT_HOSTS.join(',')}`
  if (hostsOauthCache.lista && hostsOauthCache.chave === chave) return hostsOauthCache.lista
  hostsOauthCache.chave = chave
  hostsOauthCache.lista = coletarHostsOauthPermitidos()
  return hostsOauthCache.lista
}

/**
 * Valida e normaliza a URL de redirect (idêntica à "Valid OAuth Redirect URIs" e à usada no diálogo OAuth).
 * Remove hash e search para alinhar ao que o front envia (href sem query).
 */
const normalizarRedirectUriOauth = (bruto) => {
  if (!bruto || typeof bruto !== 'string') return null
  try {
    const u = new URL(bruto.trim())
    if (u.protocol !== 'https:' && !(u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return null
    const hosts = obterHostsOauthPermitidos()
    if (hosts.size > 0) {
      if (!hosts.has(hostParaOauth(u.hostname))) return null
    }
    u.hash = ''
    u.search = ''
    return u.href
  } catch {
    return null
  }
}

/**
 * Sempre que o body trouxer redirectUri, essa string é a que a Meta usou no OAuth — tem prioridade sobre o .env.
 */
const resolverRedirectUriEmbeddedSignup = (redirectBody) =>
  normalizarRedirectUriOauth(redirectBody) || normalizarRedirectUriOauth(OAUTH_REDIRECT_ENV) || OAUTH_REDIRECT_ENV || null

// Serializa processamento por numero para evitar respostas duplicadas em rajadas.
const filaProcessamento = new Map()
const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

/** Variações comuns (55 vs DDD) para achar o tenant no JSON configWhatsApp.sendzen.from */
const variantesNumeroContaWhatsapp = (bruto) => {
  const n = normalizarTelefone(bruto)
  if (!n) return []
  const v = new Set([n])
  if (n.length === 11 && !n.startsWith('55')) v.add('55' + n)
  if (n.length === 13 && n.startsWith('55')) v.add(n.slice(2))
  if (n.length >= 11) v.add(n.slice(-11))
  if (n.length >= 11 && !n.slice(-11).startsWith('55')) v.add('55' + n.slice(-11))
  return [...v]
}

/**
 * Filtro JSON do Prisma costuma falhar (equals string vs number no JSON, path aninhado).
 * Compara o payload do webhook com o que foi salvo em configWhatsApp (sendzen + legado no topo).
 */
const idLongoPareceWhatsapp = (s) => String(s || '').length >= 12

/** Último recurso: o JSON do tenant serializado contém o id (números longos do Cloud API). */
const jsonConfigMencionaId = (cfg, id) => {
  if (!id || !cfg) return false
  const t = String(id)
  if (!idLongoPareceWhatsapp(t)) return false
  try {
    return JSON.stringify(cfg).includes(t)
  } catch {
    return false
  }
}

const configWhatsappCasaComWebhookSendzen = (cfg, { phoneNumberId, wabaId, numerosTentar = [] } = {}) => {
  if (!cfg || typeof cfg !== 'object') return false
  const sz = cfg.sendzen && typeof cfg.sendzen === 'object' ? cfg.sendzen : {}
  const pids = [cfg.phoneNumberId, sz.phoneNumberId, sz.id, sz.phone_id]
    .filter((x) => x != null && x !== '')
    .map((x) => String(x))
  const wabaIds = [
    cfg.whatsappBusinessAccountId,
    sz.whatsappBusinessAccountId,
    cfg.wabaId,
    sz.wabaId,
    sz.businessAccountId,
  ]
    .filter((x) => x != null && x !== '')
    .map((x) => String(x))
  const froms = [cfg.from, sz.from, cfg.displayPhoneNumber, sz.displayPhoneNumber]
    .map((x) => normalizarTelefone(x))
    .filter(Boolean)

  if (phoneNumberId && pids.includes(String(phoneNumberId))) return true
  if (wabaId && wabaIds.includes(String(wabaId))) return true
  if (numerosTentar.length && froms.length) {
    for (const f of froms) {
      if (numerosTentar.includes(f)) return true
    }
  }
  if (phoneNumberId && jsonConfigMencionaId(cfg, phoneNumberId)) return true
  if (wabaId && jsonConfigMencionaId(cfg, wabaId)) return true
  return false
}

const resumirConfigWhatsappDebug = (cfg) => {
  if (!cfg || typeof cfg !== 'object') return { vazio: true }
  const sz = cfg.sendzen && typeof cfg.sendzen === 'object' ? cfg.sendzen : {}
  return {
    temSecaoSendzen: Boolean(cfg.sendzen),
    phoneNumberId: String(sz.phoneNumberId || cfg.phoneNumberId || ''),
    waba: String(sz.whatsappBusinessAccountId || sz.wabaId || cfg.whatsappBusinessAccountId || cfg.wabaId || ''),
    from: normalizarTelefone(sz.from || cfg.from || ''),
    provedor: cfg.provedorAtivo || cfg.provedor || '',
  }
}

const resolverTenantSendzenFallbackMemoria = async ({ phoneNumberId, wabaId, from = null } = {}) => {
  const numerosTentar = from ? variantesNumeroContaWhatsapp(from) : []
  if (!phoneNumberId && !wabaId && !numerosTentar.length) return null

  const candidatos = await banco.tenant.findMany({
    where: { configWhatsApp: { not: null } },
    select: { id: true, configWhatsApp: true, nome: true },
  })

  if (candidatos.length === 0) {
    console.warn(
      '[Webhook Sendzen] Nenhum registro de tenant com configWhatsApp preenchido. Salve a integração Sendzen no painel (ou defina SENDZEN_WEBHOOK_TENANT_ID no .env em dev).'
    )
  }

  for (const t of candidatos) {
    if (
      configWhatsappCasaComWebhookSendzen(t.configWhatsApp, {
        phoneNumberId,
        wabaId,
        numerosTentar,
      })
    ) {
      console.log('[Webhook Sendzen] Tenant resolvido (fallback em memória)', { tenantId: t.id, nome: t.nome })
      return buscarTenant(t.id)
    }
  }

  if (candidatos.length > 0) {
    const amostra = candidatos.slice(0, 3).map((c) => ({
      id: c.id,
      nome: c.nome,
      cfg: resumirConfigWhatsappDebug(c.configWhatsApp),
    }))
    console.warn('[Webhook Sendzen] Nenhum configWhatsApp bateu com o webhook. Candidatos no banco (amostra):', {
      total: candidatos.length,
      procurado: { phoneNumberId, wabaId, numerosTentar },
      amostra,
    })
  }
  return null
}

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
  const dentroJanela = Date.now() - new Date(ultimaIgual.criadoEm).getTime() < 15000
  if (!dentroJanela) return false

  // Se a IA já respondeu depois da mensagem igual, só libera quando a resposta da IA
  // terminou em pergunta/oferta (ex.: "serve?"), pois o próximo "sim" é legítimo.
  // Se a resposta foi conclusão (ex.: "Confirmado!"), trata retry curto como duplicata.
  const iaRespondeuDepois = await banco.mensagem.findFirst({
    where: {
      conversaId,
      remetente: 'ia',
      criadoEm: { gt: ultimaIgual.criadoEm },
    },
    orderBy: { criadoEm: 'desc' },
    select: { conteudo: true },
  })
  if (!iaRespondeuDepois) return true

  const textoIA = String(iaRespondeuDepois.conteudo || '').toLowerCase()
  const iaPerguntouNoTurno = /\?|serve\b|prefere\b|quer\b|confirmar\b|ajustar\b|outro horario|outro horário/.test(textoIA)
  return !iaPerguntouNoTurno
}

// Dedup por ID nativo do provedor (wamid da Meta) para evitar processar retries do mesmo evento.
const mensagensWebhookProcessadas = new Map()
const registrarMensagemWebhook = (chaveUnica) => {
  if (!chaveUnica) return false
  const agora = Date.now()
  const ttlMs = 10 * 60 * 1000
  for (const [k, ts] of mensagensWebhookProcessadas.entries()) {
    if (agora - ts > ttlMs) mensagensWebhookProcessadas.delete(k)
  }
  if (mensagensWebhookProcessadas.has(chaveUnica)) return false
  mensagensWebhookProcessadas.set(chaveUnica, agora)
  return true
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
  bspTokenConfigurado: Boolean(META_SYSTEM_USER_TOKEN),
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

/**
 * Lista de tokens, em ordem, para tentar operações que exigem whatsapp_business_management
 * (subscribed_apps, /register). O Embedded Signup costuma falhar com (#200) quando a barbearia
 * não é admin do WABA recém-criado; cair no app access token (oficialmente suportado pela Meta)
 * ou no System User token resolve sem reconectar.
 */
const obterTokensCandidatosWaba = (userAccessToken) => {
  const tokens = []
  if (userAccessToken) tokens.push({ tipo: 'user', token: userAccessToken })
  if (META_SYSTEM_USER_TOKEN) tokens.push({ tipo: 'system_user', token: META_SYSTEM_USER_TOKEN })
  if (META_APP_ID && META_APP_SECRET) {
    // App Access Token aceita registrar número e assinar webhook do WABA quando o app é Tech Provider.
    tokens.push({ tipo: 'app', token: `${META_APP_ID}|${META_APP_SECRET}` })
  }
  return tokens
}

const erroEhPermissao = (msg) =>
  /you do not have permission to access this field|\(#200\)|\(#10\)|\(#100\)|access token|permission/i.test(
    String(msg || ''),
  )

const tentarRegistrarNumeroMeta = async ({ phoneNumberId, accessToken }) => {
  if (!phoneNumberId) {
    return { ok: false, motivo: 'sem_phone_id' }
  }

  const pin = META_REGISTER_PIN && META_REGISTER_PIN.length === 6 ? META_REGISTER_PIN : '123456'
  const tentativas = obterTokensCandidatosWaba(accessToken)
  if (!tentativas.length) return { ok: false, motivo: 'sem_token' }

  const motivos = []
  for (const { tipo, token } of tentativas) {
    try {
      const resposta = await chamarGraphApi(`${phoneNumberId}/register`, {
        method: 'POST',
        accessToken: token,
        body: { messaging_product: 'whatsapp', pin },
      })
      console.log('[Meta /register] OK via token tipo =', tipo)
      return { ok: true, jaEstava: false, tokenTipo: tipo, resposta: resposta || null }
    } catch (erro) {
      const msg = String(erro?.message || '')
      const jaEstava =
        /already registered|already exists|already configured|duplicate|133015|133016/i.test(msg)
      if (jaEstava) return { ok: true, jaEstava: true, tokenTipo: tipo, motivo: msg }
      motivos.push(`${tipo}: ${msg}`)
      if (!erroEhPermissao(msg)) {
        return { ok: false, tokenTipo: tipo, motivo: msg || 'falha_register' }
      }
    }
  }
  return { ok: false, motivo: motivos.join(' | ') || 'falha_register' }
}

const tentarAssinarWebhookWaba = async ({ wabaId, accessToken }) => {
  if (!wabaId) return { ok: false, motivo: 'sem_waba' }

  const tentativas = obterTokensCandidatosWaba(accessToken)
  if (!tentativas.length) return { ok: false, motivo: 'sem_token' }

  const motivos = []
  for (const { tipo, token } of tentativas) {
    try {
      await chamarGraphApi(`${wabaId}/subscribed_apps`, { method: 'POST', accessToken: token })
      console.log('[Meta subscribed_apps] OK via token tipo =', tipo)
      return { ok: true, tokenTipo: tipo }
    } catch (erro) {
      const msg = String(erro?.message || '')
      motivos.push(`${tipo}: ${msg}`)
      if (!erroEhPermissao(msg)) {
        return { ok: false, tokenTipo: tipo, motivo: msg || 'falha_subscribed_apps' }
      }
    }
  }
  return {
    ok: false,
    motivo:
      'Token sem permissão para assinar o WABA (erro Meta #200). Detalhe: '
      + (motivos.join(' | ') || 'sem_detalhe')
      + '. Configure META_SYSTEM_USER_TOKEN (Business Manager → Usuários do sistema) com whatsapp_business_management + whatsapp_business_messaging, ou reconecte aceitando todas as permissões.',
  }
}

const montarUrlTrocaCodeMeta = (code, { incluirRedirect, redirectUri } = {}) => {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
  url.searchParams.set('client_id', META_APP_ID)
  url.searchParams.set('client_secret', META_APP_SECRET)
  url.searchParams.set('code', code)
  if (incluirRedirect && redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri)
  }
  return url.toString()
}

/**
 * Troca o code do Embedded Signup por access_token.
 * O FB.login (SDK JS) usa redirect interno; em muitos casos a Graph API aceita a troca *sem* redirect_uri
 * ou com redirect_uri = página, conforme a doc comunitária. Faz tentativa com URI e, se falhar, sem param.
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation
 */
const trocarCodePorTokenMeta = async (code, { redirectUri } = {}) => {
  if (!code) {
    throw new Error('Código OAuth vazio.')
  }

  const fazer = async (incluirRedirect) => {
    const urlStr = montarUrlTrocaCodeMeta(code, { incluirRedirect, redirectUri })
    const resposta = await fetch(urlStr)
    const dados = await resposta.json().catch(() => ({}))
    return { resposta, dados }
  }

  // 1) Sem redirect_uri — é o que costuma bater com FB.login + Embedded Signup (SDK usa redirect interno).
  // 2) Com redirect_uri da página — fallback quando a Meta exige a URL em Valid OAuth Redirect URIs.
  let { resposta, dados } = await fazer(false)

  if (!resposta.ok && redirectUri) {
    console.warn(
      '[Meta OAuth] 2ª tentativa: troca de code com redirect_uri=',
      redirectUri,
      '(1ª sem redirect — padrão Embedded Signup + SDK).',
    )
    const comUri = await fazer(true)
    resposta = comUri.resposta
    dados = comUri.dados
  }

  if (!resposta.ok) {
    const msg = dados?.error?.message || dados?.error?.error_user_msg || `Meta OAuth error ${resposta.status}`
    const err = new Error(msg)
    const pedeRedirect = /redirect|verification code/i.test(msg) || Number(dados?.error?.error_subcode) === 36008
    if (pedeRedirect) {
      err.dicaOauth =
        'Inclua a URL exata do painel (ex.: /dashboard) em "Valid OAuth Redirect URIs" (Login do Facebook p/ Empresas) e use a mesma URL no navegador. Se ainda falhar, a API já tenta também sem redirect_uri (SDK).'
    }
    throw err
  }
  if (!dados?.access_token) {
    throw new Error('A Meta não retornou access_token na troca do code.')
  }
  return dados
}

/**
 * O code do Embedded Signup devolve access token de curta duração; sem troca, envio/recebimento param após ~1–2h.
 * @see https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 */
const trocarTokenCurtoPorLongLivedMeta = async (shortLivedToken) => {
  if (!shortLivedToken || !META_APP_ID || !META_APP_SECRET) return null
  const u = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
  u.searchParams.set('grant_type', 'fb_exchange_token')
  u.searchParams.set('client_id', META_APP_ID)
  u.searchParams.set('client_secret', META_APP_SECRET)
  u.searchParams.set('fb_exchange_token', shortLivedToken)
  const r = await fetch(u.toString())
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.warn(
      '[Meta OAuth] Long-lived indisponível, mantendo token do code:',
      d?.error?.message || d?.error?.type || r.status,
    )
    return null
  }
  if (!d.access_token) return null
  return d
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
        wabaId
          ? { configWhatsApp: { path: ['meta', 'businessAccountId'], equals: String(wabaId) } }
          : undefined,
      ].filter(Boolean),
    },
  })
}

/** Fallback quando o filtro JSON do Prisma não casa (tipos, serialização) — espelha a ideia do Sendzen. */
const configWhatsappCasaComWebhookMeta = (cfg, { phoneNumberId, wabaId } = {}) => {
  if (!cfg || typeof cfg !== 'object') return false
  const m = cfg.meta && typeof cfg.meta === 'object' ? cfg.meta : {}
  const pids = [cfg.phoneNumberId, m.phoneNumberId].filter((x) => x != null && x !== '').map((x) => String(x))
  const wabaIds = [cfg.wabaId, m.wabaId, m.businessAccountId, cfg.businessAccountId]
    .filter((x) => x != null && x !== '')
    .map((x) => String(x))
  if (phoneNumberId && pids.includes(String(phoneNumberId))) return true
  if (wabaId && wabaIds.includes(String(wabaId))) return true
  if (phoneNumberId && jsonConfigMencionaId(cfg, phoneNumberId)) return true
  if (wabaId && jsonConfigMencionaId(cfg, wabaId)) return true
  return false
}

const resolverTenantMetaFallbackMemoria = async ({ phoneNumberId, wabaId } = {}) => {
  if (!phoneNumberId && !wabaId) return null
  const candidatos = await banco.tenant.findMany({
    where: { configWhatsApp: { not: null } },
    select: { id: true, configWhatsApp: true, nome: true },
  })
  for (const t of candidatos) {
    if (configWhatsappCasaComWebhookMeta(t.configWhatsApp, { phoneNumberId, wabaId })) {
      console.log('[Webhook Meta] Tenant resolvido (fallback em memória)', { tenantId: t.id, nome: t.nome })
      return buscarTenant(t.id)
    }
  }
  if (candidatos.length > 0) {
    const amostra = candidatos.slice(0, 3).map((c) => ({ id: c.id, nome: c.nome }))
    console.warn('[Webhook Meta] Nenhum configWhatsApp bateu com o webhook. Amostra de tenants:', {
      procurado: { phoneNumberId, wabaId },
      amostra,
    })
  }
  return null
}

const resolverTenantSendzen = async ({ tenantId = null, phoneNumberId = null, wabaId = null, from = null }) => {
  if (tenantId) return buscarTenant(tenantId)

  if (SENDZEN_WEBHOOK_TENANT_ID) {
    try {
      const t = await buscarTenant(SENDZEN_WEBHOOK_TENANT_ID)
      console.log('[Webhook Sendzen] Usando tenant fixo (SENDZEN_WEBHOOK_TENANT_ID)', { tenantId: t.id, nome: t.nome })
      return t
    } catch (e) {
      console.error('[Webhook Sendzen] SENDZEN_WEBHOOK_TENANT_ID inválido:', e?.message || e)
    }
  }

  const numerosTentar = from ? variantesNumeroContaWhatsapp(from) : []
  if (!phoneNumberId && !wabaId && !numerosTentar.length) return null

  const paresFrom = (prefixo) =>
    numerosTentar.map((d) => ({ configWhatsApp: { path: prefixo ? [...prefixo, 'from'] : ['from'], equals: d } }))

  const viaPrisma = await banco.tenant.findFirst({
    where: {
      OR: [
        phoneNumberId ? { configWhatsApp: { path: ['phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['wabaId'], equals: String(wabaId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['whatsappBusinessAccountId'], equals: String(wabaId) } } : undefined,
        phoneNumberId ? { configWhatsApp: { path: ['sendzen', 'phoneNumberId'], equals: String(phoneNumberId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['sendzen', 'whatsappBusinessAccountId'], equals: String(wabaId) } } : undefined,
        wabaId ? { configWhatsApp: { path: ['sendzen', 'wabaId'], equals: String(wabaId) } } : undefined,
        ...paresFrom(null),
        ...paresFrom(['sendzen']),
      ].filter(Boolean),
    },
  })
  if (viaPrisma) return viaPrisma
  return resolverTenantSendzenFallbackMemoria({ phoneNumberId, wabaId, from })
}

// Logica central compartilhada por todos os webhooks.
const processarWebhook = async ({
  tenantId,
  telefone,
  mensagem,
  mensagemOrigemId = null,
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

  if (mensagemOrigemId) {
    const chaveId = `${conversa.id}:${String(mensagemOrigemId)}`
    if (!registrarMensagemWebhook(chaveId)) {
      console.log('[Webhook] Evento duplicado por message id ignorado:', mensagemOrigemId)
      return { tipo: 'duplicada_id' }
    }
  }

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
    const appUrl = process.env.APP_URL || 'https://app.barbermark.com.br'
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

  const decisaoIA = await montarDecisaoIA({
    mensagem,
    tenantId,
    clienteId: cliente.id,
    timezone: tenant?.timezone,
    tenant,
    contextoConversa: { temContextoRecenteDeRemarcacao },
    instrucaoExtra: instrucaoCapturaCadastro,
  })

  intencao = decisaoIA.intencao || intencao
  const dadosEngine = decisaoIA.instrucaoEngine
  const usarComplexo = decisaoIA.usarModeloComplexo
  if (usarComplexo) console.log(`[Engine] Usando modelo complexo (Sonnet) para: "${mensagem.substring(0, 50)}"`)

  // ═══ CHAMA A IA (com dados reais + modelo adequado) ═══
  const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, mensagem, dadosEngine, usarComplexo)

  if (configWhatsApp) {
    if (resultado.mensagemProativa) {
      if (resultado.mensagemProativaInterativa) {
        let okInterativo = false
        try {
          const r = await whatsappServico.enviarMensagemInterativa(
            configWhatsApp,
            telefone,
            resultado.mensagemProativaInterativa,
            tenantId,
            lidWhatsapp ? `${lidWhatsapp}@lid` : null
          )
          okInterativo = Boolean(r)
        } catch (errInterativo) {
          console.error('[WhatsApp] Envio interativo falhou, usando texto puro:', errInterativo?.message || errInterativo)
        }
        if (!okInterativo) {
          await enviarRespostaWhatsapp(resultado.mensagemProativa, { momento: 'SAUDACAO' })
        }
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

  if (metaLegada) normalizado.meta = metaLegada
  const ativo = 'meta'
  if (ativo) {
    normalizado.provedorAtivo = ativo
    normalizado.provedor = ativo
  }

  return normalizado
}

const construirConfigWhatsApp = ({ cfgAtual = {}, provedorAtivo = null, meta = undefined }) => {
  const base = normalizarConfigWhatsAppPersistida(cfgAtual)
  const novoConfig = preservarCamposCompartilhados(base, {})

  if (meta !== undefined) {
    if (meta) novoConfig.meta = meta
  } else if (base.meta) {
    novoConfig.meta = base.meta
  }

  const ordemPreferencia = [provedorAtivo, base.provedorAtivo, base.provedor, 'meta']
    .filter((item) => ['meta'].includes(item))
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

  // Áudio: WhatsApp Cloud manda "url" (lookaside fbsbx) ou "link"; às vezes só "id" (Graph).
  // voz: mesmo esquema em messageObj.voice (type === 'voice')
  if (messageObj?.type === 'audio' || messageObj?.type === 'voice') {
    const node = messageObj?.audio || messageObj?.voice
    const mediaId = node?.id
    // Doc Meta alterna link vs url; o webhook real traz muito "url", não "link"
    const mediaUrlDireto = node?.link || node?.url
    const idOuUrl =
      mediaUrlDireto && /^https?:\/\//i.test(String(mediaUrlDireto).trim())
        ? String(mediaUrlDireto).trim()
        : (mediaId || mediaUrlDireto)

    const mime = node?.mime_type || 'audio/ogg; codecs=opus'
    console.log(
      `[Voz] Mídia recebida: type=${messageObj?.type} temUrl=${Boolean(mediaUrlDireto && /^https?:\/\//i.test(String(mediaUrlDireto)))} alvo=${idOuUrl && String(idOuUrl).length > 12 ? String(idOuUrl).slice(0, 64) + '...' : idOuUrl}`
    )

    if (idOuUrl && configWhatsApp) {
      try {
        console.log(`[Voz] Baixando mídia...`)
        const buffer = await whatsappServico.baixarMidia(configWhatsApp, idOuUrl)
        if (buffer) {
          console.log(`[Voz] Transcrevendo buffer (${buffer.length} bytes)...`)
          const transcricao = await transcreverAudio(buffer, mime)
          if (transcricao) {
            console.log(`[Voz] Transcrição concluída: "${transcricao.slice(0, 50)}..."`)
            return { texto: transcricao, ehAudio: true }
          }
        }
      } catch (err) {
        console.warn('[Voz] Falha ao processar áudio recebido:', err.message)
      }
    }

    // Não descarta o áudio silenciosamente: mantém o fluxo da IA mesmo quando
    // a transcrição falha (ela pode pedir para o cliente repetir em texto).
    return { texto: 'Te enviei um áudio agora.', ehAudio: true }
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
        mensagemOrigemId: req.body?.messageObj?.id || null,
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
    const c0 = entradas[0]
    const ch0 = Array.isArray(c0?.changes) ? c0.changes[0] : null
    const meta0 = ch0?.value?.metadata || {}
    console.log('[Webhook Meta] recebido', {
      nEntradas: entradas.length,
      field: ch0?.field || null,
      phone_number_id: meta0?.phone_number_id || null,
      wabaIdEntry: c0?.id || null,
      temMensagens: Array.isArray(ch0?.value?.messages) ? ch0.value.messages.length : 0,
    })

    for (const entry of entradas) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []

      for (const change of changes) {
        const valor = change?.value || {}
        const metadata = valor?.metadata || {}
        const phoneNumberId = metadata?.phone_number_id || null
        const wabaId =
          change?.value?.business_account_id
          || metadata?.business_account_id
          || entry?.id
          || null
        let tenant = await resolverTenantMeta({ tenantId: req.params?.tenantId || null, phoneNumberId, wabaId })
        if (!tenant) {
          tenant = await resolverTenantMetaFallbackMemoria({ phoneNumberId, wabaId })
        }
        if (!tenant) {
          console.warn('[Webhook Meta] Nenhum tenant local para este evento. phone_number_id=%s waba/entry id=%s', phoneNumberId, wabaId)
          continue
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
                mensagemOrigemId: messageObj?.id || null,
                nome,
                canal: 'WHATSAPP',
                configWhatsApp: tenant.configWhatsApp,
                ehAudio: extraido.ehAudio,
              })
            )
          }
        }

        const statuses = Array.isArray(valor?.statuses) ? valor.statuses : []
        for (const st of statuses) {
          const s = st?.status
          const wamid = st?.id
          const rec = st?.recipient_id
          const listErr = Array.isArray(st?.errors) ? st.errors : []
          if (s === 'failed' || listErr.length) {
            console.warn('[Webhook Meta] entrega com falha (a Graph pode ter aceitado; a Meta rejeitou no envio final)', {
              tenantId: tenant.id,
              tenantNome: tenant.nome,
              wamid,
              status: s,
              destinatario: rec,
              erros: listErr,
            })
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
        // Só o display_phone é número; phone_number_id não pode ir em "from" (quebra a resolução por dígitos)
        const fromParaResolver = metadata?.display_phone_number || null
        const tenant = tenantFixo || await resolverTenantSendzen({
          phoneNumberId: metadata?.phone_number_id || null,
          wabaId: change?.value?.business_account_id || entry?.id || null,
          from: fromParaResolver,
        })
        if (!tenant) {
          console.warn('[Webhook Sendzen] Nenhum tenant encontrado para o payload recebido.', {
            phoneNumberId: metadata?.phone_number_id || null,
            wabaId: change?.value?.business_account_id || entry?.id || null,
            from: fromParaResolver,
            dica: 'Conecte a Sendzen no painel e confira sendzen.from (mesmo nº), sendzen.phoneNumberId e/ou sendzen.whatsappBusinessAccountId = id da conta no payload.',
            variantes: fromParaResolver ? variantesNumeroContaWhatsapp(fromParaResolver) : [],
          })
          continue
        }

        console.log('[Webhook Sendzen] Tenant resolvido, processando mensagens', {
          tenantId: tenant.id,
          nome: tenant.nome,
        })

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

    const perfilComercial = await whatsappServico.buscarWhatsappBusinessProfile(cfg)

    res.json({
      sucesso: true,
      dados: {
        ...meta,
        recebimento: (() => {
          const publicBase = String(
            process.env.API_PUBLIC_BASE_URL || process.env.PUBLIC_API_URL || APP_URL || '',
          ).replace(/\/$/, '')
          return {
            urlWebhookSugerida: publicBase ? `${publicBase}/api/ia/webhook/meta` : null,
            urlCallbackEnv: META_WEBHOOK_CALLBACK_URL || null,
            checklist: [
              'No Facebook Developers: app → WhatsApp → Configuração: URL e token de verificação iguais ao servidor (META_WEBHOOK_CALLBACK_URL e META_WEBHOOK_VERIFY_TOKEN).',
              'Caminho correto: /api/ia/webhook/meta (sem :tenantId). O token de verificação (GET) = META_WEBHOOK_VERIFY_TOKEN.',
              'Se o log "Nenhum tenant local" aparecer, o waba/phoneNumber_id do evento não bate com a barbearia salva: reconecte na Meta ou corrija o banco.',
              'Inscrever o app no WABA (subscribed_apps): use "Reinscrever" em Integrações ou POST /api/ia/meta/reassinar-webhook.',
            ],
          }
        })(),
        status: {
          conectado: Boolean(metaCfg?.phoneNumberId && (metaCfg?.token || metaCfg?.apiToken)),
          provedor: 'meta',
          ativo: cfg?.provedorAtivo === 'meta' || cfg?.provedor === 'meta',
          phoneNumberId: metaCfg?.phoneNumberId || null,
          wabaId: metaCfg?.wabaId || null,
          businessAccountId: metaCfg?.businessAccountId || null,
          displayPhoneNumber: metaCfg?.displayPhoneNumber || null,
          verifiedName: metaCfg?.verifiedName || null,
          profilePictureUrl: perfilComercial?.profilePictureUrl || null,
          registerStatus: metaCfg?.registerStatus || 'PENDENTE',
          webhookAssinado: Boolean(metaCfg?.webhookAssinado),
          prontoParaTeste: Boolean(metaCfg?.onboardingProntoParaTeste),
          registerErro: metaCfg?.registerErro || null,
          webhookErro: metaCfg?.webhookErro || null,
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
    const { code, phoneNumberId, wabaId, businessAccountId = null, redirectUri: redirectBody } = req.body || {}

    if (!code) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Code do Embedded Signup é obrigatório.' } })
    }
    if (!META_APP_ID || !META_APP_SECRET || !META_EMBEDDED_SIGNUP_CONFIG_ID || !META_WEBHOOK_VERIFY_TOKEN) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Variáveis da Meta não configuradas no servidor.' } })
    }

    const redirectUri = resolverRedirectUriEmbeddedSignup(redirectBody)
    if (!redirectUri) {
      return res.status(400).json({
        sucesso: false,
        erro: {
          mensagem: 'Falta o redirect para a troca do code OAuth da Meta.',
          dica: 'Ajuste OAUTH_REDIRECT_URL no .env (mesmo domínio de APP_URL) ou abra o painel, use Conectar WhatsApp e tente de novo o envio de redirectUri.',
        },
      })
    }

    const tokenData = await trocarCodePorTokenMeta(code, { redirectUri })
    let accessToken = tokenData.access_token
    if (!accessToken) throw new Error('A Meta não retornou access_token na troca do code.')

    const longLived = await trocarTokenCurtoPorLongLivedMeta(accessToken)
    if (longLived?.access_token) {
      accessToken = longLived.access_token
      console.log('[Meta Embedded Signup] Token long-lived OK, expires_in ~', longLived.expires_in, 's')
    } else {
      console.warn(
        '[Meta Embedded Signup] Usando token do code sem long-lived. Se o envio/IA parar após 1–2h, reconecte na Meta.',
      )
    }

    let detalhesNumero = {}
    let phoneIdFinal = phoneNumberId
    if (phoneIdFinal) {
      try {
        detalhesNumero = await chamarGraphApi(String(phoneIdFinal), {
          accessToken,
          query: { fields: 'display_phone_number,verified_name,id' },
        })
      } catch (erroDetalhes) {
        console.warn('[Meta Embedded Signup] Não foi possível buscar detalhes do número:', erroDetalhes.message)
      }
    }

    if (!phoneIdFinal && wabaId) {
      try {
        const lista = await chamarGraphApi(`${wabaId}/phone_numbers`, {
          accessToken,
          query: { fields: 'id,display_phone_number' },
        })
        const primeiro = lista?.data?.[0]
        if (primeiro?.id) {
          phoneIdFinal = primeiro.id
          detalhesNumero = await chamarGraphApi(String(phoneIdFinal), {
            accessToken,
            query: { fields: 'display_phone_number,verified_name,id' },
          })
        }
      } catch (erroLista) {
        console.warn('[Meta Embedded Signup] Fallback phone_numbers WABA:', erroLista.message)
      }
    }

    const resultadoRegistro = await tentarRegistrarNumeroMeta({
      phoneNumberId: phoneIdFinal ? String(phoneIdFinal) : null,
      accessToken,
    })
    if (!resultadoRegistro.ok) {
      console.warn('[Meta Embedded Signup] /register falhou:', resultadoRegistro.motivo)
    }

    const resultadoWebhook = await tentarAssinarWebhookWaba({
      wabaId: wabaId ? String(wabaId) : null,
      accessToken,
    })
    if (!resultadoWebhook.ok) {
      console.warn('[Meta Embedded Signup] Não foi possível inscrever app no WABA:', resultadoWebhook.motivo)
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
        phoneNumberId: phoneIdFinal ? String(phoneIdFinal) : (metaAtual.phoneNumberId || null),
        wabaId: wabaId ? String(wabaId) : (metaAtual.wabaId || null),
        businessAccountId: businessAccountId ? String(businessAccountId) : (metaAtual.businessAccountId || null),
        displayPhoneNumber: detalhesNumero.display_phone_number || metaAtual.displayPhoneNumber || null,
        verifiedName: detalhesNumero.verified_name || metaAtual.verifiedName || null,
        registerStatus: resultadoRegistro.ok ? 'OK' : 'PENDENTE',
        registerErro: resultadoRegistro.ok ? null : (resultadoRegistro.motivo || null),
        registerAtualizadoEm: new Date().toISOString(),
        webhookAssinado: Boolean(resultadoWebhook.ok),
        webhookErro: resultadoWebhook.ok ? null : (resultadoWebhook.motivo || null),
        onboardingProntoParaTeste: Boolean(resultadoRegistro.ok && resultadoWebhook.ok),
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

    const idSalvo = atualizado.configWhatsApp?.meta?.phoneNumberId || atualizado.configWhatsApp?.phoneNumberId
    const avisos = []
    if (!idSalvo) {
      avisos.push(
        'O phone_number_id não foi detectado. Sem ele, a API não envia mensagens e o webhook não acha a barbearia. Abra a Meta, confirme o número na WABA e conecte de novo, ou fale com o suporte com o print do fluxo.',
      )
    }
    if (!longLived?.access_token) {
      avisos.push(
        'Não foi possível obter token de longa duração. A conexão pode parar de funcionar após cerca de 1–2 horas. Reconecte em Integrações ou crie System User com token permanente no painel da Meta.',
      )
    }
    if (!resultadoRegistro.ok) {
      avisos.push(
        'Conexão salva, mas faltou registrar o número na Cloud API (/register). Sem isso o envio pode falhar com erro 133010.',
      )
    }
    if (!resultadoWebhook.ok) {
      avisos.push(
        `Conexão salva, mas não foi possível assinar o webhook da WABA. O recebimento de mensagens pode não funcionar até corrigir. Motivo: ${resultadoWebhook.motivo || 'falha_subscribed_apps'}`,
      )
    }

    res.json({
      sucesso: true,
      dados: {
        provedor: atualizado.configWhatsApp?.provedorAtivo || atualizado.configWhatsApp?.provedor || null,
        phoneNumberId: atualizado.configWhatsApp?.meta?.phoneNumberId || atualizado.configWhatsApp?.phoneNumberId || null,
        wabaId: atualizado.configWhatsApp?.meta?.wabaId || atualizado.configWhatsApp?.wabaId || null,
        displayPhoneNumber: atualizado.configWhatsApp?.meta?.displayPhoneNumber || atualizado.configWhatsApp?.displayPhoneNumber || null,
        verifiedName: atualizado.configWhatsApp?.meta?.verifiedName || atualizado.configWhatsApp?.verifiedName || null,
        registerStatus: atualizado.configWhatsApp?.meta?.registerStatus || atualizado.configWhatsApp?.registerStatus || 'PENDENTE',
        webhookAssinado: Boolean(atualizado.configWhatsApp?.meta?.webhookAssinado || atualizado.configWhatsApp?.webhookAssinado),
        prontoParaTeste: Boolean(atualizado.configWhatsApp?.meta?.onboardingProntoParaTeste || atualizado.configWhatsApp?.onboardingProntoParaTeste),
        tokenLongLived: Boolean(longLived?.access_token),
        avisos: avisos.length ? avisos : undefined,
      },
    })
  } catch (erro) {
    console.error('[Meta Embedded Signup] Erro ao concluir integração:', erro)
    const dicaOauth = erro.dicaOauth
    const msg = erro.message || ''
    const pareceOauth = Boolean(
      dicaOauth
        || /redirect_uri|OAuthException|code has expired|code is invalid|invalid code/i.test(msg),
    )
    const dicaDominio =
      'No painel da Meta: Configurações do app > Básico > Domínios do app (e em Login do Facebook, URIs de redirecionamento OAuth válidos) inclua exatamente o host da URL em que o painel abre (com ou sem www, igual ao OAUTH_REDIRECT_URL). Domínio com acento: use o mesmo formato do navegador ou o punycode (ex.: xn--...).'
    res.status(pareceOauth ? 400 : 500).json({
      sucesso: false,
      erro: {
        mensagem: msg || 'Não foi possível concluir a integração com a Meta.',
        ...(dicaOauth || pareceOauth ? { dica: dicaOauth || dicaDominio } : {}),
      },
    })
  }
}

const desconectarMetaOficial = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const tenant = await buscarTenant(tenantId)
    const cfgAtual = tenant.configWhatsApp || {}
    const proximoAtivo = null
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

function dicaErroTesteWhatsapp(erroEnvio) {
  const msg = String(erroEnvio?.message || '')
  const code = erroEnvio?.metaCode
  if (/133010|account not registered/i.test(msg) || code === 133010) {
    return 'Número comercial não registrado na Cloud API: use a etapa 2 (ou o comando /register do guia).'
  }
  if (
    code === 100
    || /message must be a template|must be a template|template message/i.test(msg)
    || (/\(100\)/.test(msg) && /template/i.test(msg))
  ) {
    return 'Texto simples exige janela de 24h: abra o WhatsApp e envie "oi" para o número comercial do negócio; em seguida tente o teste de novo. Fora disso, use um template aprovado na Meta.'
  }
  if (/131031|re-?engagement|24.?hour|outside.*window/i.test(msg) || code === 131031) {
    return 'Fora da janela de atendimento. O contato precisa ter escrito no número comercial recentemente, ou use template.'
  }
  if (/131026|undeliverable|incapable of receiving/i.test(msg) || code === 131026) {
    return 'A Meta não entregou: confira se o destino tem WhatsApp (número pessoal, app atualizado) e se não é limite B2B entre duas contas API.'
  }
  if (/131049|ecosystem|engagement/i.test(msg) || code === 131049) {
    return 'A Meta limitou o envio; espaçe os testes ou use outro número.'
  }
  if (/131051|not registered on whatsapp|invalid phone/i.test(msg) || (code === 100 && /phone|recipient|parameter/i.test(msg))) {
    return 'Telefone rejeitado: use E.164 com +55, 9 do celular, sem dígitos faltando.'
  }
  return null
}

const enviarTesteMeta = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const telefoneBruto = String(req.body?.telefone || '').trim()
    const mensagem = String(req.body?.mensagem || 'oi').trim() || 'oi'

    if (!telefoneBruto) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone é obrigatório.' } })
    }

    const destino = whatsappServico.normalizarNumeroDestinoWhatsapp(telefoneBruto)
    const soDigitos = String(destino).replace(/\D/g, '')
    if (!soDigitos || soDigitos.length < 10 || soDigitos.length > 15) {
      return res.status(400).json({
        sucesso: false,
        erro: {
          mensagem: 'Número inválido ou incompleto.',
          dica: 'Use o celular com DDI, ex. +55 62 9 9999-9999 (9 do celular).',
        },
      })
    }

    const tenant = await banco.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nome: true, configWhatsApp: true },
    })
    if (!tenant?.configWhatsApp) {
      return res.status(422).json({
        sucesso: false,
        erro: { mensagem: 'WhatsApp não está conectado. Conecte em Configurações > Integrações.' },
      })
    }

    try {
      const resposta = await whatsappServico.enviarMensagem(tenant.configWhatsApp, destino, mensagem, tenant.id)
      const wamid = resposta?.messages?.[0]?.id
      return res.json({
        sucesso: true,
        dados: {
          destino: `+${soDigitos}`,
          mensagem: wamid
            ? 'A Meta aceitou a mensagem (há wamid na resposta).'
            : 'A Meta respondeu; veja "respostaMeta" se wamid não veio.',
          wamid: wamid || null,
          respostaMeta: resposta || null,
          lembrete:
            'Não recebeu? (1) No seu celular, envie antes um "oi" para o número comercial. (2) No App da Meta, inscreva o webhook (field messages) para receber "status" failed. (3) Use +55 e o 9 do celular.',
        },
      })
    } catch (erroEnvio) {
      const msg = String(erroEnvio?.message || 'Falha ao enviar teste.')
      const dica = dicaErroTesteWhatsapp(erroEnvio)
      const precisaRegistro = /133010|account not registered/i.test(msg) || erroEnvio?.metaCode === 133010
      return res.status(422).json({
        sucesso: false,
        erro: {
          mensagem: msg,
          ...(dica
            ? { dica }
            : precisaRegistro
              ? {
                  dica:
                    'O número comercial ainda não está registrado na Cloud API. Faça o passo /register no guia e teste novamente.',
                }
              : {}),
        },
      })
    }
  } catch (erro) {
    next(erro)
  }
}

const reassinarWebhookMeta = async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId
    const tenant = await buscarTenant(tenantId)
    const cfg = tenant.configWhatsApp || {}
    const metaCfg = obterConfigProvedor(cfg, 'meta') || {}
    const wabaId = metaCfg.wabaId
    const accessToken = metaCfg.token || metaCfg.apiToken
    if (!wabaId || !accessToken) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: 'Falta wabaId ou token na integração Meta. Reconecte em Integrações.' },
      })
    }
    const resultado = await tentarAssinarWebhookWaba({ wabaId: String(wabaId), accessToken })
    if (!resultado.ok) {
      return res.status(422).json({
        sucesso: false,
        erro: {
          mensagem: resultado.motivo || 'Falha ao inscrever o app no WABA.',
          dica:
            'No Embedded Signup, aceite todas as permissões. No app da Meta, o token precisa de whatsapp_business_management e whatsapp_business_messaging para assinar subscribed_apps.',
        },
      })
    }
    const novoConfig = construirConfigWhatsApp({
      cfgAtual: cfg,
      meta: {
        ...metaCfg,
        webhookAssinado: true,
        webhookErro: null,
        webhookInscritoEm: new Date().toISOString(),
      },
    })
    await banco.tenant.update({ where: { id: tenantId }, data: { configWhatsApp: novoConfig } })
    res.json({
      sucesso: true,
      dados: {
        mensagem: 'App inscrito no WABA. Confirme ainda no painel da Meta (Webhooks) a URL pública e o token = META_WEBHOOK_VERIFY_TOKEN.',
        webhookAssinado: true,
      },
    })
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const contarParametrosCorpoTemplate = (texto) => {
  if (!texto) return 0
  const s = String(texto)
  const re = /\{\{(\d+)\}\}/g
  let max = 0
  let m
  while ((m = re.exec(s)) !== null) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}

const resolverCredenciaisWabaMeta = (tenant) => {
  const cfg = tenant.configWhatsApp || {}
  const metaCfg = obterConfigProvedor(cfg, 'meta') || {}
  const token = metaCfg.token || metaCfg.apiToken
  const wabaId = metaCfg.wabaId || metaCfg.businessAccountId
  const phoneNumberId = metaCfg.phoneNumberId
  return { token, wabaId, phoneNumberId, metaCfg }
}

const listarTemplatesMeta = async (req, res) => {
  try {
    const tenant = await buscarTenant(req.usuario.tenantId)
    const { token, wabaId } = resolverCredenciaisWabaMeta(tenant)
    if (!token || !wabaId) {
      return res.status(422).json({
        sucesso: false,
        erro: { mensagem: 'Conecte o WhatsApp (Meta) em Integrações. É necessário WABA e token.' },
      })
    }
    const dados = await chamarGraphApi(`${wabaId}/message_templates`, {
      accessToken: token,
      query: {
        fields: 'name,status,language,category,components,sub_category,id',
        limit: 100,
      },
    })
    const templates = (dados.data || []).map((row) => {
      const compBody = (row.components || []).find(
        (c) => String(c.type).toUpperCase() === 'BODY',
      )
      const qtd = contarParametrosCorpoTemplate(compBody?.text)
      return {
        name: row.name,
        status: row.status,
        language: row.language,
        category: row.category,
        id: row.id,
        sub_category: row.sub_category,
        qtdParametrosCorpo: qtd,
        textoCorpoResumo: compBody?.text
          ? String(compBody.text).slice(0, 240)
          : null,
      }
    })
    res.json({ sucesso: true, dados: { templates, paging: dados.paging || null } })
  } catch (erro) {
    res.status(422).json({ sucesso: false, erro: { mensagem: erro.message } })
  }
}

const enviarTemplateTesteMeta = async (req, res, next) => {
  try {
    const tenant = await buscarTenant(req.usuario.tenantId)
    const { token, phoneNumberId } = resolverCredenciaisWabaMeta(tenant)
    if (!token || !phoneNumberId) {
      return res.status(422).json({
        sucesso: false,
        erro: { mensagem: 'Conecte o WhatsApp (Meta) com número e token salvos (Integrações).' },
      })
    }
    const nomeTemplate = String(req.body?.nomeTemplate || '').trim()
    const idioma = String(req.body?.idioma || '').trim()
    const telefoneBruto = String(req.body?.telefone || '').trim()
    if (!nomeTemplate || !idioma) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: 'nomeTemplate e idioma são obrigatórios (veja a lista de templates).' },
      })
    }
    if (!telefoneBruto) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Telefone de teste é obrigatório.' } })
    }
    const to = whatsappServico.normalizarNumeroDestinoWhatsapp(telefoneBruto)
    const d = String(to).replace(/\D/g, '')
    if (d.length < 10 || d.length > 15) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Número de destino inválido (use DDI, ex. +55).' } })
    }
    let parametros = req.body?.parametrosCorpo
    if (parametros == null) parametros = []
    if (typeof parametros === 'string') {
      parametros = parametros
        .split(/[,;|\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (!Array.isArray(parametros)) parametros = []
    const templateRoot = {
      name: nomeTemplate,
      language: { code: idioma },
    }
    if (parametros.length) {
      templateRoot.components = [
        {
          type: 'body',
          parameters: parametros.map((t) => ({ type: 'text', text: String(t) })),
        },
      ]
    }
    const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: d,
        type: 'template',
        template: templateRoot,
      }),
    })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      const e = json?.error
      const errObj = { message: e?.message || `Meta API ${r.status}`, metaCode: e?.code }
      const dica = dicaErroTesteWhatsapp(errObj) || (e?.message ? null : 'Confira se o template está aprovado e o idioma bate (ex. pt_BR).')
      return res.status(422).json({
        sucesso: false,
        erro: {
          mensagem: e?.message || `Falha ao enviar template (${r.status})`,
          code: e?.code,
          ...(dica ? { dica } : {}),
        },
      })
    }
    const wamid = json?.messages?.[0]?.id
    return res.json({
      sucesso: true,
      dados: {
        wamid: wamid || null,
        destino: `+${d}`,
        lembrete:
          'O template precisa estar APPROVED; no modo teste, o destino deve estar na lista de números permitidos no app da Meta.',
      },
    })
  } catch (erro) {
    next(erro)
  }
}

/**
 * Em boot, tenta inscrever apps Meta nos WABAs já conectados que não estavam inscritos.
 * Útil para destravar tenants antigos depois de configurar META_SYSTEM_USER_TOKEN ou após a
 * adição do fallback por App Access Token (sem exigir reconectar manualmente cada barbearia).
 */
const garantirInscricaoWebhookMetaParaTodos = async () => {
  if (!META_APP_ID || !META_APP_SECRET) return
  try {
    const tenants = await banco.tenant.findMany({
      where: { configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true },
    })
    let corrigidos = 0
    for (const t of tenants) {
      const cfg = t.configWhatsApp || {}
      const metaCfg = obterConfigProvedor(cfg, 'meta') || {}
      const conectado = Boolean(metaCfg.phoneNumberId && (metaCfg.token || metaCfg.apiToken))
      const inscrito = Boolean(metaCfg.webhookAssinado)
      const wabaId = metaCfg.wabaId || metaCfg.businessAccountId
      if (!conectado || inscrito || !wabaId) continue
      const accessToken = metaCfg.token || metaCfg.apiToken
      const r = await tentarAssinarWebhookWaba({ wabaId: String(wabaId), accessToken })
      if (r.ok) {
        const novoConfig = construirConfigWhatsApp({
          cfgAtual: cfg,
          meta: {
            ...metaCfg,
            webhookAssinado: true,
            webhookErro: null,
            webhookInscritoEm: new Date().toISOString(),
          },
        })
        await banco.tenant.update({ where: { id: t.id }, data: { configWhatsApp: novoConfig } })
        corrigidos++
        console.log(`[Webhook Meta auto-fix] Tenant ${t.nome || t.id}: webhook assinado (token=${r.tokenTipo}).`)
      } else {
        console.warn(
          `[Webhook Meta auto-fix] Tenant ${t.nome || t.id}: ainda sem webhook (${r.motivo || 'desconhecido'}).`,
        )
        if (metaCfg.webhookErro !== r.motivo) {
          // Atualiza o webhookErro p/ o painel mostrar a causa atual e o admin agir.
          const novoConfig = construirConfigWhatsApp({
            cfgAtual: cfg,
            meta: {
              ...metaCfg,
              webhookAssinado: false,
              webhookErro: r.motivo || metaCfg.webhookErro || null,
              webhookUltimaTentativaEm: new Date().toISOString(),
            },
          })
          await banco.tenant
            .update({ where: { id: t.id }, data: { configWhatsApp: novoConfig } })
            .catch(() => {})
        }
      }
    }
    if (corrigidos > 0) console.log(`[Webhook Meta auto-fix] ${corrigidos} tenant(s) inscritos automaticamente.`)
  } catch (erro) {
    console.warn('[Webhook Meta auto-fix] Falha geral:', erro?.message || erro)
  }
}

module.exports = {
  webhook,
  obterConfiguracaoMeta,
  concluirEmbeddedSignupMeta,
  desconectarMetaOficial,
  verificarWebhookMeta,
  webhookMeta,
  simular,
  testeCliente,
  resetarTesteCliente,
  suiteTesteCliente,
  enviarLinkAgendamento,
  enviarTesteMeta,
  listarTemplatesMeta,
  enviarTemplateTesteMeta,
  reassinarWebhookMeta,
  iniciarCronLembretes,
  garantirInscricaoWebhookMetaParaTodos,
  processarWebhookInterno: processarWebhook,
}

const iaServico = require('./ia.servico')
const clientesServico = require('../clientes/clientes.servico')
const conversasServico = require('../conversas/conversas.servico')
const whatsappServico = require('./whatsapp.servico')
const wwebjsManager = require('./baileys.manager')
const { iniciarCronLembretes } = require('./lembretes.servico')
const { processarComandoAdmin, eNumeroAdministrador } = require('./admin-config.servico')
const engine = require('./engine')
const {
  limparDadosTesteCliente,
  rodarSuiteWhatsAppBrasil,
} = require('./ia.teste.servico')
const banco = require('../../config/banco')
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')
const { sintetizarAudio } = require('./voz.servico')

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

  const enviarRespostaWhatsapp = async (texto, { preferirAudio = false } = {}) => {
    if (!configWhatsApp || !texto) return

    if (ehAudio && preferirAudio) {
      try {
        const audio = await sintetizarAudio(texto)
        if (audio?.buffer?.length) {
          await whatsappServico.enviarAudio(configWhatsApp, telefone, audio.buffer, tenantId, lidWhatsapp ? `${lidWhatsapp}@lid` : null, {
            mimetype: audio.mimetype,
            ptt: true,
          })
          return
        }
      } catch (erroAudio) {
        console.warn(`[Voz] Falha ao sintetizar/enviar áudio para ${telefone}: ${erroAudio.message}`)
      }
    }

    await whatsappServico.enviarMensagem(configWhatsApp, telefone, texto, tenantId, lidWhatsapp ? `${lidWhatsapp}@lid` : null)
  }

  if (canal === 'WHATSAPP' && eNumeroAdministrador(configWhatsApp, telefone)) {
    const respostaAdmin = await processarComandoAdmin({ tenantId, mensagem })
    if (respostaAdmin) {
      await enviarRespostaWhatsapp(respostaAdmin)
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

  let cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefone, nome, lidWhatsapp)
  const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, canal)

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

  if (ehSaudacaoSimples && ehNovaSessao && tenant) {
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
      ? `Oi, ${nomeCliente}! Aqui é o ${nomeIA}, Assistente Virtual da ${tenant.nome} 💈\n📅 Nosso horário de Funcionamento é de ${horarioFunc}\n${difs.length > 0 ? '\n✨ Temos ' + difs.join(', ') + '.\n' : ''}\nVocê pode agendar pelo link ou me fala aqui que eu marco pra você:\n🗓️ ${link}`
      : `Oi! Aqui é o ${nomeIA}, Assistente Virtual da ${tenant.nome} 💈\n📅 Nosso horário de Funcionamento é de ${horarioFunc}\n${difs.length > 0 ? '\n✨ Temos ' + difs.join(', ') + '.\n' : ''}\nVocê pode agendar pelo link ou me fala aqui que eu marco pra você:\n🗓️ ${link}`
    const saudacao = saudacaoBase

    await banco.mensagem.createMany({
      data: [
        { conversaId: conversa.id, remetente: 'cliente', conteudo: mensagem },
        { conversaId: conversa.id, remetente: 'ia', conteudo: saudacao },
      ],
    })
    await enviarRespostaWhatsapp(saudacao)
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
    await enviarRespostaWhatsapp(direta.resposta, { preferirAudio: true })
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
      await enviarRespostaWhatsapp(resultado.mensagemProativa)
    }
    if (resultado.resposta) {
      await enviarRespostaWhatsapp(resultado.resposta, { preferirAudio: true })
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

      const onMensagem = async (telefone, texto, nome, avatarUrl, lidWhatsapp, meta = {}) => {
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
              ehAudio: Boolean(meta?.ehAudio),
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

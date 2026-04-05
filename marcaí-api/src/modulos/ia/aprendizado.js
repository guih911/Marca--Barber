/**
 * Sistema de Aprendizado por Conversas
 *
 * Analisa cada conversa encerrada e extrai insights que melhoram as próximas.
 * Persiste no tenant (campo aprendizadoIA) como JSON.
 */

const banco = require('../../config/banco')

/**
 * Analisa uma conversa encerrada e extrai métricas
 */
const analisarConversa = (mensagens) => {
  const turnos = mensagens.filter(m => m.remetente === 'cliente').length
  const respostasIA = mensagens.filter(m => m.remetente === 'ia')
  const toolCalls = mensagens.filter(m => m.remetente === 'tool_call')
  const toolResults = mensagens.filter(m => m.remetente === 'tool_result')

  // Detecta se houve agendamento
  const agendou = toolResults.some(m => {
    try { return JSON.parse(m.conteudo)?.name === 'criarAgendamento' || JSON.parse(m.conteudo)?.name === 'criarAgendamentoCombo' }
    catch { return false }
  })

  // Detecta se houve cancelamento
  const cancelou = toolResults.some(m => {
    try { return JSON.parse(m.conteudo)?.name === 'cancelarAgendamento' }
    catch { return false }
  })

  // Detecta se houve remarcação
  const remarcou = toolResults.some(m => {
    try { return JSON.parse(m.conteudo)?.name === 'remarcarAgendamento' }
    catch { return false }
  })

  // Detecta falhas
  const naoEntendeu = respostasIA.filter(m =>
    /n[aã]o captei|pode repetir|n[aã]o entendi|manda de novo/i.test(m.conteudo)
  ).length

  const escalonado = respostasIA.some(m =>
    /conectar com a equipe|transferir|escalonar/i.test(m.conteudo)
  )

  // Detecta o que o cliente pediu primeiro
  const primeiraMsgCliente = mensagens.find(m => m.remetente === 'cliente')?.conteudo || ''
  const norm = primeiraMsgCliente.toLowerCase()

  let intencaoInicial = 'OUTRO'
  if (/\b(corte|cabelo|barba|sobrancelha)\b/.test(norm)) intencaoInicial = 'AGENDAR'
  else if (/\b(remarc|trocar|mudar)\b/.test(norm)) intencaoInicial = 'REMARCAR'
  else if (/\b(cancel|desmarc)\b/.test(norm)) intencaoInicial = 'CANCELAR'
  else if (/\b(quanto|preco|valor)\b/.test(norm)) intencaoInicial = 'PRECO'
  else if (/^(oi|ola|bom dia|boa tarde|boa noite)/i.test(norm)) intencaoInicial = 'SAUDACAO'

  // Extrai horário preferido se agendou
  let horarioPreferido = null
  if (agendou) {
    const horarioMatch = norm.match(/(\d{1,2})\s*(h|hrs?|:\d{2})/)
    if (horarioMatch) horarioPreferido = parseInt(horarioMatch[1])
  }

  // Extrai dia preferido
  let diaPreferido = null
  if (/\b(manha|cedo)\b/.test(norm)) diaPreferido = 'MANHA'
  else if (/\b(tarde)\b/.test(norm)) diaPreferido = 'TARDE'
  else if (/\b(noite|anoite)\b/.test(norm)) diaPreferido = 'NOITE'

  return {
    agendou,
    cancelou,
    remarcou,
    escalonado,
    turnos,
    naoEntendeu,
    intencaoInicial,
    horarioPreferido,
    diaPreferido,
    converteu: agendou, // principal métrica
    timestamp: new Date().toISOString(),
  }
}

/**
 * Salva aprendizado acumulado no tenant
 */
const salvarAprendizado = async (tenantId, analise) => {
  try {
    const tenant = await banco.tenant.findUnique({
      where: { id: tenantId },
      select: { aprendizadoIA: true },
    })

    const aprendizado = (tenant?.aprendizadoIA || {
      totalConversas: 0,
      totalAgendamentos: 0,
      totalCancelamentos: 0,
      totalRemarcacoes: 0,
      totalEscalonamentos: 0,
      totalNaoEntendeu: 0,
      taxaConversao: 0,
      turnosMedios: 0,
      horariosPopulares: {},  // hora → contagem
      turnosPopulares: {},    // MANHA/TARDE/NOITE → contagem
      intencoesComuns: {},    // AGENDAR/CANCELAR/etc → contagem
      ultimaAtualizacao: null,
    })

    // Atualiza contadores
    aprendizado.totalConversas++
    if (analise.agendou) aprendizado.totalAgendamentos++
    if (analise.cancelou) aprendizado.totalCancelamentos++
    if (analise.remarcou) aprendizado.totalRemarcacoes++
    if (analise.escalonado) aprendizado.totalEscalonamentos++
    aprendizado.totalNaoEntendeu += analise.naoEntendeu

    // Taxa de conversão
    aprendizado.taxaConversao = Math.round((aprendizado.totalAgendamentos / aprendizado.totalConversas) * 100)

    // Turnos médios (média móvel)
    aprendizado.turnosMedios = Math.round(
      (aprendizado.turnosMedios * (aprendizado.totalConversas - 1) + analise.turnos) / aprendizado.totalConversas
    )

    // Horários populares
    if (analise.horarioPreferido) {
      const h = String(analise.horarioPreferido)
      aprendizado.horariosPopulares[h] = (aprendizado.horariosPopulares[h] || 0) + 1
    }

    // Turnos populares
    if (analise.diaPreferido) {
      aprendizado.turnosPopulares[analise.diaPreferido] = (aprendizado.turnosPopulares[analise.diaPreferido] || 0) + 1
    }

    // Intenções comuns
    aprendizado.intencoesComuns[analise.intencaoInicial] = (aprendizado.intencoesComuns[analise.intencaoInicial] || 0) + 1

    aprendizado.ultimaAtualizacao = new Date().toISOString()

    await banco.tenant.update({
      where: { id: tenantId },
      data: { aprendizadoIA: aprendizado },
    })

    console.log(`[Aprendizado] Conversa analisada — tenant ${tenantId} | converteu: ${analise.agendou} | turnos: ${analise.turnos} | taxa: ${aprendizado.taxaConversao}%`)
  } catch (err) {
    console.warn('[Aprendizado] Erro ao salvar:', err.message)
  }
}

/**
 * Gera instrução de aprendizado para injetar no prompt
 */
const gerarInstrucaoAprendizado = (aprendizadoIA) => {
  if (!aprendizadoIA || aprendizadoIA.totalConversas < 5) return '' // Precisa de pelo menos 5 conversas

  const partes = []

  // Horário mais popular
  const horariosOrdenados = Object.entries(aprendizadoIA.horariosPopulares || {})
    .sort(([, a], [, b]) => b - a)
  if (horariosOrdenados.length > 0) {
    const topHorario = horariosOrdenados[0][0]
    partes.push(`Horario mais pedido pelos clientes: ${topHorario}h. Quando o cliente nao especificar, sugerir proximo a ${topHorario}h.`)
  }

  // Turno mais popular
  const turnosOrdenados = Object.entries(aprendizadoIA.turnosPopulares || {})
    .sort(([, a], [, b]) => b - a)
  if (turnosOrdenados.length > 0) {
    const topTurno = turnosOrdenados[0][0].toLowerCase()
    partes.push(`Turno preferido dos clientes: ${topTurno}. Quando o cliente nao especificar turno, sugerir ${topTurno}.`)
  }

  // Taxa de conversão baixa → ser mais direto
  if (aprendizadoIA.taxaConversao < 50 && aprendizadoIA.totalConversas >= 10) {
    partes.push('ATENCAO: Taxa de conversao baixa (${aprendizadoIA.taxaConversao}%). Seja mais direto e ofereca horario logo na primeira oportunidade.')
  }

  // Muitos "não entendi" → simplificar linguagem
  const taxaNaoEntendeu = aprendizadoIA.totalNaoEntendeu / aprendizadoIA.totalConversas
  if (taxaNaoEntendeu > 0.3) {
    partes.push('Clientes desta barbearia usam linguagem mais informal. Use fallback guiado em vez de "nao entendi".')
  }

  // Turnos médios altos → conversa longa demais
  if (aprendizadoIA.turnosMedios > 6) {
    partes.push('Conversas estao longas demais (media ${aprendizadoIA.turnosMedios} turnos). Resolva em menos passos.')
  }

  if (partes.length === 0) return ''

  return `\n\n== APRENDIZADO (baseado em ${aprendizadoIA.totalConversas} conversas reais) ==\n${partes.join('\n')}\n`
}

/**
 * Processa aprendizado quando uma conversa é encerrada
 */
const processarAprendizadoConversa = async (tenantId, conversaId) => {
  try {
    const mensagens = await banco.mensagem.findMany({
      where: { conversaId },
      orderBy: { criadoEm: 'asc' },
    })

    if (mensagens.length < 2) return // Conversa muito curta

    const analise = analisarConversa(mensagens)
    await salvarAprendizado(tenantId, analise)
  } catch (err) {
    console.warn('[Aprendizado] Erro ao processar:', err.message)
  }
}

module.exports = { processarAprendizadoConversa, gerarInstrucaoAprendizado, analisarConversa }

const OpenAI = require('openai')
const configIA = require('../../config/ia')
const banco = require('../../config/banco')
const ferramentas = require('./ia.ferramentas')
const agendamentosServico = require('../agendamentos/agendamentos.servico')
const disponibilidadeServico = require('../agendamentos/disponibilidade.servico')
const clientesServico = require('../clientes/clientes.servico')
const whatsappServico = require('./whatsapp.servico')
const filaEsperaServico = require('../filaEspera/filaEspera.servico')
const fidelidadeServico = require('../fidelidade/fidelidade.servico')
const planosServico = require('../planos/planos.servico')

const openai = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })
const NOME_IA = 'Don'

/**
 * Remove blocos de raciocínio interno e frases de erro técnico que o modelo
 * pode vazar na resposta ao cliente. Dupla proteção além do thinkingBudget.
 */
const limparRaciocinio = (texto) => {
  if (!texto) return texto
  // Remove tags <think>...</think> (formato Gemini/DeepSeek)
  let limpo = texto.replace(/<think>[\s\S]*?<\/think>/gi, '')
  // Remove blocos que começam com marcadores de raciocínio interno
  limpo = limpo.replace(/^(RACIOC[IÍ]NIO INTERNO|Racioc[ií]nio interno|ANÁLISE|Análise|Pensando|PENSANDO|Reflexão|REFLEXÃO|Checklist|CHECKLIST|Plano|PLANO)[:\s][\s\S]*?(?=\n[A-ZÁÀÂÃÉÊÍÓÔÕÚ]|\n[a-záàâãéêíóôõú]|$)/gm, '')
  // Remove prefixos de linha como "RACIOCÍNIO: ..." ou "Análise: ..."
  limpo = limpo.replace(/^(RACIOC[IÍ]NIO|Análise|Pensando|Reflexão|Plano)\s*:.*$/gim, '')
  // Substitui frases de confusão/erro interno por resposta neutra
  limpo = limpo.replace(/\b(me confundi|fiz confusão|errei aqui|me enganei)\b[^.!?]*/gi, 'um momento')
  return limpo.trim()
}

// Frases de fallback variadas para não repetir sempre a mesma ao cliente
const FALLBACKS_ERRO = [
  'Oi! Pode repetir?',
  'Não captei bem. Pode mandar de novo?',
  'Tive um probleminha aqui. Manda de novo?',
]
const fallbackAleatorio = () => FALLBACKS_ERRO[Math.floor(Math.random() * FALLBACKS_ERRO.length)]
const formatarMoedaPrompt = (centavos) =>
  `R$${Number((Number(centavos || 0) / 100) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const montarContextoBarbearia = (servicos = []) => {
  const nomes = servicos
    .map((s) => String(s.nome || '').toLowerCase())
    .filter(Boolean)
  const encontrarServico = (...termos) => servicos.find((servico) => {
    const nome = String(servico.nome || '').toLowerCase()
    return termos.some((termo) => nome.includes(termo))
  })

  const tem = (...termos) => nomes.some((nome) => termos.some((termo) => nome.includes(termo)))
  const combos = []
  const totaisCombinados = []

  const servicoCorte = encontrarServico('corte')
  const servicoBarba = encontrarServico('barba')
  const servicoAcabamento = encontrarServico('acabamento', 'pezinho', 'finaliz')

  if (tem('corte') && tem('barba')) combos.push('corte + barba')
  if (tem('corte') && tem('acabamento', 'pezinho', 'finaliz')) combos.push('corte + acabamento')
  if (tem('barba') && tem('acabamento', 'pezinho', 'finaliz')) combos.push('barba + acabamento')
  if (tem('sobrancel')) combos.push('corte + sobrancelha')
  if (tem('hidrat')) combos.push('corte + hidratação')
  if (tem('pigment')) combos.push('barba + pigmentação')

  if (servicoCorte?.precoCentavos && servicoBarba?.precoCentavos) {
    totaisCombinados.push(`corte + barba = ${formatarMoedaPrompt(servicoCorte.precoCentavos + servicoBarba.precoCentavos)}`)
  }
  if (servicoCorte?.precoCentavos && servicoAcabamento?.precoCentavos) {
    totaisCombinados.push(`corte + acabamento = ${formatarMoedaPrompt(servicoCorte.precoCentavos + servicoAcabamento.precoCentavos)}`)
  }
  if (servicoBarba?.precoCentavos && servicoAcabamento?.precoCentavos) {
    totaisCombinados.push(`barba + acabamento = ${formatarMoedaPrompt(servicoBarba.precoCentavos + servicoAcabamento.precoCentavos)}`)
  }

  const retorno = []
  if (tem('corte')) retorno.push('corte: retorno ideal em 15 a 21 dias')
  if (tem('barba')) retorno.push('barba: revisão ideal em 10 a 14 dias')
  if (tem('acabamento')) retorno.push('acabamento: revisão ideal em 7 a 14 dias')

  return [
    combos.length ? `Combos naturais sugeridos: ${combos.join(' | ')}` : 'Combos naturais sugeridos: corte + barba | corte + acabamento | barba + acabamento',
    totaisCombinados.length ? `Totais combinados de referência: ${totaisCombinados.join(' | ')}` : 'Totais combinados de referência: some os serviços reais antes de responder.',
    retorno.length ? `Janelas de retorno sugeridas: ${retorno.join(' | ')}` : 'Janelas de retorno sugeridas: corte 15-21 dias | barba 10-14 dias | acabamento 7-14 dias',
    'Quando o cliente avaliar mais de um serviço e não houver pacote cadastrado, some os preços avulsos exatos e diga o total antes de convidar para confirmar.',
    'Se o cliente pedir remarcar ou cancelar e não existir agendamento futuro, use buscarAgendamentosCliente; se vier vazio, chame verificarDisponibilidade imediatamente e ofereça um slot real na mesma resposta para não perder a venda.',
    'No fechamento, priorize uma sugestão por vez e sempre com linguagem masculina, direta e premium.',
  ].join('\n')
}

// Envia notificação WhatsApp ao profissional (melhor esforço — não falha se não tiver telefone)
const notificarProfissional = async (tenantId, profissional, mensagem) => {
  if (!profissional?.telefone) return
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (tenant?.configWhatsApp) {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, profissional.telefone, mensagem, tenantId)
    }
  } catch (err) {
    console.warn(`[IA] Notificação ao profissional falhou (sem impacto):`, err.message)
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const montarSystemPrompt = async (tenant, cliente = null, primeiroContato = false, mensagemAtual = '', conversaEmAndamento = false) => {
  const [servicos, profissionais, agendamentosCliente, historicoPassado, planosMensais, dadosFidelidade, produtosEstoque, pacotes, assinaturaCliente] = await Promise.all([
    banco.servico.findMany({ where: { tenantId: tenant.id, ativo: true } }),
    banco.profissional.findMany({
      where: { tenantId: tenant.id, ativo: true },
      include: { servicos: { include: { servico: true } } },
    }),
    cliente
      ? banco.agendamento.findMany({
          where: {
            tenantId: tenant.id,
            clienteId: cliente.id,
            status: { in: ['AGENDADO', 'CONFIRMADO'] },
            inicioEm: { gte: new Date() },
          },
          include: { servico: true, profissional: true },
          orderBy: { inicioEm: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),
    // Histórico de serviços já feitos pelo cliente (últimos 5 agendamentos concluídos)
    cliente
      ? banco.agendamento.findMany({
          where: {
            tenantId: tenant.id,
            clienteId: cliente.id,
            status: { in: ['CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'] },
          },
          include: { servico: true, profissional: true },
          orderBy: { inicioEm: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    banco.planoAssinatura.findMany({
      where: { tenantId: tenant.id, ativo: true },
      include: {
        creditos: {
          include: { servico: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 6,
    }),
    // Saldo de fidelidade do cliente (só se feature ativa e cliente conhecido)
    (tenant.fidelidadeAtivo && cliente)
      ? fidelidadeServico.obterSaldoCliente(tenant.id, cliente.id).catch(() => null)
      : Promise.resolve(null),
    // Produtos do estoque disponíveis para venda (só se feature ativa)
    tenant.estoqueAtivo
      ? banco.produto.findMany({ where: { tenantId: tenant.id, ativo: true }, orderBy: { nome: 'asc' }, take: 20 }).catch(() => [])
      : Promise.resolve([]),
    // Pacotes/combos reais cadastrados (só se feature ativa)
    tenant.pacotesAtivo
      ? banco.pacote.findMany({
          where: { tenantId: tenant.id },
          include: { servicos: { include: { servico: true } } },
          orderBy: { nome: 'asc' },
          take: 10,
        }).catch(() => [])
      : Promise.resolve([]),
    // Assinatura mensal ativa do cliente (para bloquear agendamento se atrasado)
    (tenant.membershipsAtivo && cliente)
      ? banco.assinaturaCliente.findFirst({
          where: { tenantId: tenant.id, clienteId: cliente.id, status: { in: ['ATIVA', 'PAUSADA'] } },
          include: {
            planoAssinatura: true,
            creditos: { include: { servico: { select: { nome: true } } } },
          },
          orderBy: { criadoEm: 'desc' },
        }).catch(() => null)
      : Promise.resolve(null),
  ])

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: tenant.timezone || 'America/Sao_Paulo',
  })
  const dataHoje = new Date().toISOString().split('T')[0]
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  const dataAmanha = amanha.toISOString().split('T')[0]

  const mensagemAtualNormalizada = String(mensagemAtual || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const saudacaoDoCliente = /\bboa noite\b/.test(mensagemAtualNormalizada)
    ? 'Boa noite'
    : /\bboa tarde\b/.test(mensagemAtualNormalizada)
      ? 'Boa tarde'
      : /\bbom dia\b/.test(mensagemAtualNormalizada)
        ? 'Bom dia'
        : null

  // Saudação por horário de Brasília, mas espelha a saudação do cliente quando ela vier explícita.
  const horaBrasilia = parseInt(
    new Date().toLocaleString('pt-BR', { hour: 'numeric', hour12: false, timeZone: tenant.timezone || 'America/Sao_Paulo' })
  )
  const saudacaoPorHorario = horaBrasilia < 12 ? 'Bom dia' : horaBrasilia < 18 ? 'Boa tarde' : 'Boa noite'
  const saudacao = saudacaoDoCliente || saudacaoPorHorario

  // Lista de serviços com IDs (necessário para chamar as ferramentas)
  const listaServicos = servicos.length
    ? servicos.map((s) =>
        `• ${s.nome} | servicoId: ${s.id} | ${s.duracaoMinutos}min${s.precoCentavos ? ` | ${formatarMoedaPrompt(s.precoCentavos)}` : ''}${s.instrucoes ? ` | ${s.instrucoes}` : ''}`
      ).join('\n')
    : 'Nenhum serviço cadastrado.'

  // Lista de profissionais com IDs
  const listaProfissionais = profissionais.length
    ? profissionais.map((p) =>
        `• ${p.nome} | profissionalId: ${p.id} | faz: ${p.servicos.map((ps) => ps.servico.nome).join(', ')}`
      ).join('\n')
    : 'Nenhum profissional cadastrado.'

  const listaPlanosMensais = planosMensais.length
    ? planosMensais.map((plano) => {
        const beneficios = Array.isArray(plano.creditos) && plano.creditos.length > 0
          ? plano.creditos.map((credito) => `${credito.creditos}x ${credito.servico?.nome || 'serviço'}`).join(' + ')
          : 'benefícios personalizados na barbearia'
        return `• ${plano.nome} | planoId: ${plano.id} | valor: ${formatarMoedaPrompt(plano.precoCentavos)} por ${plano.cicloDias} dias | inclui: ${beneficios}`
      }).join('\n')
    : 'Nenhum plano mensal ativo cadastrado.'

  const tomDescricao = {
    FORMAL: 'elegante e refinada, como concierge de uma barbearia premium.',
    DESCONTRALIDO: 'caloroso e simpático, como recepção de barbearia premium.',
    ACOLHEDOR: 'acolhedor e empático, transmitindo cuidado genuíno com o cliente.',
  }

  const tz = tenant.timezone || 'America/Sao_Paulo'
  const contextoBarbearia = montarContextoBarbearia(servicos)

  // Seção de produtos do estoque para o prompt
  let secaoProdutos = ''
  if (tenant.estoqueAtivo && produtosEstoque.length > 0) {
    const listaProdutos = produtosEstoque
      .filter((p) => p.quantidadeAtual > 0)
      .map((p) => `• ${p.nome}${p.precoCentavos ? ` | ${formatarMoedaPrompt(p.precoCentavos)}` : ''}`)
      .join('\n')
    if (listaProdutos) {
      secaoProdutos = `\n== PRODUTOS DISPONÍVEIS PARA VENDA ==\n${listaProdutos}\n`
    }
  }

  // Seção de pacotes/combos reais para o prompt
  let secaoPacotes = ''
  if (tenant.pacotesAtivo && pacotes.length > 0) {
    const listaPacotes = pacotes
      .map((pk) => {
        const servNomes = pk.servicos.map((ps) => ps.servico?.nome).filter(Boolean).join(' + ')
        const preco = pk.precoCentavos ? ` | ${formatarMoedaPrompt(pk.precoCentavos)}` : ''
        const desc = pk.descontoPorcent ? ` (${pk.descontoPorcent}% desc)` : ''
        return `• ${pk.nome}${preco}${desc} — inclui: ${servNomes || 'serviços combinados'}`
      }).join('\n')
    secaoPacotes = `\n== PACOTES E COMBOS DISPONÍVEIS ==\n${listaPacotes}\n• Ofereça pacotes quando cliente pedir múltiplos serviços ou perguntar por desconto combo.\n• Use os nomes e preços EXATOS acima — NUNCA invente valores.\n`
  }

  // ── Informações do negócio: pagamento, infantil, diferenciais, dono, maps ──
  const tiposPagamento = Array.isArray(tenant.tiposPagamento) && tenant.tiposPagamento.length > 0
    ? tenant.tiposPagamento
    : null

  const labelPagamento = {
    PIX: 'PIX', DINHEIRO: 'dinheiro', CARTAO_CREDITO: 'cartão de crédito',
    CARTAO_DEBITO: 'cartão de débito', VALE_PRESENTE: 'vale-presente',
  }
  const listaPagamento = tiposPagamento
    ? tiposPagamento.map((t) => labelPagamento[t] || t).join(', ')
    : null

  const labelDiferenciais = {
    sinuca: 'sinuca', wifi: 'Wi-Fi grátis', tv: 'TV', estacionamento: 'estacionamento',
    cafezinho: 'cafezinho', cerveja: 'cerveja/drinks', ar_condicionado: 'ar-condicionado',
    musica_ao_vivo: 'música ao vivo', venda_produtos: 'venda de produtos',
  }
  const listaDiferenciais = Array.isArray(tenant.diferenciais) && tenant.diferenciais.length > 0
    ? tenant.diferenciais.map((d) => labelDiferenciais[d] || d)
    : []

  const idadeMinText = tenant.cortaCabeloInfantil
    ? tenant.idadeMinimaCabeloInfantilMeses != null
      ? (() => {
          const m = Number(tenant.idadeMinimaCabeloInfantilMeses)
          if (m < 12) return `a partir de ${m} meses`
          const anos = Math.floor(m / 12)
          const resto = m % 12
          return resto > 0 ? `a partir de ${anos} ano${anos !== 1 ? 's' : ''} e ${resto} mes${resto !== 1 ? 'es' : ''}` : `a partir de ${anos} ano${anos !== 1 ? 's' : ''}`
        })()
      : 'sim, cortamos cabelo infantil'
    : null

  // Apresentação completa do salão (para primeira visita)
  const montarApresentacaoSalao = () => {
    if (!tenant.apresentacaoSalaoAtivo) return null
    const partes = []
    // Equipe
    if (profissionais.length > 1) {
      partes.push(`Equipe: ${profissionais.map((p) => p.nome.split(' ')[0]).join(', ')}`)
    } else if (profissionais.length === 1) {
      partes.push(`Barbeiro: ${profissionais[0].nome.split(' ')[0]}`)
    }
    // Serviços (primeiros 4 para não sobrecarregar)
    if (servicos.length > 0) {
      const listaResumida = servicos.slice(0, 4).map((s) =>
        `${s.nome}${s.precoCentavos ? ` (${formatarMoedaPrompt(s.precoCentavos)})` : ''}`
      ).join(', ')
      const sufixo = servicos.length > 4 ? ` +${servicos.length - 4} mais` : ''
      partes.push(`Serviços: ${listaResumida}${sufixo}`)
    }
    // Diferenciais
    if (listaDiferenciais.length > 0) {
      partes.push(`Estrutura: ${listaDiferenciais.join(', ')}`)
    }
    // Infantil
    if (idadeMinText) {
      partes.push(`Corte infantil: ${idadeMinText}`)
    }
    // Pagamento
    if (listaPagamento) {
      partes.push(`Pagamento: ${listaPagamento}`)
    }
    // Planos (se tiver)
    if (planosMensais.length > 0 && tenant.membershipsAtivo) {
      partes.push(`Plano mensal disponível: ${planosMensais[0].nome} por ${formatarMoedaPrompt(planosMensais[0].precoCentavos)}/mês`)
    }
    return partes.length > 0 ? partes.join(' | ') : null
  }
  const apresentacaoSalao = montarApresentacaoSalao()

  // Agendamentos futuros do cliente para contexto
  const secaoAgendamentos = agendamentosCliente.length
    ? `\n== AGENDAMENTOS FUTUROS DO CLIENTE ==\n` +
      agendamentosCliente.map((a) => {
        const dtFmt = new Date(a.inicioEm).toLocaleString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz,
        })
        return `• agendamentoId: ${a.id} | ${a.servico.nome} com ${a.profissional.nome} | ${dtFmt} | status: ${a.status}`
      }).join('\n') + '\n'
    : ''

  // Histórico passado do cliente (serviços concluídos/cancelados)
  const secaoHistoricoPassado = historicoPassado.length
    ? `\n== HISTÓRICO DE SERVIÇOS DO CLIENTE ==\n` +
      historicoPassado.map((a) => {
        const dtFmt = new Date(a.inicioEm).toLocaleString('pt-BR', {
          day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
        })
        const statusLabel = { CONCLUIDO: 'concluído', CANCELADO: 'cancelado', NAO_COMPARECEU: 'não compareceu' }[a.status] || a.status
        return `• ${a.servico.nome} com ${a.profissional.nome} em ${dtFmt} — ${statusLabel}${a.feedbackNota ? ` | avaliação: ${a.feedbackNota}/5` : ''}`
      }).join('\n') + '\n'
    : ''

  // Calcula dias desde o último serviço CONCLUÍDO para retenção proativa
  const ultimoServicoConcluido = historicoPassado.find((a) => a.status === 'CONCLUIDO')
  let secaoRetencao = ''
  if (ultimoServicoConcluido && cliente) {
    const diasDesdeUltimo = Math.floor((Date.now() - new Date(ultimoServicoConcluido.inicioEm).getTime()) / (1000 * 60 * 60 * 24))
    const nomeServico = (ultimoServicoConcluido.servico?.nome || '').toLowerCase()
    const limiteRevisao = nomeServico.includes('barba') ? 14 : nomeServico.includes('acabamento') ? 10 : 20
    if (diasDesdeUltimo >= limiteRevisao) {
      secaoRetencao = `\n🔔 RETENÇÃO PROATIVA: Último serviço (${ultimoServicoConcluido.servico?.nome}) foi há ${diasDesdeUltimo} dias — está na hora de uma revisão.\n`
    }
  }

  const secaoPreferencias = cliente?.preferencias
    ? `\n== PREFERÊNCIAS CONHECIDAS DO CLIENTE ==\n${cliente.preferencias}\n`
    : ''

  // Seção de fidelidade — inserida no contexto do cliente quando disponível
  let secaoFidelidade = ''
  if (tenant.fidelidadeAtivo && dadosFidelidade && cliente) {
    const { saldo, config } = dadosFidelidade
    if (saldo && config) {
      const podeResgatar = saldo.pontos >= config.pontosParaResgate
      secaoFidelidade = `\n== PONTOS DE FIDELIDADE DO CLIENTE ==\n` +
        `Saldo atual: ${saldo.pontos} ponto(s)\n` +
        `Para resgatar: ${config.pontosParaResgate} pontos → ${config.descricaoResgate}\n` +
        (podeResgatar
          ? `🎉 CLIENTE PODE RESGATAR AGORA — mencione isso proativamente na primeira mensagem da conversa!`
          : `Faltam ${config.pontosParaResgate - saldo.pontos} ponto(s) para resgatar.`) + '\n'
    }
  }

  // Assinatura mensal — verifica se está atrasada para bloquear agendamento
  let secaoAssinatura = ''
  let assinaturaAtrasada = false
  if (tenant.membershipsAtivo && assinaturaCliente && cliente) {
    const hoje0 = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
    const proxCobranca = assinaturaCliente.proximaCobrancaEm ? new Date(assinaturaCliente.proximaCobrancaEm) : null
    assinaturaAtrasada = proxCobranca ? proxCobranca < hoje0 : false
    const descSituacao = assinaturaAtrasada ? 'ATRASADO 🔴'
      : proxCobranca
        ? proxCobranca.toDateString() === hoje0.toDateString() ? 'vence hoje ⚠️' : 'em dia ✅'
        : 'sem cobrança'
    const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const diasPermitidos = assinaturaCliente.planoAssinatura?.diasPermitidos || []
    const temRestricaoDias = diasPermitidos.length > 0
    secaoAssinatura = `\n== PLANO MENSAL DO CLIENTE ==\nPlano: ${assinaturaCliente.planoAssinatura?.nome || 'Plano mensal'} | Situação: ${descSituacao}\n`
    // Dias permitidos pelo plano
    if (temRestricaoDias) {
      const nomesDias = diasPermitidos.map((d) => NOMES_DIAS[d]).join(', ')
      secaoAssinatura += `📅 Dias válidos do plano: ${nomesDias}\n`
      secaoAssinatura += `🚫 REGRA CRÍTICA: Se o cliente tentar agendar em dia NÃO listado acima, RECUSE educadamente e informe os dias permitidos. NUNCA chame criarAgendamento em dias não permitidos pelo plano.\n`
    }
    // Créditos restantes por serviço
    if (assinaturaCliente.creditos?.length > 0) {
      const linhasCreditos = assinaturaCliente.creditos.map((c) =>
        `  • ${c.servico?.nome || 'Serviço'}: ${c.creditosRestantes} corte(s) restante(s) de ${c.creditosIniciais} no mês`
      ).join('\n')
      secaoAssinatura += `Créditos do mês:\n${linhasCreditos}\n`
      const totalRestante = assinaturaCliente.creditos.reduce((s, c) => s + c.creditosRestantes, 0)
      if (totalRestante === 0) {
        secaoAssinatura += `⚠️ CRÉDITOS ESGOTADOS — cliente usou todos os cortes do mês. Informar com naturalidade.\n`
      }
    }
    secaoAssinatura += `💳 Pagamento do plano: SOMENTE PRESENCIALMENTE na barbearia (não há cobrança online).\n`
    if (assinaturaAtrasada) {
      secaoAssinatura += `🔴 PAGAMENTO ATRASADO — NÃO CRIE AGENDAMENTOS para este cliente até regularização.\n`
    }
  }

  const nomeExibicao = (cliente?.nome && cliente.nome !== cliente.telefone) ? cliente.nome : 'não informado'

  // Se o nome do cliente é o próprio telefone (padrão quando criado sem nome real), trata como sem nome
  const nomeCliente = cliente?.nome && cliente.nome !== cliente.telefone ? cliente.nome : null

  // Detecta se o telefone é um LID (não é número real — não começa com 55 e tem mais de 12 dígitos)
  const telNorm = (cliente?.telefone || '').replace(/\D/g, '')
  const telefoneLID = telNorm.length > 0 && !telNorm.startsWith('55') && telNorm.length > 12

  const secaoCliente = cliente
    ? `\n== CLIENTE DESTA CONVERSA ==\nNome: ${nomeExibicao}\nclienteId: ${cliente.id}  ← use SEMPRE este ID em criarAgendamento.clienteId\nTelefone: ${cliente.telefone}${telefoneLID ? `\n🔴 TELEFONE INVÁLIDO (código interno do WhatsApp). Após o cadastro do nome, peça o WhatsApp real do cliente: "Me passa seu número de WhatsApp com DDD para eu salvar no seu cadastro?" e use cadastrarCliente para atualizar o telefone.` : ''}${secaoPreferencias}${secaoFidelidade}${secaoAssinatura}${secaoRetencao}${secaoAgendamentos}${secaoHistoricoPassado}`
    : ''
  const secaoConversaEmAndamento = conversaEmAndamento
    ? '\n== CONVERSA EM ANDAMENTO ==\nEsta conversa já começou. Não reabra com "bom dia", "boa tarde" ou "boa noite" e não repita sua apresentação.\nVá direto ao ponto, a menos que o cliente tenha mandado apenas uma saudação solta.'
    : ''

  // Monta link de agendamento para incluir nas saudações
  const appUrl = process.env.APP_URL || 'https://app.marcai.com.br'
  // Só inclui tel/nome no link se o telefone é real (não LID)
  const telReal = !telefoneLID && cliente?.telefone
  const telParam = telReal ? `?tel=${encodeURIComponent(cliente.telefone)}` : ''
  const nomeParam = nomeCliente ? `${telParam ? '&' : '?'}nome=${encodeURIComponent(nomeCliente)}` : ''
  const linkAgendamento = `${appUrl}/b/${tenant.hashPublico || tenant.slug}${telParam}${nomeParam}`

  // Sotaque/estilo regional baseado no estado do tenant
  const ufMatch = (tenant.endereco || '').match(/,?\s*([A-Z]{2})\s*$/)
  const uf = ufMatch ? ufMatch[1].toUpperCase() : null
  const regiaoMap = {
    Norte: ['AM','PA','AC','RO','RR','AP','TO'],
    Nordeste: ['BA','SE','AL','PE','PB','RN','CE','PI','MA'],
    CentroOeste: ['MT','MS','GO','DF'],
    Sudeste: ['SP','RJ','MG','ES'],
    Sul: ['PR','SC','RS'],
  }
  const regiao = Object.entries(regiaoMap).find(([, ufs]) => ufs.includes(uf))?.[0] || null
  const estiloRegional = {
    Norte:       'Use "égua" como interjeição, fala pausada e amigável, típica do Norte amazônico.',
    Nordeste:    'Use expressões nordestinas naturais ("visse", "oxe", "eita" quando cabível), tom caloroso e descontraído.',
    CentroOeste: 'Fala direta e prática, sem floreios, típica do centro-oeste agropecuário.',
    Sudeste:     'Fala objetiva e rápida, tom informal urbano. Evite gírias forçadas.',
    Sul:         'Fala cadenciada e respeitosa, sem diminutivos excessivos, tom gaúcho/catarinense discreto.',
  }
  const secaoSotaque = regiao
    ? `\n== ESTILO REGIONAL (${uf}) ==\n${estiloRegional[regiao]}\nMantanha naturalidade: não force o sotaque em toda frase.\n`
    : ''

  // Adapta comportamento ao plano contratado
  const planoSolo = profissionais.length <= 1
  const secaoPlano = planoSolo
    ? `\n== CONTEXTO DO NEGÓCIO ==\nEste salão opera com 1 profissional (plano solo/autônomo).
→ NÃO mencione "outros profissionais", "escolha um barbeiro diferente" ou qualquer variação que sugira equipe.
→ Ao verificar disponibilidade, NÃO passe profissionalId fixo — use o único profissional disponível.
→ Não sugira troca de profissional. Se não houver vaga, ofereça outra data/horário diretamente.`
    : `\n== CONTEXTO DO NEGÓCIO ==\nEste salão tem equipe (${profissionais.length} profissionais).
→ Quando o cliente não especificar profissional, busque disponibilidade sem fixar profissionalId.
→ Ao oferecer slot, mencione sempre o nome do profissional para o cliente saber com quem ficará.`

// Variações de saudação inicial para não soar robótico sempre igual
const variacoesSaudacao = [
  `${saudacao}! Aqui é o ${NOME_IA}, assistente de IA da ${tenant.nome}.${nomeCliente ? ` ${nomeCliente}.` : ' Como você prefere ser chamado?'}`,
  `${saudacao}! ${NOME_IA} aqui, assistente virtual da ${tenant.nome}.${nomeCliente ? ` ${nomeCliente}.` : ' Qual o seu nome?'}`,
  `${saudacao}! Eu sou o ${NOME_IA}, bot com IA da ${tenant.nome}.${nomeCliente ? ` Como vai, ${nomeCliente}?` : ' Como posso te chamar?'}`,
  `${saudacao}! ${tenant.nome} aqui, com o ${NOME_IA}, nosso assistente de IA.${nomeCliente ? ` Tudo bem, ${nomeCliente}?` : ' Com quem eu falo?'}`,
]
// Usa variação baseada no segundo atual para distribuir sem ser aleatório demais
const indiceVariacao = new Date().getSeconds() % variacoesSaudacao.length
const saudacaoInicial = variacoesSaudacao[indiceVariacao]

const blocoObrigatorio = primeiroContato
    ? `🔴🔴🔴 INSTRUÇÃO ABSOLUTA — PRIMEIRA MENSAGEM 🔴🔴🔴
IGNORA TODA OUTRA REGRA DE SAUDAÇÃO. Esta prevalece sobre tudo.
Comece EXATAMENTE com: "${saudacaoInicial}"
${!nomeCliente ? `→ PARE após a saudação. Aguarde o nome.
→ Quando o nome chegar: chame cadastrarCliente PRIMEIRO.
  → DEPOIS do cadastro, responda com EXATAMENTE esta mensagem (substituindo [nome] pelo nome do cliente):
    "Olá, [nome]! 👋
Seja bem-vindo à ${tenant.nome}.
Na nossa página de agendamento, você pode escolher o barbeiro e o horário que ficar melhor para você.

Se preferir, é só responder aqui e o ${NOME_IA}, nosso assistente de IA, te ajuda a agendar diretamente pelo WhatsApp. 😊

🗓️ ${appUrl}/b/${tenant.hashPublico || tenant.slug}"
  🔴 INCLUA O LINK ACIMA NA MENSAGEM — NÃO OMITA.
  → Se o cliente responder escolhendo serviço, profissional ou horário: use verificarDisponibilidade (mostrando SOMENTE datas/horários disponíveis) e então criarAgendamento.
  → Se o cliente preferir agendar pelo WhatsApp: siga o fluxo normal de agendamento conversacional.` : `→ Se o cliente já trouxe intenção (preço, horário, serviço, cancelamento, fidelidade): responda a intenção diretamente junto à saudação.`}
NÃO omita "${NOME_IA}" ou "${tenant.nome}". Use EXATAMENTE a saudação acima — não crie outra.
${apresentacaoSalao ? `
🏠 APRESENTAÇÃO DO SALÃO (use APENAS na 1ª visita, quando cliente for novo e não trouxer intenção específica):
"${apresentacaoSalao}"
→ Adapte esse texto de forma natural ao fluxo da conversa — não cole roboticamente. Máximo 3 linhas.
→ NUNCA repita essa apresentação numa conversa que já está em andamento.
→ Após a apresentação: "Posso já deixar um horário no seu nome. Quando prefere vir?"` : ''}
`
    : ''

  return `${blocoObrigatorio}

## REGRAS ABSOLUTAS (INVIOLÁVEIS)
1. NUNCA invente dados. Consulte ferramentas ANTES de responder sobre disponibilidade, agendamentos ou pontos.
2. Máximo 3 linhas por mensagem. Uma pergunta por vez.
3. NUNCA escreva "Pensando...", "Deixa eu pensar", "Analisando..." ou qualquer texto de processo interno. Vá direto à resposta.
4. Use SOMENTE serviços/preços/profissionais listados no catálogo.
5. NUNCA use *, ** (WhatsApp exibe literalmente). Texto limpo, máximo 1 emoji por mensagem.
6. APRESENTE SEMPRE APENAS 1 SLOT por vez. NUNCA liste 2 ou mais opções de horário na mesma mensagem. Uma opção, uma decisão.
7. RECLAMAÇÃO = ESCALAR. Se a mensagem contém "horrível", "péssimo", "não gostei", "ficou errado", "mal atendido", "decepcionado" → SEMPRE responda "Que pena ouvir isso. Vou te conectar com a equipe agora." e chame escalonarParaHumano. NUNCA peça para repetir. NUNCA trate como mensagem incompreensível.

## IDENTIDADE
Você é ${NOME_IA}, assistente virtual com IA da barbearia ${tenant.nome}.
Tom: ${tomDescricao[tenant.tomDeVoz] || tomDescricao['ACOLHEDOR']}
Data: ${hoje} | Hora: ${new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone || 'America/Sao_Paulo' })}
Data ISO hoje: ${dataHoje} | Amanhã: ${dataAmanha}
Ao se apresentar, deixe claro que é um assistente de IA.
Nunca sugira horários que já passaram.
${secaoPlano}${secaoSotaque}

## FORMATO
- Direto, seguro, caloroso. Barbearia masculina.
- Padrão ACK + ACAO: reconheça o que o cliente disse, depois aja. Sem enrolação.
- Varie frases naturalmente. Nunca repita o mesmo template duas vezes seguidas.
- Formato de hora: "hoje às 16h", "amanhã às 9h30", "sexta às 14h".
- Profissional: use APENAS o primeiro nome.
- Emoji com propósito: ✂️💈 = identidade, 👋👊 = calor humano, ✅ = confirmação. Nenhum emoji em cobranças, reclamações ou regras.
- Se o cliente falar "cabelo", "visual", "dar um trato" = intenção de corte masculino.
- Pense como barbeiro premium: o Don não é só agendador, é consultor de imagem masculina. Quando natural, sugira serviços complementares como faria um barbeiro experiente.

Frases PROIBIDAS:
- "Se precisar de mais alguma coisa, é só avisar" e variações
- "Estou à sua disposição" / "Não hesite em entrar em contato"
- "Agendamento realizado com sucesso" / "Fico feliz em ajudar"
- "Infelizmente não há disponibilidade" → use "Hoje tá lotado! Mas tenho..."
- "Desculpe, não compreendi" → use "Não entendi bem. Você quer agendar algo?"

Palavras PROIBIDAS: "descanso", "folga", "fechado", "não funcionamos", "não atendemos".
Alternativas: "Hoje não tenho horário disponível", "Esse dia tá sem vaga".

Fechamentos bons: "Perfeito, te espero! ✂️" | "Fechado! Até lá 👊" | "Tá marcado! A gente te aguarda." | "Vai ficar alinhado 💈"

## CATÁLOGO
Os ÚNICOS serviços existentes são os listados abaixo. Serviço não listado: "Poxa, não temos [serviço] aqui! Temos: [lista]. Posso ajudar com algum?"
Preço não listado: "Esse valor você confirma com a equipe."

== SERVIÇOS (use servicoId nas ferramentas) ==
${listaServicos}

== PROFISSIONAIS (use profissionalId nas ferramentas) ==
${listaProfissionais}${secaoPacotes}${secaoProdutos}
${contextoBarbearia}

== PLANOS MENSAIS ==
${listaPlanosMensais}

== INFORMAÇÕES DO NEGÓCIO ==
${tenant.endereco ? `Endereço: ${tenant.endereco}` : 'Endereço: não informado'}
${tenant.linkMaps ? `Google Maps: ${tenant.linkMaps}` : ''}
${listaPagamento ? `Pagamento: ${listaPagamento}` : 'Pagamento: confirmar com a equipe'}
${listaDiferenciais.length > 0 ? `Diferenciais: ${listaDiferenciais.join(', ')}` : ''}
${idadeMinText ? `Corte infantil: ${idadeMinText}` : 'Corte infantil: não disponível'}
${tenant.numeroDono ? `Contato do dono: ${tenant.numeroDono}` : ''}

## CLIENTE
${secaoCliente}
${secaoConversaEmAndamento}

## FLUXO DE ATENDIMENTO

### Primeiro contato
${nomeCliente
  ? primeiroContato
    ? 'Instrução de saudação definida no blocoObrigatório acima — siga exatamente.'
    : `Cliente retornando (${nomeCliente}):
Se PREFERÊNCIAS CONHECIDAS contiver serviço e o cliente pedir para agendar: chame verificarDisponibilidade IMEDIATAMENTE com o serviço preferido.
NUNCA diga "voltou" / "bem-vindo de volta" se HISTÓRICO DE SERVIÇOS estiver vazio.`
  : `Sem nome cadastrado:
Verifique se o cliente informou o nome na mensagem. Padrões: "sou o [nome]", "me chamo", "aqui é o", "meu nome é", "pode me chamar de".
Se a mensagem anterior pediu o nome e o cliente respondeu com 1-3 palavras simples: TRATE COMO NOME e chame cadastrarCliente imediatamente.
Se não detectar nome: "Como você prefere ser chamado?" — pare aqui.
Se houver frustração/reclamação: acolha primeiro, depois peça nome.`}

Pergunta direta antes do nome (novo usuário):
Se o cliente perguntar algo objetivo (localização, pagamento, preço) sem intenção de agendamento:
Responda brevemente + peça o nome: "Sim, aceitamos [X]! Como posso te chamar?"

Mensagem só com saudação ("oi", "olá", "bom dia"):
${nomeCliente
  ? `Cumprimente e pergunte como pode ajudar.`
  : `"${saudacao}! Aqui é o ${NOME_IA}, assistente de IA da ${tenant.nome}. Como você prefere ser chamado?"`}

### Agendamento

${assinaturaAtrasada ? `CLIENTE COM PLANO ATRASADO — AGENDAMENTO BLOQUEADO
NUNCA chame criarAgendamento nem verificarDisponibilidade.
Responda: "Oi ${nomeCliente || 'cliente'}. Vi que o pagamento do plano está em aberto. Para marcar, precisa regularizar com a equipe."

` : ''}Quando chamar verificarDisponibilidade SEM perguntar:
- Mensagem tem sinal temporal: "hoje", "amanhã", "essa semana", dia específico
- Expressões de semana futura: "semana que vem", "próxima semana" → calcule data ISO
- Cliente retornando COM preferências salvas
- Resposta pós-nome indica urgência: "hoje se tiver", "tem vaga?"

Quando perguntar ANTES (1 pergunta leve):
- Intenção genérica sem tempo: "quero agendar", "tem horário?"
- Pergunta ideal (escolha UMA): "Prefere vir hoje ou tem um dia em mente?" / "Manhã ou tarde fica melhor?"

Conversão de datas relativas (dataHoje = ${dataHoje}):
"amanhã" → ${dataAmanha} | "semana que vem" → segunda da próxima semana | "essa sexta" → sexta desta semana
Sempre converta para ISO (YYYY-MM-DD).
Use SEMPRE o campo inicioFormatado retornado por verificarDisponibilidade para o dia da semana. NUNCA calcule o dia por conta própria.

Sem serviço especificado e sem histórico → pergunte 1 vez: "Vai ser corte, barba ou os dois?"
Anti-loop: se já perguntou serviço e cliente respondeu outra coisa, assuma CORTE como padrão.

Combo detectado ("corte e barba", "os dois", "tudo"):
Chame verificarDisponibilidadeCombo IMEDIATAMENTE. Apresente como 1 bloco.

Agendamento para outra pessoa ("pro meu irmão"):
Pergunte nome e telefone. Cadastre com cadastrarCliente. Agende com novo clienteId.

Agendamento via site (mensagem "Olá! Escolhi pelo site:"):
Identifique serviço/profissional/horário → verificarDisponibilidade → criarAgendamento direto. Sem confirmação extra.

Apresentação do slot:
APRESENTE SEMPRE APENAS 1 SLOT. Nunca liste múltiplas opções.
Varie: "Tenho [dia] às [hora] com o [prof]. Dá certo?" / "[Dia] às [hora] — fecha?" / "Dá certo [dia] às [hora]?"

Se cliente rejeitar:
- "muito cedo" → slot com hora MAIOR ou pule para tarde
- "muito tarde" / "quero mais cedo" → slot com hora MENOR ou pule para manhã
- Rejeição genérica → próximo slot
- Todos rejeitados → "Prefere manhã ou tarde?" e verifique próximo dia
- Sem nenhum slot → "Essa semana tá disputada! Quer que eu veja a semana que vem?"

Confirmação do slot:
Sinais: "sim", "pode", "pode ser", "marca aí", "confirma", "ok", "blz", "bora", "fechou", "beleza", "serve", "👍", "✅"
→ Se há slot apresentado e não rejeitado: chame criarAgendamento IMEDIATAMENTE. NUNCA peça confirmação de confirmação.
→ Se não há slot: chame verificarDisponibilidade primeiro.
→ clienteId: ${cliente?.id || '<ID do cliente acima>'}

Após criar: SEMPRE comece com "✅ Agendado!" ou "✅ Marcado!" e varie o restante.
Chame salvarPreferenciasCliente com serviço, profissional, turno.

Erro CONFLITO_HORARIO: chame verificarDisponibilidade IMEDIATAMENTE.
"Esse horário acabou de ser preenchido! Mas tenho [próxima hora] — pode ser?"

Frases PROIBIDAS sem tool call na mesma resposta: "Deixa eu ver", "Vou checar". Se usar, a chamada DEVE estar na mesma resposta.

Tente ${dataHoje} → se vazio, ${dataAmanha} → se vazio, use sugestaoProximaData.

### Cancelamento e Remarcação

Cancelar:
buscarAgendamentosCliente → se vazio: explique + ofereça agendar → se encontrar: cancelarAgendamento.
Sucesso: "Cancelado. Quer que eu veja outro horário?"

Remarcar:
buscarAgendamentosCliente → pergunte dia/turno → verificarDisponibilidade → slot → confirma → remarcarAgendamento.
USE remarcarAgendamento — NUNCA cancelar + criar novo.

"Vou manter o horário" / "esquece, deixa como está":
Se há agendamento: "Perfeito! Fica [dia] às [hora] com o [prof]. Te espero! 👊"
Se não há: "Claro! Quando quiser agendar, é só falar."

Resposta a lembrete: "1"/"sim" = confirmarAgendamento | "2"/"não" = cancelarAgendamento → ofereça remarcar

### Pós-agendamento (vendas inteligentes)

Após criarAgendamento com sucesso, siga esta sequência de vendas (pare assim que o cliente recusar):

PASSO 1 — Serviço complementar:
- Corte agendado → "Quer aproveitar pra fazer a barba também? Consigo encaixar logo em seguida."
- Barba agendada → "Um acabamento depois da barba deixa tudo mais alinhado. Quer adicionar?"
- Sobrancelha → "Tem interesse em corte ou barba também?"
Use verificarDisponibilidade com mesmo profissional + serviço complementar + mesma data.

PASSO 2 — Combo/pacote (se pacotesAtivo e tem pacotes cadastrados):
- Se o cliente pediu 2 serviços separados: "Temos o combo [nome] por [preço] — sai mais em conta que separado."
- Apresente APENAS pacotes que incluem o serviço já agendado.

PASSO 3 — Produtos (se estoqueAtivo e tem produtos):
- Mencione 1 produto relevante ao serviço agendado:
  - Corte → "Temos pomada/cera pra manter o visual em casa. Quer dar uma olhada?"
  - Barba → "Temos óleo pra barba que ajuda a manter o shape. Interesse?"
- Não liste todos os produtos. 1 sugestão natural, 1 vez.

PASSO 4 — Fidelidade (se fidelidadeAtivo):
- Cliente novo: "Aqui cada atendimento gera pontos. Juntando [X] você ganha [benefício]. Já começa acumulando nesse!"
- Cliente com pontos: chame verificarSaldoFidelidade → "Você já tem X pontos! Faltam Y pro benefício."

${tenant.membershipsAtivo && planosMensais.length > 0
  ? `PASSO 5 — Plano mensal (se membershipsAtivo, 1 vez por conversa, só se cliente não tem plano):
- "Pra quem vem toda semana/quinzena, temos o [nome] por [preço]/mês com [benefício]. Quer ver os detalhes?"
- Se aceitar: use enviarLinkPlano.`
  : ``}

Regras de ouro das vendas:
- NUNCA insista após recusa. 1 tentativa por item.
- Seja natural, como barbeiro que conversa. Não seja vendedor insistente.
- Se o cliente disser "só isso" / "não precisa" / "tá bom assim" → encerre com calorosa.
- Priorize a experiência: o cliente veio cortar cabelo, não comprar coisas.

## FERRAMENTAS
- verificarDisponibilidade: SEMPRE antes de falar sobre horários.
- verificarDisponibilidadeCombo: 2+ serviços juntos.
- criarAgendamento / criarAgendamentoCombo: após confirmação.
- remarcarAgendamento: para trocar horário.
- buscarAgendamentosCliente: SEMPRE antes de falar sobre agendamentos.
- cadastrarCliente: nome de cliente novo ou dados de outra pessoa.
- salvarPreferenciasCliente: após agendamento.
- escalonarParaHumano: reclamações, pedido de humano, 2+ msgs sem entender.
- verificarSaldoFidelidade: SEMPRE antes de falar sobre pontos.
- ativarPlano: NUNCA ative direto pelo WhatsApp. Quando cliente quiser assinar, use enviarLinkPlano para ele ver os detalhes e assinar pelo site. Diga: "Vou te mandar o link com todos os detalhes do plano. O pagamento é feito na barbearia."
- entrarFilaEspera: ÚLTIMO recurso após 2+ datas sem vaga.
- coletarFeedback: nota NPS.
- encerrarConversa: "tchau", "vlw", "desisti".
- listarServicos / listarProfissionais: quando perguntarem.

## FAQ
"Quanto custa?" (sem serviço): "Vai ser corte, barba ou os dois?"
"Quanto custa o corte?": "O corte fica R$XX. Quer que eu já agende?"
"Tenho horário marcado?": SEMPRE chame buscarAgendamentosCliente.
"Tem plano mensal?": apresente 1 plano.
"Que horas abrem?": chame verificarDisponibilidade e use o primeiro slot.
"Onde ficam?": ${tenant.endereco ? `"Fica em ${tenant.endereco}.${tenant.linkMaps ? ` Mapa: ${tenant.linkMaps}` : ''}"` : `"Confere no perfil do nosso WhatsApp."`}
"Aceita cartão/PIX?": ${listaPagamento ? `"Aceitamos ${listaPagamento}."` : `"Confirma com a equipe."`}
"Tem sinuca/Wi-Fi/estacionamento?" ou qualquer pergunta sobre estrutura: ${listaDiferenciais.length > 0 ? `Responda com base nos diferenciais da barbearia: ${listaDiferenciais.join(', ')}. Se o que o cliente perguntou está na lista, confirme. Se NÃO está na lista: "Essa informação você confirma com a equipe."` : `"Essa informação você confirma com a equipe."`}
"Corta cabelo de criança?": ${idadeMinText ? `"Sim! ${idadeMinText}. Quer agendar?"` : `"Não fazemos corte infantil."`}
"Contato do dono" / "número do responsável": ${tenant.numeroDono ? `"Pode falar com ele pelo ${tenant.numeroDono}." — NÃO escale para humano, já tem o número.` : `"Vou te passar pra equipe." + escalonarParaHumano`}
"Tem produto pra barba/cabelo?": ${tenant.estoqueAtivo ? `Apresente 1-2 produtos relevantes do catálogo.` : `"Essa informação você confirma com a equipe."`}
"Tem combo/pacote?": ${tenant.pacotesAtivo ? `Apresente os pacotes disponíveis do catálogo com preços.` : `"Não temos combo cadastrado no momento."`}
"Como funciona a fidelidade?": ${tenant.fidelidadeAtivo ? `"Cada atendimento gera pontos. Juntando o suficiente, você troca por benefício. Quer saber seu saldo?" → chame verificarSaldoFidelidade.` : `"No momento não temos programa de fidelidade."`}

## CENÁRIOS ESPECIAIS

Reclamação ("não gostei", "ficou horrível", "péssimo"):
"Que pena ouvir isso. Vou te conectar com a equipe." → escalonarParaHumano. NÃO reagende.

"Quero falar com alguém" / "atendente":
"Claro. Vou te passar pra equipe." + escalonarParaHumano.

"Você é uma IA?":
"Sou o ${NOME_IA}, assistente virtual da ${tenant.nome}. Te ajudo com horários e agendamentos."

Modo barbeiro/demo ("sou barbeiro", "estou avaliando"):
Saia do fluxo de cliente. Responda como consultor. MANTENHA esse modo até o fim.

NPS: "1"-"5" sozinhos = nota → coletarFeedback. Nota >= 4: agradece. Nota <= 2: escala.

Mensagem incompreensível: 1 tentativa → se persistir: escalonarParaHumano.
"Obrigado" / "Tchau": resposta curta + encerrarConversa.

Fila de espera (sem vagas):
1. Use sugestaoProximaData → verificarDisponibilidade
2. Tente mais 2 dias
3. Só ofereça fila como ÚLTIMO recurso

Memória:
Leia PREFERÊNCIAS, HISTÓRICO e RETENÇÃO PROATIVA antes de responder.
Retenção proativa: mencione naturalmente, sem pressão. verificarDisponibilidade com último serviço + hoje.

== FIDELIDADE ==
${tenant.fidelidadeAtivo
  ? `ATIVA. SEMPRE chame verificarSaldoFidelidade antes de falar sobre pontos. Mencione 1 vez por conversa.`
  : `NÃO ativa. Não mencione pontos.`}

== PLANOS MENSAIS (regras de venda) ==
${tenant.membershipsAtivo && listaPlanosMensais !== 'Nenhum plano mensal ativo cadastrado.'
  ? `Quando o cliente perguntar sobre plano/mensalidade:
1. Apresente o plano com nome, preço e benefícios (dados do catálogo acima).
2. Se quiser assinar: chame enviarLinkPlano para enviar o link da página de detalhes. Diga: "Vou te mandar o link com os detalhes. O pagamento é feito na barbearia."
3. NUNCA ative o plano direto pelo WhatsApp (ativarPlano). O cliente assina pelo site ou presencialmente.
4. Pagamento: SEMPRE presencialmente na barbearia ao final do ciclo.
5. Quando o cliente com plano ativo finalizar um atendimento, informe o saldo: "Esse foi seu Xº corte do mês. Ainda restam Y no plano."`
  : 'Nenhum plano ativo. NUNCA mencione plano.'}

== FORA DO HORÁRIO ==
${tenant.mensagemForaHorario || 'A barbearia está fechada no momento. Deixe sua mensagem e a equipe retorna assim que possível.'}`
}
// ─── Executar ferramenta ──────────────────────────────────────────────────────

const executarFerramenta = async (tenantId, nomeFerramenta, parametros) => {
  try {
    switch (nomeFerramenta) {
      case 'verificarDisponibilidade': {
        // Usa profissionalId se fornecido (ex: cliente pediu profissional específico ou serviço consecutivo)
        const slots = await disponibilidadeServico.verificarDisponibilidade(tenantId, parametros)
        const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz = tenant?.timezone || 'America/Sao_Paulo'
        const horaDesejada = parseHoraDesejada(parametros.horaDesejada)

        // Quando o cliente pediu hora exata, prioriza esse horário ou o próximo depois dele.
        const disponiveis = slots
          .filter((s) => s.disponivel)
          .sort((a, b) => {
            if (horaDesejada) {
              const horarioA = obterHorarioDoIso(a.inicio, tz)
              const horarioB = obterHorarioDoIso(b.inicio, tz)
              const minutosA = horarioA?.minutos ?? 0
              const minutosB = horarioB?.minutos ?? 0
              const aDepoisDoPedido = minutosA >= horaDesejada.minutos
              const bDepoisDoPedido = minutosB >= horaDesejada.minutos

              if (aDepoisDoPedido !== bDepoisDoPedido) return aDepoisDoPedido ? -1 : 1
              if (aDepoisDoPedido && bDepoisDoPedido) return minutosA - minutosB
              return minutosB - minutosA
            }

            // Sem hora desejada, mantém o mais cedo primeiro.
            return new Date(a.inicio) - new Date(b.inicio)
          })

        // Retorna os 3 primeiros horários disponíveis — IA apresenta apenas o 1º (mais breve), reserva os outros como backup
        const formatado = disponiveis.slice(0, 3).map((s) => ({
          profissionalId: s.profissional?.id,
          profissional: s.profissional?.nome,
          inicio: s.inicio,  // ISO 8601 — usar diretamente em criarAgendamento
          inicioFormatado: formatarHorarioParaCliente(s.inicio, tz),
        }))

        if (formatado.length === 0) {
          // Tenta o dia seguinte automaticamente
          const dataAtual = new Date(`${parametros.data}T12:00:00`)
          dataAtual.setDate(dataAtual.getDate() + 1)
          const proximaData = dataAtual.toISOString().split('T')[0]
          const dataSolicitadaFormatada = formatarDataParaCliente(parametros.data, tz)
          const sugestaoProximaDataFormatada = formatarDataParaCliente(proximaData, tz)
          return {
            slots: [], total: 0, proximoHorario: null,
            mensagem: `${dataSolicitadaFormatada} sem vaga no momento. Tente ${sugestaoProximaDataFormatada}.`,
            sugestaoProximaData: proximaData,
            dataSolicitadaFormatada,
            sugestaoProximaDataFormatada,
          }
        }
        return { slots: formatado, total: disponiveis.length, proximoHorario: formatado[0] }
      }

      case 'verificarDisponibilidadeCombo': {
        const combos = await disponibilidadeServico.verificarDisponibilidadeCombo(tenantId, parametros)
        const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz = tenant?.timezone || 'America/Sao_Paulo'
        const horaDesejada = parseHoraDesejada(parametros.horaDesejada)

        const disponiveis = combos.sort((a, b) => {
          if (horaDesejada) {
            const horarioA = obterHorarioDoIso(a.inicio, tz)
            const horarioB = obterHorarioDoIso(b.inicio, tz)
            const minutosA = horarioA?.minutos ?? 0
            const minutosB = horarioB?.minutos ?? 0
            const aDepoisDoPedido = minutosA >= horaDesejada.minutos
            const bDepoisDoPedido = minutosB >= horaDesejada.minutos

            if (aDepoisDoPedido !== bDepoisDoPedido) return aDepoisDoPedido ? -1 : 1
            if (aDepoisDoPedido && bDepoisDoPedido) return minutosA - minutosB
            return minutosB - minutosA
          }

          return new Date(a.inicio) - new Date(b.inicio)
        })

        const formatado = disponiveis.slice(0, 3).map((combo) => formatarComboFerramenta(combo, tz))

        if (formatado.length === 0) {
          const dataAtual = new Date(`${parametros.data}T12:00:00`)
          dataAtual.setDate(dataAtual.getDate() + 1)
          const proximaData = dataAtual.toISOString().split('T')[0]
          const dataSolicitadaFormatada = formatarDataParaCliente(parametros.data, tz)
          const sugestaoProximaDataFormatada = formatarDataParaCliente(proximaData, tz)
          return {
            combos: [],
            total: 0,
            proximoCombo: null,
            mensagem: `${dataSolicitadaFormatada} sem vaga para o combo no momento. Tente ${sugestaoProximaDataFormatada}.`,
            sugestaoProximaData: proximaData,
            dataSolicitadaFormatada,
            sugestaoProximaDataFormatada,
          }
        }

        return { combos: formatado, total: disponiveis.length, proximoCombo: formatado[0] }
      }

      case 'criarAgendamento': {
        const ag = await agendamentosServico.criar(tenantId, { ...parametros, origem: 'WHATSAPP' })
        const tenant2 = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz2 = tenant2?.timezone || 'America/Sao_Paulo'
        const inicioFmt = formatarHorarioParaCliente(ag.inicioEm, tz2)
        // Notifica o profissional sobre o novo agendamento
        const clienteNome = ag.cliente?.nome || 'Cliente'
        notificarProfissional(tenantId, ag.profissional, `📅 Novo agendamento!\n${clienteNome} agendou ${ag.servico.nome} com você — ${inicioFmt}.\nAté lá! ✨`)
        return {
          sucesso: true,
          agendamento: {
            id: ag.id,
            inicio: ag.inicioEm,
            inicioFormatado: inicioFmt,
            servico: ag.servico.nome,
            profissional: ag.profissional.nome,
            status: ag.status,
          },
        }
      }

      case 'criarAgendamentoCombo': {
        const agendamentos = await agendamentosServico.criarCombo(tenantId, { ...parametros, origem: 'WHATSAPP' })
        const tenantCombo = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tzCombo = tenantCombo?.timezone || 'America/Sao_Paulo'

        agendamentos.forEach((agendamento) => {
          const clienteNome = agendamento.cliente?.nome || 'Cliente'
          const inicioFmt = formatarHorarioParaCliente(agendamento.inicioEm, tzCombo)
          notificarProfissional(
            tenantId,
            agendamento.profissional,
            `📅 Novo agendamento!\n${clienteNome} agendou ${agendamento.servico.nome} com você — ${inicioFmt}.\nAté lá! ✨`
          )
        })

        return {
          sucesso: true,
          agendamentos: agendamentos.map((agendamento) => ({
            id: agendamento.id,
            inicio: agendamento.inicioEm,
            inicioFormatado: formatarHorarioParaCliente(agendamento.inicioEm, tzCombo),
            servico: agendamento.servico.nome,
            profissional: agendamento.profissional.nome,
            status: agendamento.status,
          })),
        }
      }

      case 'confirmarAgendamento': {
        const ag = await agendamentosServico.confirmar(tenantId, parametros.agendamentoId)
        const tenant3 = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz3 = tenant3?.timezone || 'America/Sao_paulo'
        const inicioFmt3 = formatarHorarioParaCliente(ag.inicioEm, tz3)
        // Notifica o profissional sobre a confirmação
        notificarProfissional(tenantId, ag.profissional, `✅ Agendamento CONFIRMADO!\n${ag.cliente?.nome || 'Cliente'} confirmou ${ag.servico.nome} — ${inicioFmt3}.`)
        return {
          sucesso: true,
          agendamento: {
            id: ag.id,
            status: ag.status,
            inicioFormatado: inicioFmt3,
            servico: ag.servico.nome,
            profissional: ag.profissional.nome,
          },
        }
      }

      case 'remarcarAgendamento': {
        const ag = await agendamentosServico.remarcar(tenantId, parametros.agendamentoId, parametros.novoInicio)
        const tenant4 = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz4 = tenant4?.timezone || 'America/Sao_Paulo'
        const novoFmt = formatarHorarioParaCliente(ag.inicioEm, tz4)
        // Notifica o profissional sobre a remarcação
        notificarProfissional(tenantId, ag.profissional, `🔄 Agendamento REMARCADO!\n${ag.cliente?.nome || 'Cliente'} remarcou ${ag.servico.nome} para — ${novoFmt}.`)
        return { sucesso: true, agendamento: { id: ag.id, inicio: ag.inicioEm, inicioFormatado: novoFmt, status: ag.status } }
      }

      case 'cancelarAgendamento': {
        const ag = await agendamentosServico.cancelar(tenantId, parametros.agendamentoId, parametros.motivo)
        // Notifica o profissional sobre o cancelamento
        if (ag.profissional) {
          const tenant5 = await banco.tenant.findUnique({ where: { id: tenantId } })
          const tz5 = tenant5?.timezone || 'America/Sao_Paulo'
          const dtFmt5 = new Date(ag.inicioEm).toLocaleString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz5,
          })
          notificarProfissional(tenantId, ag.profissional, `❌ Agendamento CANCELADO!\n${ag.cliente?.nome || 'Cliente'} cancelou ${ag.servico?.nome || 'serviço'} que era em ${dtFmt5}.${parametros.motivo ? `\nMotivo: ${parametros.motivo}` : ''}`)
        }
        return { sucesso: true, cancelado: true, agendamentoId: ag.id }
      }

      case 'coletarFeedback': {
        const nota = Math.min(5, Math.max(1, Math.round(parametros.nota)))
        await banco.agendamento.update({
          where: { id: parametros.agendamentoId },
          data: {
            feedbackNota: nota,
            feedbackComentario: parametros.comentario || null,
          },
        })
        return { sucesso: true, nota, mensagem: 'Feedback registrado com sucesso.' }
      }

      case 'salvarPreferenciasCliente': {
        await banco.cliente.update({
          where: { id: parametros.clienteId },
          data: { preferencias: parametros.preferencias },
        })
        return { sucesso: true, mensagem: 'Preferências salvas.' }
      }

      case 'buscarAgendamentosCliente': {
        const { agendamentos } = await agendamentosServico.listar(tenantId, {
          clienteId: parametros.clienteId,
          status: ['AGENDADO', 'CONFIRMADO'],
          ordem: 'proximosPrimeiro',
        })
        return {
          agendamentos: agendamentos.map((a) => ({
            id: a.id,
            inicio: a.inicioEm,
            servico: a.servico.nome,
            profissional: a.profissional.nome,
            status: a.status,
          })),
        }
      }

      case 'listarServicos': {
        const servicos = await banco.servico.findMany({ where: { tenantId, ativo: true } })
        return {
          servicos: servicos.map((s) => ({
            id: s.id,
            nome: s.nome,
            duracaoMinutos: s.duracaoMinutos,
            preco: s.precoCentavos ? s.precoCentavos / 100 : null,
          })),
        }
      }

      case 'listarProfissionais': {
        const profissionais = await banco.profissional.findMany({
          where: { tenantId, ativo: true },
          include: { servicos: { include: { servico: true } } },
        })
        const filtrados = parametros.servicoId
          ? profissionais.filter((p) => p.servicos.some((ps) => ps.servicoId === parametros.servicoId))
          : profissionais
        return {
          profissionais: filtrados.map((p) => ({
            id: p.id,
            nome: p.nome,
            servicos: p.servicos.map((ps) => ps.servico.nome),
          })),
        }
      }

      case 'buscarCliente': {
        const c = await banco.cliente.findUnique({
          where: { tenantId_telefone: { tenantId, telefone: parametros.telefone } },
        })
        return { cliente: c || null, encontrado: !!c }
      }

      case 'cadastrarCliente': {
        let c = await clientesServico.buscarOuCriarPorTelefone(tenantId, parametros.telefone, parametros.nome)
        // Atualiza o nome sempre que o cliente informar um nome preferido (mesmo que já exista)
        const camposAtualizar = {}
        if (parametros.nome && c.nome !== parametros.nome) camposAtualizar.nome = parametros.nome
        // Atualiza telefone se o novo parece ser um número real (começa com 55) e o atual é um LID
        const novoTel = (parametros.telefone || '').replace(/\D/g, '')
        const telAtual = (c.telefone || '').replace(/\D/g, '')
        if (novoTel.startsWith('55') && novoTel.length >= 12 && !telAtual.startsWith('55')) {
          camposAtualizar.telefone = `+${novoTel}`
        }
        if (Object.keys(camposAtualizar).length > 0) {
          c = await clientesServico.atualizar(tenantId, c.id, camposAtualizar)
        }
        return { cliente: { id: c.id, nome: c.nome, telefone: c.telefone } }
      }

      case 'entrarFilaEspera': {
        const entrada = await filaEsperaServico.entrar(tenantId, parametros)
        return {
          sucesso: true,
          mensagem: 'Cliente adicionado à fila de espera com sucesso.',
          filaId: entrada.id,
          servico: entrada.servico?.nome,
          dataDesejada: parametros.dataDesejada,
        }
      }

      case 'verificarSaldoFidelidade': {
        const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
        if (!tenant?.fidelidadeAtivo) return { disponivel: false, mensagem: 'Programa de fidelidade não está ativo nesta barbearia.' }
        const { saldo, config } = await fidelidadeServico.obterSaldoCliente(tenantId, parametros.clienteId)
        if (!saldo) return { pontos: 0, pontosParaResgate: config?.pontosParaResgate || 10, podeResgatar: false }
        const podeResgatar = saldo.pontos >= (config?.pontosParaResgate || 10)
        return {
          pontos: saldo.pontos,
          totalGanho: saldo.totalGanho,
          pontosParaResgate: config?.pontosParaResgate || 10,
          descricaoResgate: config?.descricaoResgate || 'benefício de fidelidade',
          podeResgatar,
          faltam: podeResgatar ? 0 : (config?.pontosParaResgate || 10) - saldo.pontos,
        }
      }

      case 'ativarPlano': {
        const assinatura = await planosServico.criarAssinatura(tenantId, {
          clienteId: parametros.clienteId,
          planoAssinaturaId: parametros.planoId,
          formaPagamento: 'WHATSAPP',
          observacoes: parametros.observacoes || 'Assinado via WhatsApp pelo Don IA.',
        })
        return {
          sucesso: true,
          assinaturaId: assinatura.id,
          plano: assinatura.planoAssinatura?.nome,
          status: assinatura.status,
          mensagem: 'Plano ativado com sucesso!',
        }
      }

      case 'escalonarParaHumano':
        return { escalonado: true, mensagem: 'Conversa transferida para atendente humano.' }

      case 'encerrarConversa':
        return { encerrado: true, motivo: parametros.motivo }

      case 'enviarLinkAgendamento': {
        const tenantInfo = await banco.tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true, hashPublico: true, nome: true },
        })
        const slug = tenantInfo?.hashPublico || tenantInfo?.slug
        // Monta link com nome do cliente (sem telefone LID)
        let queryParams = ''
        if (parametros.clienteId) {
          const clienteInfo = await banco.cliente.findFirst({
            where: { id: parametros.clienteId, tenantId },
            select: { telefone: true, nome: true },
          })
          const telNorm = (clienteInfo?.telefone || '').replace(/\D/g, '')
          const telValido = telNorm.startsWith('55') && telNorm.length >= 12
          const params = []
          if (telValido) params.push(`tel=${encodeURIComponent(clienteInfo.telefone)}`)
          if (clienteInfo?.nome) params.push(`nome=${encodeURIComponent(clienteInfo.nome)}`)
          if (params.length) queryParams = `?${params.join('&')}`
        }
        const linkAgendamento = `${process.env.APP_URL || 'https://app.marcai.com.br'}/b/${slug}${queryParams}`
        const msgAcompanha = parametros.mensagem || 'Aqui está o link para você agendar diretamente:'
        return {
          sucesso: true,
          link: linkAgendamento,
          mensagemParaCliente: `${msgAcompanha}\n\n🗓️ ${linkAgendamento}`,
        }
      }

      case 'enviarLinkPlano': {
        const tenantInfo = await banco.tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true, hashPublico: true, nome: true },
        })
        const slug = tenantInfo?.hashPublico || tenantInfo?.slug
        const linkPlano = `${process.env.APP_URL || 'https://app.marcai.com.br'}/plano/${slug}`
        const msgAcompanha = parametros.mensagem || 'Aqui está o link para conhecer e assinar o plano mensal:'
        return {
          sucesso: true,
          link: linkPlano,
          mensagemParaCliente: `${msgAcompanha}\n\n👑 ${linkPlano}`,
        }
      }

      default:
        return { erro: 'Ferramenta não reconhecida' }
    }
  } catch (erro) {
    console.error(`[IA] Erro na ferramenta ${nomeFerramenta}:`, erro)
    return { erro: erro.mensagem || String(erro), codigo: erro.codigo }
  }
}

// ─── Resumo automático da conversa ────────────────────────────────────────────
// Gera um resumo breve e salva em cliente.preferencias ao encerrar a conversa.
// Isso garante que na próxima sessão a IA saiba o que ficou pendente ou combinado.

const gerarESalvarResumo = async (tenantId, clienteId, mensagensIA) => {
  try {
    // Extrai apenas trocas visíveis (user↔assistant), ignora tool_calls técnicos
    const trocas = mensagensIA
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Don'}: ${m.content}`)
      .join('\n')

    if (!trocas || trocas.length < 30) return // conversa muito curta, não vale resumir

    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'Gere um resumo de 1 a 2 frases sobre esta conversa de barbearia, incluindo: (1) o que o cliente queria, (2) o que foi resolvido ou ficou pendente. Foque em ações concretas (serviço, horário, profissional). Seja direto e objetivo.',
        },
        { role: 'user', content: trocas },
      ],
    })

    const resumo = res.choices[0]?.message?.content?.trim()
    if (!resumo) return

    const cliente = await banco.cliente.findUnique({ where: { id: clienteId } })
    const prefAnterior = typeof cliente?.preferencias === 'string' ? cliente.preferencias.trim() : ''

    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    // Acumula histórico (mais recente no topo), limita a 1500 chars para não explodir o contexto
    const novasPref = `[${agora}] ${resumo}\n${prefAnterior}`.trim().substring(0, 1500)

    await banco.cliente.update({ where: { id: clienteId }, data: { preferencias: novasPref } })

    console.log(`[IA] Resumo salvo para cliente ${clienteId}:`, resumo)
  } catch (err) {
    console.warn('[IA] Falha ao gerar resumo da conversa (sem impacto):', err.message)
  }
}

// ─── Reconstruir histórico com tool calls ─────────────────────────────────────
// O campo remetente pode ser: 'cliente' | 'ia' | 'sistema' | 'tool_call' | 'tool_result' | 'humano:xxx'
// tool_call e tool_result são persistidos para manter contexto entre turnos

const reconstruirHistorico = (mensagens) => {
  return mensagens
    .filter((m) => m.remetente !== 'sistema' && !m.remetente.startsWith('nota_interna:'))
    .map((m) => {
      if (m.remetente === 'tool_call') {
        // Mensagem do assistente com tool_calls — restaura o objeto OpenAI completo
        return JSON.parse(m.conteudo)
      }
      if (m.remetente === 'tool_result') {
        // Resultado de uma tool call — restaura no formato OpenAI
        const data = JSON.parse(m.conteudo)
        return { role: 'tool', tool_call_id: data.tool_call_id, content: data.content }
      }
      if (m.remetente === 'ia') {
        return { role: 'assistant', content: m.conteudo }
      }
      if (m.remetente.startsWith('humano:')) {
        // Mensagem de atendente humano mostrada como assistente no contexto
        return { role: 'assistant', content: `[Atendente]: ${m.conteudo}` }
      }
      // 'cliente' e qualquer outro → user
      return { role: 'user', content: m.conteudo }
    })
}

const normalizarTextoIntencao = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ehPerguntaSobreIdentidadeDaIA = (textoNormalizado) => {
  if (!textoNormalizado) return false

  const padroes = [
    /\b(?:voce|voc|vc|tu|isso)\s+(?:e|eh)\s+(?:uma\s+)?(?:ia|inteligencia artificial|robo|rob|bot|humano)\b/,
    /\b(?:e|eh)\s+(?:um|uma\s+)?(?:robo|rob|bot|humano|ia)\b/,
    /\bfalo\s+com\s+(?:um|uma\s+)?(?:robo|bot|humano|ia)\b/,
    /\bquem\s+esta\s+falando\b/,
  ]

  return padroes.some((padrao) => padrao.test(textoNormalizado))
}

const ehBarbeiroAvaliandoSistema = (textoNormalizado) => {
  if (!textoNormalizado) return false

  const mencionaPerfilDeNegocio = /\b(barbeiro|dono|proprietario|tenho uma barbearia|minha barbearia)\b/.test(textoNormalizado)
  const mencionaAvaliacaoOuDemo = /\b(avaliando|testando|vendo|conhecer|conhecendo|quero ver|quero entender|como funciona|funciona mesmo|esse sistema|esta plataforma)\b/.test(textoNormalizado)

  return (
    /\bsou\s+(?:o\s+)?barbeiro\b/.test(textoNormalizado)
    || /\bsou\s+(?:o\s+)?dono\b/.test(textoNormalizado)
    || (mencionaPerfilDeNegocio && mencionaAvaliacaoOuDemo)
    || /\bbarbeiro\b.*\b(?:avaliando|testando|vendo|sistema|plataforma)\b/.test(textoNormalizado)
  )
}

const ehPedidoDiretoDeHumano = (textoNormalizado) => {
  if (!textoNormalizado) return false

  return [
    /\bfala com humano\b/,
    /\bquero falar com (?:alguem|alguém|uma pessoa)\b/,
    /\bme passa pra (?:alguem|alguém|uma pessoa|o atendente|um atendente)\b/,
    /\bquero falar com o atendente\b/,
    /\bquero falar com uma pessoa\b/,
    /\batendente humano\b/,
    /\bme transfere\b/,
  ].some((padrao) => padrao.test(textoNormalizado))
}

const ehPedidoMaisTarde = (textoNormalizado) => (
  /\bmais tarde\b/.test(textoNormalizado)
  || /\bmais pro fim\b/.test(textoNormalizado)
  || /\bmais para o fim\b/.test(textoNormalizado)
  || /\bdepois\b/.test(textoNormalizado)
)

const ehPedidoOutroHorario = (textoNormalizado) => (
  /\boutro horario\b/.test(textoNormalizado)
  || /\boutro horario tem\b/.test(textoNormalizado)
  || /\btem outro\b/.test(textoNormalizado)
  || /\bme da outro\b/.test(textoNormalizado)
  || /\bquero outro\b/.test(textoNormalizado)
  || /\bnao esse\b/.test(textoNormalizado)
  || /\bn esse\b/.test(textoNormalizado)
  || /\bnao nesse\b/.test(textoNormalizado)
  || /\bn nesse horario\b/.test(textoNormalizado)
)

const ehConfirmacaoExplicita = (textoNormalizado) => (
  /\b(sim|s|pode|pode ser|confirmo|confirmamos|fechou|fechado|ok|beleza|blz|bora|perfeito|quero esse|esse mesmo)\b/.test(textoNormalizado)
)

const ehRefinoDeHorarioSemConfirmacao = (textoNormalizado) => {
  if (!textoNormalizado || ehConfirmacaoExplicita(textoNormalizado)) return false

  return [
    /^hj$/,
    /^hoje$/,
    /^amanha$/,
    /^de manha$/,
    /^manha$/,
    /^de tarde$/,
    /^tarde$/,
    /^a noite$/,
    /^noite$/,
    /^\d{1,2}$/,
    /^\d{1,2}:\d{2}$/,
    /^\d{1,2}h(\d{2})?$/,
    /^(?:as|a)\s*\d{1,2}(?::\d{2}|h\d{2}|h)?$/,
    /^depois das\s+\d{1,2}$/,
    /^antes das\s+\d{1,2}$/,
  ].some((padrao) => padrao.test(textoNormalizado))
}

const responderSemFerramentas = async ({ mensagens, instrucoesAdicionais, systemPromptOverride, maxTokensOverride }) => {
  const mensagensSemSistemaOriginal = mensagens.filter((mensagem) => mensagem.role !== 'system')
  const resposta = await openai.chat.completions.create({
    model: configIA.modelo,
    max_tokens: maxTokensOverride || configIA.maxTokens,
    messages: systemPromptOverride
      ? [
          { role: 'system', content: systemPromptOverride },
          ...mensagensSemSistemaOriginal,
        ]
      : instrucoesAdicionais
        ? [
            mensagens[0],
            { role: 'system', content: instrucoesAdicionais },
            ...mensagens.slice(1),
          ]
        : mensagens,
  })

  return resposta.choices[0]?.message?.content?.trim() || fallbackAleatorio()
}

const extrairHorariosDaMensagem = (textoNormalizado = '') => {
  const encontrados = new Map()
  const adicionarHorario = (horaStr, minutoStr = '0') => {
    const hora = Number(horaStr)
    const minuto = Number(minutoStr || '0')
    if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return
    const minutos = hora * 60 + minuto
    if (!encontrados.has(minutos)) {
      encontrados.set(minutos, { hora, minuto, minutos })
    }
  }

  for (const match of textoNormalizado.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) {
    adicionarHorario(match[1], match[2])
  }

  for (const match of textoNormalizado.matchAll(/\b(\d{1,2})h(\d{2})?\b/g)) {
    adicionarHorario(match[1], match[2])
  }

  for (const match of textoNormalizado.matchAll(/\b(?:as|a|pra|para|depois das|antes das|por volta das|tipo)\s*(\d{1,2})(?:h(\d{2})?)?\b/g)) {
    adicionarHorario(match[1], match[2])
  }

  for (const match of textoNormalizado.matchAll(/\b(\d{1,2})\s+e\s+meia\b/g)) {
    adicionarHorario(match[1], '30')
  }

  for (const match of textoNormalizado.matchAll(/\b(\d{1,2})\s+e\s+pouco\b/g)) {
    adicionarHorario(match[1], '01')
  }

  return Array.from(encontrados.values())
}

const obterHoraDesejadaDaMensagem = (textoNormalizado = '') => {
  const horario = extrairHorariosDaMensagem(textoNormalizado)[0]
  if (!horario) return null

  return `${String(horario.hora).padStart(2, '0')}:${String(horario.minuto).padStart(2, '0')}`
}

const obterHoraDesejadaPorTurno = (textoNormalizado = '') => {
  if (/\bde manha\b|\bmanha\b/.test(textoNormalizado)) return '09:00'
  if (/\bde tarde\b|\btarde\b/.test(textoNormalizado)) return '12:00'
  if (/\ba noite\b|\bnoite\b/.test(textoNormalizado)) return '18:00'
  return null
}

const obterDataIsoNoFuso = (data, timeZone) => obterPartesDataHorario(data, timeZone).dataIsoLocal

const obterDataDesejadaDaMensagem = (textoNormalizado = '', timeZone) => {
  const agora = new Date()
  if (/\bhj\b|\bhoje\b/.test(textoNormalizado)) return obterDataIsoNoFuso(agora, timeZone)

  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  if (/\bamanha\b/.test(textoNormalizado)) return obterDataIsoNoFuso(amanha, timeZone)

  const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  const diaPedido = diasSemana.find((dia) => new RegExp(`\\b${dia}\\b`).test(textoNormalizado))
  if (!diaPedido) return null

  for (let offset = 0; offset < 7; offset += 1) {
    const candidato = new Date(agora)
    candidato.setDate(candidato.getDate() + offset)
    const diaFormatado = normalizarTextoIntencao(new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      timeZone,
    }).format(candidato))

    if (diaFormatado === diaPedido) {
      return obterDataIsoNoFuso(candidato, timeZone)
    }
  }

  return null
}

const formatarHorarioCurto = ({ hora, minuto }) => (
  minuto ? `${hora}h${String(minuto).padStart(2, '0')}` : `${hora}h`
)

const obterPartesDataHorario = (data, timeZone) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(data)

  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value || ''

  return {
    ano: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora: valor('hour'),
    minuto: valor('minute'),
    dataIsoLocal: `${valor('year')}-${valor('month')}-${valor('day')}`,
  }
}

const formatarHorarioParaCliente = (inicio, timeZone) => {
  const data = inicio instanceof Date ? inicio : new Date(inicio)
  const agora = new Date()
  const partesAlvo = obterPartesDataHorario(data, timeZone)
  const partesAgora = obterPartesDataHorario(agora, timeZone)

  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  const partesAmanha = obterPartesDataHorario(amanha, timeZone)

  const horaHoje = Number(partesAlvo.minuto) === 0
    ? `${Number(partesAlvo.hora)}h`
    : `${Number(partesAlvo.hora)}h${partesAlvo.minuto}`

  const horaOutroDia = `${partesAlvo.hora}:${partesAlvo.minuto} horas`

  if (partesAlvo.dataIsoLocal === partesAgora.dataIsoLocal) {
    return `hoje às ${horaHoje}`
  }

  if (partesAlvo.dataIsoLocal === partesAmanha.dataIsoLocal) {
    return `amanhã às ${horaOutroDia}`
  }

  const diaSemana = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone,
  }).format(data)

  return `${diaSemana} às ${horaOutroDia}`
}

const formatarDataParaCliente = (dataIso, timeZone) => {
  const data = new Date(`${dataIso}T12:00:00`)
  const agora = new Date()
  const partesAlvo = obterPartesDataHorario(data, timeZone)
  const partesAgora = obterPartesDataHorario(agora, timeZone)

  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  const partesAmanha = obterPartesDataHorario(amanha, timeZone)

  if (partesAlvo.dataIsoLocal === partesAgora.dataIsoLocal) return 'hoje'
  if (partesAlvo.dataIsoLocal === partesAmanha.dataIsoLocal) return 'amanhã'

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone,
  }).format(data)
}

const parseHoraDesejada = (horaDesejada) => {
  if (!horaDesejada) return null
  const match = String(horaDesejada).trim().match(/^(\d{1,2})(?::|h)?(\d{2})?$/i)
  if (!match) return null

  const hora = Number(match[1])
  const minuto = Number(match[2] || '0')
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null

  return { hora, minuto, minutos: (hora * 60) + minuto }
}

const obterHorarioDoIso = (inicioIso, timeZone) => {
  if (!inicioIso) return null
  const partes = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(new Date(inicioIso))

  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value || '0')
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value || '0')
  return { hora, minuto, minutos: (hora * 60) + minuto }
}

const analisarPedidoDeHorarioDiferente = (mensagemNormalizada, inicioIso, timeZone) => {
  const horariosCitados = extrairHorariosDaMensagem(mensagemNormalizada)
  if (!horariosCitados.length || !inicioIso) return null

  const horarioOferecido = obterHorarioDoIso(inicioIso, timeZone)
  if (!horarioOferecido) return null

  const horarioDiferente = horariosCitados.find((horario) => horario.minutos !== horarioOferecido.minutos)
  if (!horarioDiferente) return null

  return { horarioOferecido, horarioPedido: horarioDiferente }
}

const formatarSlotFerramenta = (slot, timeZone) => {
  return {
    profissionalId: slot.profissional?.id,
    profissional: slot.profissional?.nome,
    inicio: slot.inicio,
    inicioFormatado: formatarHorarioParaCliente(slot.inicio, timeZone),
  }
}

const formatarComboFerramenta = (combo, timeZone) => ({
  profissionalId: combo.profissional?.id,
  profissional: combo.profissional?.nome,
  inicio: combo.inicio,
  inicioFormatado: formatarHorarioParaCliente(combo.inicio, timeZone),
  fim: combo.fim,
  fimFormatado: formatarHorarioParaCliente(combo.fim, timeZone),
  servicos: (combo.servicos || []).map((etapa) => ({
    servicoId: etapa.servicoId,
    servico: etapa.servico?.nome || etapa.servico,
    inicio: etapa.inicio,
    inicioFormatado: formatarHorarioParaCliente(etapa.inicio, timeZone),
    fim: etapa.fim,
    fimFormatado: formatarHorarioParaCliente(etapa.fim, timeZone),
  })),
  totalDuracaoMinutos: combo.totalDuracaoMinutos,
  totalPrecoCentavos: combo.totalPrecoCentavos,
  totalPrecoFormatado: formatarMoedaPrompt(combo.totalPrecoCentavos),
})

const obterContextoFerramentaDeHorario = async (tenantId, nomeFerramenta, parametros) => {
  if (nomeFerramenta === 'criarAgendamento') {
    return {
      servicoId: parametros.servicoId,
      profissionalId: parametros.profissionalId,
      inicioIso: parametros.inicio,
    }
  }

  if (nomeFerramenta === 'criarAgendamentoCombo') {
    return {
      servicoId: Array.isArray(parametros.servicoIds) ? parametros.servicoIds[0] : null,
      profissionalId: parametros.profissionalId,
      inicioIso: parametros.inicio,
    }
  }

  if (nomeFerramenta === 'remarcarAgendamento') {
    const agendamento = await banco.agendamento.findUnique({
      where: { id: parametros.agendamentoId },
      select: { servicoId: true, profissionalId: true },
    })

    if (!agendamento) return null

    return {
      servicoId: agendamento.servicoId,
      profissionalId: agendamento.profissionalId,
      inicioIso: parametros.novoInicio,
    }
  }

  return null
}

const bloquearConfirmacaoDeHorarioAntigo = async ({
  tenantId,
  tenant,
  nomeFerramenta,
  parametros,
  mensagemNormalizada,
}) => {
  if (!['criarAgendamento', 'criarAgendamentoCombo', 'remarcarAgendamento'].includes(nomeFerramenta)) return null

  const contexto = await obterContextoFerramentaDeHorario(tenantId, nomeFerramenta, parametros)
  if (!contexto?.inicioIso) return null

  const timeZone = tenant.timezone || 'America/Sao_Paulo'
  const horarioOferecido = obterHorarioDoIso(contexto.inicioIso, timeZone)
  if (!horarioOferecido) return null

  const analise = analisarPedidoDeHorarioDiferente(
    mensagemNormalizada,
    contexto.inicioIso,
    timeZone
  )

  const pediuAlternativaSemHorarioExplicito = !analise
    && (ehPedidoOutroHorario(mensagemNormalizada) || ehPedidoMaisTarde(mensagemNormalizada))
  const refinouHorarioSemConfirmar = !analise
    && !pediuAlternativaSemHorarioExplicito
    && ehRefinoDeHorarioSemConfirmacao(mensagemNormalizada)

  if (!analise && !pediuAlternativaSemHorarioExplicito && !refinouHorarioSemConfirmar) return null

  const resultado = {
    erro: refinouHorarioSemConfirmar ? 'CLIENTE_AINDA_NAO_CONFIRMOU' : 'CLIENTE_PEDIU_OUTRO_HORARIO',
    mensagem: refinouHorarioSemConfirmar
      ? `O cliente AINDA NAO confirmou ${formatarHorarioCurto(horarioOferecido)}. Ele apenas refinou o dia/horario. Nao conclua o agendamento ainda.`
      : analise
      ? `O cliente NAO confirmou ${formatarHorarioCurto(analise.horarioOferecido)}. Ele pediu ${formatarHorarioCurto(analise.horarioPedido)}. Nao conclua o horario anterior.`
      : `O cliente NAO confirmou ${formatarHorarioCurto(horarioOferecido)}. Ele pediu outro horario. Nao conclua o horario anterior.`,
    horarioAnterior: formatarHorarioCurto(analise?.horarioOferecido || horarioOferecido),
    horarioPedido: analise ? formatarHorarioCurto(analise.horarioPedido) : null,
    instrucao: refinouHorarioSemConfirmar
      ? 'Reapresente um slot real alinhado ao dia/horario informado e aguarde confirmacao explicita. Nao crie nem remarque ainda.'
      : analise
      ? 'Se o horario pedido existir, ofereca esse horario e aguarde confirmacao explicita. Se nao existir, ofereca o proximo slot disponivel. Nao confirme nem remarque o horario anterior.'
      : 'Ofereca o proximo slot disponivel depois do horario recusado e aguarde confirmacao explicita. Nao confirme nem remarque o horario anterior.',
  }

  if (!contexto.servicoId) return resultado

  const data = contexto.inicioIso.split('T')[0]
  const slots = await disponibilidadeServico.verificarDisponibilidade(tenantId, {
    profissionalId: contexto.profissionalId,
    servicoId: contexto.servicoId,
    data,
  })

  const disponiveis = slots
    .filter((slot) => slot.disponivel)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))

  const slotPedido = disponiveis.find((slot) => {
    if (!analise) return false
    const horarioSlot = obterHorarioDoIso(slot.inicio, timeZone)
    return horarioSlot?.minutos === analise.horarioPedido.minutos
  })

  const proximosSlots = analise
    ? disponiveis.slice(0, 3)
    : disponiveis.filter((slot) => {
        const horarioSlot = obterHorarioDoIso(slot.inicio, timeZone)
        return horarioSlot?.minutos > horarioOferecido.minutos
      }).slice(0, 3)

  return {
    ...resultado,
    horarioPedidoDisponivel: !!slotPedido,
    slotPedido: slotPedido ? formatarSlotFerramenta(slotPedido, timeZone) : null,
    proximosSlots: proximosSlots.map((slot) => formatarSlotFerramenta(slot, timeZone)),
  }
}

const obterUltimoResultadoDisponibilidade = (mensagens = []) => {
  for (let i = mensagens.length - 1; i >= 0; i -= 1) {
    const mensagem = mensagens[i]
    if (mensagem.remetente !== 'tool_result') continue

    try {
      const payload = JSON.parse(mensagem.conteudo)
      if (payload?.name !== 'verificarDisponibilidade' || !payload?.content) continue
      return JSON.parse(payload.content)
    } catch (_) {
      continue
    }
  }

  return null
}

const obterHoraDesejadaParaMaisTarde = (resultadoDisponibilidadeAnterior, timeZone) => {
  const inicioAnterior = resultadoDisponibilidadeAnterior?.proximoHorario?.inicio
  if (!inicioAnterior) return null

  const horarioAnterior = obterHorarioDoIso(inicioAnterior, timeZone)
  if (!horarioAnterior) return null

  const minutosDepois = Math.min((horarioAnterior.minutos + 1), 23 * 60 + 59)
  const hora = String(Math.floor(minutosDepois / 60)).padStart(2, '0')
  const minuto = String(minutosDepois % 60).padStart(2, '0')

  return `${hora}:${minuto}`
}

// ─── Processar mensagem ───────────────────────────────────────────────────────

const processarMensagem = async (tenantId, clienteId, conversaId, mensagemCliente) => {
  const [tenant, cliente, mensagens, conversa] = await Promise.all([
    banco.tenant.findUnique({ where: { id: tenantId } }),
    banco.cliente.findUnique({ where: { id: clienteId } }),
    banco.mensagem.findMany({
      where: { conversaId },
      orderBy: { criadoEm: 'asc' },
      // Sem limite — lê toda a conversa para contexto completo do cliente
    }),
    banco.conversa.findUnique({ where: { id: conversaId }, select: { modoBarbeiro: true } }),
  ])

  if (!tenant) throw { status: 404, mensagem: 'Tenant não encontrado' }

  // Contexto de conversa anterior: quando esta é uma nova conversa (sem histórico),
  // carrega as últimas mensagens da conversa anterior do mesmo cliente para manter continuidade
  let mensagensContextoAnterior = []
  if (mensagens.length === 0 && clienteId) {
    const conversaAnterior = await banco.conversa.findFirst({
      where: {
        tenantId,
        clienteId,
        id: { not: conversaId },
      },
      orderBy: { atualizadoEm: 'desc' },
      include: {
        mensagens: {
          where: { remetente: { in: ['cliente', 'ia'] } }, // apenas msgs visíveis (sem tool_calls técnicos)
          orderBy: { criadoEm: 'asc' },
          take: 20,
        },
      },
    })
    if (conversaAnterior?.mensagens?.length) {
      mensagensContextoAnterior = conversaAnterior.mensagens
    }
  }

  // primeiroContato = true SOMENTE quando o cliente nunca conversou antes (sem sessões anteriores e sem preferências)
  // Nova sessão de cliente conhecido (conversa encerrada/expirada) → primeiroContato = false → modo proativo
  const temContextoAnterior = mensagensContextoAnterior.length > 0
  const temPreferencias = !!cliente?.preferencias
  const primeiroContato = mensagens.length === 0 && !temContextoAnterior && !temPreferencias

  const systemPrompt = await montarSystemPrompt(tenant, cliente, primeiroContato, mensagemCliente, mensagens.length > 0)

  // Salva mensagem do cliente
  await banco.mensagem.create({
    data: { conversaId, remetente: 'cliente', conteudo: mensagemCliente },
  })

  // Reconstrói histórico: contexto anterior (se houver) + mensagens da conversa atual
  const historicoMensagens = [
    ...reconstruirHistorico(mensagensContextoAnterior),
    ...reconstruirHistorico(mensagens),
  ]

  let mensagensIA = [
    { role: 'system', content: systemPrompt },
    ...historicoMensagens,
    { role: 'user', content: mensagemCliente },
  ]

  let respostaFinal = ''
  let escalonado = false
  let encerrado = false
  const mensagemNormalizada = normalizarTextoIntencao(mensagemCliente)
  const ultimoResultadoDisponibilidade = obterUltimoResultadoDisponibilidade(mensagens)
  const timeZone = tenant.timezone || 'America/Sao_Paulo'
  const dataDesejadaDaMensagem = obterDataDesejadaDaMensagem(mensagemNormalizada, timeZone)
  const horaDesejadaDaMensagem = obterHoraDesejadaDaMensagem(mensagemNormalizada)
  const horaDesejadaPorTurno = obterHoraDesejadaPorTurno(mensagemNormalizada)
  const horaDesejadaParaAlternativa = (ehPedidoMaisTarde(mensagemNormalizada) || ehPedidoOutroHorario(mensagemNormalizada))
    ? obterHoraDesejadaParaMaisTarde(ultimoResultadoDisponibilidade, timeZone)
    : null
  const clientePerguntouSobreIdentidadeDaIA = ehPerguntaSobreIdentidadeDaIA(mensagemNormalizada)
  // Modo barbeiro: detectado nesta mensagem OU persistido de mensagem anterior na mesma conversa
  const barbeiroDetectadoAgora = ehBarbeiroAvaliandoSistema(mensagemNormalizada)
  const barbeiroAvaliandoSistema = barbeiroDetectadoAgora || Boolean(conversa?.modoBarbeiro)
  // Persistir modo barbeiro na conversa quando detectado pela primeira vez
  if (barbeiroDetectadoAgora && !conversa?.modoBarbeiro) {
    await banco.conversa.update({ where: { id: conversaId }, data: { modoBarbeiro: true } })
  }
  const pedidoDiretoDeHumano = ehPedidoDiretoDeHumano(mensagemNormalizada)
  const responderDiretoSemFerramentas = barbeiroAvaliandoSistema || clientePerguntouSobreIdentidadeDaIA

  if (pedidoDiretoDeHumano) {
    escalonado = true

    await banco.conversa.update({
      where: { id: conversaId },
      data: { status: 'ESCALONADA', motivoEscalacao: 'Cliente pediu atendimento humano.' },
    })

    respostaFinal = 'Claro. Vou te passar para a equipe agora.'

    await banco.mensagem.create({
      data: { conversaId, remetente: 'ia', conteudo: respostaFinal },
    })

    await banco.mensagem.create({
      data: { conversaId, remetente: 'sistema', conteudo: 'Conversa escalonada para atendente humano por pedido direto do cliente.' },
    })

    return { resposta: respostaFinal, escalonado: true, encerrado: false }
  }

  if (responderDiretoSemFerramentas) {
    const systemPromptDireto = barbeiroAvaliandoSistema
      ? `Você é ${NOME_IA}, assistente de gestão da barbearia ${tenant.nome}. Um dono ou barbeiro está avaliando o sistema Marcaí para contratar.
Responda com linguagem de negócio — direto, sem chatbot, como um consultor que entende de barbearia.
Estrutura ideal (adapte ao que foi perguntado, sem ser rígido):
1. Confirme que resolve o problema deles (máximo 1 frase, específica)
2. Maior benefício concreto: "você atende o cliente enquanto o Don agenda pelo WhatsApp automaticamente"
3. Diferencial que salva dinheiro: "lembretes automáticos 1h antes reduzem no-show sem você fazer nada"
4. CTA com pergunta engajante: "Qual a sua maior dor hoje — agenda bagunçada ou cliente que some?" / "Você já calculou quanto perde por mês com no-show?"
IMPORTANTE:
- Nunca corte a resposta no meio de uma frase. Complete sempre todos os pensamentos.
- Máximo 5 linhas, sem bullet points excessivos, sem emoji.
- Se perguntarem sobre preço/plano: "Os planos variam por tamanho da equipe — posso te mostrar como funciona na prática primeiro, quer testar agora?"
- Se quiserem demonstração: "Manda uma mensagem como se fosse um cliente seu — eu mostro como o Don responde."
- Mencione números reais quando possível: "barbearia média economiza 2-3h/dia só em confirmações pelo WhatsApp"`
      : `Você é ${NOME_IA}, assistente virtual da barbearia ${tenant.nome}.
Responda em 2 frases curtas, sem saudação longa, sem emoji e sem parecer roteiro.
Se perguntarem se você é IA, robô ou humano: seja transparente e seguro. Exemplo: "Sou o ${NOME_IA}, assistente virtual da ${tenant.nome}. Cuido de horários, agendamentos e dúvidas — no que posso te ajudar?"
NUNCA corte a resposta no meio. Complete sempre a frase.`

    respostaFinal = await responderSemFerramentas({
      mensagens: mensagensIA,
      systemPromptOverride: systemPromptDireto,
      maxTokensOverride: barbeiroAvaliandoSistema ? 800 : undefined,
    })

    await banco.mensagem.create({
      data: { conversaId, remetente: 'ia', conteudo: respostaFinal },
    })

    await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })

    return { resposta: respostaFinal, escalonado: false, encerrado: false }
  }

  // Loop de function calling — continua até o modelo retornar texto
  let iteracoesTransicao = 0
  while (true) {
    const resposta = await openai.chat.completions.create({
      model: configIA.modelo,
      max_tokens: configIA.maxTokens,
      tools: ferramentas,
      tool_choice: 'auto',
      messages: mensagensIA,
      // Desabilita thinking do Gemini 2.5 Flash para evitar raciocínio interno vazar ao cliente
      ...(configIA.thinkingBudget === 0 ? { extra_body: { thinking_config: { thinking_budget: 0 } } } : {}),
    })

    const mensagemAssistente = resposta.choices[0].message
    const toolCalls = mensagemAssistente.tool_calls

    if (toolCalls && toolCalls.length > 0) {
      mensagensIA.push(mensagemAssistente)

      // Persiste tool_call no banco — essencial para contexto no próximo turno
      await banco.mensagem.create({
        data: { conversaId, remetente: 'tool_call', conteudo: JSON.stringify(mensagemAssistente) },
      })

      for (const toolCall of toolCalls) {
        const parametros = JSON.parse(toolCall.function.arguments)
        // Injeta clienteId automaticamente em enviarLinkAgendamento para montar link com tel e nome
        if (toolCall.function.name === 'enviarLinkAgendamento' && clienteId && !parametros.clienteId) {
          parametros.clienteId = clienteId
        }
        if (['verificarDisponibilidade', 'verificarDisponibilidadeCombo'].includes(toolCall.function.name)) {
          if (dataDesejadaDaMensagem && parametros.data !== dataDesejadaDaMensagem) {
            parametros.data = dataDesejadaDaMensagem
          }
          if (!parametros.horaDesejada) {
            parametros.horaDesejada = horaDesejadaDaMensagem || horaDesejadaPorTurno || horaDesejadaParaAlternativa || undefined
          }
          toolCall.function.arguments = JSON.stringify(parametros)
        }
        const resultadoBloqueado = await bloquearConfirmacaoDeHorarioAntigo({
          tenantId,
          tenant,
          nomeFerramenta: toolCall.function.name,
          parametros,
          mensagemNormalizada,
        })
        const resultado = resultadoBloqueado || await executarFerramenta(tenantId, toolCall.function.name, parametros)
        const resultadoStr = JSON.stringify(resultado)

        // Ações especiais
        if (toolCall.function.name === 'escalonarParaHumano' && !resultadoBloqueado) {
          escalonado = true
          await banco.conversa.update({
            where: { id: conversaId },
            data: { status: 'ESCALONADA', motivoEscalacao: parametros.motivo },
          })
        }

        if (toolCall.function.name === 'encerrarConversa' && !resultadoBloqueado) {
          encerrado = true
          await banco.conversa.update({ where: { id: conversaId }, data: { status: 'ENCERRADA' } })
          await banco.mensagem.create({
            data: { conversaId, remetente: 'sistema', conteudo: 'Conversa encerrada pela IA.' },
          })
        }

        mensagensIA.push({ role: 'tool', tool_call_id: toolCall.id, content: resultadoStr })

        // Persiste tool_result no banco — essencial para contexto no próximo turno
        await banco.mensagem.create({
          data: {
            conversaId,
            remetente: 'tool_result',
            conteudo: JSON.stringify({ tool_call_id: toolCall.id, name: toolCall.function.name, content: resultadoStr }),
          },
        })
      }
      continue
    }

    // Modelo retornou texto — verificar se é frase de transição sem tool call
    const textoRetornado = mensagemAssistente.content || ''
    const textoLower = textoRetornado.toLowerCase()
    const FRASES_TRANSICAO_PROIBIDAS = [
      'deixa eu ver', 'vou checar', 'vou verificar', 'deixa eu checar',
      'vou ver', 'vou olhar', 'um momento', 'só um segundo',
      'deixa eu consultar', 'vou consultar',
    ]
    const ehFraseTransicao = FRASES_TRANSICAO_PROIBIDAS.some((f) => textoLower.includes(f))

    if (ehFraseTransicao && iteracoesTransicao < 2) {
      // Modelo anunciou verificação mas não chamou ferramenta — forçar continuação
      iteracoesTransicao++
      mensagensIA.push(mensagemAssistente)
      mensagensIA.push({
        role: 'user',
        content: '[Sistema: você anunciou uma verificação mas não chamou a ferramenta. Chame verificarDisponibilidade AGORA com os dados do contexto da conversa. NÃO escreva mais texto de transição.]',
      })
      continue
    }

    // Fim do loop — resposta final
    respostaFinal = limparRaciocinio(textoRetornado || fallbackAleatorio())
    break
  }

  // Garante mensagem adequada quando escalado para humano
  if (escalonado && respostaFinal) {
    const temFraseEscalacao = /equipe|atendente|conectar|transferir/i.test(respostaFinal)
    if (!temFraseEscalacao) {
      respostaFinal = 'Que pena ouvir isso. Vou te conectar com a equipe agora para resolver.'
    }
  }

  // Auto-append link de agendamento
  const appUrl = process.env.APP_URL || 'https://app.marcai.com.br'
  const linkSite = `${appUrl}/b/${tenant.hashPublico || tenant.slug}`
  if (respostaFinal && !respostaFinal.includes(linkSite) && !respostaFinal.includes('🗓️')) {
    const ehConfirmacao = respostaFinal.includes('✅ Agendado') || respostaFinal.includes('✅ Marcado')
    const ehEscalacao = respostaFinal.includes('equipe agora') || escalonado
    const linkJaEnviado = mensagens.some(m => m.conteudo?.includes('🗓️'))

    if (!ehConfirmacao && !ehEscalacao && !linkJaEnviado) {
      // Detecta se a IA está sugerindo um horário (oferecendo slot)
      const sugerindoHorario = /pode ser\??|dá certo\??|fecha\??|te serve\??|fica bom\??|quer esse\??|que tal\??|topa\??|serve pra voc/i.test(respostaFinal)

      if (sugerindoHorario) {
        // Sugeriu horário — link como alternativa para ver outros
        respostaFinal += `\n\nSe quiser conferir outros horários, é só acessar:\n🗓️ ${linkSite}`
      }
    }
  }

  // Auto-append link de plano quando a IA menciona plano/assinar
  if (respostaFinal && tenant.membershipsAtivo) {
    const falaSobrePlano = /plano|mensal|assinar|assinatura|link.*detalhes/i.test(respostaFinal)
    const linkPlano = `${appUrl}/plano/${tenant.hashPublico || tenant.slug}`
    const planoJaEnviado = respostaFinal.includes(linkPlano) || respostaFinal.includes('/plano/') || mensagens.some(m => m.conteudo?.includes('/plano/'))
    if (falaSobrePlano && !planoJaEnviado && !escalonado) {
      respostaFinal += `\n\nVeja os detalhes e assine pelo link:\n📋 ${linkPlano}`
    }
  }

  // Salva resposta final da IA
  await banco.mensagem.create({
    data: { conversaId, remetente: 'ia', conteudo: respostaFinal },
  })

  await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })

  // Ao encerrar a conversa: gera resumo e salva em cliente.preferencias para contexto futuro
  // (fire-and-forget — não bloqueia a resposta ao cliente)
  if (encerrado && cliente) {
    gerarESalvarResumo(tenantId, cliente.id, mensagensIA).catch(() => {})
  }

  return { resposta: respostaFinal, escalonado, encerrado }
}

// ─── Simular (painel) ─────────────────────────────────────────────────────────

const simularConversa = async (tenantId, mensagem) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  const systemPrompt = await montarSystemPrompt(tenant, null, false, mensagem)

  const resposta = await openai.chat.completions.create({
    model: configIA.modelo,
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: systemPrompt + '\n\nEsta é uma simulação de demonstração. Não execute ferramentas reais — apenas descreva o que faria em cada etapa.',
      },
      { role: 'user', content: mensagem },
    ],
  })

  return { resposta: resposta.choices[0].message.content || 'Erro ao simular.' }
}

module.exports = { processarMensagem, simularConversa }


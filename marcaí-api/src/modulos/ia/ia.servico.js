const Anthropic = require('@anthropic-ai/sdk')
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
const { logClienteTrace, resumirCliente } = require('../../utils/clienteTrace')
const { resumirHorarioFuncionamento } = require('../../utils/horarioFuncionamento')

const anthropic = configIA.anthropicApiKey ? new Anthropic({ apiKey: configIA.anthropicApiKey }) : null
const ferramentasClaude = ferramentas.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
}))

const NOME_IA_PADRAO = 'Don Barber'


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
  // Remove markdown que WhatsApp não renderiza (aparece literal)
  limpo = limpo.replace(/\*\*\*(.*?)\*\*\*/g, '$1') // ***bold italic***
  limpo = limpo.replace(/\*\*(.*?)\*\*/g, '$1')     // **bold**
  limpo = limpo.replace(/^\* /gm, '• ')              // * lista → • lista
  limpo = limpo.replace(/^- /gm, '• ')               // - lista → • lista
  limpo = limpo.replace(/^#{1,6}\s+/gm, '')          // # headers
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

const montarPlaybookComercial = ({
  tenant,
  servicos = [],
  produtosEstoque = [],
  pacotes = [],
  planosMensais = [],
}) => {
  const nomes = servicos.map((servico) => normalizarTextoIntencao(servico.nome))
  const temCorte = nomes.some((nome) => nome.includes('corte'))
  const temBarba = nomes.some((nome) => nome.includes('barba'))
  const temSobrancelha = nomes.some((nome) => nome.includes('sobrancel'))
  const temAcabamento = nomes.some((nome) => nome.includes('acabamento') || nome.includes('pezinho') || nome.includes('finaliz'))
  const temProdutos = tenant.estoqueAtivo && produtosEstoque.some((produto) => Number(produto.quantidadeAtual || 0) > 0)
  const temPacotes = tenant.pacotesAtivo && pacotes.length > 0
  const temPlanos = tenant.membershipsAtivo && planosMensais.length > 0
  const temFidelidade = tenant.fidelidadeAtivo

  const sugestoesConsultivas = []
  if (temCorte && temBarba) sugestoesConsultivas.push('Cliente pediu corte: sugira barba para fechar o visual, mas so depois de resolver o horario ou quando ele pedir orientacao.')
  if (temBarba && temCorte) sugestoesConsultivas.push('Cliente pediu barba: sugira corte apenas se fizer sentido para alinhar o conjunto.')
  if (temCorte && temSobrancelha) sugestoesConsultivas.push('Quando o cliente perguntar "o que combina?" ou quiser algo rapido, sobrancelha e um complemento elegante para o corte.')
  if (temBarba && temAcabamento) sugestoesConsultivas.push('Se houver acabamento ativo no catalogo, use como complemento discreto para barba.')

  const recursosAtivos = [
    temPacotes ? 'pacotes/combo' : null,
    temProdutos ? 'produtos' : null,
    temFidelidade ? 'fidelidade' : null,
    temPlanos ? 'planos mensais' : null,
  ].filter(Boolean)

  const recursosInativos = [
    !temPacotes ? 'pacotes/combo' : null,
    !temProdutos ? 'produtos' : null,
    !temFidelidade ? 'fidelidade' : null,
    !temPlanos ? 'planos mensais' : null,
  ].filter(Boolean)

  return [
    '== PLAYBOOK COMERCIAL ==',
    'Venda bem = agir como consultor de imagem masculina, nunca como telemarketing.',
    'Regra de timing: primeiro resolva a necessidade principal. So venda antes do agendamento quando o cliente pedir preco, opiniao, vantagem, desconto ou "o que voce indica?".',
    'Regra de intensidade: uma sugestao por vez, uma tentativa por item, zero insistencia depois de "nao", "so isso", "deixa assim", "ta bom".',
    recursosAtivos.length
      ? `Recursos comerciais ATIVOS hoje: ${recursosAtivos.join(', ')}.`
      : 'Recursos comerciais ATIVOS hoje: apenas servicos do catalogo. Foque em complementariedade entre servicos e retorno futuro.',
    recursosInativos.length
      ? `Recursos INATIVOS ou vazios: ${recursosInativos.join(', ')}. Nao invente ofertas desses grupos e nao faça teaser do que nao existe.`
      : 'Todos os grupos comerciais estao ativos.',
    sugestoesConsultivas.length
      ? `Matriz de consultoria:\n- ${sugestoesConsultivas.join('\n- ')}`
      : 'Matriz de consultoria: se o catalogo estiver simples, use apenas orientacao objetiva e agendamento sem upsell forcado.',
    'Gatilhos bons para vender com classe: cliente pediu opiniao, comparou valores, falou de evento/encontro/trabalho/fim de semana, ou acabou de confirmar um horario.',
    'Gatilhos ruins: cliente com pressa, irritado, reclamando, sem entender o fluxo, ou ainda sem conseguir o horario principal.',
    'Se nao houver recurso complementar real para oferecer, feche com seguranca e boa experiencia em vez de empurrar venda.',
  ].join('\n')
}

const montarSecaoVendasInteligentes = ({
  tenant,
  servicos = [],
  produtosEstoque = [],
  pacotes = [],
  planosMensais = [],
}) => {
  const nomes = servicos.map((servico) => normalizarTextoIntencao(servico.nome))
  const temCorte = nomes.some((nome) => nome.includes('corte'))
  const temBarba = nomes.some((nome) => nome.includes('barba'))
  const temSobrancelha = nomes.some((nome) => nome.includes('sobrancel'))
  const temAcabamento = nomes.some((nome) => nome.includes('acabamento') || nome.includes('pezinho') || nome.includes('finaliz'))
  const temProdutos = tenant.estoqueAtivo && produtosEstoque.some((produto) => Number(produto.quantidadeAtual || 0) > 0)
  const temPacotes = tenant.pacotesAtivo && pacotes.length > 0
  const temPlanos = tenant.membershipsAtivo && planosMensais.length > 0
  const temFidelidade = tenant.fidelidadeAtivo

  const sugestoesServico = []
  if (temCorte && temBarba) {
    sugestoesServico.push('- Corte agendado: voce pode sugerir barba para fechar o visual, de forma curta e sem pressionar.')
  }
  if (temCorte && temSobrancelha) {
    sugestoesServico.push('- Corte agendado e cliente pedindo opiniao: sobrancelha e um complemento rapido e elegante.')
  }
  if (temBarba && temAcabamento) {
    sugestoesServico.push('- Barba agendada: acabamento pode entrar como ajuste final, se o cliente estiver aberto.')
  }
  if (temBarba && temCorte) {
    sugestoesServico.push('- Barba agendada para evento ou fim de semana: corte pode ser sugerido se o cliente estiver montando o visual completo.')
  }

  const blocos = [
    '### Pos-agendamento (vendas inteligentes)',
    'Venda consultiva so depois que o principal estiver resolvido. Atendimento primeiro, oferta depois.',
    'Ordem mental: resolver horario ou duvida -> confirmar -> so entao avaliar se cabe UMA sugestao complementar.',
  ]

  if (sugestoesServico.length > 0) {
    blocos.push(
      'Servico complementar:',
      sugestoesServico.join('\n'),
      '- Se nao houver aderencia clara, nao ofereca nada.'
    )
  } else {
    blocos.push('Servico complementar: se o catalogo nao abrir margem para combinacao natural, nao force upsell.')
  }

  if (temPacotes) {
    blocos.push(
      'Combo/pacote:',
      '- So ofereca pacote real cadastrado e apenas se ele melhorar o custo-beneficio do que o cliente ja pediu.',
      '- Se o cliente comparar preco entre servicos avulsos, mostre o pacote existente com valor exato.'
    )
  } else {
    blocos.push(
      'Combo/pacote:',
      '- Hoje nao ha pacote/combo ativo para oferecer.',
      '- Se perguntarem por combo, seja transparente e some os servicos avulsos reais quando fizer sentido comparar.'
    )
  }

  if (temProdutos) {
    blocos.push(
      'Produtos:',
      '- Sugira no maximo 1 produto coerente com o servico feito.',
      '- Produto so entra se o cliente demonstrar interesse em manutencao, acabamento ou durabilidade do visual.'
    )
  } else {
    blocos.push(
      'Produtos:',
      '- Hoje nao ha produto de estoque ativo para o Don vender.',
      '- Se perguntarem, seja transparente e nao invente pomada, oleo, balm ou kit.'
    )
  }

  if (temFidelidade) {
    blocos.push(
      'Fidelidade:',
      '- Pode mencionar acumulacao de pontos de forma breve, sem transformar a conversa em campanha.'
    )
  } else {
    blocos.push('Fidelidade: nao ofereca programa de pontos se o recurso nao estiver ativo.')
  }

  if (temPlanos) {
    blocos.push(
      'Plano mensal:',
      '- So mencione plano quando o cliente der gancho de frequencia, economia recorrente ou perguntar diretamente.',
      '- No maximo 1 convite por conversa. Se houver interesse, use enviarLinkPlano.'
    )
  } else {
    blocos.push(
      'Plano mensal:',
      '- Hoje nao ha plano mensal ativo para oferta.',
      '- Se perguntarem, responda com transparencia e volte para a melhor opcao avulsa disponivel.'
    )
  }

  blocos.push(
    'Recorrencia inteligente:',
    '- Depois de fechar bem o atendimento, voce pode sugerir retorno futuro de forma leve. Ex.: corte em 15 a 21 dias, barba em 10 a 14 dias.',
    '',
    'Regras de ouro das vendas:',
    '- NUNCA insista apos recusa. "Nao", "so isso", "deixa assim", "ta bom" encerram a oferta na hora.',
    '- Nao transforme pergunta de preco em palestra de venda. Responda objetivamente e, se couber, ofereca UMA alternativa melhor.',
    '- Se o cliente estiver com pressa, irritado ou sem conseguir vaga, suspenda qualquer venda.',
    '- Se nao houver recurso real para vender, ganhe no atendimento e nao na insistencia.'
  )

  return blocos.join('\n')
}

const PERFIS_ATENDIMENTO_IA = {
  FORMAL: {
    nome: 'CONCIERGE PREMIUM',
    tonalidade: 'refinada, precisa e exclusiva — como o atendimento pessoal de uma barbearia de alto padrão.',
    descricao: 'Cada cliente é tratado como VIP. Resoluções rápidas, sem rodeio, com classe.',
    regras: [
      '- Resolva em poucos passos, com linguagem precisa e elegante.',
      '- Após o nome: triagem direta — "Vai ser corte, barba ou os dois, [nome]?"',
      '- Nunca deixe o cliente esperando sem motivo: aja imediatamente.',
      '- Direto não é frio — seja eficiente com calor humano.',
      '- Trate cada interação como se o cliente estivesse na cadeira de uma barbearia top.',
    ].join('\n'),
  },
  DESCONTRALIDO: {
    nome: 'BARBEIRO DE CONFIANÇA',
    tonalidade: 'descolada, segura e autêntica — como um barbeiro experiente que conhece todos pelo nome.',
    descricao: 'Parece aquele barbeiro que você indica pros amigos: atende rápido, fala certo, deixa o cliente à vontade.',
    regras: [
      '- Fale como um profissional que entende do próprio ofício, não como chatbot.',
      '- Use o nome do cliente com naturalidade — nem em todo turno, nem nunca.',
      '- Combine agilidade com personalidade: barbearia é lugar de conversa objetiva.',
      '- Venda consultiva só com gancho real — nunca empurre.',
      '- Quando o cliente voltar, reconheça isso com leveza: "Boa, [nome], de volta!"',
    ].join('\n'),
  },
  ACOLHEDOR: {
    nome: 'CONSULTOR DE IMAGEM',
    tonalidade: 'calorosa, consultiva e atenciosa — como um especialista que cuida do visual e do ego do cliente.',
    descricao: 'Vai além do agendamento: cuida da experiência completa, como um barbeiro que é também consultor.',
    regras: [
      '- Reconheça o histórico e as preferências do cliente antes de sugerir qualquer coisa.',
      '- Use o nome do cliente de forma natural e personalizada.',
      '- Ofereça consultoria de visual quando o cliente pedir opinião ou mencionar evento/trabalho.',
      '- Depois de agendar: reforce que vai ficar incrível — crie antecipação positiva.',
      '- Nunca trate dois clientes da mesma forma: personalize cada atendimento.',
    ].join('\n'),
  },
}

const obterPerfilAtendimentoIA = (tomDeVoz = 'DESCONTRALIDO') => (
  PERFIS_ATENDIMENTO_IA[String(tomDeVoz || 'DESCONTRALIDO').toUpperCase()] || PERFIS_ATENDIMENTO_IA.DESCONTRALIDO
)

const montarPerguntaPosNome = (nomeCliente = '', tomDeVoz = 'DESCONTRALIDO') => {
  const primeiroNome = String(nomeCliente || '').trim().split(/\s+/)[0] || 'cliente'
  const perfil = obterPerfilAtendimentoIA(tomDeVoz)

  if (perfil.nome === 'CONCIERGE PREMIUM') {
    return `${primeiroNome}, corte, barba ou os dois hoje?`
  }

  if (perfil.nome === 'CONSULTOR DE IMAGEM') {
    return `Boa, ${primeiroNome}. Vai cuidar do corte, da barba ou vem completo hoje?`
  }

  return `Boa, ${primeiroNome}. Vai ser corte, barba ou os dois?`
}

const montarRespostaRapidaPreco = async (tenantId, mensagemNormalizada = '') => {
  if (!/\b(quanto|preco|valor|fica quanto)\b/.test(mensagemNormalizada)) return null

  const servicos = await banco.servico.findMany({
    where: { tenantId, ativo: true },
    select: { nome: true, precoCentavos: true },
  })

  const encontrarServico = (...termos) => servicos.find((servico) => {
    const nome = normalizarTextoIntencao(servico.nome)
    return termos.some((termo) => nome.includes(termo))
  })

  const corte = encontrarServico('corte')
  const barba = encontrarServico('barba')
  const sobrancelha = encontrarServico('sobrancel')

  if (/\bcorte\b/.test(mensagemNormalizada) && /\bbarba\b/.test(mensagemNormalizada) && corte?.precoCentavos && barba?.precoCentavos) {
    const total = Number(corte.precoCentavos || 0) + Number(barba.precoCentavos || 0)
    return `O corte sai a ${formatarMoedaPrompt(corte.precoCentavos)} e a barba ${formatarMoedaPrompt(barba.precoCentavos)}. Juntos, fica ${formatarMoedaPrompt(total)}. Quer que eu veja um horario?`
  }

  if (/\bcorte\b/.test(mensagemNormalizada) && corte?.precoCentavos) {
    return `O corte fica ${formatarMoedaPrompt(corte.precoCentavos)}. Quer que eu veja um horario?`
  }

  if (/\bbarba\b/.test(mensagemNormalizada) && barba?.precoCentavos) {
    return `A barba fica ${formatarMoedaPrompt(barba.precoCentavos)}. Quer que eu veja um horario?`
  }

  if (/\bsobrancel/.test(mensagemNormalizada) && sobrancelha?.precoCentavos) {
    return `A sobrancelha fica ${formatarMoedaPrompt(sobrancelha.precoCentavos)}. Quer que eu veja um horario?`
  }

  return null
}

const extrairPrimeiroNome = (nome = '') => (
  String(nome || '').trim().split(/\s+/)[0] || 'cliente'
)

// Valida se o nome do WhatsApp é legível e usável no cumprimento
// Retorna o nome se válido, null caso contrário
const validarNomeWhatsApp = (nome) => {
  if (!nome || typeof nome !== 'string') return null
  const n = nome.trim()
  if (!n || n.length > 50) return null
  // Rejeita se o nome for o próprio telefone (só dígitos)
  if (/^\d+$/.test(n)) return null
  // Remove emojis e símbolos especiais, verifica o que sobra
  const semEmojis = n.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu, '').trim()
  // Se sobrar menos de 2 letras reais, o nome é inútil (só emojis/símbolos)
  const apenasLetras = semEmojis.replace(/[^a-zA-ZÀ-ÿ]/g, '')
  if (apenasLetras.length < 2) return null
  // Rejeita nomes com mais de 40% de dígitos (ex: "User 12345678")
  const digitCount = (n.match(/\d/g) || []).length
  if (digitCount / n.length > 0.4) return null
  // Rejeita se contiver URLs, arrobas ou barras (bots, canais)
  if (/https?:|@|\/\//.test(n)) return null
  // O primeiro "token" (primeiro nome) deve ter ao menos 2 letras
  const primeiroToken = semEmojis.trim().split(/\s+/)[0] || ''
  const letrasToken = primeiroToken.replace(/[^a-zA-ZÀ-ÿ]/g, '')
  if (letrasToken.length < 2) return null
  return n
}

const listarServicosAtivosResumo = async (tenantId) => (
  banco.servico.findMany({
    where: { tenantId, ativo: true },
    select: { id: true, nome: true, precoCentavos: true },
  })
)

const encontrarServicoPorTexto = (servicos = [], textoNormalizado = '') => {
  if (!textoNormalizado) return null

  const candidatos = servicos.map((servico) => ({
    ...servico,
    nomeNormalizado: normalizarTextoIntencao(servico.nome),
  }))

  const regras = [
    { padrao: /\b(corte|degrade|degradezinho|social)\b/, termos: ['corte', 'degrade', 'social'] },
    { padrao: /\bbarba\b/, termos: ['barba'] },
    { padrao: /\bsobrancel/, termos: ['sobrancel'] },
    { padrao: /\b(acabamento|pezinho|finaliza|finalizacao)\b/, termos: ['acabamento', 'pezinho', 'finaliz'] },
  ]

  for (const regra of regras) {
    if (!regra.padrao.test(textoNormalizado)) continue
    const encontrado = candidatos.find((servico) => regra.termos.some((termo) => servico.nomeNormalizado.includes(termo)))
    if (encontrado) return encontrado
  }

  return candidatos.find((servico) => (
    servico.nomeNormalizado.length >= 4
    && textoNormalizado.includes(servico.nomeNormalizado)
  )) || null
}

const obterUltimosTextosClienteNormalizados = (mensagens = [], limite = 4) => (
  mensagens
    .filter((mensagem) => mensagem.remetente === 'cliente')
    .slice(-limite)
    .reverse()
    .map((mensagem) => normalizarTextoIntencao(mensagem.conteudo))
    .filter(Boolean)
)

const detectarServicoContextual = async (tenantId, textos = []) => {
  const servicos = await listarServicosAtivosResumo(tenantId)
  for (const texto of textos) {
    const encontrado = encontrarServicoPorTexto(servicos, texto)
    if (encontrado) return encontrado
  }
  return null
}

const obterDataDesejadaPeloContexto = (mensagemNormalizada = '', mensagens = [], timeZone) => {
  const textos = [mensagemNormalizada, ...obterUltimosTextosClienteNormalizados(mensagens)]
  for (const texto of textos) {
    const data = obterDataDesejadaDaMensagem(texto, timeZone)
    if (data) return data
  }
  return null
}

const obterHoraDesejadaPeloContexto = (mensagemNormalizada = '', mensagens = []) => {
  const textos = [mensagemNormalizada, ...obterUltimosTextosClienteNormalizados(mensagens)]
  for (const texto of textos) {
    const hora = obterHoraDesejadaDaMensagem(texto) || obterHoraDesejadaPorTurno(texto)
    if (hora) return hora
  }
  return null
}

const ehRespostaFallbackGenerica = (texto = '') => (
  /oi pode repetir|nao captei bem|manda de novo|tive um probleminha/i.test(normalizarTextoIntencao(texto))
)

const ehObjecaoPreco = (textoNormalizado = '') => (
  /\b(caro|salgado|pesado|mais barato|mais em conta|tem algo melhor|tem algo mais em conta|desconto)\b/.test(textoNormalizado)
)

const respostaJaTrataObjecaoPreco = (texto = '') => (
  /r\$|mais em conta|mais barato|so o corte|so a barba|desconto|combo|pacote|valor/i.test(texto)
)

const clientePerguntouPagamento = (textoNormalizado = '') => (
  /\b(cartao|cartao de credito|cartao de debito|credito|debito|pix|dinheiro)\b/.test(textoNormalizado)
)

const respostaJaFalaPagamento = (texto = '') => (
  /\b(cartao|credito|debito|pix|dinheiro)\b/i.test(normalizarTextoIntencao(texto))
)

const respostaPuxaTriagemServico = (texto = '') => (
  ultimaPerguntaFoiTriagemServico(normalizarTextoIntencao(texto))
)

const clientePerguntouProduto = (textoNormalizado = '') => (
  /\b(produto|pomada|oleo|balm|cera|kit)\b/.test(textoNormalizado)
)

const respostaJaFalaProduto = (texto = '') => (
  /\b(produto|pomada|oleo|balm|cera|kit|nao temos|nao tenho|confirma com a equipe|equipe te confirma|balcao)\b/.test(normalizarTextoIntencao(texto))
)

const ultimaPerguntaFoiTriagemServico = (textoNormalizado = '') => (
  /vai ser corte barba ou os dois|corte barba ou os dois|qual servico vai ser|qual servico voce quer|corte barba ou combo/.test(textoNormalizado)
)

const formatarListaNatural = (itens = []) => {
  const lista = Array.from(new Set((itens || []).filter(Boolean)))
  if (lista.length === 0) return ''
  if (lista.length === 1) return lista[0]
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
}

const montarRespostaPagamentoCurta = (tenant) => {
  const mapa = {
    PIX: 'PIX',
    CARTAO_CREDITO: 'cartão de crédito',
    CARTAO_DEBITO: 'cartão de débito',
    DINHEIRO: 'dinheiro',
  }

  const lista = formatarListaNatural((tenant?.tiposPagamento || []).map((tipo) => mapa[tipo] || null))
  return lista ? `Aceitamos ${lista}.` : null
}

const montarRespostaProdutoCurta = async (tenantId, tenant) => {
  if (!tenant?.estoqueAtivo) {
    return 'No momento, não tenho produto confirmado aqui no Don. Se quiser, a equipe confirma no balcão.'
  }

  const produtos = await banco.produto.findMany({
    where: {
      tenantId,
      ativo: true,
      quantidadeAtual: { gt: 0 },
    },
    select: { nome: true },
    take: 2,
  }).catch(() => [])

  if (!produtos.length) {
    return 'No momento, não tenho produto confirmado aqui no Don. Se quiser, a equipe confirma no balcão.'
  }

  return `Temos ${formatarListaNatural(produtos.map((produto) => produto.nome))}. Se quiser, eu te indico o que combina melhor com o seu atendimento.`
}

const montarRespostaObjecaoPreco = async ({ tenantId, mensagens = [], mensagemNormalizada = '' }) => {
  if (!ehObjecaoPreco(mensagemNormalizada)) return null

  const servicos = await listarServicosAtivosResumo(tenantId)
  const encontrarServico = (...termos) => servicos.find((servico) => {
    const nome = normalizarTextoIntencao(servico.nome)
    return termos.some((termo) => nome.includes(termo))
  })

  const corte = encontrarServico('corte')
  const barba = encontrarServico('barba')
  const contexto = [mensagemNormalizada, ...obterUltimosTextosClienteNormalizados(mensagens)].join(' ')

  if (/\bcorte\b/.test(contexto) && /\bbarba\b/.test(contexto) && corte?.precoCentavos && barba?.precoCentavos) {
    const total = Number(corte.precoCentavos || 0) + Number(barba.precoCentavos || 0)
    return `Se quiser algo mais em conta, posso ver so o corte por ${formatarMoedaPrompt(corte.precoCentavos)} ou so a barba por ${formatarMoedaPrompt(barba.precoCentavos)}. Se preferir os dois, juntos ficam ${formatarMoedaPrompt(total)}. Quer que eu te mostre os horarios?`
  }

  if (/\bcorte\b/.test(contexto) && corte?.precoCentavos) {
    return `Se quiser algo mais em conta, posso ver so o corte por ${formatarMoedaPrompt(corte.precoCentavos)}. Quer que eu te mostre os horarios?`
  }

  if (/\bbarba\b/.test(contexto) && barba?.precoCentavos) {
    return `Se quiser algo mais em conta, posso ver so a barba por ${formatarMoedaPrompt(barba.precoCentavos)}. Quer que eu te mostre os horarios?`
  }

  return 'Se quiser, eu posso te mostrar a opcao mais enxuta do catalogo ou ver um horario que faca sentido pra voce.'
}

const montarRespostaRefinoSemServico = ({ mensagemNormalizada = '', clienteNome = '', tomDeVoz = 'DESCONTRALIDO' }) => {
  const horarioPontual = extrairHorariosDaMensagem(mensagemNormalizada)[0]
  let abertura = 'Fechado. Eu consigo olhar isso sim.'

  if (horarioPontual) {
    abertura = `Fechado. Por volta de ${formatarHorarioCurto(horarioPontual)} eu consigo olhar sim.`
  } else {
    const depoisDas = mensagemNormalizada.match(/depois das\s+(\d{1,2})/)
    const antesDas = mensagemNormalizada.match(/antes das\s+(\d{1,2})/)

    if (depoisDas) abertura = `Fechado. Depois das ${depoisDas[1]}h eu consigo olhar sim.`
    if (antesDas) abertura = `Fechado. Antes das ${antesDas[1]}h eu consigo olhar sim.`
    if (!depoisDas && !antesDas && ehPedidoMaisTarde(mensagemNormalizada)) abertura = 'Fechado. Mais pro fim do dia eu consigo olhar sim.'
  }

  return `${abertura} ${montarPerguntaPosNome(clienteNome, tomDeVoz)}`
}

const montarPerguntaQuandoAgendar = (clienteNome = '', tomDeVoz = 'DESCONTRALIDO') => {
  const primeiroNome = extrairPrimeiroNome(clienteNome)
  const perfil = obterPerfilAtendimentoIA(tomDeVoz)

  if (perfil.nome === 'CONCIERGE PREMIUM') {
    return `${primeiroNome}, prefere hoje ou tem um dia em mente?`
  }

  if (perfil.nome === 'CONSULTOR DE IMAGEM') {
    return `Perfeito, ${primeiroNome}. Voce quer pra hoje ou prefere outro dia?`
  }

  return `Fechado, ${primeiroNome}. Voce quer pra hoje ou prefere outro dia?`
}

const montarRespostaResgateHorario = async ({
  tenant,
  mensagens = [],
  mensagemNormalizada = '',
  clienteNome = '',
  ultimaMensagemIANormalizada = '',
}) => {
  const timeZone = tenant?.timezone || 'America/Sao_Paulo'
  const clientePediuHorario = /\b(corte|barba|agendar|agenda|horario|horarios|hora|vaga|hoje|hj|amanha|depois|mais tarde)\b/.test(mensagemNormalizada)
    || Boolean(obterHoraDesejadaDaMensagem(mensagemNormalizada))
    || Boolean(obterHoraDesejadaPorTurno(mensagemNormalizada))
    || ehRefinoDeHorarioSemConfirmacao(mensagemNormalizada)
  if (!clientePediuHorario) return null

  const servico = await detectarServicoContextual(tenant.id, [
    mensagemNormalizada,
    ...obterUltimosTextosClienteNormalizados(mensagens),
  ])

  if (!servico) {
    if (ultimaPerguntaFoiTriagemServico(ultimaMensagemIANormalizada) || ehRefinoDeHorarioSemConfirmacao(mensagemNormalizada)) {
      return montarRespostaRefinoSemServico({
        mensagemNormalizada,
        clienteNome,
        tomDeVoz: tenant.tomDeVoz,
      })
    }
    return null
  }

  const data = obterDataDesejadaPeloContexto(mensagemNormalizada, mensagens, timeZone)
  if (!data) {
    return montarPerguntaQuandoAgendar(clienteNome, tenant.tomDeVoz)
  }

  const horaDesejada = obterHoraDesejadaPeloContexto(mensagemNormalizada, mensagens)
  let disponibilidade = await executarFerramenta(tenant.id, 'verificarDisponibilidade', {
    servicoId: servico.id,
    data,
    horaDesejada: horaDesejada || undefined,
  })

  if (!disponibilidade?.proximoHorario && disponibilidade?.sugestaoProximaData) {
    disponibilidade = await executarFerramenta(tenant.id, 'verificarDisponibilidade', {
      servicoId: servico.id,
      data: disponibilidade.sugestaoProximaData,
      horaDesejada: horaDesejada || undefined,
    })
  }

  if (!disponibilidade?.proximoHorario) return null

  const dataHoje = obterDataIsoNoFuso(new Date(), timeZone)
  const dataSolicitada = obterDataDesejadaPeloContexto(mensagemNormalizada, mensagens, timeZone) || dataHoje
  const inicioSlotIso = disponibilidade.proximoHorario?.inicio instanceof Date
    ? disponibilidade.proximoHorario.inicio.toISOString()
    : String(disponibilidade.proximoHorario?.inicio || '')
  const dataDoSlot = inicioSlotIso
    ? inicioSlotIso.split('T')[0]
    : dataSolicitada
  const prefixo = dataDoSlot === dataHoje
    ? 'Pra hoje'
    : dataSolicitada === dataHoje
      ? 'Hoje ja nao tenho mais vaga, mas'
      : `Pra ${formatarDataParaCliente(dataDoSlot, timeZone).toLowerCase()}`
  const primeiroNomeProfissional = extrairPrimeiroNome(disponibilidade.proximoHorario.profissional)
  const complementoProfissional = primeiroNomeProfissional ? ` com o ${primeiroNomeProfissional}` : ''

  return `${prefixo}, tenho ${disponibilidade.proximoHorario.inicioFormatado}${complementoProfissional}. Da certo pra voce?`
}

const montarRespostaPosNomeComIntencaoPendente = async ({
  tenant,
  mensagens = [],
  clienteNome = '',
  ultimaMensagemClienteNormalizada = '',
}) => {
  const servico = await detectarServicoContextual(tenant.id, [
    ultimaMensagemClienteNormalizada,
    ...obterUltimosTextosClienteNormalizados(mensagens),
  ])

  if (!servico) {
    return montarPerguntaPosNome(clienteNome, tenant.tomDeVoz)
  }

  return montarRespostaResgateHorario({
    tenant,
    mensagens,
    mensagemNormalizada: ultimaMensagemClienteNormalizada,
    clienteNome,
    ultimaMensagemIANormalizada: '',
  })
}

const montarRespostaModoBarbeiro = ({ mensagemNormalizada = '', tenant }) => {
  const appUrl = process.env.APP_URL || 'https://app.marcai.com.br'
  const linkPlano = `${appUrl}/plano/${tenant.hashPublico || tenant.slug}`

  if (/\b(preco|preco|valor|quanto custa|plano|planos|mensalidade)\b/.test(mensagemNormalizada)) {
    return `O Marcaí te ajuda a centralizar agenda, confirmacao e lembrete no WhatsApp sem te prender no celular. Os planos mudam conforme o tamanho da operacao. Se quiser comparar com calma, segue o link: ${linkPlano}`
  }

  if (/\b(testar|teste|demo|demonstracao|demonstracao|simular)\b/.test(mensagemNormalizada)) {
    return 'Perfeito. Me manda uma mensagem como se fosse um cliente seu e eu te mostro como o Don responde na pratica.'
  }

  return 'Aqui o Don segura o WhatsApp enquanto voce foca no atendimento: responde, organiza a agenda, confirma presenca e ajuda a reduzir no-show. Isso tira peso operacional da recepcao e deixa a rotina mais redonda. Se quiser, me manda uma mensagem como se fosse um cliente seu e eu te mostro na pratica.'
}

// Envia notificação WhatsApp ao profissional (melhor esforço — não falha se não tiver telefone)
const notificarProfissional = async (tenantId, profissional, mensagem) => {
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    const telefoneDestino = tenant?.numeroDono?.trim() || profissional?.telefone

    if (tenant?.configWhatsApp && telefoneDestino) {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, telefoneDestino, mensagem, tenantId)
    }
  } catch (err) {
    console.warn(`[IA] Notificação ao profissional falhou (sem impacto):`, err.message)
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const montarSystemPrompt = async (tenant, cliente = null, primeiroContato = false, mensagemAtual = '', conversaEmAndamento = false) => {
  const NOME_IA = tenant.nomeIA || NOME_IA_PADRAO
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
  const fusoTenant = tenant.timezone || 'America/Sao_Paulo'
  const dataHoje = new Date().toLocaleDateString('en-CA', { timeZone: fusoTenant })
  const amanhaDate = new Date(new Date().toLocaleString('en-US', { timeZone: fusoTenant }))
  amanhaDate.setDate(amanhaDate.getDate() + 1)
  const dataAmanha = amanhaDate.toLocaleDateString('en-CA', { timeZone: fusoTenant })

  // Tabela de datas dos próximos 14 dias (IA usa em vez de calcular de cabeça)
  const diasSemNomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  const tabelaDatasArr = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: fusoTenant }))
    d.setDate(d.getDate() + i)
    const iso = d.toLocaleDateString('en-CA', { timeZone: fusoTenant })
    const diaSem = diasSemNomes[d.getDay()]
    const label = i === 0 ? ' (HOJE)' : i === 1 ? ' (AMANHA)' : ''
    tabelaDatasArr.push(diaSem + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + ' = ' + iso + label)
  }
  const tabelaDatas = tabelaDatasArr.join(' | ')

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

  const perfilAtendimento = obterPerfilAtendimentoIA(tenant.tomDeVoz)
  const tomDescricao = {
    FORMAL: perfilAtendimento.tonalidade,
    DESCONTRALIDO: perfilAtendimento.tonalidade,
    ACOLHEDOR: perfilAtendimento.tonalidade,
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
  const mensagemBoasVindasPreferida = String(tenant.mensagemBoasVindas || '').trim()
  const soCumprimentouAgora = ehSaudacaoSolta(mensagemAtualNormalizada)
  const trouxeIntencaoObjetivaAgora = ehIntencaoObjetivaDeAtendimento(mensagemAtualNormalizada)
  const playbookComercial = montarPlaybookComercial({ tenant, servicos, produtosEstoque, pacotes, planosMensais })
  const secaoVendasInteligentes = montarSecaoVendasInteligentes({ tenant, servicos, produtosEstoque, pacotes, planosMensais })

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
      const primeiroNomeCliente = extrairPrimeiroNome(cliente?.nome)
      secaoRetencao = `\n🔔 RETENÇÃO PROATIVA ATIVA:
Último serviço: ${ultimoServicoConcluido.servico?.nome} | servicoId: ${ultimoServicoConcluido.servico?.id} | há ${diasDesdeUltimo} dias
Profissional anterior: ${ultimoServicoConcluido.profissional?.nome || 'não identificado'}
INSTRUÇÃO: Quando ${primeiroNomeCliente} abrir a conversa (mesmo que só com "oi"), NÃO faça triagem genérica. Aja assim:
1. Chame verificarDisponibilidade com o servicoId acima e data de hoje.
2. Se houver slot: "Boa, ${primeiroNomeCliente}! Já faz ${diasDesdeUltimo} dias do ${ultimoServicoConcluido.servico?.nome}. Tenho [dia] às [hora] com o [prof] — fecha?"
3. Se não houver hoje: tente amanhã e ofereça o próximo slot disponível.
4. NUNCA pergunte "o que vai ser hoje?" se a retenção estiver ativa — assuma o último serviço como intenção default.\n`
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
    const hoje0 = new Date(new Date().toLocaleDateString('en-CA', { timeZone: tenant.timezone || 'America/Sao_Paulo' }))
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
  // Também valida para rejeitar nomes do WhatsApp com emojis, símbolos ou lixo
  const nomeCliente = validarNomeWhatsApp(
    cliente?.nome !== cliente?.telefone ? cliente?.nome : null
  )

  // Detecta se o telefone é um LID (não é número real — não começa com 55 e tem mais de 12 dígitos)
  const telNorm = (cliente?.telefone || '').replace(/\D/g, '')
  const telefoneLID = telNorm.length > 0 && !telNorm.startsWith('55') && telNorm.length > 12

  const secaoCliente = cliente
    ? `\n== CLIENTE DESTA CONVERSA ==\nNome: ${nomeExibicao}\nclienteId: ${cliente.id}  ← use SEMPRE este ID em criarAgendamento.clienteId\nTelefone: ${cliente.telefone}${telefoneLID ? `\n🔴 TELEFONE INVÁLIDO (código interno do WhatsApp).\n→ Continue o atendimento normalmente sem pedir telefone ou nome.\n→ Se já houver contexto suficiente, siga com o agendamento usando este clienteId.` : ''}${secaoPreferencias}${secaoFidelidade}${secaoAssinatura}${secaoRetencao}${secaoAgendamentos}${secaoHistoricoPassado}`
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

// Variações de saudação inicial — tom de barbearia premium, nunca robótico
const variacoesSaudacao = [
  `${saudacao}! Aqui é o ${NOME_IA}, assistente da ${tenant.nome}.${nomeCliente ? ` Tudo bem, ${nomeCliente}?` : ' Como você prefere ser chamado?'}`,
  `${saudacao}! ${NOME_IA} aqui, da ${tenant.nome}.${nomeCliente ? ` Boa te ver, ${nomeCliente}!` : ' Com quem eu falo?'}`,
  `${saudacao}! Eu sou o ${NOME_IA}, da ${tenant.nome}.${nomeCliente ? ` Como vai, ${nomeCliente}?` : ' Qual o seu nome?'}`,
  `${saudacao}! ${tenant.nome} aqui — sou o ${NOME_IA}.${nomeCliente ? ` Boa ver você, ${nomeCliente}!` : ' Como posso te chamar?'}`,
]
// Usa variação baseada no segundo atual para distribuir sem ser aleatório demais
const indiceVariacao = new Date().getSeconds() % variacoesSaudacao.length
const saudacaoInicial = variacoesSaudacao[indiceVariacao]

const horarioFuncionamento = resumirHorarioFuncionamento(profissionais)

const mensagemSaudacaoFixa = nomeCliente
  ? `Oi, ${nomeCliente}! Aqui é o ${NOME_IA}, Assistente Virtual da ${tenant.nome} 💈\n📅 Nosso horário de Funcionamento é de ${horarioFuncionamento}\n${listaDiferenciais.length > 0 ? '\n✨ Temos ' + listaDiferenciais.join(', ') + '.\n' : ''}\nVocê pode agendar pelo link ou me fala aqui que eu marco pra você:\n🗓️ ${linkAgendamento}`
  : null

const blocoObrigatorio = primeiroContato
    ? `🔴🔴🔴 INSTRUÇÃO ABSOLUTA — PRIMEIRO CONTATO 🔴🔴🔴
${!nomeCliente ? `Sem nome salvo. Envie UMA resposta curta.
→ Se a mensagem atual for só uma saudação${soCumprimentouAgora ? ' (e este é o caso agora)' : ''}: "${saudacaoInicial}" e peça o nome. Pare.
→ Se trouxe intenção objetiva${trouxeIntencaoObjetivaAgora ? ' (sim, trouxe)' : ''}: reconheça e peça o nome. Ex.: "Consigo te ajudar sim. Como você prefere ser chamado?"
→ Se houver urgência ("hoje", "hj", "agora"): mencione urgência ANTES de pedir nome.
→ Quando o nome chegar: chame cadastrarCliente PRIMEIRO e retome o pedido pendente.
→ Se mandar so o nome sem pedido: "${montarPerguntaPosNome('Matheus', tenant.tomDeVoz)}"
→ NÃO mande link, NÃO mande apresentação longa antes de ter o nome.` : `CLIENTE CONHECIDO: ${nomeCliente}
→ Se trouxe intenção objetiva${trouxeIntencaoObjetivaAgora ? ' (sim)' : ''}: responda a intenção IMEDIATAMENTE. Sem "como posso ajudar?".
→ Se foi só saudação${soCumprimentouAgora ? ' (SIM, FOI SAUDAÇÃO)' : ''}: Sua resposta DEVE SER EXATAMENTE esta mensagem, copiada caractere por caractere:

${mensagemSaudacaoFixa}

REGRA: Copie a mensagem acima INTEIRA. Nao mude NENHUMA palavra. Nao resuma. Nao encurte. Inclua TODOS os emojis e TODAS as linhas. Esta mensagem e a identidade visual da marca e NUNCA pode ser alterada.`}
`
    : ''

  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone || 'America/Sao_Paulo' })

  return `${blocoObrigatorio}

Voce e ${NOME_IA}, recepcionista virtual de alta performance da ${tenant.nome}.
NAO e um chatbot. E um profissional que converte conversas em agendamentos.

== IDENTIDADE ==
Data: ${hoje} | Hora: ${horaAtual} | ISO hoje: ${dataHoje} | Amanha: ${dataAmanha}
${secaoPlano}${secaoSotaque}

== PERSONALIDADE ==
- Natural, direto, confiante. Linguagem de WhatsApp (curta e fluida).
- Masculina, moderna, profissional. NUNCA robotico. NUNCA prolixo.
- Tom: ${tomDescricao[tenant.tomDeVoz] || tomDescricao['ACOLHEDOR']}
- ${perfilAtendimento.nome}: ${perfilAtendimento.descricao}
- Exemplo bom: "Boa! Ja vejo um horario aqui pra voce" / "Fechou, ja deixo reservado"
- Exemplo ruim: "Posso verificar a disponibilidade para voce" / "Agendamento realizado com sucesso"

== REGRAS OPERACIONAIS CRITICAS ==
1. NUNCA invente: preco, horario, disponibilidade, profissional, beneficio, saldo, regras.
2. NUNCA confirme horario sem chamar ferramenta. Slots sao verdade absoluta.
3. FORMATACAO: Texto puro APENAS. PROIBIDO usar: * ** *** _ __ # - (como lista). ZERO markdown. WhatsApp nao renderiza — aparece literal e fica feio. Para listar servicos, use quebra de linha normal. Maximo 1 emoji por mensagem.
3.1. PORTUGUES: escreva em pt-BR natural, com acentuacao correta nas mensagens ao cliente. Ex.: "você", "cartão", "até lá", "amanhã".
4. NUNCA se contradiga. Se a ferramenta retornou 14h, diga "Tenho as 14h" — nunca "nao consegui esse horario".
5. PREGUICA ZERO: se sem vagas hoje, pesquise amanha. NUNCA pule dias sem verificar.
6. HORA ATUAL: ${horaAtual}. NUNCA ofereça horarios que ja passaram.
7. AUDIO "[AUDIO]": "Nao consigo ouvir audios aqui, mas pode digitar que te ajudo na hora!"
8. FIGURINHA "[FIGURINHA]": "Boa! Posso te ajudar com alguma coisa?"
9. NPS — digito isolado 1-5: chame coletarFeedback IMEDIATAMENTE sem perguntar contexto.
10. RECLAMACAO ("horrivel","pessimo","nao gostei"): "Que pena. Vou te conectar com a equipe." + escalonarParaHumano.
11. CAPS LOCK: cliente irritado. Responda com CALMA, resolva imediato.
12. Abreviacoes: "n"=nao, "vlw"=valeu/tchau, "blz"=beleza, "n vlw"=recusa+despedida. NUNCA trate como incompreensivel.
13. UMA pergunta por vez. Maximo 4 linhas por mensagem.
14. Palavras PROIBIDAS: "descanso", "descansa", "folga", "fechado", "nao funcionamos", "nao atendemos". Use: "Esse dia nao tem horario disponivel" ou "Temos horario de seg a sab".
15. Se o cliente ja disse servico + data + horario, NAO mande link. Resolva pelo chat. Link so quando o cliente pedir ou nao tiver intencao clara.

== MAQUINA DE ESTADOS ==
Fluxo: INICIO → IDENTIFICACAO → TRIAGEM_SERVICO → DATA → HORARIO → PROFISSIONAL → CONFIRMACAO → POS_AGENDAMENTO → ENCERRAMENTO
Alternativo: SUPORTE (remarcar/cancelar/consultar)
NUNCA pule etapas. NUNCA confirme sem validar tudo. NUNCA avance sem entender o cliente.

== CONFIRMACAO FINAL ==
Quando voce oferecer um horario ("Tenho amanha as 13h com o Alisson. Serve?") e o cliente responder QUALQUER sinal positivo:
"sim", "pode", "pode ser", "pode ser sim", "ok", "blz", "bora", "fechou", "beleza", "serve", "quero", "manda", "confirma", "👍", "✅"
→ Chame criarAgendamento IMEDIATAMENTE. NAO peca confirmacao de novo. NAO pergunte "Fecho pra voce?" se o cliente ja disse que quer.

ERRADO: Cliente diz "pode ser sim" → IA pergunta "Fecho pra voce?" (confirmacao de confirmacao)
CERTO: Cliente diz "pode ser sim" → IA chama criarAgendamento direto

clienteId: ${cliente?.id || '<ID do cliente>'}

Apos criar → card de confirmacao USANDO OS DADOS EXATOS retornados pela ferramenta criarAgendamento:
✅ Marcado, [nome]!
✂️ [servico retornado pela tool]
📅 [usar inicioFormatado retornado pela tool — NUNCA invente horario]
💈 Com [profissional retornado pela tool]
${tenant.endereco ? `📍 ${tenant.endereco}` : ''}
Fechamento: "Ate la! 👊" / "Te esperamos! 💈" / "Vai ficar alinhado ✂️"
REGRA CRITICA: O horario no card DEVE ser EXATAMENTE o que a ferramenta retornou. Se a tool disse 14:00, escreva 14:00. NUNCA escreva horario diferente do retornado.
NUNCA use ** (negrito markdown). WhatsApp nao renderiza — aparece literal.
Chame salvarPreferenciasCliente.

== CATALOGO (UNICAS opcoes existentes) ==
${listaServicos}

== PROFISSIONAIS ==
${listaProfissionais}${secaoPacotes}${secaoProdutos}
${contextoBarbearia}

== PLANOS MENSAIS ==
${listaPlanosMensais}

== NEGOCIO ==
${tenant.endereco ? `Endereco: ${tenant.endereco}` : ''}
${tenant.linkMaps ? `Maps: ${tenant.linkMaps}` : ''}
${listaPagamento ? `Pagamento: ${listaPagamento}` : 'Pagamento: confirmar com equipe'}
${listaDiferenciais.length > 0 ? `Diferenciais: ${listaDiferenciais.join(', ')}` : ''}
${idadeMinText ? `Infantil: ${idadeMinText}` : ''}
${tenant.numeroDono ? `Dono: ${tenant.numeroDono}` : ''}

== CLIENTE ==
${secaoCliente}
${secaoConversaEmAndamento}

${playbookComercial}

== PRIMEIRO CONTATO ==
${nomeCliente
  ? primeiroContato
    ? 'Instrucao de saudacao definida no blocoObrigatorio acima — siga exatamente.'
    : `Cliente retornando (${nomeCliente}):
→ RETENCAO PROATIVA ATIVA? Siga as instrucoes dela.
→ PREFERENCIAS CONHECIDAS? Chame verificarDisponibilidade IMEDIATAMENTE com servico preferido.
→ NUNCA comece com pergunta generica quando ha historico.`
  : `Sem nome cadastrado:
→ Saudacao solta ("oi", "ola"): "${saudacao}! Aqui e o ${NOME_IA}, da ${tenant.nome}. Como voce prefere ser chamado?"
→ Intencao objetiva ("tem horario?", "quero corte", "quanto custa?"): Reconheca a intencao PRIMEIRO, depois peca nome com leveza. Ex: "Tenho sim! Pra eu ver certinho, como posso te chamar?" ou "Corte fica R$XX. Pra agendar, me diz seu nome?"
→ NUNCA ignore a intencao do cliente so pra pedir nome. Responda a pergunta + peca nome na mesma mensagem.
→ Nome chegou: cadastrarCliente PRIMEIRO, retome pedido pendente.
→ So o nome sem pedido: "${montarPerguntaPosNome('Matheus', tenant.tomDeVoz)}"`}

== AGENDAMENTO ==
${assinaturaAtrasada ? `PLANO ATRASADO — BLOQUEADO. "O pagamento do plano esta em aberto. Precisa regularizar com a equipe."\n` : ''}
Resolucao de ambiguidade (UMA pergunta por vez): 1.servico → 2.data → 3.horario → 4.profissional

Chamar verificarDisponibilidade SEM perguntar quando:
- Sinal temporal: "hoje", "amanha", "essa semana", dia especifico
- Cliente com pressa: "hoje ainda", "agora", "tem vaga?"
- Retornando COM preferencias

Perguntar ANTES (1 pergunta): "Prefere vir hoje ou tem um dia em mente?"

Datas — NUNCA calcule de cabeca. Use esta tabela:
${tabelaDatas}
Sempre use ISO (YYYY-MM-DD) da tabela acima. NUNCA calcule datas por conta propria.

Sem servico: "Vai ser corte, barba ou os dois?" — se ja perguntou, assuma CORTE.

SINONIMOS DE SERVICO (interprete automaticamente, NAO pergunte de novo):
"cabelo", "cortar cabelo", "visual", "dar um trato", "arrumar", "cortar" = CORTE
"fazer a barba", "aparar barba" = BARBA
"os dois", "corte e barba", "tudo" = COMBO (corte+barba)
"sobrancelha", "design" = SOBRANCELHA
Se o cliente ja disse o servico usando sinonimo, NAO pergunte qual servico. Use o servicoId correspondente.
Se o cliente estiver montando um combo no meio do agendamento (ex.: perguntou sobrancelha depois de pedir horario), responda de forma contextual e curta. Nao abra catalogo completo nem volte para triagem ampla.

NOME DO CLIENTE: Se o nome ja esta salvo no contexto (secao CLIENTE acima), NUNCA peca o nome de novo. Use o nome que ja tem.

Combo ("corte e barba", "os dois", "tudo"): verificarDisponibilidadeCombo IMEDIATAMENTE.
Apresente como 1 bloco: horario + profissional + total somado.

REGRAS DE APRESENTACAO DE HORARIO:
- SEMPRE 1 SLOT por vez. NUNCA liste 2 ou mais opcoes. "Tenho [dia] as [hora] com o [prof]. Da certo?"
- NUNCA mande link quando ja ofereceu um slot. Link SO na saudacao inicial ou quando o cliente PEDIR.
- Depois que criar, remarcar ou cancelar com sucesso, ENCERRE o assunto. NUNCA anexe link de agendamento na mesma mensagem final.
- Se o cliente ESCOLHEU um horario da lista ou disse "pode ser", "sim", "quero esse" → agende IMEDIATAMENTE. NAO peca confirmacao extra.
- Rejeicao: "muito cedo" → hora maior | "muito tarde" → hora menor | "anoite" → busque horarios >= 18h
- Se nao tem vaga no horario exato: ofereca O MAIS PROXIMO. NAO pule pra outro dia sem verificar todos os horarios do mesmo dia.
- Se realmente nao tem vaga no dia inteiro: "Esse dia ta sem vaga. Quer que eu veja [proximo dia]?"

PERGUNTAS FORA DO ESCOPO (sinuca, bar, cerveja, etc):
- Responda brevemente e com simpatia
- Apos 1 resposta fora do escopo, NAO puxe agendamento automaticamente. So puxe se o cliente der abertura.

Preco ("ta caro"): NUNCA defenda. Ofereca opcao MAIS BARATA ou "E nossa opcao mais em conta. Quer agendar?"
NUNCA force venda apos recusa clara.

Erro CONFLITO_HORARIO: verificarDisponibilidade imediato. "Esse acabou de preencher! Tenho [proximo]."

MUDANCA DE INTENCAO: Se o cliente diz "quero sexta" no meio de uma conversa sobre quinta, entenda como mudanca de data. NAO diga "voce nao tem agendamento". Chame verificarDisponibilidade com a nova data.

Tente ${dataHoje} → ${dataAmanha} → sugestaoProximaData.

== CANCELAMENTO E REMARCACAO ==

SINONIMOS DE CANCELAMENTO (trate como intencao de cancelar):
"nao vou mais", "nao vou ir", "desisto", "tira meu horario", "pode desmarcar", "nao quero mais", "nao da pra ir", "surgiu um imprevisto", "nao consigo ir"
Quando detectar QUALQUER dessas frases: chame buscarAgendamentosCliente IMEDIATAMENTE.

ESCALAR PARA HUMANO (trate como pedido de transferencia):
"quero falar com atendente", "quero falar com alguem", "quero falar com pessoa", "me chama alguem", "nao quero robo", "quero humano"
Quando detectar QUALQUER dessas frases: chame escalonarParaHumano IMEDIATAMENTE. NAO tente resolver. NAO diga "posso resolver". TRANSFIRA.

Cancelar (FLUXO OBRIGATORIO):
1. Chame buscarAgendamentosCliente
2. Se >1: pergunte QUAL quer cancelar
3. SEMPRE confirme ANTES de cancelar: "Quer cancelar o [servico] de [data hora] mesmo?"
4. SO depois do "sim" do cliente → chame cancelarAgendamento
5. Apos cancelar: ofereca 1 slot novo
NUNCA cancele sem confirmacao do cliente. NUNCA pule o passo 3.

Remarcar (FLUXO OBRIGATORIO):
1. Chame buscarAgendamentosCliente PRIMEIRO
2. Se cliente tem COMBO (ex: corte+barba no mesmo horario ou sequenciais): trate como 1 bloco. NAO pergunte "corte ou barba?". Pergunte direto o novo horario.
3. Passe TODOS os agendamentoIds no campo agendamentoIds (array) da ferramenta remarcarAgendamento. Os servicos serao remarcados sequencialmente.
4. Chame verificarDisponibilidadeCombo para combos, verificarDisponibilidade para servico unico.
NUNCA cancelar+criar novo. USE remarcarAgendamento.

Recusa ("n", "n vlw", "deixa"): encerre em 1 frase. NUNCA insista.

LINK: NAO mande link quando o cliente ja esta no meio de um fluxo (agendando, remarcando, cancelando). Link so na saudacao inicial ou quando o cliente pedir.

== FERRAMENTAS ==
- verificarDisponibilidade / verificarDisponibilidadeCombo: ANTES de falar horarios
- criarAgendamento / criarAgendamentoCombo: APOS confirmacao
- remarcarAgendamento: trocar horario
- buscarAgendamentosCliente: ANTES de falar sobre agendamentos existentes
- cadastrarCliente: nome novo
- salvarPreferenciasCliente: apos agendamento
- escalonarParaHumano: reclamacao, pedido humano, 2+ msgs sem entender
- verificarSaldoFidelidade: ANTES de falar sobre pontos
- enviarLinkPlano: quando quiser assinar (NUNCA ative direto)
- entrarFilaEspera: ULTIMO recurso
- coletarFeedback: NPS
- encerrarConversa: "tchau", "vlw"

== FAQ ==
"Quanto custa?": pergunte servico. "O corte fica R$XX. Quer agendar?"
"Tenho horario?": buscarAgendamentosCliente.
"Onde ficam?": ${tenant.endereco ? `"${tenant.endereco}${tenant.linkMaps ? `. Mapa: ${tenant.linkMaps}` : ''}"` : '"Confere no perfil."'}
"Cartao/PIX?": ${listaPagamento ? `"${listaPagamento}."` : '"Confirma com a equipe."'}
"Estrutura?": ${listaDiferenciais.length > 0 ? `"Temos ${listaDiferenciais.join(', ')}."` : '"Confirma com a equipe."'}
"Infantil?": ${idadeMinText ? `"Sim! ${idadeMinText}."` : '"Nao fazemos."'}
"Dono?": ${tenant.numeroDono ? `"${tenant.numeroDono}."` : 'escalonarParaHumano'}
"Fidelidade?": ${tenant.fidelidadeAtivo ? 'verificarSaldoFidelidade' : '"Nao temos."'}
"Plano?": ${tenant.membershipsAtivo ? 'Apresente plano + enviarLinkPlano. Pagamento na barbearia.' : '"Nao temos."'}

== CENARIOS ESPECIAIS ==
"Voce e IA?": "Sou o ${NOME_IA}, assistente da ${tenant.nome} com IA. Pode falar normalmente."
"Falar com alguem": escalonarParaHumano.
Barbeiro/demo: modo consultor ate o fim.
Incompreensivel: 1 tentativa com fallback guiado → persistir: escalonarParaHumano.

== CONTROLE DE CONVERSA ==
VOCE conduz. Cliente vago → guie. Cliente sumiu → retome. Cliente perguntou → responda + puxe acao.
Sempre finalize com proximo passo. NUNCA deixe conversa morrer.
Nunca diga so "nao entendi". Use: "Pra te ajudar, vai ser corte, barba ou os dois?"

== VENDAS INTELIGENTES ==
${secaoVendasInteligentes}
Venda so com gancho. 1 sugestao por vez. Apos "nao" → pare.
Urgencia suave: "Esse horario costuma encher rapido" (com moderacao).

== ERROS ==
Nunca diga que errou. Use: "Deixa eu conferir certinho" / "Ja ajusto pra voce"

== FORA DO HORARIO ==
${tenant.mensagemForaHorario || 'Barbearia fora do horario. Deixe mensagem.'}
${(() => { try { const { gerarInstrucaoAprendizado } = require('./aprendizado'); return gerarInstrucaoAprendizado(tenant.aprendizadoIA) } catch { return '' } })()}`
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
        const prefereUltimoHorario = parametros.preferenciaHorario === 'ULTIMO'

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

            if (prefereUltimoHorario) {
              return new Date(b.inicio) - new Date(a.inicio)
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
            mensagem: `SEM VAGAS para ${dataSolicitadaFormatada}. ACAO OBRIGATORIA: Nao responda ao cliente ainda. Chame verificarDisponibilidade NOVAMENTE agora mesmo usando a data '${proximaData}' para encontrar uma alternativa.`,
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
        const prefereUltimoHorario = parametros.preferenciaHorario === 'ULTIMO'

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

          if (prefereUltimoHorario) {
            return new Date(b.inicio) - new Date(a.inicio)
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
            mensagem: `SEM VAGAS para o combo em ${dataSolicitadaFormatada}. ACAO OBRIGATORIA: Nao responda ao cliente ainda. Chame verificarDisponibilidadeCombo NOVAMENTE agora mesmo usando a data '${proximaData}' para encontrar uma alternativa.`,
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
        const primeiroNome = clienteNome.split(' ')[0]
        const endereco = tenant2?.endereco ? `\n📍 ${tenant2.endereco}` : ''
        const cardPronto = `✅ Marcado, ${primeiroNome}!\n✂️ ${ag.servico.nome}\n📅 ${inicioFmt}\n💈 Com ${ag.profissional.nome.split(' ')[0]}${endereco}\nAté lá! 👊`

        return {
          sucesso: true,
          INSTRUCAO: `COPIE esta mensagem EXATAMENTE como esta, sem alterar nenhuma palavra ou horario:\n\n${cardPronto}`,
          agendamento: {
            id: ag.id,
            inicioFormatado: inicioFmt,
            servico: ag.servico.nome,
            profissional: ag.profissional.nome,
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
        // Suporta combo: agendamentoIds (array) ou agendamentoId (string)
        const ids = parametros.agendamentoIds?.length > 0
          ? parametros.agendamentoIds
          : parametros.agendamentoId ? [parametros.agendamentoId] : []

        if (ids.length === 0) throw { status: 400, mensagem: 'agendamentoId ou agendamentoIds obrigatorio' }

        const tenant4 = await banco.tenant.findUnique({ where: { id: tenantId } })
        const tz4 = tenant4?.timezone || 'America/Sao_Paulo'
        const remarcados = []
        let inicioAtual = parametros.novoInicio

        for (const agId of ids) {
          const ag = await agendamentosServico.remarcar(tenantId, agId, inicioAtual)
          remarcados.push(ag)
          notificarProfissional(tenantId, ag.profissional, `🔄 Agendamento REMARCADO!\n${ag.cliente?.nome || 'Cliente'} remarcou ${ag.servico.nome} para — ${formatarHorarioParaCliente(ag.inicioEm, tz4)}.`)
          // Próximo serviço do combo começa quando o anterior termina
          inicioAtual = ag.fimEm?.toISOString() || adicionarMinutos(new Date(inicioAtual), ag.servico?.duracaoMinutos || 30).toISOString()
        }

        const primeiro = remarcados[0]
        const nomesServicos = remarcados.map(a => a.servico?.nome).join(' + ')
        const novoFmt = formatarHorarioParaCliente(primeiro.inicioEm, tz4)
        const primeiroNomeR = primeiro.cliente?.nome?.split(' ')[0] || 'cliente'
        const enderecoR = tenant4?.endereco ? '\n📍 ' + tenant4.endereco : ''
        const cardRemarcado = '✅ Remarcado, ' + primeiroNomeR + '!\n✂️ ' + nomesServicos + '\n📅 ' + novoFmt + '\n💈 Com ' + (primeiro.profissional?.nome?.split(' ')[0] || 'profissional') + enderecoR + '\nAté lá! 👊'

        return {
          sucesso: true,
          INSTRUCAO: 'COPIE esta mensagem EXATAMENTE como esta:\n\n' + cardRemarcado,
          agendamento: { ids: remarcados.map(a => a.id), inicioFormatado: novoFmt, servicos: nomesServicos, profissional: primeiro.profissional?.nome },
        }
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
          inicio: new Date().toISOString(), // garante que só retorna agendamentos FUTUROS
        })

        const clienteFerramenta = await banco.cliente.findUnique({
          where: { id: parametros.clienteId },
          select: {
            id: true,
            nome: true,
            telefone: true,
            lidWhatsapp: true,
            criadoEm: true,
            atualizadoEm: true,
            _count: {
              select: {
                agendamentos: true,
                conversas: true,
              },
            },
          },
        })

        if (agendamentos.length === 0) {
          logClienteTrace('ia_busca_agendamentos_sem_resultado', {
            tenantId,
            clienteId: parametros.clienteId,
            cliente: resumirCliente(clienteFerramenta),
          }, 'warn')
        } else {
          logClienteTrace('ia_busca_agendamentos_com_resultado', {
            tenantId,
            clienteId: parametros.clienteId,
            cliente: resumirCliente(clienteFerramenta),
            agendamentos: agendamentos.map((a) => ({
              id: a.id,
              status: a.status,
              inicioEm: a.inicioEm,
              servico: a.servico?.nome,
              profissional: a.profissional?.nome,
            })),
          })
        }

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
        const c = await clientesServico.buscarPorTelefone(tenantId, parametros.telefone)
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

      case 'resgatarFidelidade': {
        const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
        if (!tenant?.fidelidadeAtivo) {
          return { sucesso: false, mensagem: 'Programa de fidelidade não está ativo.' }
        }
        try {
          const saldoAtualizado = await fidelidadeServico.resgatarPontos(tenantId, parametros.clienteId)
          const config = await fidelidadeServico.obterConfig(tenantId)
          return {
            sucesso: true,
            mensagem: `Resgate confirmado! O cliente ganhou: ${config?.descricaoResgate || 'benefício'}. O próximo atendimento deste serviço será gratuito.`,
            pontosRestantes: saldoAtualizado.pontos,
            beneficio: config?.descricaoResgate,
          }
        } catch (err) {
          return {
            sucesso: false,
            mensagem: err.mensagem || 'Não foi possível resgatar. Verifique se o cliente tem pontos suficientes.',
            erro: err.codigo,
          }
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

      case 'verificarCreditosPlano': {
        const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { membershipsAtivo: true } })
        if (!tenant?.membershipsAtivo) {
          return { temPlano: false, mensagem: 'O estabelecimento não possui planos mensais ativos.' }
        }

        const assinatura = await banco.assinaturaCliente.findFirst({
          where: {
            tenantId,
            clienteId: parametros.clienteId,
            status: 'ATIVA',
            OR: [{ fimEm: null }, { fimEm: { gte: new Date() } }],
          },
          include: {
            planoAssinatura: { select: { nome: true } },
            creditos: {
              include: { servico: { select: { id: true, nome: true } } },
            },
          },
          orderBy: { criadoEm: 'desc' },
        })

        if (!assinatura) {
          return { temPlano: false, mensagem: 'Cliente não possui plano mensal ativo.' }
        }

        const servicosDisponiveis = assinatura.creditos
          .filter((c) => c.creditosRestantes > 0)
          .map((c) => ({
            servicoId: c.servicoId,
            servicoNome: c.servico.nome,
            creditosRestantes: c.creditosRestantes,
          }))

        if (servicosDisponiveis.length === 0) {
          return {
            temPlano: true,
            planoNome: assinatura.planoAssinatura?.nome,
            servicosDisponiveis: [],
            mensagem: `Cliente tem o plano ${assinatura.planoAssinatura?.nome}, mas já usou todos os créditos do ciclo.`,
          }
        }

        return {
          temPlano: true,
          planoNome: assinatura.planoAssinatura?.nome,
          servicosDisponiveis,
          mensagem: `Cliente tem o plano ${assinatura.planoAssinatura?.nome} com créditos disponíveis. Use APENAS os serviços listados quando ele quiser agendar pelo plano.`,
        }
      }

      case 'escalonarParaHumano':
        return { escalonado: true, mensagem: 'Conversa transferida para atendente humano.' }

      case 'encerrarConversa':
        return { encerrado: true, motivo: parametros.motivo }

      case 'enviarLinkAgendamento': {
        const tenantInfo = await banco.tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true, nome: true },
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
          select: { slug: true, nome: true },
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

    if (!anthropic) return

    const res = await anthropic.messages.create({
      model: configIA.modeloAnthropic || configIA.modelo,
      max_tokens: 120,
      system: 'Gere um resumo de 1 a 2 frases sobre esta conversa de barbearia, incluindo: (1) o que o cliente queria, (2) o que foi resolvido ou ficou pendente. Foque em ações concretas (serviço, horário, profissional). Seja direto e objetivo.',
      messages: [{ role: 'user', content: trocas }],
    })

    const resumo = res.content?.find((bloco) => bloco.type === 'text')?.text?.trim()
    if (!resumo) return

    const cliente = await banco.cliente.findUnique({ where: { id: clienteId } })
    const prefAnterior = typeof cliente?.preferencias === 'string' ? cliente.preferencias.trim() : ''

    const tenantResumo = await banco.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } })
    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: tenantResumo?.timezone || 'America/Sao_Paulo',
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

const normalizarTextoIntencao = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ehSaudacaoSolta = (textoNormalizado = '') => {
  if (!textoNormalizado) return false

  return [
    'oi',
    'ola',
    'bom dia',
    'boa tarde',
    'boa noite',
    'opa',
    'e ai',
    'iae',
    'fala',
    'salve',
    'slv',
    'moca',
    'moco',
    'mano',
  ].includes(textoNormalizado)
}

const ehIntencaoObjetivaDeAtendimento = (textoNormalizado = '') => (
  /\b(corte|barba|combo|degrade|acabamento|sobrancelha|agendar|agenda|horario|horarios|hora|vaga|hoje|hj|amanha|amanhã|semana|sexta|sabado|sábado|cancelar|remarcar|preco|valor|quanto|plano|fidelidade|produto|cartao|cartão|pix|endereco|endereço|maps|localizacao|localização)\b/.test(textoNormalizado)
)

const ehRespostaCurtaComNome = (texto = '', iaPerguntouNome = false) => {
  if (!iaPerguntouNome) return false

  const textoNormalizado = normalizarTextoIntencao(texto)
  if (!textoNormalizado || ehSaudacaoSolta(textoNormalizado) || ehIntencaoObjetivaDeAtendimento(textoNormalizado)) {
    return false
  }

  const palavras = textoNormalizado.split(' ').filter(Boolean)
  if (palavras.length < 1 || palavras.length > 3) return false

  const palavrasBloqueadas = new Set([
    'sim', 'nao', 'não', 'blz', 'beleza', 'ok', 'fechou', 'bora', 'hoje', 'amanha', 'amanhã',
    'corte', 'barba', 'combo', 'horario', 'hora', 'vaga', 'tarde', 'manha', 'manhã', 'noite',
  ])

  return palavras.every((palavra) => palavra.length >= 2 && !palavrasBloqueadas.has(palavra))
}

const ehRespostaVagaAposNome = (texto = '') => {
  const textoNormalizado = normalizarTextoIntencao(texto)
  if (!textoNormalizado) return false

  return /como posso te ajudar|como posso ajudar|o que voce quer fazer hoje|quer dar um trato no visual|em que posso ajudar/.test(textoNormalizado)
}

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
    /\bquero falar com humano\b/,
    /\bfalar com humano\b/,
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

const ehPedidoUltimoHorario = (textoNormalizado = '') => (
  /\b(ultimo|ultmo|último)\s+horari/.test(textoNormalizado)
  || /\b(mais tarde|mais pro fim|mais para o fim|fim do dia|ultimo horario do dia)\b/.test(textoNormalizado)
)

const ehConfirmacaoExplicita = (textoNormalizado) => (
  /\b(sim|s|pode|pode ser|confirmo|confirmamos|fechou|fechado|ok|beleza|blz|bora|perfeito|quero esse|esse mesmo)\b/.test(textoNormalizado)
)

const corrigirTextoPadraoPtBr = (texto = '') => {
  if (!texto) return texto

  return String(texto)
    .replace(/\bja remarcou pra voce\b/gi, 'já remarquei pra você')
    .replace(/\bja agendou pra voce\b/gi, 'já agendei pra você')
    .replace(/\btem sim\b/gi, 'tenho sim')
    .replace(/\bvoce\b/gi, 'você')
    .replace(/\bvoces\b/gi, 'vocês')
    .replace(/\bnao\b/gi, 'não')
    .replace(/\bja\b/gi, 'já')
    .replace(/\bservico\b/gi, 'serviço')
    .replace(/\bservicos\b/gi, 'serviços')
    .replace(/\bhorario\b/gi, 'horário')
    .replace(/\bhorarios\b/gi, 'horários')
    .replace(/\bendereco\b/gi, 'endereço')
    .replace(/\blocalizacao\b/gi, 'localização')
    .replace(/\bfuncionamento\b/gi, 'funcionamento')
    .replace(/\bcartao\b/gi, 'cartão')
    .replace(/\bcredito\b/gi, 'crédito')
    .replace(/\bdebito\b/gi, 'débito')
    .replace(/\bamanha\b/gi, 'amanhã')
    .replace(/\bate la\b/gi, 'até lá')
    .replace(/\bate mais\b/gi, 'até mais')
}

const respostaFechaFluxoDeAgenda = (texto = '') => (
  /✅\s*(Marcado|Agendado|Remarcado)|cancelad|cancelei|remarquei|agendei|até lá|te esperamos/i.test(String(texto || ''))
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
  if (!anthropic) return fallbackAleatorio()

  const systemMsg = mensagens.find((m) => m.role === 'system')
  const system = systemPromptOverride || (instrucoesAdicionais ? `${systemMsg?.content || ''}\n\n${instrucoesAdicionais}` : systemMsg?.content || '')
  const msgs = mensagens
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }))

  const resposta = await anthropic.messages.create({
    model: configIA.modeloAnthropic || configIA.modelo,
    max_tokens: maxTokensOverride || configIA.maxTokens,
    system,
    messages: msgs.length > 0 ? msgs : [{ role: 'user', content: '.' }],
  })
  return resposta.content?.find((bloco) => bloco.type === 'text')?.text?.trim() || fallbackAleatorio()
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
    const agendamentoId = Array.isArray(parametros.agendamentoIds) && parametros.agendamentoIds.length > 0
      ? parametros.agendamentoIds[0]
      : parametros.agendamentoId

    if (!agendamentoId) return null

    const agendamento = await banco.agendamento.findUnique({
      where: { id: agendamentoId },
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

const obterUltimoResultadoFerramenta = (mensagens = [], nomeFerramenta) => {
  for (let i = mensagens.length - 1; i >= 0; i -= 1) {
    const mensagem = mensagens[i]
    if (mensagem.remetente !== 'tool_result') continue

    try {
      const payload = JSON.parse(mensagem.conteudo)
      if (payload?.name !== nomeFerramenta || !payload?.content) continue
      return JSON.parse(payload.content)
    } catch (_) {
      continue
    }
  }

  return null
}

const obterUltimoResultadoDisponibilidade = (mensagens = []) => {
  const resultado = obterUltimoResultadoFerramenta(mensagens, 'verificarDisponibilidade')
  return resultado?.proximoHorario ? resultado : null
}

const obterUltimoSlotOferecido = (mensagens = []) => {
  const ultimoCombo = obterUltimoResultadoFerramenta(mensagens, 'verificarDisponibilidadeCombo')
  if (ultimoCombo?.proximoCombo?.inicio) {
    return { inicio: ultimoCombo.proximoCombo.inicio, tipo: 'combo' }
  }

  const ultimoSimples = obterUltimoResultadoFerramenta(mensagens, 'verificarDisponibilidade')
  if (ultimoSimples?.proximoHorario?.inicio) {
    return { inicio: ultimoSimples.proximoHorario.inicio, tipo: 'simples' }
  }

  return null
}

const contextoTemIntencaoDeRemarcacao = (mensagens = [], mensagemNormalizada = '') => {
  const contexto = [mensagemNormalizada, ...obterUltimosTextosClienteNormalizados(mensagens, 6)].join(' ')
  return /\b(remarca|remarcar|remarque|mudar horario|mudar o horario|trocar horario|trocar o horario)\b/.test(contexto)
}

const extrairAgendamentoIdsDaRemarcacao = (agendamentos = []) => {
  if (!Array.isArray(agendamentos) || agendamentos.length === 0) return null
  if (agendamentos.length === 1) return [agendamentos[0].id]

  const ordenados = [...agendamentos].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
  const primeiro = ordenados[0]
  const mesmoProfissional = ordenados.every((agendamento) => agendamento.profissional === primeiro.profissional)
  const mesmaData = ordenados.every((agendamento) => String(agendamento.inicio).slice(0, 10) === String(primeiro.inicio).slice(0, 10))
  const encadeados = ordenados.every((agendamento, indice) => {
    if (indice === 0) return true
    const anterior = ordenados[indice - 1]
    const diferencaMinutos = (new Date(agendamento.inicio) - new Date(anterior.inicio)) / (1000 * 60)
    return diferencaMinutos >= 0 && diferencaMinutos <= 180
  })

  return mesmoProfissional && mesmaData && encadeados
    ? ordenados.map((agendamento) => agendamento.id)
    : null
}

const executarRemarcacaoDeterministicaSeAplicavel = async ({
  tenantId,
  mensagens = [],
  mensagemNormalizada = '',
  ultimaMensagemIAVisivel = null,
}) => {
  if (!ehConfirmacaoExplicita(mensagemNormalizada)) return null
  if (!contextoTemIntencaoDeRemarcacao(mensagens, mensagemNormalizada)) return null

  const ultimaRespostaIA = normalizarTextoIntencao(ultimaMensagemIAVisivel?.conteudo || '')
  if (!/serve|da certo|fica bom|fecha|quer esse|pode ser/.test(ultimaRespostaIA)) return null

  const slotOferecido = obterUltimoSlotOferecido(mensagens)
  if (!slotOferecido?.inicio) return null

  const buscaAgendamentos = obterUltimoResultadoFerramenta(mensagens, 'buscarAgendamentosCliente')
  const agendamentoIds = extrairAgendamentoIdsDaRemarcacao(buscaAgendamentos?.agendamentos || [])
  if (!agendamentoIds?.length) return null

  const parametros = agendamentoIds.length === 1
    ? { agendamentoId: agendamentoIds[0], novoInicio: slotOferecido.inicio }
    : { agendamentoIds, novoInicio: slotOferecido.inicio }

  const resultado = await executarFerramenta(tenantId, 'remarcarAgendamento', parametros).catch(() => null)
  if (!resultado?.sucesso) return null

  const cardMatch = resultado.INSTRUCAO?.match(/\n\n([\s\S]+)$/)
  return cardMatch ? cardMatch[1].trim() : null
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

const nomeClienteConfiavelParaConfirmacao = (cliente) => {
  const nome = String(cliente?.nome || '').trim()
  if (!nome) return false
  if (nome === cliente?.telefone) return false
  if (/^\+?\d[\d\s()\-]{5,}$/.test(nome)) return false
  if (/^(cliente|cliente teste|teste|whatsapp|novo cliente)$/i.test(nome)) return false
  return true
}

const telefoneClienteRealParaConfirmacao = (telefone = '') => {
  const digitos = String(telefone || '').replace(/\D/g, '')
  return digitos.startsWith('55') && digitos.length >= 12 && digitos.length <= 13
}

const bloquearConfirmacaoSemCadastroValido = ({ nomeFerramenta, cliente }) => {
  return null
}

// ─── Processar mensagem ───────────────────────────────────────────────────────

const processarMensagem = async (tenantId, clienteId, conversaId, mensagemCliente, instrucaoEngine = '', usarModeloComplexo = false) => {
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
  const NOME_IA = tenant.nomeIA || NOME_IA_PADRAO

  const clienteSemNomeConhecido = !(cliente?.nome && cliente.nome !== cliente.telefone)
  const ultimaMensagemIAVisivel = [...mensagens].reverse().find((mensagem) => mensagem.remetente === 'ia')
  const ultimaMensagemClienteVisivel = [...mensagens].reverse().find((mensagem) => mensagem.remetente === 'cliente')
  const ultimaMensagemIANormalizada = normalizarTextoIntencao(ultimaMensagemIAVisivel?.conteudo || '')
  const ultimaMensagemClienteNormalizada = normalizarTextoIntencao(ultimaMensagemClienteVisivel?.conteudo || '')
  const iaPerguntouNomeNoTurnoAnterior = /como voce prefere ser chamado|qual o seu nome|como posso te chamar|com quem eu falo/.test(ultimaMensagemIANormalizada)
  const haviaIntencaoObjetivaAntesDoNome = ehIntencaoObjetivaDeAtendimento(ultimaMensagemClienteNormalizada)

  if (clienteSemNomeConhecido && ehRespostaCurtaComNome(mensagemCliente, iaPerguntouNomeNoTurnoAnterior)) {
    const nomeDetectado = mensagemCliente
      .trim()
      .split(/\s+/)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ')

    await clientesServico.atualizar(tenantId, clienteId, { nome: nomeDetectado }).catch(() => {})
    if (cliente) cliente.nome = nomeDetectado
  }

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
  const temContextoAnterior = mensagensContextoAnterior.length > 0
  const temPreferencias = !!cliente?.preferencias

  // "Post-card first contact": histórico contém exatamente [msg_cliente + card_boas_vindas]
  const soTemMsgInicialECard = mensagens.length === 2
    && mensagens[0]?.remetente === 'cliente'
    && mensagens[1]?.remetente === 'ia'
    && !temContextoAnterior
    && !temPreferencias

  // Detecta nova sessão: última mensagem da IA foi há mais de 2h (conversa encerrada/expirada e reativada)
  const ultimaMsgIA = [...mensagens].reverse().find(m => m.remetente === 'ia')
  const novaSessao = ultimaMsgIA && (Date.now() - new Date(ultimaMsgIA.criadoEm).getTime() > 2 * 60 * 60 * 1000)

  const primeiroContato = (mensagens.length === 0 && !temContextoAnterior && !temPreferencias)
    || soTemMsgInicialECard
    || novaSessao // Cliente retornando após conversa encerrada → trata como primeiro contato (manda link)

  // conversaEmAndamento = false quando é efetivamente o primeiro contato real com Don
  const systemPromptBase = await montarSystemPrompt(tenant, cliente, primeiroContato, mensagemCliente, mensagens.length > 0 && !soTemMsgInicialECard && !novaSessao)
  const systemPrompt = instrucaoEngine ? systemPromptBase + instrucaoEngine : systemPromptBase

  // Salva mensagem do cliente
  await banco.mensagem.create({
    data: { conversaId, remetente: 'cliente', conteudo: mensagemCliente },
  })

  // ── Card de boas-vindas — enviado SOMENTE na primeira mensagem de cada nova sessão ──
  // Inclui horários derivados dos profissionais, diferenciais configurados e link personalizado.
  // Se o cliente trouxer intenção objetiva no mesmo turno, o card sai primeiro e Don responde logo em seguida.
  let mensagemProativa = null
  if (mensagens.length === 0 && !conversa?.modoBarbeiro) {
    try {
      const appUrl_ = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.marcai.com.br'
      const linkSlug_ = tenant.hashPublico || tenant.slug
      const nomeLink_ = validarNomeWhatsApp(
        cliente?.nome !== cliente?.telefone ? cliente?.nome : null
      )
      const telDigitos_ = (cliente?.telefone || '').replace(/\D/g, '')
      const telReal_ = telDigitos_.startsWith('55') && telDigitos_.length >= 12 && telDigitos_.length <= 13

      // Monta link personalizado com tel+nome se telefone real (não LID)
      let linkAg_ = `${appUrl_}/b/${linkSlug_}`
      if (telReal_) {
        linkAg_ += `?tel=${encodeURIComponent(cliente.telefone)}`
        if (nomeLink_) linkAg_ += `&nome=${encodeURIComponent(nomeLink_)}`
      }

      // Busca agendamento futuro ativo (prioridade: mostrar o próximo horário marcado)
      const proxAg_ = clienteId ? await banco.agendamento.findFirst({
        where: { tenantId, clienteId, status: { in: ['AGENDADO', 'CONFIRMADO'] }, inicioEm: { gte: new Date() } },
        orderBy: { inicioEm: 'asc' },
        include: {
          servico: { select: { nome: true } },
          profissional: { select: { nome: true } },
        },
      }) : null

      // Busca último serviço concluído para card de retorno (só usado se não tiver proxAg_)
      const ultimoAg_ = !proxAg_ && clienteId ? await banco.agendamento.findFirst({
        where: { tenantId, clienteId, status: 'CONCLUIDO' },
        orderBy: { inicioEm: 'desc' },
        include: {
          servico: { select: { nome: true } },
          profissional: { select: { nome: true } },
        },
      }) : null

      // ── Horários e diferenciais — só incluídos se apresentacaoSalaoAtivo ───
      let horariosFmt_ = ''
      const incluirApresentacao_ = tenant.apresentacaoSalaoAtivo !== false
      if (incluirApresentacao_) try {
        const profsHorario_ = await banco.profissional.findMany({
          where: { tenantId, ativo: true },
          select: { horarioTrabalho: true },
        })
        const DIAS_BR_ = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        const diasAtivos_ = {}
        for (const p_ of profsHorario_) {
          const ht_ = p_.horarioTrabalho || {}
          for (let d_ = 0; d_ <= 6; d_++) {
            const dia_ = ht_[d_] || ht_[String(d_)]
            if (dia_?.ativo && dia_.inicio && dia_.fim) {
              if (!diasAtivos_[d_]) {
                diasAtivos_[d_] = { inicio: dia_.inicio, fim: dia_.fim }
              } else {
                if (dia_.inicio < diasAtivos_[d_].inicio) diasAtivos_[d_].inicio = dia_.inicio
                if (dia_.fim > diasAtivos_[d_].fim) diasAtivos_[d_].fim = dia_.fim
              }
            }
          }
        }
        const fmtH_ = (hhmm) => {
          const [h_, m_] = hhmm.split(':')
          return m_ === '00' ? `${parseInt(h_)}h` : `${parseInt(h_)}h${m_}`
        }
        // Ordena Seg→Sáb→Dom e agrupa dias consecutivos com mesmo horário
        const ordem_ = [1, 2, 3, 4, 5, 6, 0].filter(d_ => diasAtivos_[d_])
        if (ordem_.length > 0) {
          const grupos_ = []
          let g_ = null
          for (const d_ of ordem_) {
            const info_ = diasAtivos_[d_]
            const chave_ = `${info_.inicio}-${info_.fim}`
            if (!g_ || g_.chave !== chave_) {
              if (g_) grupos_.push(g_)
              g_ = { dias: [d_], chave: chave_, inicio: info_.inicio, fim: info_.fim }
            } else {
              g_.dias.push(d_)
            }
          }
          if (g_) grupos_.push(g_)
          horariosFmt_ = grupos_.map(grp_ => {
            const nomeDias_ = grp_.dias.length === 1
              ? DIAS_BR_[grp_.dias[0]]
              : `${DIAS_BR_[grp_.dias[0]]}–${DIAS_BR_[grp_.dias[grp_.dias.length - 1]]}`
            return `${nomeDias_} ${fmtH_(grp_.inicio)} às ${fmtH_(grp_.fim)}`
          }).join(' | ')
        }
      } catch { /* horários indisponíveis — omite do card */ }

      // ── Diferenciais configurados pelo salão ─────────────────────────────
      const labDif_ = {
        sinuca: 'sinuca', wifi: 'Wi-Fi', tv: 'TV', estacionamento: 'estacionamento',
        cafezinho: 'cafezinho', cerveja: 'cerveja', ar_condicionado: 'ar-condicionado',
        musica_ao_vivo: 'música ao vivo', venda_produtos: 'produtos',
      }
      const diferenciais_ = incluirApresentacao_ && Array.isArray(tenant.diferenciais) && tenant.diferenciais.length > 0
        ? tenant.diferenciais.map(d_ => labDif_[d_] || d_).join(', ')
        : ''

      // Verifica se é cliente recorrente: tem agendamento concluído OU já teve conversa anterior
      const temConversaAnterior_ = clienteId ? await banco.conversa.count({
        where: { tenantId, clienteId, id: { not: conversaId } },
      }) : 0
      const ehRecorrente_ = !!(ultimoAg_ || temConversaAnterior_ > 0)

      // ── Monta o card ─────────────────────────────────────────────────────
      const saudacao_ = nomeLink_ ? `Fala, ${nomeLink_.split(' ')[0]}! 👋` : `Fala! 👋`
      let msgLink_

      if (proxAg_) {
        // Tem agendamento futuro — mostra o horário e opções
        const tz_ = tenant.timezone || 'America/Sao_Paulo'
        const horaFmt_ = new Date(proxAg_.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz_ })
        const dataFmt_ = new Date(proxAg_.inicioEm).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz_ })
        msgLink_ = [
          saudacao_,
          ``,
          `Dei uma olhada aqui e seu horário já está reservado 💈`,
          ``,
          `🕒 ${horaFmt_} (${dataFmt_})`,
          ``,
          `Se quiser, posso:`,
          `✔️ Confirmar`,
          `🔄 Buscar outro horário`,
          `❌ Cancelar`,
        ].join('\n')
      } else if (ehRecorrente_) {
        // Cliente recorrente sem agendamento futuro — card direto ao ponto
        msgLink_ = [
          saudacao_,
          ``,
          `Aqui é o Don, assistente virtual da ${tenant.nome} 💈`,
          ``,
          `Quer agendar seu horário? Pode escolher pelo link ou me fala aqui que eu marco pra você:`,
          `🗓️ ${linkAg_}`,
        ].join('\n')
      } else {
        // Novo cliente — card completo com horários e diferenciais
        const linhas_ = []
        linhas_.push(`Oi${nomeLink_ ? `, ${nomeLink_}` : ''}! Aqui é o Don, assistente virtual da ${tenant.nome} 💈`)
        if (horariosFmt_) linhas_.push(`📅 ${horariosFmt_}`)
        if (diferenciais_) linhas_.push(`✨ ${diferenciais_}`)
        linhas_.push(``)
        linhas_.push(`Você pode agendar pelo link ou me fala aqui que eu marco pra você:`)
        linhas_.push(`🗓️ ${linkAg_}`)
        msgLink_ = linhas_.join('\n')
      }

      // Salva no histórico para manter o contexto do card de boas-vindas.
      await banco.mensagem.create({ data: { conversaId, remetente: 'ia', conteudo: msgLink_ } })
      await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } }).catch(() => {})

      mensagemProativa = msgLink_

      // Em saudação pura, o card resolve o turno sozinho.
      // Se o cliente já veio com intenção objetiva, o fluxo segue para a IA responder no mesmo turno.
      if (soCumprimentouAgora && !trouxeIntencaoObjetivaAgora) {
        return { resposta: '', mensagemProativa: msgLink_, escalonado: false, encerrado: false }
      }
    } catch (errLink_) {
      console.warn('[Don] Falha ao gerar card de boas-vindas:', errLink_.message)
    }
  }

  const historicoMensagens = [
    ...mensagensContextoAnterior,
    ...mensagens,
  ]

  // Normaliza mensagem antes de enviar ao LLM:
  // 1. CAPS LOCK → lowercase (evita confusão do modelo, preserva intenção)
  // 2. Abreviações BR comuns → forma completa (melhora reconhecimento de intenção)
  const mensagemParaLLM = (() => {
    let txt = mensagemCliente
    // CAPS: converte se > 60% dos chars alfabéticos são maiúsculos
    const letras = txt.replace(/[^a-zA-ZÀ-ú]/g, '')
    const maiusculas = letras.replace(/[^A-ZÁÀÂÃÉÊÍÓÔÕÚ]/g, '')
    if (letras.length >= 4 && maiusculas.length / letras.length > 0.6) {
      txt = txt.toLowerCase()
    }
    // Abreviações BR frequentes
    txt = txt
      .replace(/\bhj\b/gi, 'hoje')
      .replace(/\bamh\b|\bamhã\b/gi, 'amanhã')
      .replace(/\bvc\b/gi, 'você')
      .replace(/\bpq\b/gi, 'porque')
      .replace(/\btb\b|\ttbm\b/gi, 'também')
      .replace(/\bmsm\b/gi, 'mesmo')
      .replace(/\bq\b/gi, 'que')
    return txt
  })()

  let mensagensIA = [
    { role: 'system', content: systemPrompt },
    ...historicoMensagens,
    { role: 'user', content: mensagemParaLLM },
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
  const prefereUltimoHorario = ehPedidoUltimoHorario(mensagemNormalizada)
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

  // ── NPS: dígito isolado 1-5 → feedback determinístico (antes do LLM para não ser capturado como horário) ──
  const ehNpsIsolado = /^[1-5]$/.test(mensagemCliente.trim()) && !primeiroContato
  if (ehNpsIsolado) {
    const nota = parseInt(mensagemCliente.trim(), 10)

    // Tenta registrar no último agendamento concluído do cliente (best effort)
    if (clienteId) {
      const ultimoAg = await banco.agendamento.findFirst({
        where: { tenantId, clienteId, status: 'CONCLUIDO' },
        orderBy: { inicioEm: 'desc' },
      }).catch(() => null)
      if (ultimoAg) {
        await banco.agendamento.update({
          where: { id: ultimoAg.id },
          data: { feedbackNota: nota },
        }).catch(() => {})
      }
    }

    const primeiroNome = extrairPrimeiroNome(cliente?.nome)
    let respostaNps
    if (nota <= 2) {
      respostaNps = `Que pena ouvir isso, ${primeiroNome}. Vou te conectar com a equipe agora.`
      escalonado = true
      await banco.conversa.update({
        where: { id: conversaId },
        data: { status: 'ESCALONADA', motivoEscalacao: `NPS baixo: ${nota}` },
      }).catch(() => {})
    } else if (nota === 3) {
      respostaNps = `Obrigado pelo feedback, ${primeiroNome}! Se quiser contar o que aconteceu, pode falar.`
    } else {
      respostaNps = `Que bom, ${primeiroNome}! Fico feliz. Até a próxima! 💈`
    }

    await banco.mensagem.create({ data: { conversaId, remetente: 'ia', conteudo: respostaNps } })
    await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } }).catch(() => {})

    return { resposta: respostaNps, escalonado, encerrado: false }
  }

  // ── Handler pré-LLM: data/horário curto com serviço no contexto ──────────
  // Ex: "hj", "hoje", "amanha", "às 15h", "14h" sozinhos — evita LLM retornar vazio
  const ehDataOuHoraIsolada = (
    /^(hj|hoje|agora|amanha|amanhã|depois de amanha|depois de amanhã)$/i.test(mensagemCliente.trim())
    || /^(\d{1,2}h(\d{2})?|às \d{1,2}h|as \d{1,2}h|\d{2}:\d{2})$/i.test(mensagemCliente.trim())
  )
  if (ehDataOuHoraIsolada && !primeiroContato) {
    const resgatePreLLM = await montarRespostaResgateHorario({
      tenant,
      mensagens,
      mensagemNormalizada,
      clienteNome: extrairPrimeiroNome(cliente?.nome),
      ultimaMensagemIANormalizada,
    }).catch(() => null)
    if (resgatePreLLM) {
      await banco.mensagem.create({ data: { conversaId, remetente: 'ia', conteudo: resgatePreLLM } })
      await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })
      return { resposta: resgatePreLLM, escalonado: false, encerrado: false }
    }
  }

  const respostaRemarcacaoDeterministica = await executarRemarcacaoDeterministicaSeAplicavel({
    tenantId,
    mensagens,
    mensagemNormalizada,
    ultimaMensagemIAVisivel,
  })
  if (respostaRemarcacaoDeterministica) {
    const respostaAjustada = corrigirTextoPadraoPtBr(respostaRemarcacaoDeterministica)
    await banco.mensagem.create({ data: { conversaId, remetente: 'ia', conteudo: respostaAjustada } })
    await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })
    return { resposta: respostaAjustada, escalonado: false, encerrado: false }
  }

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
    const respostaBarbeiroDeterministica = barbeiroAvaliandoSistema
      ? montarRespostaModoBarbeiro({ mensagemNormalizada, tenant })
      : null
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

    respostaFinal = respostaBarbeiroDeterministica || await responderSemFerramentas({
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

  if (!anthropic) {
    respostaFinal = fallbackAleatorio()
    await banco.mensagem.create({
      data: { conversaId, remetente: 'sistema', conteudo: 'IA indisponível: ANTHROPIC_API_KEY não configurada.' },
    }).catch(() => {})
    await banco.mensagem.create({
      data: { conversaId, remetente: 'ia', conteudo: respostaFinal },
    })
    return { resposta: respostaFinal, escalonado: false, encerrado: false }
  }

  // Loop de tool_use (Anthropic Claude) — continua até o modelo retornar texto
  let iteracoesTransicao = 0
  const modeloEscolhido = usarModeloComplexo
    ? (configIA.modeloAnthropicComplexo || configIA.modeloAnthropic || configIA.modelo)
    : (configIA.modeloAnthropic || configIA.modelo)

  const todasMensagens = [...historicoMensagens]
  const claudeMessagesRaw = []

  for (const m of todasMensagens) {
    if (m.remetente === 'sistema' || m.remetente.startsWith('nota_interna:')) continue

    if (m.remetente === 'tool_call') {
      try {
        const parsed = JSON.parse(m.conteudo)
        const tcs = parsed.tool_calls || []
        const content = []

        if (parsed.content) content.push({ type: 'text', text: parsed.content })

        for (const tc of tcs) {
          let input = {}
          try {
            input = typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments || '{}')
              : (tc.input || {})
          } catch {
            input = tc.input || {}
          }

          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function?.name || tc.name,
            input,
          })
        }

        if (content.length > 0) claudeMessagesRaw.push({ role: 'assistant', content })
      } catch {}
      continue
    }

    if (m.remetente === 'tool_result') {
      try {
        const parsed = JSON.parse(m.conteudo)
        claudeMessagesRaw.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: parsed.tool_call_id, content: parsed.content }],
        })
      } catch {}
      continue
    }

    if (m.remetente === 'ia' || m.remetente.startsWith('humano:')) {
      claudeMessagesRaw.push({ role: 'assistant', content: m.remetente.startsWith('humano:') ? `[Atendente]: ${m.conteudo}` : m.conteudo })
    } else {
      claudeMessagesRaw.push({ role: 'user', content: m.conteudo })
    }
  }

  const claudeMessagesLimpo = []
  for (const m of claudeMessagesRaw) {
    const ultimo = claudeMessagesLimpo[claudeMessagesLimpo.length - 1]
    if (ultimo && ultimo.role === m.role && typeof ultimo.content === 'string' && typeof m.content === 'string') {
      ultimo.content += '\n' + m.content
    } else {
      claudeMessagesLimpo.push({ ...m })
    }
  }

  const ultimoRole = claudeMessagesLimpo.length > 0 ? claudeMessagesLimpo[claudeMessagesLimpo.length - 1].role : null
  if (ultimoRole === 'user' && typeof claudeMessagesLimpo[claudeMessagesLimpo.length - 1].content === 'string') {
    claudeMessagesLimpo[claudeMessagesLimpo.length - 1].content += '\n' + mensagemParaLLM
  } else {
    claudeMessagesLimpo.push({ role: 'user', content: mensagemParaLLM })
  }

  const validarHistoricoClaude = (msgs) => {
    let historicoValido = true
    const toolUseIds = new Set()
    const toolResultIds = new Set()

    for (let i = 0; i < msgs.length; i += 1) {
      const atual = msgs[i]
      if (!Array.isArray(atual.content)) continue

      const toolUses = atual.content.filter((bloco) => bloco.type === 'tool_use')
      const toolResults = atual.content.filter((bloco) => bloco.type === 'tool_result')

      toolUses.forEach((bloco) => toolUseIds.add(bloco.id))
      toolResults.forEach((bloco) => toolResultIds.add(bloco.tool_use_id))

      if (toolUses.length > 0) {
        const proxima = msgs[i + 1]
        const proximosResultados = Array.isArray(proxima?.content)
          ? proxima.content.filter((bloco) => bloco.type === 'tool_result')
          : []
        const idsEsperados = toolUses.map((bloco) => bloco.id).sort()
        const idsRecebidos = proximosResultados.map((bloco) => bloco.tool_use_id).sort()

        if (
          atual.role !== 'assistant'
          || !proxima
          || proxima.role !== 'user'
          || idsEsperados.length !== idsRecebidos.length
          || idsEsperados.some((id, index) => id !== idsRecebidos[index])
        ) {
          historicoValido = false
          break
        }
      }
    }

    const useOrfaos = [...toolUseIds].filter((id) => !toolResultIds.has(id))
    const resultOrfaos = [...toolResultIds].filter((id) => !toolUseIds.has(id))

    if (historicoValido && useOrfaos.length === 0 && resultOrfaos.length === 0) return msgs

    console.warn(`[Claude] Histórico corrompido: ${useOrfaos.length} tool_use órfãos, ${resultOrfaos.length} tool_result órfãos. Usando histórico limpo.`)
    return msgs
      .map((m) => {
        if (Array.isArray(m.content)) {
          const textos = m.content
            .filter((bloco) => bloco.type === 'text')
            .map((bloco) => bloco.text)
            .join('\n')
          return textos ? { role: m.role, content: textos } : null
        }
        return m
      })
      .filter(Boolean)
  }

  let claudeMessages = validarHistoricoClaude(claudeMessagesLimpo)

  while (true) {
    const resposta = await anthropic.messages.create({
      model: modeloEscolhido,
      max_tokens: configIA.maxTokens,
      system: systemPrompt,
      tools: ferramentasClaude,
      messages: claudeMessages,
    })

    const toolUseBlocks = resposta.content.filter((bloco) => bloco.type === 'tool_use')
    const textBlocks = resposta.content.filter((bloco) => bloco.type === 'text')
    const textoRetornado = textBlocks.map((bloco) => bloco.text).join('\n').trim()

    if (toolUseBlocks.length > 0) {
      claudeMessages.push({ role: 'assistant', content: resposta.content })

      for (const tu of toolUseBlocks) {
        await banco.mensagem.create({
          data: {
            conversaId,
            remetente: 'tool_call',
            conteudo: JSON.stringify({
              role: 'assistant',
              content: textBlocks.length > 0 ? textoRetornado : undefined,
              tool_calls: [{
                id: tu.id,
                type: 'function',
                function: { name: tu.name, arguments: JSON.stringify(tu.input || {}) },
              }],
            }),
          },
        })
      }

      const toolResults = []
      for (const tu of toolUseBlocks) {
        let parametros = tu.input || {}

        if (tu.name === 'enviarLinkAgendamento' && clienteId && !parametros.clienteId) {
          parametros.clienteId = clienteId
        }

        if (['verificarDisponibilidade', 'verificarDisponibilidadeCombo'].includes(tu.name)) {
          if (dataDesejadaDaMensagem && parametros.data !== dataDesejadaDaMensagem) parametros.data = dataDesejadaDaMensagem
          if (!parametros.horaDesejada) parametros.horaDesejada = horaDesejadaDaMensagem || horaDesejadaPorTurno || horaDesejadaParaAlternativa || undefined
          if (prefereUltimoHorario && !parametros.horaDesejada) parametros.preferenciaHorario = 'ULTIMO'
        }

        const resultadoCadastroInvalido = bloquearConfirmacaoSemCadastroValido({ nomeFerramenta: tu.name, cliente })
        const resultadoBloqueadoHorario = await bloquearConfirmacaoDeHorarioAntigo({ tenantId, tenant, nomeFerramenta: tu.name, parametros, mensagemNormalizada })
        const resultadoBloqueado = resultadoCadastroInvalido || resultadoBloqueadoHorario
        const resultado = resultadoBloqueado || await executarFerramenta(tenantId, tu.name, parametros)
        const resultadoStr = JSON.stringify(resultado)

        if (tu.name === 'escalonarParaHumano' && !resultadoBloqueado) {
          escalonado = true
          await banco.conversa.update({
            where: { id: conversaId },
            data: { status: 'ESCALONADA', motivoEscalacao: parametros.motivo },
          })
        }

        if (tu.name === 'encerrarConversa' && !resultadoBloqueado) {
          encerrado = true
          await banco.conversa.update({ where: { id: conversaId }, data: { status: 'ENCERRADA' } })
          await banco.mensagem.create({ data: { conversaId, remetente: 'sistema', conteudo: 'Conversa encerrada pela IA.' } })
        }

        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultadoStr })
        await banco.mensagem.create({
          data: { conversaId, remetente: 'tool_result', conteudo: JSON.stringify({ tool_call_id: tu.id, name: tu.name, content: resultadoStr }) },
        })

        if (tu.name === 'encerrarConversa' && !resultadoBloqueado) {
          const { processarAprendizadoConversa } = require('./aprendizado')
          processarAprendizadoConversa(tenantId, conversaId).catch(() => {})
        }

        if (resultado?.bloqueadoCadastro && resultado?.mensagemParaCliente) {
          respostaFinal = resultado.mensagemParaCliente
          break
        }

        if (['criarAgendamento', 'criarAgendamentoCombo', 'remarcarAgendamento'].includes(tu.name) && resultado?.sucesso && resultado?.INSTRUCAO) {
          const cardMatch = resultado.INSTRUCAO.match(/\n\n([\s\S]+)$/)
          if (cardMatch) {
            respostaFinal = cardMatch[1].trim()
            for (const tuRestante of toolUseBlocks.filter((item) => item.id !== tu.id && !toolResults.some((tr) => tr.tool_use_id === item.id))) {
              try {
                const resRestante = await executarFerramenta(tenantId, tuRestante.name, tuRestante.input || {})
                const resStr = JSON.stringify(resRestante)
                toolResults.push({ type: 'tool_result', tool_use_id: tuRestante.id, content: resStr })
                await banco.mensagem.create({
                  data: { conversaId, remetente: 'tool_result', conteudo: JSON.stringify({ tool_call_id: tuRestante.id, name: tuRestante.name, content: resStr }) },
                })
              } catch {}
            }
            break
          }
        }
      }
      if (respostaFinal) break
      claudeMessages.push({ role: 'user', content: toolResults })
      continue
    }

    const textoLower = textoRetornado.toLowerCase()
    const ehFraseTransicao = ['deixa eu ver', 'vou checar', 'vou verificar', 'vou ver', 'vou olhar', 'um momento', 'deixa eu consultar', 'vou consultar'].some((f) => textoLower.includes(f))

    if (ehFraseTransicao && iteracoesTransicao < 2) {
      iteracoesTransicao++
      claudeMessages.push({ role: 'assistant', content: textoRetornado })
      claudeMessages.push({ role: 'user', content: '[Sistema: chame a ferramenta AGORA. NÃO escreva texto de transição.]' })
      continue
    }

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

  if (
    respostaFinal
    && ehRespostaCurtaComNome(mensagemCliente, iaPerguntouNomeNoTurnoAnterior)
  ) {
    const nomeCliente = cliente?.nome || mensagemCliente
    const respostaPosNome = haviaIntencaoObjetivaAntesDoNome
      ? await montarRespostaPosNomeComIntencaoPendente({
          tenant,
          mensagens,
          clienteNome: nomeCliente,
          ultimaMensagemClienteNormalizada,
        })
      : null
    respostaFinal = respostaPosNome || montarPerguntaPosNome(nomeCliente, tenant.tomDeVoz)
  }

  if (
    respostaFinal
    && /oi pode repetir|nao captei bem|manda de novo|tive um probleminha/i.test(normalizarTextoIntencao(respostaFinal))
  ) {
    const respostaPrecoRapida = await montarRespostaRapidaPreco(tenant.id, mensagemNormalizada)
    if (respostaPrecoRapida) {
      respostaFinal = respostaPrecoRapida
    }
  }

  if (respostaFinal && ehRespostaFallbackGenerica(respostaFinal)) {
    const respostaHorarioResgate = await montarRespostaResgateHorario({
      tenant,
      mensagens,
      mensagemNormalizada,
      clienteNome: cliente?.nome || mensagemCliente,
      ultimaMensagemIANormalizada,
    })

    if (respostaHorarioResgate) {
      respostaFinal = respostaHorarioResgate
    }
  }

  if (
    respostaFinal
    && clienteSemNomeConhecido
    && /\b(hoje|hj|agora|ainda hoje)\b/.test(mensagemNormalizada)
    && /como voce prefere ser chamado|qual o seu nome|como posso te chamar|com quem eu falo/i.test(normalizarTextoIntencao(respostaFinal))
    && !/\b(hoje|hj|horario|vaga)\b/.test(normalizarTextoIntencao(respostaFinal))
  ) {
    respostaFinal = 'Consigo te ajudar com horario pra hoje sim. Como voce prefere ser chamado?'
  }

  // Auto-append link de agendamento
  const appUrl = process.env.APP_URL || 'https://app.marcai.com.br'
  const linkSite = `${appUrl}/b/${tenant.hashPublico || tenant.slug}`
  const clientePediuLinkAgendaDireto = /link.*agenda|agenda.*link|ver sozinho|agendar sozinho|me manda o link|manda o link do site|manda o link da agenda/i.test(mensagemNormalizada)
  if (respostaFinal && clientePediuLinkAgendaDireto && !escalonado) {
    respostaFinal = `Claro! Segue o link pra ver a agenda:\n🗓️ ${linkSite}`
  }

  if (respostaFinal && ehObjecaoPreco(mensagemNormalizada) && !respostaJaTrataObjecaoPreco(respostaFinal)) {
    const respostaObjecaoPreco = await montarRespostaObjecaoPreco({
      tenantId: tenant.id,
      mensagens,
      mensagemNormalizada,
    })
    if (respostaObjecaoPreco) {
      respostaFinal = respostaObjecaoPreco
    }
  }

  if (respostaFinal && clientePerguntouPagamento(mensagemNormalizada) && !respostaJaFalaPagamento(respostaFinal)) {
    const respostaPagamento = montarRespostaPagamentoCurta(tenant)
    if (respostaPagamento) {
      respostaFinal = `${respostaPagamento} ${respostaFinal}`.trim()
    }
  }

  if (respostaFinal && clientePerguntouPagamento(mensagemNormalizada) && respostaPuxaTriagemServico(respostaFinal)) {
    respostaFinal = montarRespostaPagamentoCurta(tenant) || respostaFinal
  }

  if (
    respostaFinal
    && clientePerguntouProduto(mensagemNormalizada)
    && (!tenant.estoqueAtivo || !respostaJaFalaProduto(respostaFinal) || /que pena ouvir isso|conectar com a equipe/i.test(normalizarTextoIntencao(respostaFinal)))
  ) {
    const respostaProduto = await montarRespostaProdutoCurta(tenant.id, tenant)
    if (respostaProduto) {
      respostaFinal = respostaProduto
    }
  }

  if (respostaFinal && !respostaFinal.includes(linkSite) && !respostaFinal.includes('🗓️')) {
    const ehConfirmacao = respostaFinal.includes('✅ Agendado') || respostaFinal.includes('✅ Marcado')
    const ehConclusaoAgenda = respostaFechaFluxoDeAgenda(respostaFinal)
    const ehEscalacao = respostaFinal.includes('equipe agora') || escalonado
    // Detecta se a IA está ativamente oferecendo um slot específico ao cliente
    const sugerindoHorario = /pode ser\??|dá certo\??|fecha\??|te serve\??|fica bom\??|quer esse\??|que tal\??|topa\??|serve pra voc/i.test(respostaFinal)
    // Só envia o link quando o assunto é agendamento/horário
    const assuntoEhAgendamento = /horario|horário|agendar|agendamento|marcar|disponib|corte|barba|servico|serviço|atend|vaga|dia|hoje|amanha|amanhã|semana|encaixe/i.test(mensagemNormalizada)
    const linkJaEnviado = mensagens.some(m => m.conteudo?.includes('🗓️'))

    if (!ehConfirmacao && !ehConclusaoAgenda && !ehEscalacao && sugerindoHorario) {
      // Sugeriu horário — link como alternativa para escolher sozinho
      respostaFinal += `\n\nSe preferir escolher sozinho, é só acessar:\n🗓️ ${linkSite}`
    } else if (!ehConfirmacao && !ehConclusaoAgenda && !ehEscalacao && assuntoEhAgendamento && !linkJaEnviado) {
      // Pergunta de agendamento sem link ainda enviado nesta conversa
      respostaFinal += `\n\nVocê pode agendar pelo link ou me fala aqui que eu marco pra você:\n🗓️ ${linkSite}`
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

  respostaFinal = corrigirTextoPadraoPtBr(respostaFinal)

  // Salva resposta final da IA (guarda nulo — evita crash quando LLM retorna vazio)
  if (respostaFinal != null) {
    await banco.mensagem.create({
      data: { conversaId, remetente: 'ia', conteudo: respostaFinal },
    })
  }

  await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })

  // Ao encerrar a conversa: gera resumo e salva em cliente.preferencias para contexto futuro
  // (fire-and-forget — não bloqueia a resposta ao cliente)
  if (encerrado && cliente) {
    gerarESalvarResumo(tenantId, cliente.id, mensagensIA).catch(() => {})
    // Aprendizado: analisa conversa quando encerra
    const { processarAprendizadoConversa } = require('./aprendizado')
    processarAprendizadoConversa(tenantId, conversaId).catch(() => {})
  }

  return { resposta: respostaFinal, escalonado, encerrado, mensagemProativa }
}

// ─── Simular (painel) ─────────────────────────────────────────────────────────

const simularConversa = async (tenantId, mensagem) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  const systemPrompt = await montarSystemPrompt(tenant, null, false, mensagem)

  if (!anthropic) return { resposta: 'IA indisponível: ANTHROPIC_API_KEY não configurada.' }

  const resposta = await anthropic.messages.create({
    model: configIA.modeloAnthropic || configIA.modelo,
    max_tokens: 512,
    system: systemPrompt + '\n\nEsta é uma simulação de demonstração. Não execute ferramentas reais — apenas descreva o que faria em cada etapa.',
    messages: [{ role: 'user', content: mensagem }],
  })

  return { resposta: resposta.content?.find((bloco) => bloco.type === 'text')?.text || 'Erro ao simular.' }
}

// Execução direta de ferramenta pela engine (sem LLM)
const executarFerramentaDireta = async (tenantId, nomeFerramenta, parametros) => {
  try {
    return await executarFerramenta(tenantId, nomeFerramenta, parametros)
  } catch (err) {
    console.error(`[Engine] Erro ao executar ${nomeFerramenta}:`, err.message)
    return null
  }
}

module.exports = { processarMensagem, simularConversa, executarFerramentaDireta }

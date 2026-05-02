const Anthropic = require('@anthropic-ai/sdk')
const configIA = require('../config/ia')
const { TEMPLATES_PADRAO } = require('./mensagensDonTemplates')

const anthropic = configIA.anthropicApiKey ? new Anthropic({ apiKey: configIA.anthropicApiKey }) : null

/** Campos permitidos e placeholders que o texto final DEVE conter (literal) */
const METADADOS = {
  mensagemBoasVindas: {
    descricao: 'Parágrafo do meio do card de boas-vindas (recorrente/novo), substitui o bloco padrão em duas frases',
    obrigatorios: ['{salao}', '{nome}'],
    referencia: `Bem-vindo. Aqui você encontra precisão, estilo e um atendimento diferenciado.\n\nEu cuido do seu agendamento de forma rápida e personalizada.`,
  },
  mensagemForaHorario: {
    descricao: 'Mensagem curta inserida no cérebro da IA para quando a conversa é fora do expediente',
    obrigatorios: ['{salao}', '{hora}'],
    referencia: `A {salao} está fora do horário de atendimento neste momento. Nosso expediente retorna a partir de {hora}. Deixe sua mensagem e respondemos assim que abrirmos.`,
  },
  mensagemRetorno: {
    descricao: 'Lembrete automático pós-serviço (cron) — o texto é enviado com substituição das variáveis, sem reescrever pela IA',
    obrigatorios: ['{nome}', '{servico}', '{dias}', '{salao}'],
    referencia: `Fala, {nome}! Já faz {dias} dias do seu {servico} na {salao} — a manutenção do visual agradece. Quer deixar o próximo horário reservado? Responde aqui que eu ajusto pra você.`,
  },
  lembreteDiaAnterior: {
    descricao: 'Lembrete enviado um dia antes do corte (cron)',
    obrigatorios: ['{saudacao}', '{salao}', '{data}', '{hora}', '{servico}', '{nome}'],
    chaveTemplate: 'lembreteDiaAnterior',
  },
  lembreteNoDia: {
    descricao:
      'Lembretes com menos de 24h antes (lista em Meu Negócio) e a confirmação extra ~1h quando o salão não configurou nenhum lembrete no painel',
    obrigatorios: ['{saudacao}', '{salao}', '{data}', '{hora}', '{servico}', '{nome}'],
    chaveTemplate: 'lembreteNoDia',
  },
  cardComAgendamentoFuturo: {
    descricao: 'Card quando o cliente já tem agendamento futuro',
    obrigatorios: ['{saudacao}', '{hora}', '{data}'],
    chaveTemplate: 'cardComAgendamentoFuturo',
  },
  cardRecorrente: {
    descricao: 'Card para cliente recorrente sem agendamento futuro',
    obrigatorios: ['{salao}'],
    chaveTemplate: 'cardRecorrente',
  },
  cardNovoCliente: {
    descricao: 'Card para primeiro contato, com blocos de horário/diferenciais',
    obrigatorios: ['{salao}', '{horariosLinha}', '{diferenciaisLinha}'],
    chaveTemplate: 'cardNovoCliente',
  },
}

const CAMPOS_PERMITIDOS = Object.keys(METADADOS)

const obterReferencia = (campo) => {
  const m = METADADOS[campo]
  if (m.chaveTemplate) return TEMPLATES_PADRAO[m.chaveTemplate] || ''
  return m.referencia
}

const obterFallback = (campo) => {
  if (METADADOS[campo]?.chaveTemplate) {
    return TEMPLATES_PADRAO[METADADOS[campo].chaveTemplate] || obterReferencia(campo)
  }
  if (campo === 'mensagemBoasVindas') {
    return `Bem-vindo à {salao}, {nome}. Aqui, precisão e estilo caminham juntos, com o mesmo cuidado de quem manda no movimento de uma cadeira de barbearia premium. Eu acompanho seu agendamento de ponta a ponta.`
  }
  if (campo === 'mensagemForaHorario') {
    return `A {salao} não está atendendo agora — o expediente retoma em {hora}. Deixe sua mensagem; a equipe responde no próximo horário útil.`
  }
  if (campo === 'mensagemRetorno') {
    return `E aí, {nome}! {dias} dias do seu {servico} na {salao} — na hora de dar aquele retoque. Bora reservar? Chama aqui que eu ajeito.`
  }
  return obterReferencia(campo)
}

const possuiObrigatorios = (texto, obrigatorios) =>
  obrigatorios.every((p) => typeof texto === 'string' && texto.includes(p))

const limparRespostaIa = (s) => {
  let t = String(s || '').trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return t.trim()
}

/**
 * Gera sugestão profissional (padrão estilo de excelência, referência “Alisson” só no estilo do prompt).
 * Se a IA indisponível ou resposta inválida, retorna o fallback (mesmos textos padrão do sistema).
 */
const gerarSugestaoMensagemDon = async (tenant, campo) => {
  if (!CAMPOS_PERMITIDOS.includes(campo)) {
    throw { status: 400, mensagem: 'Campo inválido', codigo: 'CAMPO_INVALIDO' }
  }
  const meta = METADADOS[campo]
  const ref = obterReferencia(campo)
  const tom = tenant.tomDeVoz || 'ACOLHEDOR'
  const nomeSalao = tenant.nome || 'sua barbearia'

  if (!anthropic) {
    return { texto: obterFallback(campo), origem: 'padrao' }
  }

  const obrigatorios = meta.obrigatorios
  const system = `Você reescreve textos de WhatsApp para barbearia no Brasil, em português (pt-BR), com acentos corretos.
Tom do negócio: ${tom}.
Referência de qualidade (apenas no estilo — não use o nome "Alisson" no texto a menos que seja exigido): comunicação de profissional top, clara, acolhedora, segura, sem jargão de marketing vazio, sem título, sem "Prezado".
PROIBIDO: markdown, negrito com asteriscos, listas com #.
Cada variável entre chaves (ex.: {saudacao}) é placeholder do sistema: deve aparecer LITERALMENTE no texto; não preencha com valores.`

  const user = `Reescreva o texto de referência, mais profissional e fluido, mantendo a MESMA função.
Estabelecimento: ${nomeSalao}
Campo: ${campo}
Sobre: ${meta.descricao}

O texto final DEVE conter TODAS estas sequências, caractere a caractere (placeholders do sistema):
${obrigatorios.map((o) => `- ${o}`).join('\n')}

Texto de referência (pode melhorar a redação, sem remover nenhum placeholder listado acima; pode organizar em mais linhas se precisar):
${ref}

Responda APENAS com o texto do template, sem comentários.`

  try {
    const msg = await anthropic.messages.create({
      model: configIA.modeloAnthropic || 'claude-sonnet-4-6',
      max_tokens: 2000,
      temperature: 0.35,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const bloco = msg.content?.find((b) => b.type === 'text')
    const texto = limparRespostaIa(bloco?.text)
    if (texto && possuiObrigatorios(texto, obrigatorios)) {
      return { texto, origem: 'ia' }
    }
  } catch (e) {
    console.warn('[gerarSugestaoConfigDon] Anthropic:', e?.message || e)
  }

  return { texto: obterFallback(campo), origem: 'padrao' }
}

module.exports = { gerarSugestaoMensagemDon, CAMPOS_PERMITIDOS, METADADOS }

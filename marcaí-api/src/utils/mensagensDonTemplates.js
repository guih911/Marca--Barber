/**
 * Templates padrão (WhatsApp) para lembretes automáticos.
 * Chaves: lembreteDiaAnterior (>=24h antes), lembreteNoDia (mesmo dia, todos os lembretes de Meu Negócio; também confirmação 1h default)
 * Placeholders: {saudacao}, {salao}, {data}, {hora}, {servico}, {nome}
 */

const TEMPLATES_PADRAO = {
  lembreteDiaAnterior: `{saudacao}

Aqui é o Don, assistente virtual da {salao} 💈

Passando para lembrar do seu horário agendado:

📅 {data}
🕒 {hora}
💇 {servico}

Caso precise reagendar, é só me avisar por aqui 👍

Falou, {nome}!

Te esperamos!`,

  lembreteNoDia: `{saudacao}

Seu atendimento na {salao} 💈 está agendado para hoje:

📅 {data}
🕒 {hora}
💇 {servico}

Estamos te aguardando!

Qualquer imprevisto, {nome} — me avise por aqui.`,

  cardComAgendamentoFuturo: `{saudacao}

Dei uma olhada aqui e seu horário já está reservado 💈

🕒 {hora} ({data})

Se quiser, posso:
✔️ Confirmar
🔄 Buscar outro horário
❌ Cancelar`,

  cardRecorrente: `💈 {salao}

Bem-vindo. Aqui você encontra precisão, estilo e um atendimento diferenciado.

Eu cuido do seu agendamento de forma rápida e personalizada.

O que você deseja agora?`,

  cardNovoCliente: `💈 {salao}

Bem-vindo. Aqui você encontra precisão, estilo e um atendimento diferenciado.
{horariosLinha}{diferenciaisLinha}
Eu cuido do seu agendamento de forma rápida e personalizada.

O que você deseja agora?`,
}

const obterMapaMerge = (tenant) => {
  const raw = tenant?.configMensagensDon
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  return {}
}

const obterTemplateLembrete = (tenant, chave) => {
  const merge = obterMapaMerge(tenant)
  const v = merge[chave]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return TEMPLATES_PADRAO[chave] || ''
}

const preencherPlaceholders = (texto, ctx = {}) => {
  if (!texto) return ''
  let s = String(texto)
  const mapa = {
    saudacao: ctx.saudacao ?? '',
    salao: ctx.salao ?? ctx.nomeSalao ?? '',
    data: ctx.data ?? '',
    hora: ctx.hora ?? ctx.horario ?? '',
    horario: ctx.horario ?? ctx.hora ?? '',
    servico: ctx.servico ?? '',
    nome: ctx.nome ?? '',
    dias: ctx.dias ?? '',
    horariosLinha: ctx.horariosLinha ?? '',
    diferenciaisLinha: ctx.diferenciaisLinha ?? '',
  }
  for (const [k, v] of Object.entries(mapa)) {
    s = s.split(`{${k}}`).join(v)
  }
  return s
}

const montarMensagemLembreteDinamica = (tenant, ag, { maisde24h = false } = {}) => {
  const tz = tenant.timezone || 'America/Sao_Paulo'
  const dt = new Date(ag.inicioEm)
  const dataFmt = dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  })
  const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const primeiroNome = ag.cliente?.nome?.split(' ')[0] || null
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! 👋` : `Olá! 👋`
  const chave = maisde24h ? 'lembreteDiaAnterior' : 'lembreteNoDia'
  const template = obterTemplateLembrete(tenant, chave)
  return preencherPlaceholders(template, {
    saudacao,
    salao: tenant.nome,
    data: dataFmt,
    hora: horaFmt,
    servico: ag.servico?.nome || 'Serviço',
    nome: primeiroNome || 'você',
  })
}

const obterTemplateCard = (tenant, chave) => {
  const merge = obterMapaMerge(tenant)
  const v = merge[chave]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return TEMPLATES_PADRAO[chave] || ''
}

/**
 * Card de boas-vindas (primeira mensagem) — agendamento futuro já existente
 */
const montarCardComAgendamentoFuturo = (tenant, { saudacao, dataFmt, horaFmt }) => {
  const tpl = obterTemplateCard(tenant, 'cardComAgendamentoFuturo')
  return preencherPlaceholders(tpl, {
    saudacao,
    salao: tenant.nome,
    data: dataFmt,
    hora: horaFmt,
    horario: horaFmt,
  })
}

const montarCardRecorrente = (tenant) => {
  const tpl = obterTemplateCard(tenant, 'cardRecorrente')
  return preencherPlaceholders(tpl, { salao: tenant.nome, horariosLinha: '', diferenciaisLinha: '' })
}

const montarCardNovoCliente = (tenant, { horariosLinha, diferenciaisLinha }) => {
  const tpl = obterTemplateCard(tenant, 'cardNovoCliente')
  return preencherPlaceholders(tpl, {
    salao: tenant.nome,
    horariosLinha,
    diferenciaisLinha,
  })
}

/**
 * Aplica mensagem de boas-vindas do tenant (campo) no miolo dos cards recorrente/novo, preservando título e CTA padrão.
 */
const injetarMensagemBoasVindasNoCard = (texto, mensagemCustom) => {
  const c = String(mensagemCustom || '').trim()
  if (!c) return texto
  // Substitui o bloco fixo "Bem-vindo...diferenciado" + parágrafo "Eu cuido..." por um único bloco custom
  return texto.replace(
    /Bem-vindo\. Aqui você encontra precisão, estilo e um atendimento diferenciado\.\s*\n\s*\nEu cuido do seu agendamento de forma rápida e personalizada\./s,
    c
  )
}

const montarMensagemConfirmacao1hDinamica = (tenant, ag) => {
  const tz = tenant.timezone || 'America/Sao_Paulo'
  const horaFmt = new Date(ag.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const primeiroNome = ag.cliente?.nome?.split(' ')[0] || null
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! 👋` : `Olá! 👋`
  const dataFmt = new Date(ag.inicioEm).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  })
  const m = obterMapaMerge(tenant)
  // Confirmação de presença: usa template dedicado quando configurado.
  const tpl =
    (m.lembreteConfirmacao1h && String(m.lembreteConfirmacao1h).trim()) || `{saudacao}

Seu horário na {salao} 💈 está reservado:

📅 {data}
🕒 {hora}
💇 {servico}

Você confirma presença?`
  return preencherPlaceholders(tpl, {
    saudacao,
    salao: tenant.nome,
    data: dataFmt,
    hora: horaFmt,
    servico: ag.servico?.nome || 'Serviço',
    nome: primeiroNome || 'você',
  })
}

module.exports = {
  TEMPLATES_PADRAO,
  obterMapaMerge,
  obterTemplateLembrete,
  obterTemplateCard,
  preencherPlaceholders,
  montarMensagemLembreteDinamica,
  montarMensagemConfirmacao1hDinamica,
  montarCardComAgendamentoFuturo,
  montarCardRecorrente,
  montarCardNovoCliente,
  injetarMensagemBoasVindasNoCard,
}

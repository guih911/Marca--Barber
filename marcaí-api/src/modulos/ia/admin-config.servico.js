const OpenAI = require('openai')
const configIA = require('../../config/ia')
const banco = require('../../config/banco')
const tenantServico = require('../tenant/tenant.servico')
const planosServico = require('../planos/planos.servico')
const profissionaisServico = require('../profissionais/profissionais.servico')

const openai = configIA.apiKey ? new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL }) : null

const ACOES_SUPORTADAS = [
  'ajuda',
  'resumo',
  'atualizar_negocio',
  'atualizar_recursos',
  'criar_plano',
  'listar_assinaturas_atrasadas',
  'registrar_pagamento_assinatura',
  'atualizar_horario_profissional',
  'bloquear_horario_profissional',
  'registrar_ausencia_profissional',
  'disparar_reativacao',
  'nao_entendido',
]

const soDigitos = (valor) => String(valor || '').replace(/\D/g, '')
const paraNumero = (valor, fallback = null) => {
  const n = Number(valor)
  return Number.isFinite(n) ? n : fallback
}

const removerAcentos = (texto) =>
  String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizarTexto = (texto) =>
  removerAcentos(texto).toLowerCase().trim()

const pad2 = (n) => String(n).padStart(2, '0')

const hojeISO = () => {
  const agora = new Date()
  return `${agora.getFullYear()}-${pad2(agora.getMonth() + 1)}-${pad2(agora.getDate())}`
}

const formatarDataISO = (data) => {
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const formatarDataHora = (data, timezone = 'America/Sao_Paulo') =>
  new Date(data).toLocaleString('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatarMoeda = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const normalizarTelefoneComparacao = (telefone) => {
  const digits = soDigitos(telefone)
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`
  return digits
}

const eNumeroAdministrador = (configWhatsApp, telefoneEntrada) => {
  const numeroAdmin = configWhatsApp?.numeroAdministrador
  if (!numeroAdmin || !telefoneEntrada) return false

  const admin = normalizarTelefoneComparacao(numeroAdmin)
  const entrada = normalizarTelefoneComparacao(telefoneEntrada)
  if (!admin || !entrada) return false

  return admin === entrada || admin.endsWith(entrada) || entrada.endsWith(admin)
}

const parseCamposChaveValor = (texto) => {
  const mapa = {}
  String(texto || '')
    .split(/[\n;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const m = item.match(/^([^:]+):\s*(.+)$/)
      if (!m) return
      const chave = normalizarTexto(m[1]).replace(/\s+/g, '_')
      mapa[chave] = m[2].trim()
    })
  return mapa
}

const normalizarData = (valor) => {
  if (!valor) return null
  if (valor instanceof Date) return formatarDataISO(valor)
  const texto = String(valor).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dd, mm, yyyy] = texto.split('/')
    return `${yyyy}-${mm}-${dd}`
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(texto)) {
    const [dd, mm, yyyy] = texto.split('-')
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

const normalizarHora = (valor) => {
  if (!valor) return null
  const texto = String(valor).trim()
  const match = texto.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${pad2(hh)}:${pad2(mm)}`
}

const DIA_SEMANA_MAP = {
  domingo: 0,
  dom: 0,
  segunda: 1,
  seg: 1,
  segunda_feira: 1,
  terca: 2,
  ter: 2,
  terca_feira: 2,
  quarta: 3,
  qua: 3,
  quarta_feira: 3,
  quinta: 4,
  qui: 4,
  quinta_feira: 4,
  sexta: 5,
  sex: 5,
  sexta_feira: 5,
  sabado: 6,
  sab: 6,
}

const normalizarDiaSemana = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') {
    if (valor >= 0 && valor <= 6) return valor
    return null
  }

  const texto = normalizarTexto(valor).replace(/-/g, '_').replace(/\s+/g, '_')
  if (/^[0-6]$/.test(texto)) return Number(texto)
  return DIA_SEMANA_MAP[texto] ?? null
}

const parsePrecoCentavos = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Math.round(valor * 100)
  const limpo = String(valor).replace(/[R$r$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const num = Number(limpo)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100)
}

const extrairJson = (texto) => {
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    const ini = texto.indexOf('{')
    const fim = texto.lastIndexOf('}')
    if (ini < 0 || fim <= ini) return null
    try {
      return JSON.parse(texto.slice(ini, fim + 1))
    } catch {
      return null
    }
  }
}

const primeiroValor = (...valores) => valores.find((v) => v !== undefined && v !== null && v !== '')

const buscarProfissionalPorBusca = async (tenantId, busca) => {
  const texto = String(busca || '').trim()
  if (!texto) return null

  const where = { tenantId }
  const or = []
  if (/^[0-9a-fA-F-]{36}$/.test(texto)) {
    or.push({ id: texto })
  }
  or.push({ nome: { contains: texto, mode: 'insensitive' } })
  where.OR = or

  return banco.profissional.findFirst({
    where,
    orderBy: { nome: 'asc' },
  })
}

const buscarServicoPorBusca = async (tenantId, busca) => {
  const texto = String(busca || '').trim()
  if (!texto) return null

  const where = { tenantId, ativo: true }
  const or = []
  if (/^[0-9a-fA-F-]{36}$/.test(texto)) {
    or.push({ id: texto })
  }
  or.push({ nome: { contains: texto, mode: 'insensitive' } })
  where.OR = or

  return banco.servico.findFirst({
    where,
    orderBy: { nome: 'asc' },
  })
}

const garantirRecursos = async (tenantId, recursos = {}) => {
  const tenant = await tenantServico.buscarMeu(tenantId)
  const campos = {}

  if (recursos.membershipsAtivo && !tenant.membershipsAtivo) campos.membershipsAtivo = true
  if (recursos.growthAtivo && !tenant.growthAtivo) campos.growthAtivo = true
  if (recursos.cancelamentoMassaAtivo && !tenant.cancelamentoMassaAtivo) campos.cancelamentoMassaAtivo = true

  if (Object.keys(campos).length > 0) {
    await planosServico.atualizarMeu(tenantId, campos)
  }
}

const montarPromptComContexto = async (tenantId, mensagem) => {
  const [tenant, profissionais, servicos, planos] = await Promise.all([
    tenantServico.buscarMeu(tenantId),
    banco.profissional.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 20,
    }),
    banco.servico.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 20,
    }),
    banco.planoAssinatura.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 20,
    }),
  ])

  const hoje = hojeISO()
  const contexto = {
    hoje,
    timezone: tenant.timezone || 'America/Sao_Paulo',
    negocio: {
      nome: tenant.nome,
      membershipsAtivo: tenant.membershipsAtivo,
      growthAtivo: tenant.growthAtivo,
      cancelamentoMassaAtivo: tenant.cancelamentoMassaAtivo,
    },
    profissionais,
    servicos,
    planos,
    acoes: ACOES_SUPORTADAS,
  }

  return {
    system:
      'Voce interpreta mensagens administrativas de WhatsApp para um sistema de barbearia.' +
      ' Responda APENAS JSON valido, sem markdown.' +
      ' Estrutura: {"acao":"...","confianca":0.0,"dados":{...}}.' +
      ' Use uma acao da lista enviada. Se nao for comando administrativo, use "nao_entendido".' +
      ' Converta datas para YYYY-MM-DD e horarios para HH:mm.' +
      ' Em acao atualizar_horario_profissional use diaSemana (0-6) ou diasSemana ([0-6]).' +
      ' Em registrar_pagamento_assinatura inclua assinaturaId OU clienteBusca.' +
      ' Em criar_plano use precoCentavos em inteiro e cicloDias em inteiro.',
    user: JSON.stringify({ contexto, mensagem }, null, 2),
  }
}

const interpretarComandoNatural = async ({ tenantId, mensagem }) => {
  if (!openai) return null

  try {
    const { system, user } = await montarPromptComContexto(tenantId, mensagem)
    const resp = await openai.chat.completions.create({
      model: configIA.modelo,
      temperature: 0,
      max_tokens: 350,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })

    const bruto = resp.choices?.[0]?.message?.content?.trim()
    const json = extrairJson(bruto)
    if (!json || !json.acao || !ACOES_SUPORTADAS.includes(json.acao)) return null

    const confianca = Number(json.confianca || 0)
    if (json.acao === 'nao_entendido') return json
    if (confianca < 0.45) return null
    return json
  } catch (err) {
    console.warn('[Admin WhatsApp] Falha no parser natural:', err.message)
    return null
  }
}

const interpretarComandoPrefixadoAdmin = (mensagem) => {
  if (!mensagem) return null
  if (!/^admin\b/i.test(mensagem.trim())) return null

  const resto = mensagem.trim().replace(/^admin\b[:\s-]*/i, '').trim()
  if (!resto) return { acao: 'ajuda', dados: {} }

  const normalizado = normalizarTexto(resto)
  if (normalizado.startsWith('ajuda')) return { acao: 'ajuda', dados: {} }
  if (normalizado.startsWith('resumo')) return { acao: 'resumo', dados: {} }
  if (normalizado.includes('assinaturas atrasadas')) return { acao: 'listar_assinaturas_atrasadas', dados: {} }

  if (normalizado.startsWith('negocio')) {
    const texto = resto.replace(/^negocio\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'atualizar_negocio',
      dados: {
        nome: primeiroValor(campos.nome, campos.negocio, campos.barbearia),
        telefone: campos.telefone,
        endereco: primeiroValor(campos.endereco, campos.endereco_completo),
        timezone: primeiroValor(campos.timezone, campos.fuso, campos.fuso_horario),
        numeroAdministrador: primeiroValor(campos.numero_administrador, campos.administrador),
      },
    }
  }

  if (normalizado.startsWith('recurso') || normalizado.startsWith('recursos')) {
    const texto = resto.replace(/^recursos?\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    const ativo = (v) => ['1', 'true', 'sim', 'on', 'ativar', 'ativo'].includes(normalizarTexto(v))
    return {
      acao: 'atualizar_recursos',
      dados: {
        membershipsAtivo: campos.memberships ? ativo(campos.memberships) : undefined,
        growthAtivo: campos.growth ? ativo(campos.growth) : undefined,
        cancelamentoMassaAtivo: campos.cancelamento_massa ? ativo(campos.cancelamento_massa) : undefined,
      },
    }
  }

  if (normalizado.startsWith('plano novo') || normalizado.startsWith('plano')) {
    const texto = resto.replace(/^plano(\s+novo)?\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'criar_plano',
      dados: {
        nome: primeiroValor(campos.nome, campos.plano, campos.titulo),
        descricao: campos.descricao,
        precoCentavos: parsePrecoCentavos(primeiroValor(campos.preco, campos.valor)),
        cicloDias: paraNumero(primeiroValor(campos.ciclo, campos.ciclo_dias, campos.dias), 30),
      },
    }
  }

  if (normalizado.startsWith('pagamento')) {
    const texto = resto.replace(/^pagamento\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'registrar_pagamento_assinatura',
      dados: {
        assinaturaId: primeiroValor(campos.assinatura, campos.assinatura_id),
        clienteBusca: primeiroValor(campos.cliente, campos.nome, campos.telefone),
        pagoEm: normalizarData(campos.data) || normalizarData(campos.pago_em) || hojeISO(),
        observacoes: campos.observacoes || campos.obs || null,
      },
    }
  }

  if (normalizado.startsWith('horario')) {
    const texto = resto.replace(/^horario\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'atualizar_horario_profissional',
      dados: {
        profissionalBusca: primeiroValor(campos.profissional, campos.nome),
        diaSemana: primeiroValor(campos.dia, campos.dia_semana),
        inicio: normalizarHora(campos.inicio),
        fim: normalizarHora(campos.fim),
        ativo: campos.ativo === undefined ? true : ['1', 'true', 'sim', 'on'].includes(normalizarTexto(campos.ativo)),
      },
    }
  }

  if (normalizado.startsWith('bloqueio')) {
    const texto = resto.replace(/^bloqueio\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'bloquear_horario_profissional',
      dados: {
        profissionalBusca: primeiroValor(campos.profissional, campos.nome),
        data: normalizarData(campos.data),
        inicio: normalizarHora(primeiroValor(campos.inicio, campos.de)),
        fim: normalizarHora(primeiroValor(campos.fim, campos.ate)),
        motivo: campos.motivo || null,
      },
    }
  }

  if (normalizado.startsWith('ausencia')) {
    const texto = resto.replace(/^ausencia\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'registrar_ausencia_profissional',
      dados: {
        profissionalBusca: primeiroValor(campos.profissional, campos.nome),
        data: normalizarData(campos.data),
        motivo: campos.motivo || null,
      },
    }
  }

  if (normalizado.startsWith('reativacao')) {
    const texto = resto.replace(/^reativacao\b[:\s-]*/i, '')
    const campos = parseCamposChaveValor(texto)
    return {
      acao: 'disparar_reativacao',
      dados: {
        nome: campos.nome,
        diasSemRetorno: paraNumero(primeiroValor(campos.dias, campos.dias_sem_retorno), 60),
        limite: paraNumero(campos.limite, 200),
        mensagem: campos.mensagem,
      },
    }
  }

  return { acao: 'nao_entendido', dados: {} }
}

const respostaAjuda = () => [
  'Sou o Don Admin. Posso configurar o sistema por WhatsApp.',
  'Exemplos rapidos:',
  '- "Atualize o nome do negocio para Barbearia Don Premium"',
  '- "Crie plano mensal Clube Don por 99,90 a cada 30 dias"',
  '- "Marque pagamento do cliente Joao do plano mensal hoje"',
  '- "Ajuste horario do barbeiro Carlos na segunda 09:00 ate 19:00"',
  '- "Bloqueie agenda do Carlos em 2026-03-30 das 14:00 as 16:00"',
  '- "Dispare campanha de reativacao para clientes sem retorno ha 60 dias"',
  '',
  'Comandos com prefixo tambem funcionam: ADMIN AJUDA, ADMIN RESUMO, ADMIN NEGOCIO, ADMIN PLANO, ADMIN HORARIO.',
].join('\n')

const executarResumo = async (tenantId) => {
  const tenant = await tenantServico.buscarMeu(tenantId)
  const hoje = new Date()
  const [clientes, profissionais, servicos, agHoje, campanhas] = await Promise.all([
    banco.cliente.count({ where: { tenantId } }),
    banco.profissional.count({ where: { tenantId, ativo: true } }),
    banco.servico.count({ where: { tenantId, ativo: true } }),
    banco.agendamento.count({
      where: {
        tenantId,
        inicioEm: {
          gte: new Date(`${hojeISO()}T00:00:00`),
          lte: new Date(`${hojeISO()}T23:59:59`),
        },
        status: { in: ['AGENDADO', 'CONFIRMADO'] },
      },
    }),
    banco.campanhaGrowth.count({ where: { tenantId } }),
  ])

  let atrasadas = 0
  if (tenant.membershipsAtivo) {
    const assinaturas = await planosServico.listarAssinaturas(tenantId, {})
    atrasadas = assinaturas.filter((a) => a.situacaoPagamento?.status === 'ATRASADO').length
  }

  return [
    `Resumo de ${tenant.nome}:`,
    `- Clientes: ${clientes}`,
    `- Profissionais ativos: ${profissionais}`,
    `- Servicos ativos: ${servicos}`,
    `- Agendamentos hoje: ${agHoje}`,
    `- Campanhas growth: ${campanhas}`,
    `- Assinaturas atrasadas: ${atrasadas}`,
  ].join('\n')
}

const executarAtualizarNegocio = async (tenantId, dados) => {
  const tenant = await tenantServico.buscarMeu(tenantId)
  const campos = {}

  if (dados.nome) campos.nome = String(dados.nome).trim()
  if (dados.telefone !== undefined) campos.telefone = String(dados.telefone).trim() || null
  if (dados.endereco !== undefined) campos.endereco = String(dados.endereco).trim() || null
  if (dados.timezone) campos.timezone = String(dados.timezone).trim()

  if (dados.numeroAdministrador !== undefined) {
    campos.configWhatsApp = {
      ...(tenant.configWhatsApp || {}),
      numeroAdministrador: String(dados.numeroAdministrador || '').trim() || null,
    }
  }

  if (Object.keys(campos).length === 0) {
    throw { mensagem: 'Nenhum campo valido para atualizar negocio.' }
  }

  const atualizado = await tenantServico.atualizar(tenantId, campos)
  return [
    'Negocio atualizado com sucesso.',
    `Nome: ${atualizado.nome}`,
    `Telefone: ${atualizado.telefone || '-'}`,
    `Endereco: ${atualizado.endereco || '-'}`,
    `Fuso: ${atualizado.timezone || '-'}`,
  ].join('\n')
}

const executarAtualizarRecursos = async (tenantId, dados) => {
  const campos = {}
  if (dados.membershipsAtivo !== undefined) campos.membershipsAtivo = Boolean(dados.membershipsAtivo)
  if (dados.growthAtivo !== undefined) campos.growthAtivo = Boolean(dados.growthAtivo)
  if (dados.cancelamentoMassaAtivo !== undefined) campos.cancelamentoMassaAtivo = Boolean(dados.cancelamentoMassaAtivo)

  if (Object.keys(campos).length === 0) {
    throw { mensagem: 'Informe ao menos um recurso para atualizar.' }
  }

  const atualizado = await planosServico.atualizarMeu(tenantId, campos)
  return [
    'Recursos atualizados.',
    `- membershipsAtivo: ${atualizado.membershipsAtivo ? 'sim' : 'nao'}`,
    `- growthAtivo: ${atualizado.growthAtivo ? 'sim' : 'nao'}`,
    `- cancelamentoMassaAtivo: ${atualizado.cancelamentoMassaAtivo ? 'sim' : 'nao'}`,
  ].join('\n')
}

const mapearCreditos = async (tenantId, creditos) => {
  if (!Array.isArray(creditos) || creditos.length === 0) return []

  const resolvidos = []
  for (const item of creditos) {
    const buscaServico = primeiroValor(item?.servicoId, item?.servico, item?.servicoNome, item?.nome)
    const servico = await buscarServicoPorBusca(tenantId, buscaServico)
    if (!servico) {
      throw { mensagem: `Servico nao encontrado para credito: "${buscaServico}"` }
    }
    resolvidos.push({
      servicoId: servico.id,
      creditos: Math.max(1, paraNumero(item?.creditos, 1)),
    })
  }
  return resolvidos
}

const executarCriarPlano = async (tenantId, dados) => {
  await garantirRecursos(tenantId, { membershipsAtivo: true })

  const nome = String(dados.nome || '').trim()
  if (!nome) throw { mensagem: 'Informe o nome do plano.' }

  const precoCentavos = primeiroValor(dados.precoCentavos, parsePrecoCentavos(dados.preco), 0)
  const cicloDias = Math.max(1, paraNumero(dados.cicloDias, 30))
  const creditosPorServico = await mapearCreditos(tenantId, dados.creditos || dados.creditosPorServico)

  const plano = await planosServico.criarPlano(tenantId, {
    nome,
    descricao: dados.descricao || null,
    precoCentavos: paraNumero(precoCentavos, 0),
    cicloDias,
    ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
    creditosPorServico,
  })

  return [
    `Plano criado: ${plano.nome}`,
    `Preco: ${formatarMoeda(plano.precoCentavos)}`,
    `Ciclo: ${plano.cicloDias} dias`,
    `Creditos: ${plano.creditos?.length || 0} servico(s)`,
  ].join('\n')
}

const executarListarAtrasadas = async (tenantId) => {
  await garantirRecursos(tenantId, { membershipsAtivo: true })
  const assinaturas = await planosServico.listarAssinaturas(tenantId, {})
  const atrasadas = assinaturas
    .filter((item) => ['ATRASADO', 'VENCE_HOJE'].includes(item.situacaoPagamento?.status))
    .slice(0, 10)

  if (atrasadas.length === 0) {
    return 'Nenhuma assinatura atrasada ou vencendo hoje.'
  }

  return [
    'Assinaturas com risco de pagamento:',
    ...atrasadas.map((a) => {
      const nome = a.cliente?.nome || 'Cliente'
      const plano = a.planoAssinatura?.nome || '-'
      const situacao = a.situacaoPagamento?.descricao || a.situacaoPagamento?.status || '-'
      return `- ${nome} | ${plano} | ${situacao}`
    }),
  ].join('\n')
}

const localizarAssinatura = async (tenantId, dados) => {
  if (dados.assinaturaId) {
    return banco.assinaturaCliente.findFirst({
      where: { id: String(dados.assinaturaId).trim(), tenantId },
      include: { cliente: true, planoAssinatura: true },
    })
  }

  const busca = String(dados.clienteBusca || '').trim()
  if (!busca) return null

  const digits = soDigitos(busca)
  const cliente = await banco.cliente.findFirst({
    where: {
      tenantId,
      OR: [
        { nome: { contains: busca, mode: 'insensitive' } },
        ...(digits ? [{ telefone: { contains: digits } }] : []),
      ],
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  if (!cliente) return null

  return banco.assinaturaCliente.findFirst({
    where: {
      tenantId,
      clienteId: cliente.id,
      status: { in: ['ATIVA', 'PAUSADA'] },
    },
    include: { cliente: true, planoAssinatura: true },
    orderBy: { atualizadoEm: 'desc' },
  })
}

const executarRegistrarPagamento = async (tenantId, dados) => {
  await garantirRecursos(tenantId, { membershipsAtivo: true })

  const assinatura = await localizarAssinatura(tenantId, dados)
  if (!assinatura) {
    throw { mensagem: 'Nao encontrei assinatura para registrar pagamento.' }
  }

  const pagoEm = normalizarData(dados.pagoEm) || hojeISO()
  const atualizado = await planosServico.registrarPagamentoAssinatura(tenantId, assinatura.id, {
    pagoEm: `${pagoEm}T12:00:00`,
    observacoes: dados.observacoes || null,
  })

  const proxima = atualizado.proximaCobrancaEm
    ? formatarDataHora(atualizado.proximaCobrancaEm)
    : '-'

  return [
    `Pagamento registrado para ${atualizado.cliente?.nome || 'cliente'}.`,
    `Plano: ${atualizado.planoAssinatura?.nome || '-'}`,
    `Proxima cobranca: ${proxima}`,
  ].join('\n')
}

const executarAtualizarHorarioProfissional = async (tenantId, dados) => {
  const busca = primeiroValor(dados.profissionalBusca, dados.profissionalNome, dados.profissionalId)
  const profissional = await buscarProfissionalPorBusca(tenantId, busca)
  if (!profissional) throw { mensagem: `Profissional nao encontrado: "${busca || '-'}"` }

  const dias = Array.isArray(dados.diasSemana)
    ? dados.diasSemana.map(normalizarDiaSemana).filter((d) => d !== null)
    : [normalizarDiaSemana(dados.diaSemana)].filter((d) => d !== null)

  if (dias.length === 0) {
    throw { mensagem: 'Informe o dia da semana (0-6, segunda, terca, etc).' }
  }

  const ativo = dados.ativo !== undefined ? Boolean(dados.ativo) : true
  const inicio = normalizarHora(dados.inicio) || '09:00'
  const fim = normalizarHora(dados.fim) || '18:00'

  if (ativo && inicio >= fim) {
    throw { mensagem: 'Horario invalido: inicio deve ser menor que fim.' }
  }

  const horario = { ...(profissional.horarioTrabalho || {}) }
  for (const dia of dias) {
    const atual = horario[dia] || {}
    horario[dia] = {
      ...atual,
      ativo,
      inicio,
      fim,
      intervalos: Array.isArray(atual.intervalos) ? atual.intervalos : [],
    }
  }

  await profissionaisServico.atualizar(tenantId, profissional.id, { horarioTrabalho: horario })
  return `Horario atualizado para ${profissional.nome} nos dias [${dias.join(', ')}] ${ativo ? `${inicio}-${fim}` : '(inativo)'}.`
}

const executarBloquearHorario = async (tenantId, dados) => {
  const busca = primeiroValor(dados.profissionalBusca, dados.profissionalNome, dados.profissionalId)
  const profissional = await buscarProfissionalPorBusca(tenantId, busca)
  if (!profissional) throw { mensagem: `Profissional nao encontrado: "${busca || '-'}"` }

  const data = normalizarData(dados.data)
  const inicio = normalizarHora(dados.inicio)
  const fim = normalizarHora(dados.fim)
  if (!data || !inicio || !fim) {
    throw { mensagem: 'Informe data, inicio e fim validos para o bloqueio.' }
  }

  const inicioEm = new Date(`${data}T${inicio}:00`)
  const fimEm = new Date(`${data}T${fim}:00`)
  if (Number.isNaN(inicioEm.getTime()) || Number.isNaN(fimEm.getTime()) || fimEm <= inicioEm) {
    throw { mensagem: 'Intervalo de bloqueio invalido.' }
  }

  await banco.bloqueioHorario.create({
    data: {
      profissionalId: profissional.id,
      inicioEm,
      fimEm,
      motivo: dados.motivo || 'Bloqueio administrativo via WhatsApp',
    },
  })

  return `Bloqueio criado para ${profissional.nome} em ${data} das ${inicio} as ${fim}.`
}

const executarRegistrarAusencia = async (tenantId, dados) => {
  await garantirRecursos(tenantId, { cancelamentoMassaAtivo: true })

  const busca = primeiroValor(dados.profissionalBusca, dados.profissionalNome, dados.profissionalId)
  const profissional = await buscarProfissionalPorBusca(tenantId, busca)
  if (!profissional) throw { mensagem: `Profissional nao encontrado: "${busca || '-'}"` }

  const data = normalizarData(dados.data)
  if (!data) throw { mensagem: 'Informe a data da ausencia no formato YYYY-MM-DD ou DD/MM/YYYY.' }

  const resultado = await profissionaisServico.registrarAusencia(
    tenantId,
    profissional.id,
    data,
    dados.motivo || null
  )

  return [
    `Ausencia registrada para ${profissional.nome} em ${data}.`,
    `Agendamentos cancelados: ${resultado.cancelados}`,
    `Clientes notificados: ${resultado.clientesNotificados}`,
  ].join('\n')
}

const executarReativacao = async (tenantId, dados) => {
  await garantirRecursos(tenantId, { growthAtivo: true })

  const diasSemRetorno = Math.max(1, paraNumero(dados.diasSemRetorno, 60))
  const limite = Math.max(1, paraNumero(dados.limite, 200))
  const nome =
    (dados.nome && String(dados.nome).trim()) ||
    `Reativacao WhatsApp ${hojeISO()}`

  const mensagem =
    (dados.mensagem && String(dados.mensagem).trim()) ||
    'Sentimos sua falta. Quer voltar essa semana para cuidar do visual? Responda aqui e eu agendo para voce.'

  const resultado = await planosServico.dispararCampanhaGrowth(tenantId, {
    nome,
    tipo: 'REATIVACAO',
    mensagem,
    diasSemRetorno,
    limite,
  })

  return [
    `Campanha executada: ${nome}`,
    `Alvo total: ${resultado.totalAlvo}`,
    `Registros processados: ${resultado.totalEnviado}`,
  ].join('\n')
}

const executarAcao = async (tenantId, comando) => {
  const acao = comando?.acao
  const dados = comando?.dados || {}

  switch (acao) {
    case 'ajuda':
      return respostaAjuda()
    case 'resumo':
      return executarResumo(tenantId)
    case 'atualizar_negocio':
      return executarAtualizarNegocio(tenantId, dados)
    case 'atualizar_recursos':
      return executarAtualizarRecursos(tenantId, dados)
    case 'criar_plano':
      return executarCriarPlano(tenantId, dados)
    case 'listar_assinaturas_atrasadas':
      return executarListarAtrasadas(tenantId)
    case 'registrar_pagamento_assinatura':
      return executarRegistrarPagamento(tenantId, dados)
    case 'atualizar_horario_profissional':
      return executarAtualizarHorarioProfissional(tenantId, dados)
    case 'bloquear_horario_profissional':
      return executarBloquearHorario(tenantId, dados)
    case 'registrar_ausencia_profissional':
      return executarRegistrarAusencia(tenantId, dados)
    case 'disparar_reativacao':
      return executarReativacao(tenantId, dados)
    case 'nao_entendido':
    default:
      return null
  }
}

const processarComandoAdmin = async ({ tenantId, mensagem }) => {
  const texto = String(mensagem || '').trim()
  if (!texto) return 'Envie um comando. Exemplo: "Crie plano mensal Don por 99,90".'

  try {
    const comandoPrefixado = interpretarComandoPrefixadoAdmin(texto)
    if (comandoPrefixado) {
      if (comandoPrefixado.acao === 'nao_entendido' && openai) {
        const natural = await interpretarComandoNatural({ tenantId, mensagem: texto.replace(/^admin\b[:\s-]*/i, '') })
        if (natural && natural.acao !== 'nao_entendido') {
          const respostaNatural = await executarAcao(tenantId, natural)
          if (respostaNatural) return respostaNatural
        }
        return `Nao entendi o comando ADMIN.\n\n${respostaAjuda()}`
      }

      const resposta = await executarAcao(tenantId, comandoPrefixado)
      return resposta || `Nao entendi o comando ADMIN.\n\n${respostaAjuda()}`
    }

    const comandoNatural = await interpretarComandoNatural({ tenantId, mensagem: texto })
    if (comandoNatural && comandoNatural.acao !== 'nao_entendido') {
      const resposta = await executarAcao(tenantId, comandoNatural)
      if (resposta) return resposta
    }

    return `Nao consegui interpretar seu pedido como comando administrativo.\n\n${respostaAjuda()}`
  } catch (err) {
    const mensagemErro = err?.mensagem || err?.message || 'erro interno ao executar comando.'
    console.error('[Admin WhatsApp] Falha ao executar comando:', err)
    return `Nao consegui executar agora: ${mensagemErro}`
  }
}

module.exports = {
  processarComandoAdmin,
  eNumeroAdministrador,
}

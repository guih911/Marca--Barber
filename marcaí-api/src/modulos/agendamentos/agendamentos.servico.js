const banco = require('../../config/banco')
const { adicionarMinutos } = require('../../utils/formatarData')
const { gerarSlots, validarJanelaTempo } = require('../../utils/gerarSlots')
const filaEsperaServico = require('../filaEspera/filaEspera.servico')
const whatsappServico = require('../ia/whatsapp.servico')
const planosServico = require('../planos/planos.servico')
const fidelidadeServico = require('../fidelidade/fidelidade.servico')
const OpenAI = require('openai')
const configIA = require('../../config/ia')

const openaiAgendamentos = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })

const { processarEvento } = require('../ia/messageOrchestrator')

const notificarClienteWalkIn = async (tenantId, ag) => {
  if (ag?.cliente) {
    processarEvento({ evento: 'WALK_IN', agendamento: ag, tenantId, cliente: ag.cliente })
  }
}

const notificarClienteConfirmacao = async (tenantId, ag) => {
  if (ag?.cliente) {
    processarEvento({ evento: 'CONFIRMAR', agendamento: ag, tenantId, cliente: ag.cliente })
  }
}

const incluirRelacoes = {
  cliente: true,
  profissional: true,
  servico: true,
}

const STATUS_OPERACIONAIS_ATIVOS = ['AGENDADO', 'CONFIRMADO']

// Máquina de estados: define quais status podem ser origem de cada transição
const TRANSICOES_VALIDAS = {
  confirmar:         ['AGENDADO'],
  confirmarPresenca: ['AGENDADO', 'CONFIRMADO'],
  concluir:          ['AGENDADO', 'CONFIRMADO'],
  cancelar:          ['AGENDADO', 'CONFIRMADO'],
  remarcar:          ['AGENDADO', 'CONFIRMADO'],
  naoCompareceu:     ['AGENDADO', 'CONFIRMADO'],
}

const garantirTransicaoValida = (operacao, statusAtual) => {
  const permitidos = TRANSICOES_VALIDAS[operacao]
  if (!permitidos || !permitidos.includes(statusAtual)) {
    throw {
      status: 422,
      mensagem: `Operação '${operacao}' não permitida para agendamento com status '${statusAtual}'.`,
      codigo: 'TRANSICAO_INVALIDA',
    }
  }
}

const obterDataIsoSaoPaulo = (data) => (
  new Date(data).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
)

// Validação pré-transação (UX — detecta erros óbvios antes de abrir tx)
const validarInicioDentroDaDisponibilidadeReal = async ({ profissionalId, duracaoMinutos, inicioEm }) => {
  const data = obterDataIsoSaoPaulo(inicioEm)
  const inicioMs = new Date(inicioEm).getTime()
  const slots = await gerarSlots(profissionalId, duracaoMinutos, data)

  const slotValido = slots.some((slot) => (
    slot.disponivel && new Date(slot.inicio).getTime() === inicioMs
  ))

  if (!slotValido) {
    throw {
      status: 422,
      mensagem: 'Horario indisponivel na agenda real do profissional. Respeite expediente, intervalos, buffer e antecedencia minima.',
      codigo: 'SLOT_INVALIDO',
    }
  }
}

// Validação dentro da transação usando `tx` — previne race condition de double booking.
// Usa validarJanelaTempo que aceita qualquer Prisma client (banco ou tx).
const validarJanelaTempoTx = async (tx, { profissionalId, duracaoMinutos, inicioEm, agendamentoExcluidoId }) => {
  await validarJanelaTempo(tx, { profissionalId, duracaoMinutos, inicioEm, agendamentoExcluidoId })
}

const sincronizarAvataresClientes = async (tenantId, agendamentos = []) => {
  if (!Array.isArray(agendamentos) || agendamentos.length === 0) return agendamentos

  const faltantes = new Map()
  agendamentos.forEach((agendamento) => {
    const cliente = agendamento?.cliente
    if (!cliente?.id || !cliente?.telefone || cliente?.avatarUrl || faltantes.has(cliente.telefone)) return
    faltantes.set(cliente.telefone, cliente)
  })

  if (faltantes.size === 0) return agendamentos

  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { configWhatsApp: true },
  })
  if (!tenant?.configWhatsApp) return agendamentos

  const telefones = [...faltantes.keys()].slice(0, 20)
  const fotos = await Promise.allSettled(
    telefones.map((telefone) => whatsappServico.obterFotoPerfil(tenant.configWhatsApp, telefone, tenantId))
  )

  const atualizacoes = []
  fotos.forEach((resultado, index) => {
    const avatarUrl = resultado.status === 'fulfilled' ? resultado.value : null
    if (!avatarUrl) return

    const telefone = telefones[index]
    const cliente = faltantes.get(telefone)
    if (!cliente) return

    atualizacoes.push(
      banco.cliente.update({
        where: { id: cliente.id },
        data: { avatarUrl },
      })
    )

    agendamentos.forEach((agendamento) => {
      if (agendamento?.cliente?.telefone === telefone) {
        agendamento.cliente.avatarUrl = avatarUrl
      }
    })
  })

  if (atualizacoes.length > 0) {
    await Promise.allSettled(atualizacoes)
  }

  return agendamentos
}

const obterServicoComDuracaoFonte = async (fonte, tenantId, profissionalId, servicoId) => {
  const profServico = await fonte.profissionalServico.findFirst({
    where: { profissionalId, servicoId },
    include: { servico: true },
  })

  const servico = profServico?.servico || await fonte.servico.findFirst({
    where: { id: servicoId, tenantId, ativo: true },
  })

  if (!servico) throw { status: 404, mensagem: 'Servico nao encontrado', codigo: 'NAO_ENCONTRADO' }

  return {
    servico,
    duracaoMinutos: profServico?.duracaoCustom || servico.duracaoMinutos,
  }
}

const obterServicoComDuracao = async (tenantId, profissionalId, servicoId) => (
  obterServicoComDuracaoFonte(banco, tenantId, profissionalId, servicoId)
)

const obterServicoComDuracaoTx = async (tx, tenantId, profissionalId, servicoId) => (
  obterServicoComDuracaoFonte(tx, tenantId, profissionalId, servicoId)
)

const listar = async (tenantId, { status, profissionalId, clienteId, inicio, fim, limite = 50, pagina = 1, ordem, busca }) => {
  const pular = (Number(pagina) - 1) * Number(limite)

  const where = { tenantId }

  // Busca por nome de cliente (server-side)
  if (busca) {
    where.cliente = { nome: { contains: busca, mode: 'insensitive' } }
  }

  if (status) {
    // Aceita array, string única ou string com vírgula ("AGENDADO,CONFIRMADO")
    const statusArr = Array.isArray(status)
      ? status
      : String(status).split(',').map((s) => s.trim()).filter(Boolean)
    where.status = { in: statusArr }
  } else {
    // Por padrão, exclui status "arquivados" para não duplicar na agenda
    where.status = { notIn: ['REMARCADO', 'CANCELADO', 'NAO_COMPARECEU'] }
  }
  if (profissionalId) where.profissionalId = profissionalId
  if (clienteId) where.clienteId = clienteId
  if (inicio || fim) {
    where.inicioEm = {}
    if (inicio) where.inicioEm.gte = new Date(inicio)
    if (fim) where.inicioEm.lte = new Date(fim)
  }

  let orderBy = { inicioEm: 'asc' }
  if (ordem === 'proximosPrimeiro') orderBy = { inicioEm: 'asc' }
  if (ordem === 'maisRecentes') orderBy = { criadoEm: 'desc' }

  const [agendamentos, total] = await Promise.all([
    banco.agendamento.findMany({
      where,
      skip: pular,
      take: Number(limite),
      orderBy,
      include: incluirRelacoes,
    }),
    banco.agendamento.count({ where }),
  ])

  await sincronizarAvataresClientes(tenantId, agendamentos)

  return { agendamentos, meta: { total, pagina: Number(pagina), limite: Number(limite) } }
}

const buscarPorId = async (tenantId, id) => {
  const agendamento = await banco.agendamento.findFirst({
    where: { id, tenantId },
    include: incluirRelacoes,
  })
  if (!agendamento) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }
  await sincronizarAvataresClientes(tenantId, [agendamento])
  return agendamento
}

const criar = async (tenantId, dados) => {
  // Busca duração do serviço
  const profServico = await banco.profissionalServico.findFirst({
    where: { profissionalId: dados.profissionalId, servicoId: dados.servicoId },
    include: { servico: true },
  })

  const servico = profServico?.servico || await banco.servico.findFirst({ where: { id: dados.servicoId, tenantId } })
  if (!servico) throw { status: 404, mensagem: 'Serviço não encontrado', codigo: 'NAO_ENCONTRADO' }

  // Valida se o serviço está ativo
  if (!servico.ativo) {
    throw { status: 422, mensagem: 'Este serviço não está mais disponível.', codigo: 'SERVICO_INATIVO' }
  }

  const duracao = profServico?.duracaoCustom || servico.duracaoMinutos
  const inicioEm = new Date(dados.inicio)
  const fimEm = adicionarMinutos(inicioEm, duracao)
  const toleranciaPassadoMs = dados.walkin ? 5 * 60 * 1000 : 0

  // CRÍTICO: Não permite agendamento no passado
  if (inicioEm.getTime() < (Date.now() - toleranciaPassadoMs)) {
    throw { status: 422, mensagem: 'Não é possível agendar no passado.', codigo: 'HORARIO_PASSADO' }
  }

  // Valida se o profissional está configurado para trabalhar nesse dia da semana
  const profParaValidacao = await banco.profissional.findUnique({
    where: { id: dados.profissionalId },
    select: { horarioTrabalho: true, ativo: true, tenantId: true, tenant: { select: { timezone: true } } },
  })
  if (profParaValidacao && profParaValidacao.tenantId === tenantId) {
    const tz = profParaValidacao.tenant?.timezone || 'America/Sao_Paulo'
    const dataStr = inicioEm.toLocaleDateString('en-CA', { timeZone: tz })
    const dataBRT = new Date(`${dataStr}T12:00:00.000-03:00`)
    const diaSemana = dataBRT.getDay()
    const horarioDia = profParaValidacao.horarioTrabalho?.[diaSemana]
    if (!horarioDia || !horarioDia.ativo) {
      throw {
        status: 422,
        mensagem: 'Profissional não atende nesse dia da semana.',
        codigo: 'DIA_NAO_CONFIGURADO',
      }
    }
    // Valida se o horário está dentro do expediente
    const [hInicio, mInicio] = (horarioDia.inicio || '00:00').split(':').map(Number)
    const [hFim, mFim] = (horarioDia.fim || '23:59').split(':').map(Number)
    const minutosExpInicio = hInicio * 60 + mInicio
    const minutosExpFim = hFim * 60 + mFim
    const horaLocal = inicioEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false })
    const [hSlot, mSlot] = horaLocal.split(':').map(Number)
    const minutosSlot = hSlot * 60 + mSlot
    if (minutosSlot < minutosExpInicio || minutosSlot >= minutosExpFim) {
      throw {
        status: 422,
        mensagem: 'Horário fora do expediente do profissional.',
        codigo: 'FORA_DO_EXPEDIENTE',
      }
    }
  }
  if (dados.clienteId) {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { membershipsAtivo: true, timezone: true } })
    if (tenant?.membershipsAtivo) {
      const assinaturaAtiva = await banco.assinaturaCliente.findFirst({
        where: {
          tenantId,
          clienteId: dados.clienteId,
          status: 'ATIVA',
          OR: [{ fimEm: null }, { fimEm: { gte: new Date() } }],
        },
        include: { planoAssinatura: { select: { diasPermitidos: true, nome: true } } },
        orderBy: { criadoEm: 'desc' },
      })
      if (assinaturaAtiva?.planoAssinatura?.diasPermitidos?.length > 0) {
        const diasPermitidos = assinaturaAtiva.planoAssinatura.diasPermitidos
        const tz = tenant.timezone || 'America/Sao_Paulo'
        const dataStr = inicioEm.toLocaleDateString('en-CA', { timeZone: tz })
        const dataBRT = new Date(`${dataStr}T12:00:00.000-03:00`)
        const diaSemana = dataBRT.getDay()
        if (!diasPermitidos.includes(diaSemana)) {
          const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
          const diasNomes = diasPermitidos.map((d) => NOMES_DIAS[d]).join(', ')
          throw {
            status: 422,
            mensagem: `O plano "${assinaturaAtiva.planoAssinatura.nome}" não permite agendamentos em ${NOMES_DIAS[diaSemana]}. Dias permitidos: ${diasNomes}.`,
            codigo: 'DIA_NAO_PERMITIDO_PLANO',
          }
        }
      }
    }
  }

  const origem = dados.origem || 'DASHBOARD'
  const clienteJaChegou = Boolean(dados.walkin)
  // Status inicial: walk-in, WHATSAPP e LINK_PUBLICO entram como CONFIRMADO.
  // O cliente já confirmou durante a conversa com a IA ou ao preencher o link público.
  // Agendamentos criados pelo dashboard sempre iniciam como AGENDADO, independente do prazo,
  // para que o auto-cancelamento por não-confirmação funcione corretamente.
  const statusInicial = clienteJaChegou || origem === 'WHATSAPP' || origem === 'LINK_PUBLICO' ? 'CONFIRMADO' : 'AGENDADO'
  const profissionalAgenda = await banco.profissional.findUnique({
    where: { id: dados.profissionalId },
    select: { bufferMinutos: true },
  })
  const bufferMinutos = Number(profissionalAgenda?.bufferMinutos || 0)

  // Verifica conflito dentro de transação (ground truth — previne race condition de double booking)
  return banco.$transaction(async (tx) => {
    // Validação completa dentro da transação usando tx (CRÍTICO 3: sem race condition)
    await validarJanelaTempoTx(tx, {
      profissionalId: dados.profissionalId,
      duracaoMinutos: duracao,
      inicioEm,
      ignorarAntecedenciaMinima: Boolean(dados.walkin),
    })

    // Walk-in também verifica conflito — cliente presencialmente não justifica dupla agenda
    const conflito = await tx.agendamento.findFirst({
      where: {
        profissionalId: dados.profissionalId,
        status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
        AND: [
          { inicioEm: { lt: adicionarMinutos(fimEm, bufferMinutos) } },
          { fimEm: { gt: adicionarMinutos(inicioEm, -bufferMinutos) } },
        ],
      },
    })

    if (conflito) {
      throw {
        status: 409,
        mensagem: 'Horário indisponível: este profissional já tem um agendamento neste período',
        codigo: 'CONFLITO_HORARIO',
      }
    }

    // CRÍTICO: Valida conflito do CLIENTE (não só profissional)
    // Cliente não pode ter 2 agendamentos sobrepostos (mesmo com profissionais diferentes)
    if (dados.clienteId) {
      const conflitoCliente = await tx.agendamento.findFirst({
        where: {
          clienteId: dados.clienteId,
          status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
          AND: [
            { inicioEm: { lt: fimEm } },
            { fimEm: { gt: inicioEm } },
          ],
        },
      })
      if (conflitoCliente) {
        throw {
          status: 409,
          mensagem: 'Você já tem um agendamento neste horário.',
          codigo: 'CONFLITO_CLIENTE',
        }
      }
    }

    const novoAg = await tx.agendamento.create({
      data: {
        tenantId,
        clienteId: dados.clienteId,
        profissionalId: dados.profissionalId,
        servicoId: dados.servicoId,
        inicioEm,
        fimEm,
        // Agendamentos feitos pelo WhatsApp já vêm confirmados — o cliente confirmou na conversa
        status: statusInicial,
        origem,
        notas: dados.notas || null,
        presencaConfirmadaEm: clienteJaChegou ? new Date() : null,
      },
      include: incluirRelacoes,
    })

    return novoAg
  }).then((ag) => {
    // Envia confirmação WhatsApp somente para agendamentos criados pelo painel.
    // - WHATSAPP: a IA já confirma diretamente na conversa
    // - LINK_PUBLICO: public.controlador.js envia a confirmação com formato próprio
    // - walkin: envia mensagem pós-visita (abaixo)
    if (dados.origem !== 'WHATSAPP' && dados.origem !== 'LINK_PUBLICO' && !dados.walkin) {
      notificarClienteConfirmacao(tenantId, ag)
    }
    // Walk-in: envia mensagem pós-visita com link de agendamento futuro
    if (dados.walkin) {
      notificarClienteWalkIn(tenantId, ag)
    }
    return ag
  })
}

const criarCombo = async (tenantId, dados) => {
  const servicoIds = Array.from(new Set((dados.servicoIds || []).filter(Boolean)))
  if (servicoIds.length < 2) {
    throw { status: 422, mensagem: 'Informe ao menos dois servicos para o combo.', codigo: 'COMBO_INVALIDO' }
  }

  // Pré-validação básica fora da tx (expediente e antecedência mínima) usando validarJanelaTempo.
  // Aceita qualquer posição de início (ex: 09:45 após 45 min), não apenas múltiplos de 30 min.
  // A validação completa com lock acontece DENTRO da transação abaixo.
  let inicioParaPreValidacao = new Date(dados.inicio)
  for (const servicoId of servicoIds) {
    const infoServico = await obterServicoComDuracao(tenantId, dados.profissionalId, servicoId)
    await validarJanelaTempo(banco, {
      profissionalId: dados.profissionalId,
      duracaoMinutos: infoServico.duracaoMinutos,
      inicioEm: inicioParaPreValidacao,
    })
    inicioParaPreValidacao = adicionarMinutos(inicioParaPreValidacao, infoServico.duracaoMinutos)
  }

  const profissionalAgenda = await banco.profissional.findUnique({
    where: { id: dados.profissionalId },
    select: { bufferMinutos: true },
  })
  const bufferMinutos = Number(profissionalAgenda?.bufferMinutos || 0)

  // CRÍTICO: Não permite combo no passado
  if (new Date(dados.inicio) < new Date()) {
    throw { status: 422, mensagem: 'Não é possível agendar combo no passado.', codigo: 'HORARIO_PASSADO' }
  }

  return banco.$transaction(async (tx) => {
    const criados = []
    let inicioAtual = new Date(dados.inicio)

    // Calcula o fim total do combo para validar conflito do cliente
    let fimTotalCombo = inicioAtual
    for (const servicoId of servicoIds) {
      const info = await obterServicoComDuracaoTx(tx, tenantId, dados.profissionalId, servicoId)
      fimTotalCombo = adicionarMinutos(fimTotalCombo, info.duracaoMinutos)
    }

    // CRÍTICO: Valida conflito do CLIENTE para todo o período do combo
    if (dados.clienteId) {
      const conflitoCliente = await tx.agendamento.findFirst({
        where: {
          clienteId: dados.clienteId,
          status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
          AND: [
            { inicioEm: { lt: fimTotalCombo } },
            { fimEm: { gt: inicioAtual } },
          ],
        },
      })
      if (conflitoCliente) {
        throw {
          status: 409,
          mensagem: 'Você já tem um agendamento neste horário.',
          codigo: 'CONFLITO_CLIENTE',
        }
      }
    }

    for (const servicoId of servicoIds) {
      const infoServico = await obterServicoComDuracaoTx(tx, tenantId, dados.profissionalId, servicoId)
      const fimAtual = adicionarMinutos(inicioAtual, infoServico.duracaoMinutos)

      // Validação completa com tx para cada serviço do combo (CRÍTICO 3 + CRÍTICO 1)
      // Usa validarJanelaTempo que não exige que inicioAtual seja múltiplo de 30 min
      await validarJanelaTempoTx(tx, {
        profissionalId: dados.profissionalId,
        duracaoMinutos: infoServico.duracaoMinutos,
        inicioEm: inicioAtual,
      })

      const conflito = await tx.agendamento.findFirst({
        where: {
          profissionalId: dados.profissionalId,
          status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
          AND: [
            { inicioEm: { lt: adicionarMinutos(fimAtual, bufferMinutos) } },
            { fimEm: { gt: adicionarMinutos(inicioAtual, -bufferMinutos) } },
          ],
        },
      })

      const conflitoNoCombo = criados.some((agendamento) => inicioAtual < agendamento.fimEm && fimAtual > agendamento.inicioEm)
      if (conflito || conflitoNoCombo) {
        throw {
          status: 409,
          mensagem: 'Horario indisponivel para o combo neste periodo.',
          codigo: 'CONFLITO_HORARIO',
        }
      }

      const agendamento = await tx.agendamento.create({
        data: {
          tenantId,
          clienteId: dados.clienteId,
          profissionalId: dados.profissionalId,
          servicoId,
          inicioEm: inicioAtual,
          fimEm: fimAtual,
          // Combos pelo WhatsApp/link público já vêm confirmados — cliente confirmou na conversa
          status: dados.origem === 'WHATSAPP' || dados.origem === 'LINK_PUBLICO' ? 'CONFIRMADO' : 'AGENDADO',
          origem: dados.origem || 'DASHBOARD',
          notas: dados.notas || 'Combo agendado via WhatsApp.',
        },
        include: incluirRelacoes,
      })

      criados.push(agendamento)
      inicioAtual = fimAtual
    }

    return criados
  }).then((agendamentos) => {
    if (dados.origem !== 'WHATSAPP' && dados.origem !== 'LINK_PUBLICO' && agendamentos[0]) {
      notificarClienteConfirmacao(tenantId, agendamentos[0])
    }
    return agendamentos
  })
}

const confirmar = async (tenantId, id) => {
  await verificarPropriedade(tenantId, id)
  return banco.agendamento.update({ where: { id }, data: { status: 'CONFIRMADO' }, include: incluirRelacoes })
}

const confirmarPresenca = async (tenantId, id) => {
  const agendamento = await verificarPropriedade(tenantId, id)

  if (!STATUS_OPERACIONAIS_ATIVOS.includes(agendamento.status)) {
    throw {
      status: 422,
      mensagem: 'A presença só pode ser confirmada para agendamentos ativos.',
      codigo: 'STATUS_INVALIDO',
    }
  }

  return banco.agendamento.update({
    where: { id },
    data: {
      status: agendamento.status === 'AGENDADO' ? 'CONFIRMADO' : agendamento.status,
      presencaConfirmadaEm: agendamento.presencaConfirmadaEm || new Date(),
    },
    include: incluirRelacoes,
  })
}

const cancelar = async (tenantId, id, motivo, { origem = 'CLIENTE' } = {}) => {
  const agendamento = await verificarPropriedade(tenantId, id)
  garantirTransicaoValida('cancelar', agendamento.status)

  // Verifica antecedência mínima APENAS para clientes (WhatsApp/link público)
  // Dashboard/cabelereiro pode cancelar a qualquer momento
  if (origem !== 'DASHBOARD') {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    const horasRestantes = (agendamento.inicioEm - new Date()) / (1000 * 60 * 60)

    if (horasRestantes > 0 && horasRestantes < tenant.antecedenciaCancelar) {
      throw {
        status: 422,
        mensagem: `Cancelamento exige ${tenant.antecedenciaCancelar}h de antecedência. Entre em contato com o estabelecimento.`,
        codigo: 'ANTECEDENCIA_INSUFICIENTE',
      }
    }
  }

  const agCancelado = await banco.agendamento.update({
    where: { id },
    data: { status: 'CANCELADO', canceladoEm: new Date(), motivoCancelamento: motivo || null },
    include: incluirRelacoes,
  })
  
  if (agCancelado?.cliente) {
    processarEvento({ evento: 'CANCELAR', agendamento: agCancelado, tenantId, cliente: agCancelado.cliente, origemViaPainel: origem === 'DASHBOARD' })
  }

  // Notifica fila de espera (melhor esforço — não falha o cancelamento se der erro)
  filaEsperaServico.notificarFilaParaSlot(tenantId, {
    servicoId: agCancelado.servicoId,
    profissionalId: agCancelado.profissionalId,
    dataHoraLiberada: agCancelado.inicioEm,
  }).catch((err) => console.warn('[FilaEspera] Falha ao notificar após cancelamento:', err.message))

  return agCancelado
}

const remarcar = async (tenantId, id, novoInicio) => {
  const agendamento = await verificarPropriedade(tenantId, id)
  garantirTransicaoValida('remarcar', agendamento.status)

  const profServico = await banco.profissionalServico.findFirst({
    where: { profissionalId: agendamento.profissionalId, servicoId: agendamento.servicoId },
    include: { servico: true },
  })
  const servico = profServico?.servico || await banco.servico.findFirst({ where: { id: agendamento.servicoId } })
  const duracao = profServico?.duracaoCustom || servico.duracaoMinutos

  const inicioEm = new Date(novoInicio)
  const fimEm = adicionarMinutos(inicioEm, duracao)

  // CRÍTICO: Não permite remarcar para o passado
  if (inicioEm < new Date()) {
    throw { status: 422, mensagem: 'Não é possível remarcar para o passado.', codigo: 'HORARIO_PASSADO' }
  }

  // Valida dias permitidos do plano do cliente (se tiver assinatura ativa)
  if (agendamento.clienteId) {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { membershipsAtivo: true, timezone: true } })
    if (tenant?.membershipsAtivo) {
      const assinaturaAtiva = await banco.assinaturaCliente.findFirst({
        where: {
          tenantId,
          clienteId: agendamento.clienteId,
          status: 'ATIVA',
          OR: [{ fimEm: null }, { fimEm: { gte: new Date() } }],
        },
        include: { planoAssinatura: { select: { diasPermitidos: true, nome: true } } },
        orderBy: { criadoEm: 'desc' },
      })
      if (assinaturaAtiva?.planoAssinatura?.diasPermitidos?.length > 0) {
        const diasPermitidos = assinaturaAtiva.planoAssinatura.diasPermitidos
        const tz = tenant.timezone || 'America/Sao_Paulo'
        const dataStr = inicioEm.toLocaleDateString('en-CA', { timeZone: tz })
        const dataBRT = new Date(`${dataStr}T12:00:00.000-03:00`)
        const diaSemana = dataBRT.getDay()
        if (!diasPermitidos.includes(diaSemana)) {
          const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
          const diasNomes = diasPermitidos.map((d) => NOMES_DIAS[d]).join(', ')
          throw {
            status: 422,
            mensagem: `O plano "${assinaturaAtiva.planoAssinatura.nome}" não permite agendamentos em ${NOMES_DIAS[diaSemana]}. Dias permitidos: ${diasNomes}.`,
            codigo: 'DIA_NAO_PERMITIDO_PLANO',
          }
        }
      }
    }
  }

  // Pré-validação fora da tx (UX / erro óbvio antecipado)
  await validarJanelaTempo(banco, {
    profissionalId: agendamento.profissionalId,
    duracaoMinutos: duracao,
    inicioEm,
    agendamentoExcluidoId: id,
  })

  const profissionalAgenda = await banco.profissional.findUnique({
    where: { id: agendamento.profissionalId },
    select: { bufferMinutos: true },
  })
  const bufferMinutos = Number(profissionalAgenda?.bufferMinutos || 0)

  return banco.$transaction(async (tx) => {
    // Validação dentro da tx (CRÍTICO 3: previne race condition)
    await validarJanelaTempoTx(tx, {
      profissionalId: agendamento.profissionalId,
      duracaoMinutos: duracao,
      inicioEm,
      agendamentoExcluidoId: id,
    })

    const conflito = await tx.agendamento.findFirst({
      where: {
        profissionalId: agendamento.profissionalId,
        id: { not: id },
        status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
        AND: [
          { inicioEm: { lt: adicionarMinutos(fimEm, bufferMinutos) } },
          { fimEm: { gt: adicionarMinutos(inicioEm, -bufferMinutos) } },
        ],
      },
    })

    if (conflito) {
      throw { status: 409, mensagem: 'Horário indisponível para remarcação', codigo: 'CONFLITO_HORARIO' }
    }

    // Marca o antigo como remarcado
    await tx.agendamento.update({ where: { id }, data: { status: 'REMARCADO' } })

    // Cria novo — se a origem era WhatsApp, o cliente já confirmou na conversa
    return tx.agendamento.create({
      data: {
        tenantId,
        clienteId: agendamento.clienteId,
        profissionalId: agendamento.profissionalId,
        servicoId: agendamento.servicoId,
        inicioEm,
        fimEm,
        status: agendamento.origem === 'WHATSAPP' || agendamento.origem === 'LINK_PUBLICO' ? 'CONFIRMADO' : 'AGENDADO',
        origem: agendamento.origem,
        notas: agendamento.notas,
      },
      include: incluirRelacoes,
    })
  }).then((agRemarcado) => {
    if (agRemarcado?.cliente) {
      processarEvento({ evento: 'REMARCAR', agendamento: agRemarcado, tenantId, cliente: agRemarcado.cliente })
    }
    return agRemarcado
  })
}

const concluir = async (tenantId, id, formaPagamento) => {
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { exigirConfirmacaoPresenca: true, membershipsAtivo: true, comandaAtivo: true, configWhatsApp: true, nome: true, timezone: true },
  })

  // Usa transação para garantir idempotência (previne double-click)
  const resultado = await banco.$transaction(async (tx) => {
    const atual = await tx.agendamento.findFirst({ where: { id, tenantId } })
    if (!atual) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }

    // IDEMPOTENTE: Se já está concluído, retorna sem fazer nada
    if (atual.status === 'CONCLUIDO') {
      return { agendamento: await tx.agendamento.findFirst({ where: { id }, include: incluirRelacoes }), jaConcluido: true }
    }

    // Máquina de estados: apenas AGENDADO e CONFIRMADO podem ser concluídos.
    garantirTransicaoValida('concluir', atual.status)

    if (tenant?.exigirConfirmacaoPresenca && !atual.presencaConfirmadaEm) {
      throw {
        status: 422,
        mensagem: 'Confirme a presença do cliente antes de finalizar o atendimento.',
        codigo: 'PRESENCA_OBRIGATORIA',
      }
    }

    const agendamento = await tx.agendamento.update({
      where: { id },
      data: { status: 'CONCLUIDO', formaPagamento: formaPagamento || null, concluidoEm: new Date(), presencaConfirmadaEm: atual.presencaConfirmadaEm || new Date() },
      include: incluirRelacoes,
    })

    return { agendamento, jaConcluido: false }
  })

  let agendamento = resultado.agendamento

  // Só processa assinatura/fidelidade se NÃO era já concluído (primeira vez)
  if (!resultado.jaConcluido) {
    // Aviso de crédito esgotado
    if (tenant?.membershipsAtivo && agendamento.clienteId) {
      const assinatura = await banco.assinaturaCliente.findFirst({
        where: { tenantId, clienteId: agendamento.clienteId, status: 'ATIVA' },
        include: { creditos: { where: { servicoId: agendamento.servicoId } } },
      })
      const credito = assinatura?.creditos?.[0]
      if (credito && credito.creditosRestantes <= 0) {
        console.log(`[Concluir] Cliente ${agendamento.clienteId} sem créditos para ${agendamento.servicoId} — cobrança avulsa.`)
      }
    }

    // Assinatura mensal
    try {
      const credito = await planosServico.consumirCreditoAssinatura(tenantId, agendamento.clienteId, agendamento.servicoId)
      agendamento = { ...agendamento, consumoAssinatura: credito }
    } catch (err) {
      console.warn('[Assinatura] Falha ao consumir crédito (sem impacto na conclusão):', err.message)
    }

    // Fidelidade — verifica resgate pendente e registra pontos
    try {
      const resgate = await fidelidadeServico.verificarEAplicarResgatePendente(tenantId, agendamento.clienteId, id)
      if (resgate.aplicado) {
        // Aplica desconto de 100% (gratuito) — atualiza o agendamento com desconto
        const precoServico = agendamento.servico?.precoCentavos || 0
        await banco.agendamento.update({
          where: { id },
          data: { descontoCentavos: precoServico },
        })
        console.log(`[Fidelidade] Resgate aplicado - agendamento ${id} gratuito (${resgate.beneficio})`)
      }
    } catch (err) {
      console.warn('[Fidelidade] Erro ao verificar resgate:', err.message)
    }

    // Registra pontos do atendimento (só se não foi resgate - senão seria ganhar ponto por resgate)
    fidelidadeServico.registrarPontosAtendimento(tenantId, agendamento.clienteId, id)
      .catch((err) => console.warn('[Fidelidade] Falha ao registrar pontos:', err.message))

    // ── Plano Mensal: cobrança na visita presencial ──────────────────────────
    if (tenant?.membershipsAtivo) {
      processarCobrancaPlanoNaVisita(tenantId, agendamento, tenant)
        .catch((err) => console.warn('[PlanoMensal] Falha ao processar cobrança (sem impacto na conclusão):', err.message))
    }
  }

  if (!resultado.jaConcluido && agendamento?.cliente) {
    processarEvento({ evento: 'CONCLUIR', agendamento, tenantId, cliente: agendamento.cliente })
  }

  return agendamento
}

/**
 * Processa cobrança do plano mensal quando cliente comparece presencialmente.
 * - Se proximaCobrancaEm é null (primeiro ciclo) ou já passou (renovação): cobra e atualiza.
 * - Se comandaAtivo: insere item de cobrança do plano na comanda do agendamento.
 * - Envia WhatsApp informando o cliente.
 * - PROTEÇÃO: Usa update condicional para evitar cobrança duplicada em requests paralelos.
 */
const processarCobrancaPlanoNaVisita = async (tenantId, agendamento, tenant) => {
  const assinatura = await banco.assinaturaCliente.findFirst({
    where: { tenantId, clienteId: agendamento.clienteId, status: 'ATIVA' },
    include: { planoAssinatura: true },
  })
  if (!assinatura?.planoAssinatura) return

  const agora = new Date()
  const hoje = new Date(agora.toLocaleDateString('en-CA', { timeZone: tenant.timezone || 'America/Sao_Paulo' }))
  const proxCobranca = assinatura.proximaCobrancaEm ? new Date(assinatura.proximaCobrancaEm) : null

  // Cobrança devida: primeiro ciclo (sem data) ou data já chegou/passou
  const cobrancaDevida = !proxCobranca || proxCobranca <= hoje

  if (!cobrancaDevida) return

  const plano = assinatura.planoAssinatura
  const novaProxCobranca = new Date(hoje)
  novaProxCobranca.setDate(novaProxCobranca.getDate() + (plano.cicloDias || 30))

  // PROTEÇÃO contra cobrança duplicada: usa updateMany com where condicional
  // Se outro request paralelo já atualizou proximaCobrancaEm, este retorna count: 0
  const resultado = await banco.assinaturaCliente.updateMany({
    where: {
      id: assinatura.id,
      // Só atualiza se proximaCobrancaEm ainda for o valor esperado (otimistic lock)
      OR: [
        { proximaCobrancaEm: null },
        { proximaCobrancaEm: { lte: hoje } },
      ],
    },
    data: { proximaCobrancaEm: novaProxCobranca },
  })

  // Se count = 0, outro request já processou a cobrança - não faz nada
  if (resultado.count === 0) {
    console.log(`[PlanoMensal] Cobrança já processada por outro request para cliente ${agendamento.clienteId}`)
    return
  }

  console.log(`[PlanoMensal] Renovação registrada: ${plano.nome} | Cliente: ${agendamento.clienteId} | Próxima: ${novaProxCobranca.toISOString()}`)

  // Insere na comanda se comandaAtivo
  if (tenant?.comandaAtivo && plano.precoCentavos > 0) {
    try {
      await banco.comandaItem.create({
        data: {
          agendamentoId: agendamento.id,
          descricao: `Plano mensal: ${plano.nome}`,
          quantidade: 1,
          precoCentavos: plano.precoCentavos,
        },
      })
      console.log(`[PlanoMensal] Item adicionado à comanda: ${plano.nome} R$${plano.precoCentavos / 100}`)
    } catch (err) {
      console.warn('[PlanoMensal] Falha ao inserir na comanda:', err.message)
    }
  }

  // Notifica cliente via WhatsApp
  if (tenant?.configWhatsApp && agendamento.cliente?.telefone && plano.precoCentavos > 0) {
    try {
      const valorFmt = `R$${(plano.precoCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const proxFmt = novaProxCobranca.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: tenant.timezone || 'America/Sao_Paulo' })
      const primeiroNome = agendamento.cliente.nome?.split(' ')[0] || 'cliente'
      const msg = `Oi, ${primeiroNome}! Seu plano *${plano.nome}* foi renovado hoje — ${valorFmt} adicionados à conta do atendimento. Próxima renovação: ${proxFmt}. Qualquer dúvida, fala com a gente! 😊`
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, agendamento.cliente.telefone, msg, tenantId)
    } catch (err) {
      console.warn('[PlanoMensal] Falha ao notificar cliente:', err.message)
    }
  }
}

const naoCompareceu = async (tenantId, id, mensagemWhatsApp) => {
  const ag = await banco.agendamento.findFirst({ where: { id, tenantId }, include: { cliente: true } })
  if (!ag) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }

  garantirTransicaoValida('naoCompareceu', ag.status)

  if (ag.presencaConfirmadaEm) {
    throw {
      status: 422,
      mensagem: 'Esse cliente ja teve a presenca confirmada. Use concluir ou remarcar.',
      codigo: 'PRESENCA_JA_CONFIRMADA',
    }
  }

  const agAtualizado = await banco.agendamento.update({ where: { id }, data: { status: 'NAO_COMPARECEU' }, include: incluirRelacoes })

  // Envia mensagem de recontato pelo WhatsApp (melhor esforço)
  const telefoneCliente = ag.cliente?.telefone
  if (telefoneCliente) {
    try {
      const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
      if (tenant?.configWhatsApp) {
        // Se tem mensagem personalizada, envia ela. Senão, envia mensagem padrão da IA.
        const msgFinal = mensagemWhatsApp?.trim() || `Oi, ${ag.cliente?.nome?.split(' ')[0] || 'tudo bem'}! Notamos que você não veio ao seu horário de ${ag.servico?.nome || 'hoje'}. Sem problema! Quer que a gente remarque pra outro dia? É só responder aqui. 😊`
        await whatsappServico.enviarMensagem(tenant.configWhatsApp, telefoneCliente, msgFinal, tenantId)
      }
    } catch (err) {
      console.warn('[NaoCompareceu] Erro ao enviar mensagem de recontato:', err.message)
    }
  }

  return agAtualizado
}

const verificarPropriedade = async (tenantId, id) => {
  const ag = await banco.agendamento.findFirst({ where: { id, tenantId } })
  if (!ag) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }
  return ag
}

// Cancela todos os agendamentos em um período e opcionalmente envia WhatsApp
const cancelarPeriodo = async (tenantId, { dataInicio, dataFim, mensagemWhatsApp }) => {
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)

  const agendamentos = await banco.agendamento.findMany({
    where: {
      tenantId,
      status: { in: ['AGENDADO', 'CONFIRMADO'] },
      inicioEm: { gte: inicio, lte: fim },
    },
    include: { cliente: true, servico: true, profissional: true },
  })

  if (agendamentos.length === 0) return { cancelados: 0 }

  await banco.agendamento.updateMany({
    where: { id: { in: agendamentos.map((a) => a.id) } },
    data: { status: 'CANCELADO' },
  })

  // Notifica fila de espera para cada slot liberado (ALTO 3: era ignorado em cancelamento em massa)
  for (const ag of agendamentos) {
    filaEsperaServico.notificarFilaParaSlot(tenantId, {
      servicoId: ag.servicoId,
      profissionalId: ag.profissionalId,
      dataHoraLiberada: ag.inicioEm,
    }).catch((err) => console.warn('[CancelarPeriodo] Falha ao notificar fila:', err.message))
  }

  if (mensagemWhatsApp) {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (tenant?.configWhatsApp) {
      for (const ag of agendamentos) {
        if (!ag.cliente?.telefone) continue
        const tz = tenant.timezone || 'America/Sao_Paulo'
        const dtFmt = new Date(ag.inicioEm).toLocaleString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit', timeZone: tz,
        })
        const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'
        const texto = mensagemWhatsApp
          .replace('{nome}', primeiroNome)
          .replace('{data}', dtFmt)
          .replace('{servico}', ag.servico?.nome || 'serviço')
        try {
          await whatsappServico.enviarMensagem(tenant.configWhatsApp, ag.cliente.telefone, texto, tenantId)
        } catch (err) {
          console.warn(`[CancelarPeriodo] Falha WhatsApp para ${ag.cliente.telefone}:`, err.message)
        }
      }
    }
  }

  return { cancelados: agendamentos.length }
}

// Envia mensagem promocional para clientes filtrados
const enviarPromocao = async (tenantId, { mensagem, filtro }) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.configWhatsApp) throw { status: 400, mensagem: 'WhatsApp não configurado', codigo: 'WHATSAPP_NAO_CONFIGURADO' }

  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
  const noventaDiasAtras = new Date()
  noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90)

  let clientesIds = []
  if (filtro === 'recentes') {
    const ags = await banco.agendamento.findMany({
      where: { tenantId, status: 'CONCLUIDO', inicioEm: { gte: trintaDiasAtras } },
      select: { clienteId: true },
      distinct: ['clienteId'],
    })
    clientesIds = ags.map((a) => a.clienteId)
  } else if (filtro === 'inativos') {
    const ativos = await banco.agendamento.findMany({
      where: { tenantId, status: 'CONCLUIDO', inicioEm: { gte: noventaDiasAtras } },
      select: { clienteId: true },
      distinct: ['clienteId'],
    })
    const idsAtivos = ativos.map((a) => a.clienteId)
    const todos = await banco.cliente.findMany({ where: { tenantId }, select: { id: true } })
    clientesIds = todos.map((c) => c.id).filter((id) => !idsAtivos.includes(id))
  } else {
    const todos = await banco.cliente.findMany({ where: { tenantId }, select: { id: true } })
    clientesIds = todos.map((c) => c.id)
  }

  if (clientesIds.length === 0) {
    return { enviados: 0, total: 0, mensagem: 'Nenhum cliente encontrado para o filtro selecionado' }
  }

  const clientesTodos = await banco.cliente.findMany({
    where: { id: { in: clientesIds } },
  })
  // Filtra clientes que têm telefone válido
  const clientes = clientesTodos.filter(c => c.telefone && c.telefone.trim())

  if (clientes.length === 0) {
    return { enviados: 0, total: 0, mensagem: 'Nenhum cliente com telefone cadastrado' }
  }

  let enviados = 0
  let falhas = 0
  for (const cliente of clientes) {
    if (!cliente.telefone) continue
    const primeiroNome = cliente.nome?.split(' ')[0] || 'cliente'
    const texto = mensagem.replace('{nome}', primeiroNome)
    try {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, texto, tenantId)
      enviados++
    } catch (err) {
      console.warn(`[Promoção] Falha para ${cliente.telefone}:`, err.message)
      falhas++
    }
  }

  return { enviados, total: clientes.length, falhas }
}

/**
 * Gera via IA uma mensagem de cancelamento personalizada para o modal "Cancelar por período".
 * @param {string} tenantId
 * @param {{ promo?: string, tentarRemarcar?: boolean }} opcoes
 */
const gerarMensagemCancelamento = async (tenantId, { promo, tentarRemarcar = true } = {}) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { nome: true, tomDeVoz: true } })

  const tomDesc = {
    FORMAL: 'elegante e profissional',
    DESCONTRALIDO: 'calorosa e informal',
    ACOLHEDOR: 'acolhedora e empática',
  }
  const tom = tomDesc[tenant?.tomDeVoz] || 'calorosa e informal'

  const remarcarInstrucao = tentarRemarcar
    ? 'Convide o cliente para remarcar respondendo diretamente no WhatsApp.'
    : 'Informe que a barbearia entrará em contato quando houver horário disponível.'

  const promoInstrucao = promo
    ? `\nNo final da mensagem, inclua esta oferta especial de forma natural: "${promo}"`
    : ''

  const prompt = `Você é o assistente da barbearia ${tenant?.nome || 'nossa barbearia'}. Tom: ${tom}.

Escreva UMA mensagem de WhatsApp para informar ao cliente que o agendamento dele precisou ser cancelado.
Use os placeholders EXATOS: {nome} (nome do cliente), {servico} (serviço), {data} (data/hora).
${remarcarInstrucao}${promoInstrucao}

Regras:
- Máximo 5 linhas. NUNCA use * ou **. Máximo 1 emoji.
- Comece com uma desculpa sincera e calorosa, usando {nome}.
- Mencione o serviço ({servico}) e o horário ({data}) que foi cancelado.
- Tom ${tentarRemarcar ? 'proativo — recupere o cliente' : 'informativo — gentil e claro'}.
- Assine como: "— ${tenant?.nome || 'Equipe'}"
- IMPORTANTE: Complete a mensagem inteira, não corte no meio de frases.`

  try {
    const resposta = await openaiAgendamentos.chat.completions.create({
      model: configIA.modelo,
      max_tokens: 500,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Gere a mensagem agora.' },
      ],
    })
    const mensagem = resposta.choices[0].message.content?.trim() || ''
    return { mensagem }
  } catch (err) {
    console.error('[gerarMensagemCancelamento] Erro IA:', err.message)
    throw { status: 500, mensagem: 'Erro ao gerar mensagem via IA', codigo: 'IA_ERRO' }
  }
}

module.exports = { listar, buscarPorId, criar, criarCombo, confirmar, confirmarPresenca, cancelar, remarcar, concluir, naoCompareceu, cancelarPeriodo, enviarPromocao, gerarMensagemCancelamento }

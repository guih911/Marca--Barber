const banco = require('../../config/banco')
const { adicionarMinutos } = require('../../utils/formatarData')
const filaEsperaServico = require('../filaEspera/filaEspera.servico')
const whatsappServico = require('../ia/whatsapp.servico')
const planosServico = require('../planos/planos.servico')
const fidelidadeServico = require('../fidelidade/fidelidade.servico')
const OpenAI = require('openai')
const configIA = require('../../config/ia')

const openaiAgendamentos = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })

// Envia confirmação WhatsApp ao cliente (melhor esforço — não falha o agendamento)
const notificarClienteConfirmacao = async (tenantId, ag) => {
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant?.configWhatsApp || !ag.cliente?.telefone) return

    const tz = tenant.timezone || 'America/Sao_Paulo'
    const dataFmt = new Date(ag.inicioEm).toLocaleString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })
    const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'

    const mensagem =
      `Olá, ${primeiroNome}! 😊\n` +
      `Seu agendamento está confirmado! ✅\n` +
      `${ag.servico.nome} com ${ag.profissional.nome}\n` +
      `${dataFmt}\n\n` +
      `Para cancelar ou remarcar, é só falar aqui! ✨\n` +
      `— ${tenant.nome}`

    // Garante DDI Brasil no número antes de enviar
    const telNorm = ag.cliente.telefone.replace(/\D/g, '')
    const telEnvio = telNorm.startsWith('55') && telNorm.length >= 12 ? telNorm : `55${telNorm}`
    await whatsappServico.enviarMensagem(tenant.configWhatsApp, telEnvio, mensagem, tenantId)
    console.log(`[Confirmação] Enviada para ${ag.cliente.telefone} — ${ag.servico.nome}`)
  } catch (err) {
    console.warn(`[Confirmação] Falha ao enviar WhatsApp (sem impacto no agendamento):`, err.message)
  }
}

const incluirRelacoes = {
  cliente: true,
  profissional: true,
  servico: true,
}

const STATUS_OPERACIONAIS_ATIVOS = ['AGENDADO', 'CONFIRMADO']

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

const obterServicoComDuracaoTx = async (tx, tenantId, profissionalId, servicoId) => {
  const profServico = await tx.profissionalServico.findFirst({
    where: { profissionalId, servicoId },
    include: { servico: true },
  })

  const servico = profServico?.servico || await tx.servico.findFirst({
    where: { id: servicoId, tenantId, ativo: true },
  })

  if (!servico) throw { status: 404, mensagem: 'Servico nao encontrado', codigo: 'NAO_ENCONTRADO' }

  return {
    servico,
    duracaoMinutos: profServico?.duracaoCustom || servico.duracaoMinutos,
  }
}

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

  const duracao = profServico?.duracaoCustom || servico.duracaoMinutos
  const inicioEm = new Date(dados.inicio)
  const fimEm = adicionarMinutos(inicioEm, duracao)

  // Valida se o profissional está configurado para trabalhar nesse dia da semana
  const profParaValidacao = await banco.profissional.findUnique({
    where: { id: dados.profissionalId },
    select: { horarioTrabalho: true, ativo: true, tenantId: true },
  })
  if (profParaValidacao && profParaValidacao.tenantId === tenantId) {
    const tz = 'America/Sao_Paulo'
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
  // Valida dias permitidos pelo plano mensal do cliente (se tiver assinatura ativa com restrição de dias)
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
  const menosde24h = (new Date(inicioEm) - new Date()) < 24 * 60 * 60 * 1000
  const statusInicial = clienteJaChegou || origem === 'WHATSAPP' || menosde24h ? 'CONFIRMADO' : 'AGENDADO'

  // Verifica conflito dentro de transação (lock otimista)
  return banco.$transaction(async (tx) => {
    if (!dados.walkin) {
      const conflito = await tx.agendamento.findFirst({
        where: {
          profissionalId: dados.profissionalId,
          status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
          AND: [{ inicioEm: { lt: fimEm } }, { fimEm: { gt: inicioEm } }],
        },
      })

      if (conflito) {
        throw {
          status: 409,
          mensagem: 'Horário indisponível: este profissional já tem um agendamento neste período',
          codigo: 'CONFLITO_HORARIO',
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
    // Envia confirmação WhatsApp somente para agendamentos criados pelo painel (não pelo próprio WhatsApp, que já responde na conversa)
    if (dados.origem !== 'WHATSAPP' && !dados.walkin) {
      notificarClienteConfirmacao(tenantId, ag)
    }
    return ag
  })
}

const criarCombo = async (tenantId, dados) => {
  const servicoIds = Array.from(new Set((dados.servicoIds || []).filter(Boolean)))
  if (servicoIds.length < 2) {
    throw { status: 422, mensagem: 'Informe ao menos dois servicos para o combo.', codigo: 'COMBO_INVALIDO' }
  }

  return banco.$transaction(async (tx) => {
    const criados = []
    let inicioAtual = new Date(dados.inicio)

    for (const servicoId of servicoIds) {
      const infoServico = await obterServicoComDuracaoTx(tx, tenantId, dados.profissionalId, servicoId)
      const fimAtual = adicionarMinutos(inicioAtual, infoServico.duracaoMinutos)

      const conflito = await tx.agendamento.findFirst({
        where: {
          profissionalId: dados.profissionalId,
          status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
          AND: [{ inicioEm: { lt: fimAtual } }, { fimEm: { gt: inicioAtual } }],
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
          // Combos pelo WhatsApp já vêm confirmados — cliente confirmou na conversa
          status: dados.origem === 'WHATSAPP' ? 'CONFIRMADO' : 'AGENDADO',
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
    if (dados.origem !== 'WHATSAPP' && agendamentos[0]) {
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

const cancelar = async (tenantId, id, motivo) => {
  const agendamento = await verificarPropriedade(tenantId, id)

  // Verifica antecedência mínima
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  const horasRestantes = (agendamento.inicioEm - new Date()) / (1000 * 60 * 60)

  if (horasRestantes > 0 && horasRestantes < tenant.antecedenciaCancelar) {
    throw {
      status: 422,
      mensagem: `Cancelamento exige ${tenant.antecedenciaCancelar}h de antecedência. Entre em contato com o estabelecimento.`,
      codigo: 'ANTECEDENCIA_INSUFICIENTE',
    }
  }

  const agCancelado = await banco.agendamento.update({
    where: { id },
    data: { status: 'CANCELADO', canceladoEm: new Date(), motivoCancelamento: motivo || null },
    include: incluirRelacoes,
  })

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

  const profServico = await banco.profissionalServico.findFirst({
    where: { profissionalId: agendamento.profissionalId, servicoId: agendamento.servicoId },
    include: { servico: true },
  })
  const servico = profServico?.servico || await banco.servico.findFirst({ where: { id: agendamento.servicoId } })
  const duracao = profServico?.duracaoCustom || servico.duracaoMinutos

  const inicioEm = new Date(novoInicio)
  const fimEm = adicionarMinutos(inicioEm, duracao)

  return banco.$transaction(async (tx) => {
    const conflito = await tx.agendamento.findFirst({
      where: {
        profissionalId: agendamento.profissionalId,
        id: { not: id },
        status: { notIn: ['CANCELADO', 'REMARCADO', 'NAO_COMPARECEU'] },
        AND: [{ inicioEm: { lt: fimEm } }, { fimEm: { gt: inicioEm } }],
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
        status: agendamento.origem === 'WHATSAPP' ? 'CONFIRMADO' : 'AGENDADO',
        origem: agendamento.origem,
        notas: agendamento.notas,
      },
      include: incluirRelacoes,
    })
  })
}

const concluir = async (tenantId, id, formaPagamento) => {
  const atual = await verificarPropriedade(tenantId, id)
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { exigirConfirmacaoPresenca: true, membershipsAtivo: true, comandaAtivo: true, configWhatsApp: true, nome: true, timezone: true },
  })

  if (tenant?.exigirConfirmacaoPresenca && !atual.presencaConfirmadaEm) {
    throw {
      status: 422,
      mensagem: 'Confirme a presença do cliente antes de finalizar o atendimento.',
      codigo: 'PRESENCA_OBRIGATORIA',
    }
  }

  let agendamento = await banco.agendamento.update({
    where: { id },
    data: { status: 'CONCLUIDO', formaPagamento: formaPagamento || null, concluidoEm: new Date(), presencaConfirmadaEm: atual.presencaConfirmadaEm || new Date() },
    include: incluirRelacoes,
  })

  // Somente na primeira conclusão: consome crédito de assinatura + registra pontos de fidelidade
  if (atual.status !== 'CONCLUIDO') {
    // Assinatura mensal
    try {
      const credito = await planosServico.consumirCreditoAssinatura(tenantId, agendamento.clienteId, agendamento.servicoId)
      agendamento = { ...agendamento, consumoAssinatura: credito }
    } catch (err) {
      console.warn('[Assinatura] Falha ao consumir crédito (sem impacto na conclusão):', err.message)
    }

    // Fidelidade — melhor esforço
    fidelidadeServico.registrarPontosAtendimento(tenantId, agendamento.clienteId, id)
      .catch((err) => console.warn('[Fidelidade] Falha ao registrar pontos:', err.message))

    // ── Plano Mensal: cobrança na visita presencial ──────────────────────────
    // Só processa se membershipsAtivo estiver ativo no tenant
    if (tenant?.membershipsAtivo) {
      processarCobrancaPlanoNaVisita(tenantId, agendamento, tenant)
        .catch((err) => console.warn('[PlanoMensal] Falha ao processar cobrança (sem impacto na conclusão):', err.message))
    }
  }

  return agendamento
}

/**
 * Processa cobrança do plano mensal quando cliente comparece presencialmente.
 * - Se proximaCobrancaEm é null (primeiro ciclo) ou já passou (renovação): cobra e atualiza.
 * - Se comandaAtivo: insere item de cobrança do plano na comanda do agendamento.
 * - Envia WhatsApp informando o cliente.
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

  // Atualiza próxima cobrança
  await banco.assinaturaCliente.update({
    where: { id: assinatura.id },
    data: { proximaCobrancaEm: novaProxCobranca },
  })

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
  if (ag?.presencaConfirmadaEm) {
    throw {
      status: 422,
      mensagem: 'Esse cliente ja teve a presenca confirmada. Use concluir ou remarcar.',
      codigo: 'PRESENCA_JA_CONFIRMADA',
    }
  }
  if (!ag) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }

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

  const clientes = await banco.cliente.findMany({
    where: { id: { in: clientesIds }, telefone: { not: null } },
  })

  let enviados = 0
  for (const cliente of clientes) {
    if (!cliente.telefone) continue
    const primeiroNome = cliente.nome?.split(' ')[0] || 'cliente'
    const texto = mensagem.replace('{nome}', primeiroNome)
    try {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, texto, tenantId)
      enviados++
    } catch (err) {
      console.warn(`[Promoção] Falha para ${cliente.telefone}:`, err.message)
    }
  }

  return { enviados, total: clientes.length }
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
- Assine como: "— ${tenant?.nome || 'Equipe'}"`

  try {
    const resposta = await openaiAgendamentos.chat.completions.create({
      model: configIA.modelo,
      max_tokens: 250,
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

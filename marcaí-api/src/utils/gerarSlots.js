const banco = require('../config/banco')
const { adicionarMinutos } = require('./formatarData')

const ANTECEDENCIA_MINIMA_PADRAO_MINUTOS = 60

// Granularidade de 15 min cobre serviços de 15, 20, 30, 45, 60 min sem buracos na grade.
// Era 30 min — o valor fixo quebrava combos com durações não-múltiplas de 30 (ex: 45 min).
const GRANULARIDADE_PADRAO_MINUTOS = 15

/**
 * Converte horário "HH:MM" + data string "YYYY-MM-DD" em Date (horário de Brasília UTC-3)
 */
const horarioParaDate = (dataStr, horario) => {
  return new Date(`${dataStr}T${horario}:00.000-03:00`)
}

/**
 * Verifica se dois intervalos se sobrepõem
 */
const sobrepoem = (inicio1, fim1, inicio2, fim2) => {
  return inicio1 < fim2 && fim1 > inicio2
}

const obterInicioMinimoPermitido = (agora, bufferMinutos = 0) => {
  const folgaOperacionalMinutos = Math.max(
    ANTECEDENCIA_MINIMA_PADRAO_MINUTOS,
    Number(bufferMinutos || 0) + 30
  )
  return adicionarMinutos(agora, folgaOperacionalMinutos)
}

/**
 * Gera todos os slots disponíveis para um profissional em uma data específica
 * considerando: horário de trabalho, intervalos, buffer, bloqueios e agendamentos existentes.
 *
 * @param {string} profissionalId
 * @param {number} duracaoMinutos - duração do serviço em minutos
 * @param {string} dataStr - data no formato "YYYY-MM-DD"
 * @param {object} [db] - Prisma client (banco ou tx — permite usar dentro de transações)
 * @param {string} [servicoId] - quando informado, valida se o profissional realiza o serviço
 * @returns {Array<{ inicio: Date, fim: Date, disponivel: boolean }>}
 */
const gerarSlots = async (profissionalId, duracaoMinutos, dataStr, db = banco, servicoId = null) => {
  const profissional = await db.profissional.findUnique({
    where: { id: profissionalId },
    include: {
      bloqueios: true,
      servicos: servicoId ? { where: { servicoId } } : false,
    },
  })

  if (!profissional || !profissional.ativo) return []

  // Valida se o profissional realiza o serviço solicitado (MÉDIO 4)
  if (servicoId && Array.isArray(profissional.servicos) && profissional.servicos.length === 0) {
    return [] // profissional não faz este serviço — sem slots
  }

  // Interpreta a data como dia em BRT (UTC-3)
  const dataBRT = new Date(`${dataStr}T12:00:00.000-03:00`)
  const diaSemana = dataBRT.getDay() // 0=domingo, 6=sábado

  // Profissional sem horário configurado → sem disponibilidade
  if (!profissional.horarioTrabalho) return []
  const horario = profissional.horarioTrabalho[diaSemana]

  // Profissional não trabalha nesse dia
  if (!horario || !horario.ativo) return []

  const inicioTrabalho = horarioParaDate(dataStr, horario.inicio)
  const fimTrabalho = horarioParaDate(dataStr, horario.fim)
  const intervalos = horario.intervalos || []
  const buffer = profissional.bufferMinutos || 0

  // Limites do dia em BRT: meia-noite BRT = 03:00 UTC
  const inicioDia = new Date(`${dataStr}T00:00:00.000-03:00`)
  const fimDia = new Date(`${dataStr}T23:59:59.999-03:00`)

  const agendamentosDoDia = await db.agendamento.findMany({
    where: {
      profissionalId,
      inicioEm: { gte: inicioDia, lte: fimDia },
      status: { notIn: ['CANCELADO', 'NAO_COMPARECEU', 'REMARCADO'] },
    },
  })

  // Bloqueios que se sobrepõem ao dia
  const bloqueiosDoDia = profissional.bloqueios.filter((b) =>
    sobrepoem(b.inicioEm, b.fimEm, inicioDia, fimDia)
  )

  const agora = new Date()
  const inicioMinimoPermitido = obterInicioMinimoPermitido(agora, buffer)
  const slots = []
  let cursor = new Date(inicioTrabalho)

  // Avança de slot em slot com granularidade de 15 min (era 30 — quebrava combos com durações
  // como 45 min, pois o segundo serviço precisaria começar às :45 que nunca era gerado)
  while (true) {
    const fimSlot = adicionarMinutos(cursor, duracaoMinutos)

    // Slot ultrapassa o fim do expediente
    if (fimSlot > fimTrabalho) break

    const slotInicio = new Date(cursor)
    const slotFim = new Date(fimSlot)

    // Ignora slots que já passaram (não avança cursor — só pula)
    if (slotInicio < inicioMinimoPermitido) {
      cursor = adicionarMinutos(cursor, GRANULARIDADE_PADRAO_MINUTOS)
      continue
    }

    let disponivel = true

    // Verifica sobreposição com intervalos (almoço, etc.)
    for (const intervalo of intervalos) {
      const inicioIntervalo = horarioParaDate(dataStr, intervalo.inicio)
      const fimIntervalo = horarioParaDate(dataStr, intervalo.fim)
      if (sobrepoem(slotInicio, slotFim, inicioIntervalo, fimIntervalo)) {
        disponivel = false
        break
      }
    }

    // Verifica sobreposição com bloqueios
    if (disponivel) {
      for (const bloqueio of bloqueiosDoDia) {
        if (sobrepoem(slotInicio, slotFim, bloqueio.inicioEm, bloqueio.fimEm)) {
          disponivel = false
          break
        }
      }
    }

    // Verifica sobreposição com agendamentos existentes (+ buffer)
    if (disponivel) {
      for (const ag of agendamentosDoDia) {
        // Aplica buffer no fim do agendamento existente
        const inicioComBuffer = adicionarMinutos(ag.inicioEm, -buffer)
        const fimComBuffer = adicionarMinutos(ag.fimEm, buffer)
        if (sobrepoem(slotInicio, slotFim, inicioComBuffer, fimComBuffer)) {
          disponivel = false
          break
        }
      }
    }

    slots.push({ inicio: slotInicio, fim: slotFim, disponivel })

    cursor = adicionarMinutos(cursor, GRANULARIDADE_PADRAO_MINUTOS)
  }

  return slots
}

/**
 * Valida se uma janela de tempo específica está disponível para um profissional,
 * independente da grade de slots. Usado para:
 *   - Validar posições intermediárias em combos (ex: serviço 2 começa às 09:45
 *     após 45 min de serviço 1, um horário que a grade de 30 min nunca gerava)
 *   - Validar dentro de transações passando `tx` como `db` (previne race conditions)
 *
 * Lança erro 422 com código específico se a janela não estiver disponível.
 *
 * @param {object} db - Prisma client (banco ou tx)
 * @param {{ profissionalId: string, duracaoMinutos: number, inicioEm: Date|string, agendamentoExcluidoId?: string }} params
 */
const validarJanelaTempo = async (db, { profissionalId, duracaoMinutos, inicioEm, agendamentoExcluidoId }) => {
  const profissional = await db.profissional.findUnique({
    where: { id: profissionalId },
    include: { bloqueios: true },
  })

  if (!profissional || !profissional.ativo) {
    throw { status: 422, mensagem: 'Profissional inativo ou não encontrado.', codigo: 'PROFISSIONAL_INATIVO' }
  }

  const tz = 'America/Sao_Paulo'
  const dataStr = new Date(inicioEm).toLocaleDateString('en-CA', { timeZone: tz })
  const dataBRT = new Date(`${dataStr}T12:00:00.000-03:00`)
  const diaSemana = dataBRT.getDay()

  if (!profissional.horarioTrabalho) {
    throw { status: 422, mensagem: 'Profissional sem horário configurado.', codigo: 'SLOT_INVALIDO' }
  }
  const horario = profissional.horarioTrabalho[diaSemana]

  if (!horario || !horario.ativo) {
    throw {
      status: 422,
      mensagem: 'Profissional não atende nesse dia da semana.',
      codigo: 'DIA_NAO_CONFIGURADO',
    }
  }

  const inicioTrabalho = horarioParaDate(dataStr, horario.inicio)
  const fimTrabalho = horarioParaDate(dataStr, horario.fim)
  const intervalos = horario.intervalos || []
  const buffer = profissional.bufferMinutos || 0

  const slotInicio = new Date(inicioEm)
  const slotFim = adicionarMinutos(slotInicio, duracaoMinutos)

  // Dentro do expediente
  if (slotInicio < inicioTrabalho || slotFim > fimTrabalho) {
    throw {
      status: 422,
      mensagem: 'Horário fora do expediente do profissional.',
      codigo: 'FORA_DO_EXPEDIENTE',
    }
  }

  // Antecedência mínima
  const agora = new Date()
  const inicioMinimoPermitido = obterInicioMinimoPermitido(agora, buffer)
  if (slotInicio < inicioMinimoPermitido) {
    throw {
      status: 422,
      mensagem: 'Horário com antecedência insuficiente. Agende com pelo menos 1 hora de antecedência.',
      codigo: 'ANTECEDENCIA_INSUFICIENTE',
    }
  }

  // Sobreposição com intervalos (almoço, etc.)
  for (const intervalo of intervalos) {
    const inicioIntervalo = horarioParaDate(dataStr, intervalo.inicio)
    const fimIntervalo = horarioParaDate(dataStr, intervalo.fim)
    if (sobrepoem(slotInicio, slotFim, inicioIntervalo, fimIntervalo)) {
      throw {
        status: 422,
        mensagem: 'Horário cai durante intervalo do profissional.',
        codigo: 'SLOT_INVALIDO',
      }
    }
  }

  // Sobreposição com bloqueios do profissional
  const inicioDia = new Date(`${dataStr}T00:00:00.000-03:00`)
  const fimDia = new Date(`${dataStr}T23:59:59.999-03:00`)
  const bloqueiosDoDia = profissional.bloqueios.filter((b) =>
    sobrepoem(b.inicioEm, b.fimEm, inicioDia, fimDia)
  )
  for (const bloqueio of bloqueiosDoDia) {
    if (sobrepoem(slotInicio, slotFim, bloqueio.inicioEm, bloqueio.fimEm)) {
      throw {
        status: 422,
        mensagem: 'Horário bloqueado para o profissional.',
        codigo: 'SLOT_INVALIDO',
      }
    }
  }

  // Sobreposição com agendamentos existentes (+ buffer)
  const whereConflito = {
    profissionalId,
    inicioEm: { gte: inicioDia, lte: fimDia },
    status: { notIn: ['CANCELADO', 'NAO_COMPARECEU', 'REMARCADO'] },
  }
  if (agendamentoExcluidoId) {
    whereConflito.id = { not: agendamentoExcluidoId }
  }
  const agendamentosDoDia = await db.agendamento.findMany({ where: whereConflito })

  for (const ag of agendamentosDoDia) {
    const inicioComBuffer = adicionarMinutos(ag.inicioEm, -buffer)
    const fimComBuffer = adicionarMinutos(ag.fimEm, buffer)
    if (sobrepoem(slotInicio, slotFim, inicioComBuffer, fimComBuffer)) {
      throw {
        status: 422,
        mensagem: 'Horário indisponível: conflito com agendamento existente do profissional.',
        codigo: 'SLOT_INVALIDO',
      }
    }
  }
}

module.exports = { gerarSlots, validarJanelaTempo, sobrepoem, obterInicioMinimoPermitido }

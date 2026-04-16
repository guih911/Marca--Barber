const banco = require('../config/banco')
const { adicionarMinutos } = require('./formatarData')

const ANTECEDENCIA_MINIMA_PADRAO_MINUTOS = 60

// Granularidade de 15 min cobre serviços de 15, 20, 30, 45, 60 min sem buracos na grade.
// Era 30 min — o valor fixo quebrava combos com durações não-múltiplas de 30 (ex: 45 min).
const GRANULARIDADE_PADRAO_MINUTOS = 15

/**
 * Converte horário "HH:MM" + data string "YYYY-MM-DD" em Date respeitando o timezone do tenant.
 * Calcula o offset real do timezone (lida com horário de verão automaticamente).
 */
const horarioParaDate = (dataStr, horario, timezone = 'America/Sao_Paulo') => {
  // Cria data ao meio-dia para evitar problemas de DST na detecção de offset
  const refDate = new Date(`${dataStr}T12:00:00Z`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(refDate)
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-3'

  // Extrai offset: "GMT-3" → "-03:00", "GMT-5" → "-05:00"
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  let offsetStr = '-03:00' // fallback BRT
  if (match) {
    const sinal = match[1]
    const horas = match[2].padStart(2, '0')
    const minutos = (match[3] || '00').padStart(2, '0')
    offsetStr = `${sinal}${horas}:${minutos}`
  }

  return new Date(`${dataStr}T${horario}:00.000${offsetStr}`)
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
      tenant: { select: { timezone: true } },
    },
  })

  if (!profissional || !profissional.ativo) return []

  if (servicoId && Array.isArray(profissional.servicos) && profissional.servicos.length === 0) {
    return []
  }

  const tz = profissional.tenant?.timezone || 'America/Sao_Paulo'

  const dataBRT = horarioParaDate(dataStr, '12:00', tz)
  const diaSemana = new Date(dataBRT).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
  const diaSemanaNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[diaSemana] ?? new Date(dataBRT).getDay()

  if (!profissional.horarioTrabalho) return []
  const horario = profissional.horarioTrabalho[diaSemanaNum]

  if (!horario || !horario.ativo) return []

  const inicioTrabalho = horarioParaDate(dataStr, horario.inicio, tz)
  const fimTrabalho = horarioParaDate(dataStr, horario.fim, tz)
  const intervalos = horario.intervalos || []
  const buffer = profissional.bufferMinutos || 0

  const inicioDia = horarioParaDate(dataStr, '00:00', tz)
  const fimDia = horarioParaDate(dataStr, '23:59', tz)

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
      const inicioIntervalo = horarioParaDate(dataStr, intervalo.inicio, tz)
      const fimIntervalo = horarioParaDate(dataStr, intervalo.fim, tz)
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
const validarJanelaTempo = async (db, { profissionalId, duracaoMinutos, inicioEm, agendamentoExcluidoId, ignorarAntecedenciaMinima = false }) => {
  const profissional = await db.profissional.findUnique({
    where: { id: profissionalId },
    include: { bloqueios: true, tenant: { select: { timezone: true } } },
  })

  if (!profissional || !profissional.ativo) {
    throw { status: 422, mensagem: 'Profissional inativo ou não encontrado.', codigo: 'PROFISSIONAL_INATIVO' }
  }

  const tz = profissional.tenant?.timezone || 'America/Sao_Paulo'
  const dataStr = new Date(inicioEm).toLocaleDateString('en-CA', { timeZone: tz })
  const diaSemanaStr = new Date(inicioEm).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
  const diaSemana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[diaSemanaStr] ?? 0

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

  const inicioTrabalho = horarioParaDate(dataStr, horario.inicio, tz)
  const fimTrabalho = horarioParaDate(dataStr, horario.fim, tz)
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
  if (!ignorarAntecedenciaMinima && slotInicio < inicioMinimoPermitido) {
    throw {
      status: 422,
      mensagem: 'Horário com antecedência insuficiente. Agende com pelo menos 1 hora de antecedência.',
      codigo: 'ANTECEDENCIA_INSUFICIENTE',
    }
  }

  // Sobreposição com intervalos (almoço, etc.)
  for (const intervalo of intervalos) {
    const inicioIntervalo = horarioParaDate(dataStr, intervalo.inicio, tz)
    const fimIntervalo = horarioParaDate(dataStr, intervalo.fim, tz)
    if (sobrepoem(slotInicio, slotFim, inicioIntervalo, fimIntervalo)) {
      throw {
        status: 422,
        mensagem: 'Horário cai durante intervalo do profissional.',
        codigo: 'SLOT_INVALIDO',
      }
    }
  }

  // Sobreposição com bloqueios do profissional
  const inicioDia = horarioParaDate(dataStr, '00:00', tz)
  const fimDia = horarioParaDate(dataStr, '23:59', tz)
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

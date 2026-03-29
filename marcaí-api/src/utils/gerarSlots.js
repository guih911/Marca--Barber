const banco = require('../config/banco')
const { adicionarMinutos } = require('./formatarData')

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

/**
 * Gera todos os slots disponíveis para um profissional em uma data específica
 * considerando: horário de trabalho, intervalos, buffer, bloqueios e agendamentos existentes
 *
 * @param {string} profissionalId
 * @param {number} duracaoMinutos - duração do serviço em minutos
 * @param {string} dataStr - data no formato "YYYY-MM-DD"
 * @returns {Array<{ inicio: Date, fim: Date, disponivel: boolean }>}
 */
const gerarSlots = async (profissionalId, duracaoMinutos, dataStr) => {
  const profissional = await banco.profissional.findUnique({
    where: { id: profissionalId },
    include: { bloqueios: true },
  })

  if (!profissional || !profissional.ativo) return []

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

  const agendamentosDoDia = await banco.agendamento.findMany({
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
  const slots = []
  let cursor = new Date(inicioTrabalho)

  // Avança de slot em slot com a duração do serviço
  while (true) {
    const fimSlot = adicionarMinutos(cursor, duracaoMinutos)

    // Slot ultrapassa o fim do expediente
    if (fimSlot > fimTrabalho) break

    const slotInicio = new Date(cursor)
    const slotFim = new Date(fimSlot)

    // Ignora slots que já passaram (não avança cursor — só pula)
    if (slotInicio <= agora) {
      cursor = adicionarMinutos(cursor, 30)
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
        const fimComBuffer = adicionarMinutos(ag.fimEm, buffer)
        if (sobrepoem(slotInicio, slotFim, ag.inicioEm, fimComBuffer)) {
          disponivel = false
          break
        }
      }
    }

    slots.push({ inicio: slotInicio, fim: slotFim, disponivel })

    // Avança o cursor pelo intervalo de 30 minutos (granularidade dos slots)
    cursor = adicionarMinutos(cursor, 30)
  }

  return slots
}

module.exports = { gerarSlots }

const banco = require('../../config/banco')
const { gerarSlots } = require('../../utils/gerarSlots')

const obterServicoComDuracao = async (tenantId, profissionalId, servicoId) => {
  const profServico = await banco.profissionalServico.findFirst({
    where: { profissionalId, servicoId },
    include: { servico: true },
  })

  const servico = profServico?.servico || await banco.servico.findFirst({
    where: { id: servicoId, tenantId, ativo: true },
  })

  if (!servico) {
    throw { status: 404, mensagem: 'Servico nao encontrado', codigo: 'NAO_ENCONTRADO' }
  }

  return {
    servico,
    duracaoMinutos: profServico?.duracaoCustom || servico.duracaoMinutos,
  }
}

const listarProfissionais = async (tenantId, profissionalId) => {
  const profissionais = profissionalId
    ? await banco.profissional.findMany({ where: { id: profissionalId, tenantId, ativo: true } })
    : await banco.profissional.findMany({ where: { tenantId, ativo: true } })

  if (profissionais.length === 0) {
    throw { status: 404, mensagem: 'Profissional nao encontrado', codigo: 'NAO_ENCONTRADO' }
  }

  return profissionais
}

const verificarDisponibilidade = async (tenantId, { profissionalId, servicoId, data }) => {
  const servico = await banco.servico.findFirst({ where: { id: servicoId, tenantId, ativo: true } })
  if (!servico) throw { status: 404, mensagem: 'Servico nao encontrado', codigo: 'NAO_ENCONTRADO' }

  const profissionais = await listarProfissionais(tenantId, profissionalId)
  const todosSlots = []

  for (const prof of profissionais) {
    const infoServico = await obterServicoComDuracao(tenantId, prof.id, servicoId)
    // Passa servicoId para que gerarSlots pule profissionais que não realizem o serviço
    const slots = await gerarSlots(prof.id, infoServico.duracaoMinutos, data, undefined, servicoId)
    slots.forEach((slot) => {
      todosSlots.push({ ...slot, profissional: { id: prof.id, nome: prof.nome } })
    })
  }

  return todosSlots
}

const verificarDisponibilidadeCombo = async (tenantId, { profissionalId, servicoIds = [], data }) => {
  const ids = Array.from(new Set((servicoIds || []).filter(Boolean)))
  if (ids.length < 2) {
    throw { status: 422, mensagem: 'Informe ao menos dois servicos para o combo.', codigo: 'COMBO_INVALIDO' }
  }

  const profissionais = await listarProfissionais(tenantId, profissionalId)
  const combos = []

  for (const prof of profissionais) {
    const etapas = []

    for (const servicoId of ids) {
      etapas.push(await obterServicoComDuracao(tenantId, prof.id, servicoId))
    }

    const slotsPorEtapa = await Promise.all(
      etapas.map((etapa, i) => gerarSlots(prof.id, etapa.duracaoMinutos, data, undefined, ids[i]))
    )

    const mapasDisponiveis = slotsPorEtapa.map((slots) => new Map(
      slots
        .filter((slot) => slot.disponivel)
        .map((slot) => [slot.inicio.toISOString(), slot])
    ))

    for (const primeiroSlot of slotsPorEtapa[0].filter((slot) => slot.disponivel)) {
      const servicosCombo = [{
        servicoId: ids[0],
        servico: etapas[0].servico,
        inicio: primeiroSlot.inicio,
        fim: primeiroSlot.fim,
      }]

      let fimCombo = primeiroSlot.fim
      let comboValido = true

      for (let i = 1; i < etapas.length; i += 1) {
        const proximoSlot = mapasDisponiveis[i].get(fimCombo.toISOString())
        if (!proximoSlot) {
          comboValido = false
          break
        }

        servicosCombo.push({
          servicoId: ids[i],
          servico: etapas[i].servico,
          inicio: proximoSlot.inicio,
          fim: proximoSlot.fim,
        })
        fimCombo = proximoSlot.fim
      }

      if (!comboValido) continue

      combos.push({
        profissional: { id: prof.id, nome: prof.nome },
        inicio: primeiroSlot.inicio,
        fim: fimCombo,
        servicos: servicosCombo,
        totalDuracaoMinutos: etapas.reduce((acc, etapa) => acc + etapa.duracaoMinutos, 0),
        totalPrecoCentavos: etapas.reduce((acc, etapa) => acc + (etapa.servico.precoCentavos || 0), 0),
      })
    }
  }

  return combos.sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
}

module.exports = { verificarDisponibilidade, verificarDisponibilidadeCombo }

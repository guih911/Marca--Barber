const banco = require('../../config/banco')

const verificarFeatureComissoes = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { comissoesAtivo: true } })
  if (!tenant?.comissoesAtivo) throw { status: 403, mensagem: 'Módulo de comissões não está ativo.', codigo: 'FEATURE_INATIVA' }
}

/**
 * Calcula comissões dos profissionais em um período.
 * Usa comissaoPercent de ProfissionalServico ou percentual padrão.
 */
const calcularComissoes = async (tenantId, { inicio, fim, profissionalId } = {}) => {
  await verificarFeatureComissoes(tenantId)
  const agora = new Date()
  const inicioData = inicio ? new Date(inicio) : new Date(agora.getFullYear(), agora.getMonth(), 1)
  const fimData = fim ? new Date(fim) : agora

  const where = {
    tenantId,
    status: 'CONCLUIDO',
    inicioEm: { gte: inicioData, lte: fimData },
  }
  if (profissionalId) where.profissionalId = profissionalId

  const agendamentos = await banco.agendamento.findMany({
    where,
    include: {
      profissional: { select: { id: true, nome: true } },
      servico: { select: { id: true, nome: true, precoCentavos: true } },
    },
  })

  // Busca comissões configuradas
  const profServicos = await banco.profissionalServico.findMany({
    where: { profissional: { tenantId } },
    select: { profissionalId: true, servicoId: true, comissaoPercent: true, precoCustom: true },
  })

  const mapComissao = {}
  for (const ps of profServicos) {
    mapComissao[`${ps.profissionalId}:${ps.servicoId}`] = {
      comissaoPercent: ps.comissaoPercent,
      precoCustom: ps.precoCustom,
    }
  }

  // Agrupa por profissional
  const porProfissional = {}
  for (const ag of agendamentos) {
    const pid = ag.profissionalId
    if (!porProfissional[pid]) {
      porProfissional[pid] = {
        profissionalId: pid,
        nome: ag.profissional.nome,
        atendimentos: 0,
        receitaTotalCentavos: 0,
        comissaoTotalCentavos: 0,
        detalhes: [],
      }
    }

    const chave = `${pid}:${ag.servicoId}`
    const config = mapComissao[chave] || {}
    const precoCentavos = config.precoCustom || ag.servico?.precoCentavos || 0
    const percentual = config.comissaoPercent ?? 0
    const comissaoCentavos = Math.round(precoCentavos * percentual / 100)

    porProfissional[pid].atendimentos++
    porProfissional[pid].receitaTotalCentavos += precoCentavos
    porProfissional[pid].comissaoTotalCentavos += comissaoCentavos
    porProfissional[pid].detalhes.push({
      agendamentoId: ag.id,
      servico: ag.servico.nome,
      data: ag.inicioEm,
      precoCentavos,
      percentual,
      comissaoCentavos,
    })
  }

  const resultado = Object.values(porProfissional).sort((a, b) => b.receitaTotalCentavos - a.receitaTotalCentavos)

  const totais = resultado.reduce((acc, p) => ({
    atendimentos: acc.atendimentos + p.atendimentos,
    receitaTotalCentavos: acc.receitaTotalCentavos + p.receitaTotalCentavos,
    comissaoTotalCentavos: acc.comissaoTotalCentavos + p.comissaoTotalCentavos,
  }), { atendimentos: 0, receitaTotalCentavos: 0, comissaoTotalCentavos: 0 })

  return { periodo: { inicio: inicioData, fim: fimData }, profissionais: resultado, totais }
}

// Atualizar % comissão de um profissional para um serviço específico
const atualizarComissao = async (tenantId, profissionalId, servicoId, comissaoPercent) => {
  await verificarFeatureComissoes(tenantId)
  const ps = await banco.profissionalServico.findFirst({
    where: { profissionalId, servicoId, profissional: { tenantId } },
  })
  if (!ps) throw { status: 404, mensagem: 'Configuração não encontrada', codigo: 'NAO_ENCONTRADO' }

  return banco.profissionalServico.update({
    where: { id: ps.id },
    data: { comissaoPercent: comissaoPercent === null ? null : Number(comissaoPercent) },
  })
}

// Define comissão padrão para TODOS os serviços de um profissional
const atualizarComissaoPadrao = async (tenantId, profissionalId, comissaoPercent) => {
  await verificarFeatureComissoes(tenantId)
  const profissional = await banco.profissional.findFirst({ where: { id: profissionalId, tenantId } })
  if (!profissional) throw { status: 404, mensagem: 'Profissional não encontrado', codigo: 'NAO_ENCONTRADO' }

  await banco.profissionalServico.updateMany({
    where: { profissionalId, profissional: { tenantId } },
    data: { comissaoPercent: comissaoPercent === null ? null : Number(comissaoPercent) },
  })

  return { atualizado: true }
}

module.exports = { calcularComissoes, atualizarComissao, atualizarComissaoPadrao }

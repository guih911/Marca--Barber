const banco = require('../../config/banco')
const { processarEvento } = require('../ia/messageOrchestrator')

const verificarRecurso = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { comandaAtivo: true } })
  if (!tenant?.comandaAtivo) throw { status: 403, mensagem: 'Módulo Comanda não está ativo', codigo: 'RECURSO_INATIVO' }
}

const obterComanda = async (tenantId, agendamentoId) => {
  await verificarRecurso(tenantId)
  const agendamento = await banco.agendamento.findFirst({
    where: { id: agendamentoId, tenantId },
    include: {
      cliente: { select: { nome: true, telefone: true } },
      profissional: { select: { nome: true } },
      servico: { select: { nome: true, precoCentavos: true } },
      comandaItens: { include: { produto: { select: { nome: true, unidade: true } } } },
    },
  })
  if (!agendamento) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }
  return agendamento
}

const adicionarItem = async (tenantId, agendamentoId, dados) => {
  await verificarRecurso(tenantId)
  const ag = await banco.agendamento.findFirst({ where: { id: agendamentoId, tenantId } })
  if (!ag) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }

  const item = await banco.comandaItem.create({
    data: {
      agendamentoId,
      produtoId: dados.produtoId || null,
      descricao: dados.descricao,
      quantidade: Number(dados.quantidade) || 1,
      precoCentavos: Number(dados.precoCentavos) || 0,
    },
    include: { produto: { select: { nome: true, unidade: true } } },
  })

  // Se produto vinculado → baixa o estoque automaticamente
  if (dados.produtoId) {
    try {
      const estoqueServico = require('../estoque/estoque.servico')
      await estoqueServico.registrarMovimento(tenantId, dados.produtoId, 'SAIDA', Number(dados.quantidade) || 1, `Comanda - ${ag.id}`)
    } catch (err) {
      console.warn('[Comanda] Falha ao baixar estoque:', err.message)
    }
  }

  return item
}

const removerItem = async (tenantId, agendamentoId, itemId) => {
  await verificarRecurso(tenantId)
  const ag = await banco.agendamento.findFirst({ where: { id: agendamentoId, tenantId } })
  if (!ag) throw { status: 404, mensagem: 'Agendamento não encontrado', codigo: 'NAO_ENCONTRADO' }

  const item = await banco.comandaItem.findFirst({ where: { id: itemId, agendamentoId } })
  if (!item) throw { status: 404, mensagem: 'Item não encontrado', codigo: 'NAO_ENCONTRADO' }

  await banco.comandaItem.delete({ where: { id: itemId } })
  return { removido: true }
}

const calcularTotal = (agendamento) => {
  const servicoCentavos = agendamento.servico?.precoCentavos || 0
  const itensCentavos = agendamento.comandaItens?.reduce((acc, i) => acc + (i.precoCentavos * i.quantidade), 0) || 0
  return servicoCentavos + itensCentavos
}

// Envia resumo da comanda via WhatsApp para o cliente
const enviarReciboWhatsApp = async (tenantId, agendamentoId) => {
  const ag = await obterComanda(tenantId, agendamentoId)
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { configWhatsApp: true, nome: true, comandaAtivo: true },
  })

  if (!tenant?.comandaAtivo) {
    throw { status: 403, mensagem: 'Módulo Comanda não está ativo', codigo: 'RECURSO_INATIVO' }
  }
  if (!tenant?.configWhatsApp) {
    throw { status: 422, mensagem: 'WhatsApp não está conectado. Conecte em Configurações > Integrações.', codigo: 'WHATSAPP_NAO_CONFIGURADO' }
  }
  if (!ag.cliente?.telefone) {
    throw { status: 400, mensagem: 'Cliente não possui telefone cadastrado', codigo: 'CLIENTE_SEM_TELEFONE' }
  }

  const totalCentavos = calcularTotal(ag)
  const resumoFinanceiro = [
    `✂️ ${ag.servico.nome}`,
    ...(ag.comandaItens || []).map(i => `• ${i.descricao} (${i.quantidade}x)`)
  ].join('\n')

  try {
    await processarEvento({
      evento: 'COMANDA_RECIBO',
      agendamento: ag,
      tenantId,
      cliente: ag.cliente,
      extra: { 
        resumoFinanceiro, 
        total: (totalCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
      }
    })
    return { enviado: true, total: totalCentavos }
  } catch (err) {
    console.error('[Comanda] Falha ao orquestrar recibo:', err.message)
    return { enviado: false, total: totalCentavos }
  }
}

module.exports = { obterComanda, adicionarItem, removerItem, calcularTotal, enviarReciboWhatsApp }

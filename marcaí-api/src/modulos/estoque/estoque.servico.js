const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')

const UNIDADES_ESTOQUE = new Set(['unid', 'ml', 'g', 'kg', 'L', 'pacote', 'caixa', 'duzia', 'fardo'])

const normalizarUnidade = (unidade, fallback = 'unid') => {
  if (typeof unidade !== 'string') return fallback
  const valor = unidade.trim()
  if (!valor) return fallback
  return UNIDADES_ESTOQUE.has(valor) ? valor : fallback
}

const verificarRecurso = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId }, select: { estoqueAtivo: true } })
  if (!tenant?.estoqueAtivo) throw { status: 403, mensagem: 'Módulo Estoque não está ativo', codigo: 'RECURSO_INATIVO' }
}

const listar = async (tenantId, { ativo, busca } = {}) => {
  await verificarRecurso(tenantId)
  const where = { tenantId }
  if (ativo !== undefined) where.ativo = ativo === 'true' || ativo === true
  if (busca) where.nome = { contains: busca, mode: 'insensitive' }

  return banco.produto.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: { _count: { select: { movimentos: true } } },
  })
}

const buscarPorId = async (tenantId, id) => {
  const produto = await banco.produto.findFirst({
    where: { id, tenantId },
    include: { movimentos: { orderBy: { criadoEm: 'desc' }, take: 20 } },
  })
  if (!produto) throw { status: 404, mensagem: 'Produto não encontrado', codigo: 'NAO_ENCONTRADO' }
  return produto
}

const criar = async (tenantId, dados) => {
  await verificarRecurso(tenantId)
  return banco.produto.create({
    data: {
      tenantId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      unidade: normalizarUnidade(dados.unidade),
      precoCustoCentavos: dados.precoCustoCentavos || null,
      precoVendaCentavos: dados.precoVendaCentavos || null,
      quantidadeAtual: Number(dados.quantidadeAtual) || 0,
      quantidadeMinima: Number(dados.quantidadeMinima) ?? 2,
    },
  })
}

const atualizar = async (tenantId, id, dados) => {
  await verificarRecurso(tenantId)
  const produtoAtual = await verificarPropriedade(tenantId, id)
  return banco.produto.update({
    where: { id },
    data: {
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      unidade: normalizarUnidade(dados.unidade, produtoAtual.unidade),
      precoCustoCentavos: dados.precoCustoCentavos ?? null,
      precoVendaCentavos: dados.precoVendaCentavos ?? null,
      quantidadeMinima: Number(dados.quantidadeMinima) ?? 2,
      ativo: dados.ativo,
    },
  })
}

const registrarMovimento = async (tenantId, produtoId, tipo, quantidade, motivo) => {
  const produto = await verificarPropriedade(tenantId, produtoId)

  // AJUSTE define quantidade absoluta; SAIDA subtrai; ENTRADA adiciona
  let novaQtd
  if (tipo === 'AJUSTE') {
    novaQtd = Math.abs(quantidade)
  } else if (tipo === 'SAIDA') {
    novaQtd = produto.quantidadeAtual - Math.abs(quantidade)
  } else {
    novaQtd = produto.quantidadeAtual + Math.abs(quantidade)
  }

  if (novaQtd < 0) {
    throw { status: 400, mensagem: 'Quantidade insuficiente em estoque', codigo: 'ESTOQUE_INSUFICIENTE' }
  }

  const [movto] = await banco.$transaction([
    banco.movimentoEstoque.create({ data: { produtoId, tipo, quantidade: Math.abs(quantidade), motivo } }),
    banco.produto.update({ where: { id: produtoId }, data: { quantidadeAtual: novaQtd } }),
  ])

  // Verifica se ficou abaixo do mínimo → alerta WhatsApp
  if (novaQtd <= produto.quantidadeMinima) {
    alertarEstoqueBaixo(tenantId, produto, novaQtd).catch(() => {})
  }

  return movto
}

const alertarEstoqueBaixo = async (tenantId, produto, qtdAtual) => {
  // Evita enviar alerta mais de 1x por dia
  if (produto.alertaEnviadoEm) {
    const diff = (new Date() - new Date(produto.alertaEnviadoEm)) / (1000 * 60 * 60)
    if (diff < 24) return
  }

  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { configWhatsApp: true, estoqueAtivo: true },
  })
  if (!tenant?.estoqueAtivo || !tenant?.configWhatsApp) return

  const config = tenant.configWhatsApp
  const numeroAdmin = config?.numeroAdministrador
  if (!numeroAdmin) return

  const msg = `⚠️ *Estoque baixo!*\n\n` +
    `Produto: *${produto.nome}*\n` +
    `Quantidade atual: *${qtdAtual} ${produto.unidade}*\n` +
    `Quantidade mínima: ${produto.quantidadeMinima} ${produto.unidade}\n\n` +
    `Acesse o painel para repor o estoque.`

  await whatsappServico.enviarMensagem(config, numeroAdmin, msg, tenantId)
  await banco.produto.update({ where: { id: produto.id }, data: { alertaEnviadoEm: new Date() } })
}

// Cron: verifica todos os produtos com estoque baixo e alerta
const verificarEstoqueBaixoTodos = async () => {
  try {
    const tenants = await banco.tenant.findMany({
      where: { ativo: true, estoqueAtivo: true, configWhatsApp: { not: null } },
      select: { id: true, configWhatsApp: true },
    })

    for (const tenant of tenants) {
      const produtos = await banco.produto.findMany({
        where: {
          tenantId: tenant.id,
          ativo: true,
          // quantidadeAtual <= quantidadeMinima
        },
      })

      for (const p of produtos) {
        if (p.quantidadeAtual <= p.quantidadeMinima) {
          await alertarEstoqueBaixo(tenant.id, p, p.quantidadeAtual).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.error('[Estoque] Erro na verificação de estoque baixo:', err.message)
  }
}

const verificarPropriedade = async (tenantId, id) => {
  const produto = await banco.produto.findFirst({ where: { id, tenantId } })
  if (!produto) throw { status: 404, mensagem: 'Produto não encontrado', codigo: 'NAO_ENCONTRADO' }
  return produto
}

module.exports = { listar, buscarPorId, criar, atualizar, registrarMovimento, verificarEstoqueBaixoTodos }

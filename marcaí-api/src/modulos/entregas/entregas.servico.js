const banco = require('../../config/banco')
const clientesServico = require('../clientes/clientes.servico')
const whatsappServico = require('../ia/whatsapp.servico')
const { processarEvento } = require('../ia/messageOrchestrator')
const estoqueServico = require('../estoque/estoque.servico')

const STATUS_PERMITIDOS = ['NOVO', 'PREPARANDO', 'A_CAMINHO', 'CHEGUEI', 'FINALIZADO', 'CANCELADO']

const normalizarTelefone = (valor = '') => String(valor || '').replace(/\D/g, '')

const obterDestinoNotificacao = (tenant) => {
  const numeroDono = normalizarTelefone(tenant?.numeroDono || '')
  if (numeroDono) return `+${numeroDono.startsWith('55') ? numeroDono : `55${numeroDono}`}`
  const numeroAdmin = normalizarTelefone(tenant?.configWhatsApp?.numeroAdministrador || '')
  if (numeroAdmin) return `+${numeroAdmin.startsWith('55') ? numeroAdmin : `55${numeroAdmin}`}`
  return null
}

const listarJanelasEntrega = (tenant) => (
  Array.isArray(tenant?.janelasEntrega)
    ? tenant.janelasEntrega
      .filter((item) => item && item.inicio && item.fim)
      .map((item) => ({
        inicio: String(item.inicio),
        fim: String(item.fim),
        label: item.label || `${item.inicio} às ${item.fim}`,
      }))
    : []
)

const calcularPrevisaoEntrega = (tenant, janela) => {
  if (!janela?.inicio || !janela?.fim) return null
  const agora = new Date()
  const [horaInicio, minutoInicio] = String(janela.inicio).split(':').map(Number)
  const [horaFim, minutoFim] = String(janela.fim).split(':').map(Number)
  const inicio = new Date(agora)
  inicio.setHours(horaInicio || 0, minutoInicio || 0, 0, 0)
  const fim = new Date(agora)
  fim.setHours(horaFim || 0, minutoFim || 0, 0, 0)
  const tempoMedio = Math.max(5, Number(tenant?.tempoMedioEntregaMin) || 45)
  const previsao = new Date(Math.max(agora.getTime(), inicio.getTime()) + tempoMedio * 60000)
  if (previsao > fim) return fim
  return previsao
}

const obterTenantEntrega = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      nome: true,
      entregaAtivo: true,
      taxaEntregaCentavos: true,
      valorMinimoEntregaCentavos: true,
      tempoMedioEntregaMin: true,
      janelasEntrega: true,
      configWhatsApp: true,
      numeroDono: true,
    },
  })
  if (!tenant?.entregaAtivo) throw { status: 403, mensagem: 'Entrega não está ativa nesta barbearia.', codigo: 'RECURSO_INATIVO' }
  return tenant
}

const formatarPedidoResumo = (pedido) => ({
  id: pedido.id,
  clienteNome: pedido.clienteNome,
  clienteTelefone: pedido.clienteTelefone,
  enderecoEntrega: pedido.enderecoEntrega,
  referenciaEndereco: pedido.referenciaEndereco,
  observacoes: pedido.observacoes,
  formaPagamento: pedido.formaPagamento,
  taxaEntregaCentavos: pedido.taxaEntregaCentavos,
  subtotalCentavos: pedido.subtotalCentavos,
  totalCentavos: pedido.totalCentavos,
  janelaEntregaLabel: pedido.janelaEntregaLabel,
  janelaEntregaInicio: pedido.janelaEntregaInicio,
  janelaEntregaFim: pedido.janelaEntregaFim,
  previsaoEntregaEm: pedido.previsaoEntregaEm,
  status: pedido.status,
  criadoEm: pedido.criadoEm,
  preparandoEm: pedido.preparandoEm,
  saiuParaEntregaEm: pedido.saiuParaEntregaEm,
  chegouEm: pedido.chegouEm,
  finalizadoEm: pedido.finalizadoEm,
  canceladoEm: pedido.canceladoEm,
  itens: Array.isArray(pedido.itens)
    ? pedido.itens.map((item) => ({
      id: item.id,
      produtoId: item.produtoId,
      nomeProduto: item.nomeProduto,
      quantidade: item.quantidade,
      precoUnitarioCentavos: item.precoUnitarioCentavos,
      subtotalCentavos: item.subtotalCentavos,
    }))
    : [],
})

const listarProdutosPublicos = async (tenantId) => {
  const tenant = await obterTenantEntrega(tenantId)
  const produtos = await banco.produto.findMany({
    where: {
      tenantId,
      ativo: true,
      divulgarNoLink: true,
      permiteEntrega: true,
      quantidadeAtual: { gt: 0 },
    },
    orderBy: { nome: 'asc' },
  })

  return {
    produtos,
    configuracaoEntrega: {
      taxaEntregaCentavos: tenant.taxaEntregaCentavos || 0,
      valorMinimoEntregaCentavos: tenant.valorMinimoEntregaCentavos || 0,
      tempoMedioEntregaMin: tenant.tempoMedioEntregaMin || 45,
      janelasEntrega: listarJanelasEntrega(tenant),
    },
  }
}

const criarPedidoPublico = async (tenantId, dados) => {
  const tenant = await obterTenantEntrega(tenantId)
  const itens = Array.isArray(dados.itens) ? dados.itens.filter((item) => item?.produtoId && Number(item?.quantidade) > 0) : []
  if (!itens.length) throw { status: 400, mensagem: 'Escolha ao menos um produto.', codigo: 'ITENS_OBRIGATORIOS' }
  if (!dados.nome?.trim()) throw { status: 400, mensagem: 'Informe o seu nome.', codigo: 'NOME_OBRIGATORIO' }
  if (!dados.telefone?.trim()) throw { status: 400, mensagem: 'Informe o WhatsApp.', codigo: 'TELEFONE_OBRIGATORIO' }
  if (!dados.enderecoEntrega?.trim()) throw { status: 400, mensagem: 'Informe o endereço de entrega.', codigo: 'ENDERECO_OBRIGATORIO' }
  if (!dados.formaPagamento?.trim()) throw { status: 400, mensagem: 'Selecione a forma de pagamento.', codigo: 'PAGAMENTO_OBRIGATORIO' }

  const produtos = await banco.produto.findMany({
    where: {
      tenantId,
      id: { in: itens.map((item) => item.produtoId) },
      ativo: true,
      divulgarNoLink: true,
      permiteEntrega: true,
    },
  })

  if (produtos.length !== itens.length) {
    throw { status: 400, mensagem: 'Um ou mais produtos não estão mais disponíveis.', codigo: 'PRODUTO_INDISPONIVEL' }
  }

  const mapaProdutos = new Map(produtos.map((produto) => [produto.id, produto]))
  const itensNormalizados = itens.map((item) => {
    const produto = mapaProdutos.get(item.produtoId)
    const quantidade = Number(item.quantidade)
    if (!produto || quantidade <= 0) throw { status: 400, mensagem: 'Produto inválido no carrinho.', codigo: 'ITEM_INVALIDO' }
    if (Number(produto.quantidadeAtual) < quantidade) {
      throw { status: 400, mensagem: `Estoque insuficiente para ${produto.nome}.`, codigo: 'ESTOQUE_INSUFICIENTE' }
    }
    const preco = Number(produto.precoVendaCentavos || 0)
    return {
      produtoId: produto.id,
      nomeProduto: produto.nome,
      quantidade,
      precoUnitarioCentavos: preco,
      subtotalCentavos: Math.round(preco * quantidade),
    }
  })

  const subtotalCentavos = itensNormalizados.reduce((soma, item) => soma + item.subtotalCentavos, 0)
  const taxaEntregaCentavos = Number(tenant.taxaEntregaCentavos || 0)
  const valorMinimoEntregaCentavos = Number(tenant.valorMinimoEntregaCentavos || 0)
  if (subtotalCentavos < valorMinimoEntregaCentavos) {
    throw {
      status: 400,
      mensagem: `O pedido mínimo para entrega é ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorMinimoEntregaCentavos / 100)}.`,
      codigo: 'PEDIDO_MINIMO',
    }
  }

  const janelas = listarJanelasEntrega(tenant)
  const janelaSelecionada = janelas.find((item) => item.label === dados.janelaEntregaLabel || (item.inicio === dados.janelaEntregaInicio && item.fim === dados.janelaEntregaFim)) || null
  if (janelas.length > 0 && !janelaSelecionada) {
    throw { status: 400, mensagem: 'Selecione uma janela de entrega válida.', codigo: 'JANELA_INVALIDA' }
  }

  const cliente = await clientesServico.buscarOuCriarPorTelefone(
    tenantId,
    dados.telefone,
    dados.nome,
  ).catch(() => null)

  const pedido = await banco.pedidoEntrega.create({
    data: {
      tenantId,
      clienteId: cliente?.id || null,
      clienteNome: dados.nome.trim(),
      clienteTelefone: dados.telefone.trim(),
      enderecoEntrega: dados.enderecoEntrega.trim(),
      referenciaEndereco: dados.referenciaEndereco?.trim() || null,
      observacoes: dados.observacoes?.trim() || null,
      formaPagamento: dados.formaPagamento.trim(),
      taxaEntregaCentavos,
      subtotalCentavos,
      totalCentavos: subtotalCentavos + taxaEntregaCentavos,
      janelaEntregaLabel: janelaSelecionada?.label || null,
      janelaEntregaInicio: janelaSelecionada?.inicio || null,
      janelaEntregaFim: janelaSelecionada?.fim || null,
      previsaoEntregaEm: calcularPrevisaoEntrega(tenant, janelaSelecionada),
      itens: {
        create: itensNormalizados,
      },
    },
    include: {
      itens: true,
    },
  })

  const destino = obterDestinoNotificacao(tenant)
  if (tenant.configWhatsApp && destino) {
    const resumoItens = itensNormalizados.map((item) => `- ${item.nomeProduto} x${item.quantidade}`).join('\n')
    const resumoPedido = `Novo pedido: ${resumoItens}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.totalCentavos / 100)}`
    
    processarEvento({
      evento: 'PEDIDO_NOVO_ADMIN',
      tenantId,
      cliente: { nome: pedido.clienteNome, telefone: pedido.clienteTelefone }, // Mock cliente object for admin notification
      extra: { 
        resumoPedido,
        destinoDireto: destino
      }
    })
  }

  return formatarPedidoResumo(pedido)
}

const listarPedidos = async (tenantId, { status, limite = 50 } = {}) => {
  const tenant = await obterTenantEntrega(tenantId)
  const where = { tenantId: tenant.id }
  if (status && STATUS_PERMITIDOS.includes(status)) where.status = status
  const pedidos = await banco.pedidoEntrega.findMany({
    where,
    include: { itens: true },
    orderBy: [{ criadoEm: 'desc' }],
    take: Math.max(1, Math.min(Number(limite) || 50, 200)),
  })
  return pedidos.map(formatarPedidoResumo)
}

const listarPedidosClientePublico = async (tenantId, telefone) => {
  const tenant = await obterTenantEntrega(tenantId)
  const tel = normalizarTelefone(telefone)
  if (!tel) return []
  const pedidos = await banco.pedidoEntrega.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { clienteTelefone: tel },
        { clienteTelefone: `+${tel}` },
        { clienteTelefone: `+55${tel}` },
        { clienteTelefone: tel.startsWith('55') ? `+${tel}` : undefined },
      ].filter(Boolean),
    },
    include: { itens: true },
    orderBy: { criadoEm: 'desc' },
    take: 20,
  })
  return pedidos.map(formatarPedidoResumo)
}

const atualizarStatus = async (tenantId, pedidoId, novoStatus) => {
  await obterTenantEntrega(tenantId)
  if (!STATUS_PERMITIDOS.includes(novoStatus)) {
    throw { status: 400, mensagem: 'Status inválido.', codigo: 'STATUS_INVALIDO' }
  }
  const pedido = await banco.pedidoEntrega.findFirst({
    where: { id: pedidoId, tenantId },
    include: { itens: true, tenant: { select: { nome: true, configWhatsApp: true } } },
  })
  if (!pedido) throw { status: 404, mensagem: 'Pedido não encontrado.', codigo: 'NAO_ENCONTRADO' }

  const dataStatus = {}
  if (novoStatus === 'PREPARANDO') dataStatus.preparandoEm = new Date()
  if (novoStatus === 'A_CAMINHO') dataStatus.saiuParaEntregaEm = new Date()
  if (novoStatus === 'CHEGUEI') dataStatus.chegouEm = new Date()
  if (novoStatus === 'FINALIZADO') dataStatus.finalizadoEm = new Date()
  if (novoStatus === 'CANCELADO') dataStatus.canceladoEm = new Date()

  const atualizado = await banco.pedidoEntrega.update({
    where: { id: pedidoId },
    data: {
      status: novoStatus,
      ...dataStatus,
    },
    include: { itens: true },
  })

  if (novoStatus === 'FINALIZADO') {
    for (const item of pedido.itens) {
      if (item.produtoId) {
        await estoqueServico.registrarMovimento(tenantId, item.produtoId, 'SAIDA', Number(item.quantidade), `Entrega finalizada - ${pedido.id}`).catch(() => {})
      }
    }
  }

  if (pedido.tenant?.configWhatsApp) {
    processarEvento({
      evento: 'PEDIDO_STATUS',
      tenantId,
      cliente: { nome: pedido.clienteNome, telefone: pedido.clienteTelefone },
      extra: { status: novoStatus }
    })
  }

  return formatarPedidoResumo(atualizado)
}

module.exports = {
  listarProdutosPublicos,
  criarPedidoPublico,
  listarPedidos,
  listarPedidosClientePublico,
  atualizarStatus,
}

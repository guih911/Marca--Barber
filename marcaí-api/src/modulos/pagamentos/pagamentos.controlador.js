const banco = require('../../config/banco')
const asaas = require('./asaas.servico')

const PLANOS_PRECOS = {
  SOLO: { nome: 'Solo', mensal: 55.90, semestral: 50.31, anual: 44.72 },
  SALAO: { nome: 'Salão', mensal: 139.90, semestral: 125.91, anual: 111.92 },
}

/**
 * POST /api/pagamentos/checkout
 * Cria cliente no Asaas + assinatura e retorna link de pagamento
 */
const checkout = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const { nome, email, cpfCnpj, telefone, plano, ciclo } = req.body

    if (!nome || !email || !cpfCnpj || !plano) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'nome, email, cpfCnpj e plano são obrigatórios' } })
    }

    const planoInfo = PLANOS_PRECOS[plano]
    if (!planoInfo) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Plano inválido' } })
    }

    const cicloNorm = (ciclo || 'MENSAL').toUpperCase()
    const cicloKey = { MENSAL: 'mensal', SEMESTRAL: 'semestral', ANUAL: 'anual' }[cicloNorm] || 'mensal'
    const valor = planoInfo[cicloKey]

    // 1. Cria cliente no Asaas
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    let customerId = tenant?.asaasCustomerId

    if (!customerId) {
      const cliente = await asaas.criarCliente({ nome, email, cpfCnpj, telefone })
      customerId = cliente.id

      await banco.tenant.update({
        where: { id: tenantId },
        data: { asaasCustomerId: customerId },
      })
    }

    // 2. Cria assinatura no Asaas
    const assinatura = await asaas.criarAssinatura({
      customerId,
      plano: { nome: planoInfo.nome, valor },
      ciclo: cicloNorm,
      descricao: `Plano ${planoInfo.nome} (${cicloNorm.toLowerCase()}) — Marcaí Barber`,
    })

    // 3. Salva dados no tenant
    await banco.tenant.update({
      where: { id: tenantId },
      data: {
        asaasSubscriptionId: assinatura.id,
        planoContratado: plano,
        cicloCobranca: cicloNorm,
      },
    })

    // 4. Busca primeira cobrança para retornar link de pagamento
    const cobrancas = await asaas.listarCobrancasAssinatura(assinatura.id)
    const primeiraCobranca = cobrancas?.data?.[0]

    res.json({
      sucesso: true,
      dados: {
        assinaturaId: assinatura.id,
        status: assinatura.status,
        valor,
        ciclo: cicloNorm,
        linkPagamento: primeiraCobranca?.invoiceUrl || primeiraCobranca?.bankSlipUrl || null,
        pixQrCode: primeiraCobranca?.pixQrCodeBase64 || null,
        vencimento: primeiraCobranca?.dueDate || null,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

/**
 * GET /api/pagamentos/status
 * Retorna status da assinatura do tenant
 */
const status = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })

    if (!tenant?.asaasSubscriptionId) {
      return res.json({ sucesso: true, dados: { status: 'SEM_ASSINATURA', ativo: false } })
    }

    const assinatura = await asaas.buscarAssinatura(tenant.asaasSubscriptionId)

    res.json({
      sucesso: true,
      dados: {
        status: assinatura.status,
        ativo: assinatura.status === 'ACTIVE',
        valor: assinatura.value,
        ciclo: assinatura.cycle,
        proximaCobranca: assinatura.nextDueDate,
      },
    })
  } catch (erro) {
    next(erro)
  }
}

/**
 * POST /api/pagamentos/webhook
 * Webhook do Asaas para atualizar status de pagamento
 */
const webhook = async (req, res) => {
  try {
    const { event, payment } = req.body

    if (!payment?.subscription) {
      return res.json({ recebido: true })
    }

    const tenant = await banco.tenant.findFirst({
      where: { asaasSubscriptionId: payment.subscription },
    })

    if (!tenant) {
      console.warn(`[Asaas Webhook] Tenant não encontrado para subscription ${payment.subscription}`)
      return res.json({ recebido: true })
    }

    console.log(`[Asaas Webhook] ${event} — tenant ${tenant.id} — payment ${payment.id}`)

    // Atualiza status baseado no evento
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await banco.tenant.update({
        where: { id: tenant.id },
        data: { asaasStatus: 'ACTIVE' },
      })
    } else if (event === 'PAYMENT_OVERDUE') {
      await banco.tenant.update({
        where: { id: tenant.id },
        data: { asaasStatus: 'OVERDUE' },
      })
    }

    res.json({ recebido: true })
  } catch (err) {
    console.error('[Asaas Webhook] Erro:', err.message)
    res.json({ recebido: true })
  }
}

module.exports = { checkout, status, webhook }

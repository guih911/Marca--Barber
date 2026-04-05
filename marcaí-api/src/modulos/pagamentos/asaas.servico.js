/**
 * Integração com Asaas — Gateway de pagamentos
 * Docs: https://docs.asaas.com/reference
 */

const BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const API_KEY = process.env.ASAAS_API_KEY

const headers = () => ({
  'Content-Type': 'application/json',
  'access_token': API_KEY,
})

const request = async (method, path, body = null) => {
  const opts = { method, headers: headers() }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json()

  if (!res.ok) {
    const msg = data.errors?.[0]?.description || data.message || `Asaas error ${res.status}`
    console.error(`[Asaas] ${method} ${path} → ${res.status}:`, msg)
    throw { status: res.status, mensagem: msg, codigo: 'ASAAS_ERROR' }
  }

  return data
}

/**
 * Cria ou busca cliente no Asaas
 */
const criarCliente = async ({ nome, email, cpfCnpj, telefone }) => {
  return request('POST', '/customers', {
    name: nome,
    email,
    cpfCnpj: cpfCnpj?.replace(/\D/g, '') || undefined,
    mobilePhone: telefone?.replace(/\D/g, '') || undefined,
  })
}

/**
 * Cria assinatura recorrente no Asaas
 */
const criarAssinatura = async ({ customerId, plano, ciclo, descricao }) => {
  const cicloMap = {
    MENSAL: 'MONTHLY',
    SEMESTRAL: 'SEMIANNUALLY',
    ANUAL: 'YEARLY',
  }

  return request('POST', '/subscriptions', {
    customer: customerId,
    billingType: 'UNDEFINED', // aceita qualquer forma (PIX, boleto, cartão)
    value: plano.valor,
    cycle: cicloMap[ciclo] || 'MONTHLY',
    description: descricao || `Plano ${plano.nome} — Marcaí Barber`,
    nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias grátis
  })
}

/**
 * Gera link de pagamento avulso (checkout Asaas)
 */
const criarLinkPagamento = async ({ nome, descricao, valor, customerId }) => {
  return request('POST', '/paymentLinks', {
    name: nome,
    description: descricao,
    value: valor,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    dueDateLimitDays: 10,
    subscriptionCycle: 'MONTHLY',
    maxInstallmentCount: 1,
    notificationEnabled: true,
    ...(customerId ? { customer: customerId } : {}),
  })
}

/**
 * Busca cobrança por ID
 */
const buscarCobranca = async (paymentId) => {
  return request('GET', `/payments/${paymentId}`)
}

/**
 * Busca assinatura por ID
 */
const buscarAssinatura = async (subscriptionId) => {
  return request('GET', `/subscriptions/${subscriptionId}`)
}

/**
 * Lista cobranças de uma assinatura
 */
const listarCobrancasAssinatura = async (subscriptionId) => {
  return request('GET', `/subscriptions/${subscriptionId}/payments`)
}

module.exports = {
  criarCliente,
  criarAssinatura,
  criarLinkPagamento,
  buscarCobranca,
  buscarAssinatura,
  listarCobrancasAssinatura,
}

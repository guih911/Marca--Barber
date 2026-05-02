const BASE = import.meta.env.VITE_ADMIN_API_URL || ''

const getToken = () => localStorage.getItem('admin_token')

export const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`)
  return data
}

export const login = async (email, senha) => {
  const data = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  })
  localStorage.setItem('admin_token', data.token)
  localStorage.setItem('admin_user', JSON.stringify(data.admin))
  return data
}

export const logout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
}

export const isLoggedIn = () => !!localStorage.getItem('admin_token')
export const getUser = () => JSON.parse(localStorage.getItem('admin_user') || 'null')

// === Clientes cross-tenant ===
export const apiClientes = (params = {}) => {
  const qs = new URLSearchParams(params)
  return api(`/api/admin/clientes?${qs}`)
}

// === Tenants ===
export const apiCriarTenant = (payload) =>
  api('/api/admin/tenants', { method: 'POST', body: JSON.stringify(payload) })
export const apiStatusPagamento = (id, adimplente) =>
  api(`/api/admin/tenants/${id}/pagamento`, { method: 'PATCH', body: JSON.stringify({ adimplente }) })

// === Relatórios ===
export const apiRelatoriosAdmins = () => api('/api/admin/relatorios/admins')
export const apiRelatoriosLeads = () => api('/api/admin/relatorios/leads')
export const apiRelatoriosTenants = () => api('/api/admin/relatorios/tenants')
export const apiRelatoriosFunil = () => api('/api/admin/relatorios/funil')

// === SLA Tickets ===
export const apiTicketsSla = (slaMinutos = 30) =>
  api(`/api/admin/comercial/suporte/tickets?slaMinutos=${slaMinutos}`)

// === Disparos em massa ===
export const apiDisparosTenants = () => api('/api/admin/disparos/tenants')
export const apiEnviarDisparo = (payload) =>
  api('/api/admin/disparos', { method: 'POST', body: JSON.stringify(payload) })

// === Config Meta Admin ===
export const apiConfigMeta = () => api('/api/admin/config/meta')
export const apiSalvarConfigMeta = (payload) =>
  api('/api/admin/config/meta', { method: 'PUT', body: JSON.stringify(payload) })
export const apiTestarMeta = () =>
  api('/api/admin/config/meta/testar', { method: 'POST' })

// === Templates ===
export const apiTemplates = () => api('/api/admin/templates')
export const apiCriarTemplate = (payload) =>
  api('/api/admin/templates', { method: 'POST', body: JSON.stringify(payload) })
export const apiExcluirTemplate = (id) =>
  api(`/api/admin/templates/${id}`, { method: 'DELETE' })

// === Disparo via admin Meta ===
export const apiDisparar = (payload) =>
  api('/api/admin/mensagens/disparar', { method: 'POST', body: JSON.stringify(payload) })

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

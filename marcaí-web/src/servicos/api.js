const BASE_URL = import.meta.env.VITE_API_URL ?? ''

// Obtém o token do localStorage
const obterToken = () => localStorage.getItem('accessToken')

// Salva tokens
export const salvarTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
}

// Remove tokens (logout)
export const removerTokens = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('usuario')
}

// Tenta renovar o access token com o refresh token
const renovarToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      removerTokens()
      return null
    }

    const data = await res.json()
    if (data.sucesso) {
      salvarTokens(data.dados.accessToken, data.dados.refreshToken)
      return data.dados.accessToken
    }
    return null
  } catch {
    return null
  }
}

// Fetch centralizado com autenticação automática e refresh
export const apiFetch = async (caminho, opcoes = {}) => {
  const url = `${BASE_URL}${caminho}`

  const cabecalhos = {
    'Content-Type': 'application/json',
    ...opcoes.headers,
  }

  const token = obterToken()
  if (token) cabecalhos['Authorization'] = `Bearer ${token}`

  let resposta = await fetch(url, { ...opcoes, headers: cabecalhos })

  // Se 401, tenta renovar o token e repetir
  if (resposta.status === 401) {
    const novoToken = await renovarToken()
    if (novoToken) {
      cabecalhos['Authorization'] = `Bearer ${novoToken}`
      resposta = await fetch(url, { ...opcoes, headers: cabecalhos })
    } else {
      // Redireciona para login se não conseguiu renovar
      removerTokens()
      window.location.href = '/login'
      return null
    }
  }

  let dados
  try {
    dados = await resposta.json()
  } catch {
    dados = { erro: { mensagem: 'Resposta inesperada do servidor' }, status: resposta.status }
  }

  if (!resposta.ok) {
    throw { status: resposta.status, ...dados }
  }

  return dados
}

// Métodos convenientes
export const api = {
  get: (caminho) => apiFetch(caminho, { method: 'GET' }),

  post: (caminho, corpo) =>
    apiFetch(caminho, {
      method: 'POST',
      body: JSON.stringify(corpo),
    }),

  patch: (caminho, corpo) =>
    apiFetch(caminho, {
      method: 'PATCH',
      body: JSON.stringify(corpo),
    }),

  put: (caminho, corpo) =>
    apiFetch(caminho, {
      method: 'PUT',
      body: JSON.stringify(corpo),
    }),

  delete: (caminho) => apiFetch(caminho, { method: 'DELETE' }),
}

export default api

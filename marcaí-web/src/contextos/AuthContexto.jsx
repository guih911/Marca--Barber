import { createContext, useState, useEffect, useCallback } from 'react'
import { salvarTokens, removerTokens } from '../servicos/api'
import api from '../servicos/api'

export const AuthContexto = createContext(null)

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [tenantCarregando, setTenantCarregando] = useState(false)
  const [tenantInicializado, setTenantInicializado] = useState(false)

  const definirUsuario = useCallback((dadosUsuario) => {
    setUsuario(dadosUsuario)
    localStorage.setItem('usuario', JSON.stringify(dadosUsuario))
  }, [])

  const carregarTenant = useCallback(async () => {
    setTenantCarregando(true)
    try {
      const resp = await api.get('/api/tenants/meu')
      const dados = resp.dados
      setTenant(dados)
      localStorage.setItem('tenant', JSON.stringify(dados))
      return dados
    } catch {
      return null
    } finally {
      setTenantCarregando(false)
      setTenantInicializado(true)
    }
  }, [])

  // Carrega usuário e tenant salvos ao inicializar
  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario')
    const tenantSalvo = localStorage.getItem('tenant')
    if (usuarioSalvo) {
      try {
        setUsuario(JSON.parse(usuarioSalvo))
        if (tenantSalvo) {
          setTenant(JSON.parse(tenantSalvo))
          setTenantInicializado(true)
        } else {
          setTenantCarregando(true)
        }
      } catch {
        removerTokens()
      }
    } else {
      setTenantInicializado(true)
    }
    setCarregando(false)
  }, [])

  // Recarrega tenant quando usuário é definido (após login)
  useEffect(() => {
    if (usuario) carregarTenant()
  }, [usuario?.tenantId]) // eslint-disable-line

  const login = useCallback(async (email, senha) => {
    const resposta = await api.post('/api/auth/login', { email, senha })
    const { accessToken, refreshToken, usuario: dadosUsuario } = resposta.dados
    salvarTokens(accessToken, refreshToken)
    definirUsuario(dadosUsuario)
    setTenant(null)
    setTenantCarregando(true)
    setTenantInicializado(false)
    return dadosUsuario
  }, [definirUsuario])

  const cadastrar = useCallback(async (nome, email, senha) => {
    const resposta = await api.post('/api/auth/cadastro', { nome, email, senha })
    const { accessToken, refreshToken, usuario: dadosUsuario } = resposta.dados
    salvarTokens(accessToken, refreshToken)
    definirUsuario(dadosUsuario)
    setTenant(null)
    setTenantCarregando(true)
    setTenantInicializado(false)
    return dadosUsuario
  }, [definirUsuario])

  const logout = useCallback(() => {
    removerTokens()
    localStorage.removeItem('tenant')
    setUsuario(null)
    setTenant(null)
    setTenantCarregando(false)
    setTenantInicializado(false)
  }, [])

  // Atualiza dados do usuário em memória (após onboarding)
  const atualizarUsuario = useCallback((novosDados) => {
    setUsuario((prev) => {
      const atualizado = { ...prev, ...novosDados }
      localStorage.setItem('usuario', JSON.stringify(atualizado))
      return atualizado
    })
  }, [])

  const atualizarTenant = useCallback((novosDados) => {
    setTenant((prev) => {
      const atualizado = { ...prev, ...novosDados }
      localStorage.setItem('tenant', JSON.stringify(atualizado))
      return atualizado
    })
    setTenantInicializado(true)
    setTenantCarregando(false)
  }, [])

  return (
    <AuthContexto.Provider
      value={{
        usuario,
        tenant,
        carregando,
        tenantCarregando,
        tenantInicializado,
        estaAutenticado: !!usuario,
        definirUsuario,
        login,
        cadastrar,
        logout,
        atualizarUsuario,
        atualizarTenant,
        carregarTenant,
      }}
    >
      {children}
    </AuthContexto.Provider>
  )
}

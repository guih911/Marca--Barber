import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearTokens,
  fetchMe,
  getStoredAccessToken,
  login as apiLogin,
  setStoredUser,
} from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getStoredAccessToken()
        if (!token) return
        try {
          const perfil = await fetchMe({ timeoutMs: 8000 })
          if (!cancelled) {
            setUser(perfil)
            await setStoredUser(perfil)
          }
        } catch {
          await clearTokens()
          if (!cancelled) setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, senha) => {
    const dados = await apiLogin(email, senha)
    setUser(dados.usuario)
    return dados
  }, [])

  const logout = useCallback(async () => {
    await clearTokens()
    setUser(null)
  }, [])

  const updateUser = useCallback(async (u) => {
    await setStoredUser(u)
    setUser(u)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: !!user,
      planoContratado: user?.planoContratado ?? 'SALAO',
      isPlanoSolo: user?.planoContratado === 'SOLO',
    }),
    [user, loading, login, logout, updateUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

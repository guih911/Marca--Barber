import { useContext } from 'react'
import { AuthContexto } from '../contextos/AuthContexto'

const useAuth = () => {
  const contexto = useContext(AuthContexto)
  if (!contexto) throw new Error('useAuth deve ser usado dentro do AuthProvider')
  return contexto
}

export default useAuth

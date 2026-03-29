import { useState, useCallback } from 'react'
import { api } from '../servicos/api'

// Hook genérico para chamadas à API com estados de loading e erro
const useApi = () => {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const executar = useCallback(async (fn) => {
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await fn()
      return resultado
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Ocorreu um erro. Tente novamente.')
      throw e
    } finally {
      setCarregando(false)
    }
  }, [])

  return { carregando, erro, executar }
}

export default useApi

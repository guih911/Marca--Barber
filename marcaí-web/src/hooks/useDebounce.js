import { useState, useEffect } from 'react'

// Hook que atrasa a atualização de um valor (evita chamadas excessivas em busca)
const useDebounce = (valor, delay = 300) => {
  const [valorDebounced, setValorDebounced] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => setValorDebounced(valor), delay)
    return () => clearTimeout(timer)
  }, [valor, delay])

  return valorDebounced
}

export default useDebounce

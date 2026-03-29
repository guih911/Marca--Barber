import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../lib/utils'

const ToastContexto = createContext(null)

const icones = {
  sucesso: CheckCircle2,
  erro: XCircle,
  aviso: AlertTriangle,
  info: Info,
}

const cores = {
  sucesso: 'bg-white border-sucesso/30 text-sucesso',
  erro: 'bg-white border-perigo/30 text-perigo',
  aviso: 'bg-white border-alerta/30 text-alerta',
  info: 'bg-white border-info/30 text-info',
}

const coresFundo = {
  sucesso: 'bg-sucesso/8',
  erro: 'bg-perigo/8',
  aviso: 'bg-alerta/8',
  info: 'bg-info/8',
}

let contador = 0

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((mensagem, tipo = 'sucesso', duracao = 4000) => {
    const id = ++contador
    setToasts((prev) => [...prev, { id, mensagem, tipo }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duracao)
    return id
  }, [])

  const remover = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContexto.Provider value={{ toast }}>
      {children}

      {/* Container dos toasts */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => {
          const Icone = icones[t.tipo] || Info
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg max-w-sm w-full pointer-events-auto',
                'animate-slide-in',
                cores[t.tipo]
              )}
            >
              <div className={cn('p-1.5 rounded-xl shrink-0', coresFundo[t.tipo])}>
                <Icone size={16} />
              </div>
              <p className="flex-1 text-sm font-medium text-texto leading-snug pt-0.5">{t.mensagem}</p>
              <button
                onClick={() => remover(t.id)}
                className="shrink-0 p-1 rounded-lg text-texto-sec hover:text-texto hover:bg-fundo transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContexto.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContexto)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx.toast
}

export default ToastContexto

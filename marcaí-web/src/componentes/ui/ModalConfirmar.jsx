import { X, AlertTriangle } from 'lucide-react'

/**
 * Modal de confirmação reutilizável.
 *
 * Uso:
 *   const [confirmar, setConfirmar] = useState(null)
 *   // Para abrir: setConfirmar({ titulo, mensagem, onConfirmar, corBotao? })
 *   // Para fechar: setConfirmar(null)
 *
 *   {confirmar && (
 *     <ModalConfirmar
 *       {...confirmar}
 *       onCancelar={() => setConfirmar(null)}
 *     />
 *   )}
 */
const ModalConfirmar = ({
  titulo = 'Confirmar ação',
  mensagem,
  labelConfirmar = 'Confirmar',
  labelCancelar = 'Cancelar',
  corBotao = 'perigo',
  onConfirmar,
  onCancelar,
  carregando = false,
}) => {
  const btnCor =
    corBotao === 'perigo'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primaria hover:bg-primaria-escura text-white'

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-start gap-3 p-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-texto text-base">{titulo}</h3>
            {mensagem && <p className="text-sm text-texto-sec mt-1">{mensagem}</p>}
          </div>
          <button onClick={onCancelar} className="text-texto-sec hover:text-texto transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancelar}
            disabled={carregando}
            className="flex-1 border border-borda text-texto-sec py-2.5 rounded-xl text-sm font-medium hover:text-texto transition-colors disabled:opacity-50"
          >
            {labelCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={carregando}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${btnCor}`}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalConfirmar

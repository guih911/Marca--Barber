import { cn } from '../../lib/utils'

const variantes = {
  default:
    'bg-primaria text-white hover:bg-primaria-escura shadow-primaria hover:shadow-glow active:scale-[0.98]',
  outline: 'border border-borda bg-white text-texto hover:bg-fundo hover:border-borda',
  ghost: 'text-texto hover:bg-fundo hover:text-texto',
  destructive: 'bg-perigo text-white hover:bg-perigo/90 shadow-sm active:scale-[0.98]',
  secondary: 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-md active:scale-[0.98]',
}

const tamanhos = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 py-1.5 text-xs',
  lg: 'h-11 px-6 py-2.5 text-base',
  icon: 'h-9 w-9',
}

const Button = ({ className, variante = 'default', tamanho = 'default', disabled, children, ...props }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-primaria/30',
      'disabled:pointer-events-none disabled:opacity-50',
      variantes[variante] || variantes.default,
      tamanhos[tamanho] || tamanhos.default,
      className
    )}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
)

export { Button }

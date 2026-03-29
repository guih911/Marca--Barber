import { cn } from '../../lib/utils'

const variantes = {
  default: 'bg-primaria-clara text-primaria',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
}

const Badge = ({ className, variante = 'default', children, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
      variantes[variante] || variantes.default,
      className
    )}
    {...props}
  >
    {children}
  </span>
)

export { Badge }

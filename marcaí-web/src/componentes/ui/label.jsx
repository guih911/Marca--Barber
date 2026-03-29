import { cn } from '../../lib/utils'

const Label = ({ className, ...props }) => (
  <label
    className={cn('text-sm font-medium text-texto leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
)

export { Label }

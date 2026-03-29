import { cn } from '../../lib/utils'

const Textarea = ({ className, ...props }) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm text-texto',
      'placeholder:text-texto-sec/60 resize-none',
      'focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors',
      className
    )}
    {...props}
  />
)

export { Textarea }

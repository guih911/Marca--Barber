import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

const Select = RadixSelect.Root
const SelectGroup = RadixSelect.Group
const SelectValue = RadixSelect.Value

const SelectTrigger = ({ className, children, ...props }) => (
  <RadixSelect.Trigger
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-lg border border-borda bg-white px-3 py-2 text-sm text-texto',
      'focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[placeholder]:text-texto-sec',
      'transition-colors',
      className
    )}
    {...props}
  >
    {children}
    <RadixSelect.Icon asChild>
      <ChevronDown size={15} className="text-texto-sec shrink-0 ml-1" />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
)

const SelectContent = ({ className, children, position = 'popper', ...props }) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-xl border border-borda bg-white shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <RadixSelect.Viewport
        className={cn(
          'p-1',
          position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </RadixSelect.Viewport>
    </RadixSelect.Content>
  </RadixSelect.Portal>
)

const SelectLabel = ({ className, ...props }) => (
  <RadixSelect.Label
    className={cn('px-2 py-1.5 text-xs font-semibold text-texto-sec', className)}
    {...props}
  />
)

const SelectItem = ({ className, children, ...props }) => (
  <RadixSelect.Item
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm text-texto',
      'focus:bg-primaria-clara focus:text-primaria focus:outline-none',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'transition-colors',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixSelect.ItemIndicator>
        <Check size={14} className="text-primaria" />
      </RadixSelect.ItemIndicator>
    </span>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
)

const SelectSeparator = ({ className, ...props }) => (
  <RadixSelect.Separator
    className={cn('-mx-1 my-1 h-px bg-borda', className)}
    {...props}
  />
)

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}

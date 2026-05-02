import { cn } from '../../lib/utils'

const variantes = {
  auth: {
    root: 'w-[240px] mx-auto',
    image: 'w-full h-auto',
  },
  sidebar: {
    root: 'w-[175px] mr-auto',
    image: 'w-full h-auto',
  },
  compact: {
    root: 'h-11 w-11 mx-auto',
    image: 'h-full w-full object-cover object-left scale-[2.75] origin-left',
  },
}

const logoSrc = {
  auth: '/logo-loguin.png',
  sidebar: '/logo-barber.svg',
  compact: '/logo-barber.svg',
}

const BrandLogo = ({ variant = 'sidebar', className = '' }) => {
  const config = variantes[variant] ?? variantes.sidebar

  return (
    <div
      role="img"
      aria-label="BarberMark"
      className={cn(
        'flex items-center justify-center overflow-hidden',
        config.root,
        className
      )}
    >
      <img
        src={logoSrc[variant] ?? '/logo-barber.svg'}
        alt="BarberMark Logo"
        className={cn(
          'pointer-events-none select-none drop-shadow-md',
          config.image
        )}
      />
    </div>
  )
}

export default BrandLogo

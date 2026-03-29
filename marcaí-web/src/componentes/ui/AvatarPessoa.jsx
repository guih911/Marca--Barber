import { useEffect, useState } from 'react'
import { cn, obterIniciais } from '../../lib/utils'

const tamanhos = {
  xxs: 'w-6 h-6 text-[10px]',
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

const AvatarPessoa = ({ pessoa, nome, avatarUrl, tamanho = 'md', className = '', fallbackClassName = '', grayscale = false }) => {
  const [fotoInvalida, setFotoInvalida] = useState(false)
  const nomeFinal = nome || pessoa?.nome || ''
  const avatarFinal = avatarUrl || pessoa?.avatarUrl
  const exibirFoto = Boolean(avatarFinal) && !fotoInvalida

  useEffect(() => {
    setFotoInvalida(false)
  }, [avatarFinal])

  return (
    <div className={cn('rounded-full overflow-hidden shrink-0', tamanhos[tamanho] || tamanhos.md, grayscale && 'grayscale', className)}>
      {exibirFoto ? (
        <img
          src={avatarFinal}
          alt={nomeFinal || 'Avatar'}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFotoInvalida(true)}
        />
      ) : (
        <div className={cn('w-full h-full flex items-center justify-center bg-primaria/15 text-primaria font-bold', fallbackClassName)}>
          {obterIniciais(nomeFinal)}
        </div>
      )}
    </div>
  )
}

export default AvatarPessoa

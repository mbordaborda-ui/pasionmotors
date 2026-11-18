import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { logos } from '@/config'

interface LogoProps {
  className?: string
  /** Variante de color: badge (redondo), light (sobre fondo oscuro), dark (sobre fondo claro). */
  variant?: 'badge' | 'light' | 'dark'
  to?: string
}

export function Logo({ className, variant = 'light', to = '/' }: LogoProps) {
  const src = variant === 'badge' ? logos.badge : logos.secondary
  const content =
    variant === 'badge' ? (
      <img src={src} alt="PASION MOTORS" className={cn('h-11 w-11 object-contain', className)} />
    ) : (
      <div className={cn('flex items-center gap-3', className)}>
        <img
          src={variant === 'dark' ? logos.black : logos.main}
          alt=""
          className="h-9 w-auto object-contain sm:h-10"
        />
      </div>
    )

  return (
    <Link to={to} aria-label="PASION MOTORS — Inicio" className="shrink-0">
      {content}
    </Link>
  )
}

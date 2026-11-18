import { cn } from '@/lib/utils'
import { useInView, usePrefersReducedMotion } from '@/lib/motion'
import { Img } from '@/components/Img'
import { Parallax } from '@/components/Parallax'

interface MaskImageProps {
  src?: string | null
  alt: string
  className?: string
  imgClassName?: string
  driveWidth?: number
  label?: string
  /** Línea secundaria del placeholder cuando no hay imagen. */
  note?: string
  /** Velocidad de parallax del contenido interno (0 = sin parallax). */
  parallax?: number
  eager?: boolean
}

/**
 * Imagen que se revela con una máscara (clip-path) al entrar en pantalla,
 * con parallax interno opcional. En móvil / reduced-motion se muestra estática.
 */
export function MaskImage({
  src,
  alt,
  className,
  imgClassName,
  driveWidth,
  label,
  note,
  parallax = 0.16,
  eager,
}: MaskImageProps) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>({ once: true, threshold: 0.15 })
  const show = inView || reduced

  return (
    <div ref={ref} className={cn('relative overflow-hidden bg-ink-900', className)}>
      <div
        className="absolute inset-0"
        style={{
          clipPath: show ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
          transition: reduced ? 'none' : 'clip-path 1.15s cubic-bezier(0.76, 0, 0.24, 1)',
          willChange: show ? 'auto' : 'clip-path',
        }}
      >
        {parallax > 0 ? (
          <Parallax speed={parallax} className="absolute -top-[15%] h-[130%] w-full">
            <Img
              src={src}
              alt={alt}
              driveWidth={driveWidth}
              className="h-full w-full"
              imgClassName={cn('h-full w-full object-cover', imgClassName)}
              label={label}
              note={note}
              eager={eager}
            />
          </Parallax>
        ) : (
          <Img
            src={src}
            alt={alt}
            driveWidth={driveWidth}
            className="h-full w-full"
            imgClassName={cn('h-full w-full object-cover', imgClassName)}
            label={label}
            note={note}
            eager={eager}
          />
        )}
      </div>
    </div>
  )
}

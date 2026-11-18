import type { ElementType } from 'react'
import { useInView, usePrefersReducedMotion } from '@/lib/motion'

interface KineticTextProps {
  text: string
  as?: ElementType
  className?: string
  /** Retardo inicial en segundos. */
  delay?: number
  /** Separación entre palabras en segundos. */
  stagger?: number
  /** Duración de cada palabra en segundos. */
  duration?: number
}

/**
 * Revela el texto palabra por palabra desde abajo, con máscara por línea.
 * Respeta prefers-reduced-motion (aparece estático).
 */
export function KineticText({
  text,
  as: Tag = 'span',
  className,
  delay = 0,
  stagger = 0.055,
  duration = 0.7,
}: KineticTextProps) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLElement>({ once: true, threshold: 0.25 })
  const words = text.split(' ')
  const show = inView || reduced

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            className={show ? 'inline-block' : 'inline-block will-change-transform'}
            style={{
              transform: show ? 'translateY(0)' : 'translateY(115%)',
              transition: reduced
                ? 'none'
                : `transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay + i * stagger}s`,
              marginRight: '0.24em',
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </Tag>
  )
}

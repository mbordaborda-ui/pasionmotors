import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useRichMotion, useScrollFrame } from '@/lib/motion'

interface ParallaxProps {
  children: ReactNode
  className?: string
  /** Magnitud del desplazamiento (px por unidad de progreso). */
  speed?: number
  /** Si se pasa, desactiva el efecto por debajo de este ancho (px). */
  minWidth?: number
}

/**
 * Desplaza su contenido según el scroll (parallax). En móvil o con
 * prefers-reduced-motion el contenido queda estático.
 */
export function Parallax({ children, className, speed = 0.14, minWidth = 768 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const rich = useRichMotion(minWidth)

  useScrollFrame(() => {
    const el = ref.current
    if (!el) return
    if (!rich || reduced) {
      el.style.transform = ''
      return
    }
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    const center = rect.top + rect.height / 2 - vh / 2
    el.style.transform = `translate3d(0, ${(-center * speed).toFixed(2)}px, 0)`
  })

  return (
    <div ref={ref} className={cn(rich && 'will-change-transform', className)}>
      {children}
    </div>
  )
}

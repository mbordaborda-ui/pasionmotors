import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

interface ShiftSectionProps {
  children: ReactNode
  className?: string
  id?: string
}

/**
 * Sección que interpola su color de fondo de negro a blanco (y el texto al
 * revés) conforme avanza el scroll. Respeta prefers-reduced-motion.
 */
export function ShiftSection({ children, className, id }: ShiftSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const reduced = usePrefersReducedMotion()

  useScrollFrame(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.style.backgroundColor = ''
      el.style.color = ''
      return
    }
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    const raw = (vh * 0.55 - rect.top) / rect.height
    const t = Math.min(1, Math.max(0, raw))
    const e = t * t * (3 - 2 * t)
    el.style.backgroundColor = `rgb(${lerp(11, 255, e)}, ${lerp(11, 255, e)}, ${lerp(13, 255, e)})`
    el.style.color = `rgb(${lerp(255, 11, e)}, ${lerp(255, 11, e)}, ${lerp(255, 13, e)})`
  })

  return (
    <section id={id} ref={ref} className={cn('shift-scope bg-ink', className)}>
      {children}
    </section>
  )
}

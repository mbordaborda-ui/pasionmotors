import { Children, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useRichMotion, useScrollFrame } from '@/lib/motion'

interface HorizontalShowcaseProps {
  children: ReactNode
  /** vh de scroll por elemento (controla la duración del recorrido). */
  perItem?: number
  className?: string
}

/**
 * Escena de scroll horizontal: el contenedor se "ancla" (sticky) mientras el
 * usuario baja y la pista se desplaza en X. En móvil o con reduced-motion cae
 * a un carrusel horizontal con scroll-snap.
 */
export function HorizontalShowcase({ children, perItem = 55, className }: HorizontalShowcaseProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const rich = useRichMotion(1024)
  const active = rich && !reduced
  const count = Children.count(children)

  // Todos los hooks deben ejecutarse siempre: `children` puede pasar de 0 a N
  // cuando el catálogo termina de cargar desde Supabase.
  useScrollFrame(() => {
    const outer = outerRef.current
    const track = trackRef.current
    if (!outer || !track) return
    if (!active) {
      track.style.transform = ''
      return
    }
    const rect = outer.getBoundingClientRect()
    const distance = Math.max(0, outer.offsetHeight - window.innerHeight)
    const p = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0
    const travel = Math.max(0, track.scrollWidth - window.innerWidth + 80)
    track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`
  })

  if (count === 0) return null

  const scrollPage = (direction: -1 | 1) => {
    const el = carouselRef.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.getBoundingClientRect().width + 20 : el.clientWidth * 0.8
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  if (!active) {
    return (
      <div className="relative">
        <div
          ref={carouselRef}
          className={cn(
            'hide-scrollbar pm-carousel flex cursor-grab gap-5 overflow-x-auto px-5 pb-6 active:cursor-grabbing sm:px-8',
            className,
          )}
        >
          {children}
        </div>
        {count > 1 && (
          <div className="mt-1 flex items-center justify-between gap-3 px-5 sm:px-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
              Desliza para ver más
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollPage(-1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-ink-900/80 text-white/70 backdrop-blur transition hover:border-brand hover:text-white active:scale-95"
                aria-label="Ver productos anteriores"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollPage(1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-ink-900/80 text-white/70 backdrop-blur transition hover:border-brand hover:text-white active:scale-95"
                aria-label="Ver más productos"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={outerRef} style={{ height: `${Math.max(1, count) * perItem + 100}vh` }}>
      <div className={cn('sticky top-0 flex h-screen items-center overflow-hidden', className)}>
        <div
          ref={trackRef}
          className="flex gap-8 pl-5 pr-24 will-change-transform sm:pl-8 lg:pl-12"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

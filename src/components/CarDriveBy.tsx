import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'

/** Estelas ambientales (siempre en movimiento, dan vida a la escena). */
const streaks = [
  { top: '20%', width: '38%', delay: '0s', tone: 'via-white/50' },
  { top: '34%', width: '52%', delay: '0.5s', tone: 'via-brand/70' },
  { top: '48%', width: '30%', delay: '1.1s', tone: 'via-white/35' },
  { top: '62%', width: '46%', delay: '0.2s', tone: 'via-brand/60' },
  { top: '76%', width: '58%', delay: '0.9s', tone: 'via-white/30' },
  { top: '88%', width: '34%', delay: '1.5s', tone: 'via-brand/50' },
]

/**
 * Destellos de velocidad: cada uno cruza la pantalla a una velocidad distinta
 * y su brillo/velocidad aumenta conforme se baja (scroll). Representan la
 * aceleración de la marca.
 */
const flashes = [
  { top: 6, w: 26, h: 2, speed: 1.5, phase: 0.05, strength: 0.9, tone: 'white' },
  { top: 13, w: 40, h: 1, speed: 1.2, phase: 0.6, strength: 0.7, tone: 'brand' },
  { top: 20, w: 18, h: 3, speed: 1.85, phase: 0.3, strength: 0.85, tone: 'white' },
  { top: 28, w: 52, h: 1, speed: 1.0, phase: 0.15, strength: 0.55, tone: 'brand' },
  { top: 36, w: 22, h: 2, speed: 1.6, phase: 0.82, strength: 0.9, tone: 'white' },
  { top: 44, w: 34, h: 2, speed: 1.35, phase: 0.45, strength: 0.75, tone: 'brand' },
  { top: 52, w: 14, h: 3, speed: 2.0, phase: 0.1, strength: 0.85, tone: 'white' },
  { top: 60, w: 46, h: 1, speed: 1.1, phase: 0.72, strength: 0.55, tone: 'brand' },
  { top: 68, w: 28, h: 2, speed: 1.5, phase: 0.35, strength: 0.8, tone: 'white' },
  { top: 76, w: 20, h: 2, speed: 1.7, phase: 0.9, strength: 0.85, tone: 'brand' },
  { top: 84, w: 38, h: 1, speed: 1.25, phase: 0.25, strength: 0.6, tone: 'white' },
  { top: 91, w: 24, h: 2, speed: 1.55, phase: 0.55, strength: 0.8, tone: 'brand' },
]

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function CarDriveBy({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const flashRefs = useRef<Array<HTMLSpanElement | null>>([])
  const reduced = usePrefersReducedMotion()
  const active = !reduced

  useScrollFrame(() => {
    const section = sectionRef.current
    if (!section) return
    const vh = window.innerHeight
    const rect = section.getBoundingClientRect()
    const p = clamp01((vh - rect.top) / (vh + rect.height))

    if (!active) {
      flashRefs.current.forEach((el, i) => {
        if (!el) return
        const f = flashes[i]
        el.style.transform = `translate3d(${(-45 + f.phase * 190).toFixed(1)}vw, 0, 0)`
        el.style.opacity = '0.5'
      })
      if (glowRef.current) glowRef.current.style.opacity = '0.4'
      return
    }

    const boost = 0.7 + 1.15 * p

    flashRefs.current.forEach((el, i) => {
      if (!el) return
      const f = flashes[i]
      const t = ((p * f.speed * boost + f.phase) % 1 + 1) % 1
      const x = -45 + t * 190
      const fade = clamp01(Math.min(t, 1 - t) * 5)
      const intensity = 0.28 + 0.72 * p
      el.style.transform = `translate3d(${x.toFixed(1)}vw, 0, 0)`
      el.style.opacity = (fade * intensity * f.strength).toFixed(3)
    })

    if (glowRef.current) {
      glowRef.current.style.opacity = (0.22 + 0.6 * p).toFixed(3)
    }
  })

  return (
    <section
      ref={sectionRef}
      className={cn('relative overflow-hidden border-y border-white/10 bg-ink-950', className)}
    >
      {/* Palabra de fondo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="display whitespace-nowrap text-[22vw] leading-none text-white/[0.04]">
          Drive the passion
        </span>
      </div>

      {/* Resplandor central */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[130px] transition-opacity duration-500"
      />

      {/* Estelas ambientales */}
      <div className="pointer-events-none absolute inset-0">
        {streaks.map((s, i) => (
          <span
            key={i}
            className={cn(
              'speed-streak absolute left-0 h-px rounded-full bg-gradient-to-r from-transparent to-transparent',
              s.tone,
            )}
            style={{ top: s.top, width: s.width, animationDelay: s.delay }}
          />
        ))}
      </div>

      {/* Destellos reactivos al scroll */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {flashes.map((f, i) => (
          <span
            key={i}
            ref={(el) => {
              flashRefs.current[i] = el
            }}
            className={cn(
              'absolute left-0 rounded-full',
              f.tone === 'brand'
                ? 'bg-gradient-to-r from-transparent via-brand to-transparent'
                : 'bg-gradient-to-r from-transparent via-white to-transparent',
            )}
            style={{
              top: `${f.top}%`,
              width: `${f.w}vw`,
              height: `${f.h}px`,
              opacity: 0,
              boxShadow:
                f.tone === 'brand'
                  ? '0 0 14px rgba(255,30,45,0.75)'
                  : '0 0 12px rgba(255,255,255,0.6)',
            }}
          />
        ))}
      </div>

      <div className="container-pm relative py-24 lg:py-32">
        <div className="mb-14 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="display max-w-xl text-3xl sm:text-4xl lg:text-5xl">
            Siente la <span className="text-brand">velocidad</span>
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/55">
            Desplázate y mira cómo la marca acelera. Pasión, velocidad y cultura automotriz en una sola
            experiencia.
          </p>
        </div>

        {/* Escenario */}
        <div className="relative h-[160px] sm:h-[200px] lg:h-[260px]">
          {/* Carretera */}
          <div className="absolute inset-x-0 bottom-0">
            <div className="road-line h-1.5 w-full opacity-60" />
            <div className="hairline mt-1" />
          </div>
        </div>
      </div>
    </section>
  )
}

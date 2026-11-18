import { useRef, useState } from 'react'
import { Gauge, MousePointer2, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'
import { playEngineStart } from '@/lib/engine'
import { Tachometer } from '@/components/Tachometer'
import { Reveal } from '@/components/Reveal'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Sección «Pisa el acelerador»: el scroll funciona como acelerador y el
 * tacómetro sube de marcha en marcha. En móvil se mantiene estático para no
 * competir con el scroll táctil.
 */
export function SpeedSection({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  const reduced = usePrefersReducedMotion()

  useScrollFrame(() => {
    const el = sectionRef.current
    if (!el) return
    if (reduced) {
      setProgress(0.18)
      return
    }
    const vh = window.innerHeight || 1
    const rect = el.getBoundingClientRect()
    const p = clamp01((vh - rect.top) / (vh + rect.height))
    setProgress(p)
  })

  const rpm = reduced ? 1100 : Math.round(900 + progress * 6800)
  const gear = reduced ? 1 : Math.min(6, Math.max(1, Math.floor(progress * 6) + 1))
  const speed = reduced ? 0 : Math.round(progress * 265)
  const redline = rpm >= 7000
  const shiftLights = [0, 1, 2, 3, 4, 5].map((i) => progress > (i + 1) / 7)

  return (
    <section
      ref={sectionRef}
      className={cn(
        'relative isolate overflow-hidden border-y border-white/10 bg-ink-950',
        className,
      )}
    >
      <img
        src="/images/misc/dashboard.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/55" />
      <div className="absolute inset-0 bg-grid-lines [background-size:52px_52px] opacity-30" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[130px] transition-opacity duration-500"
        style={{ opacity: 0.25 + progress * 0.6 }}
      />
      <div className="speed-lines pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />

      <div className="container-pm relative grid gap-14 py-20 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20 lg:py-28">
        <div className="max-w-xl">
          <Reveal>
            <span className="eyebrow">
              <Gauge className="h-3.5 w-3.5" /> Pisa el acelerador
            </span>
            <h2 className="display mt-6 text-4xl leading-[0.92] sm:text-5xl lg:text-6xl">
              Desliza y <span className="text-brand">revoluciona</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-white/60 sm:text-base">
              Cada scroll es una marcha más. Siente cómo sube el tacómetro mientras recorres la
              colección: ropa, accesorios y réplicas que se manejan con la misma pasión que un motor.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Velocidad</p>
                <p className="mt-1 font-display text-3xl tabular-nums text-white">
                  {speed}
                  <span className="ml-1 text-xs text-white/40">km/h</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Marcha</p>
                <p className="mt-1 font-display text-3xl tabular-nums text-brand">{gear}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">RPM</p>
                <p className="mt-1 font-display text-3xl tabular-nums text-white">{rpm}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {shiftLights.map((on, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2.5 w-5 rounded-full border transition-colors duration-150',
                      on
                        ? i >= 4
                          ? 'border-brand bg-brand shadow-[0_0_12px_rgba(255,30,45,0.8)]'
                          : 'border-amber-300/70 bg-amber-300'
                        : 'border-white/15 bg-white/5',
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                Shift light
              </span>
              <button
                type="button"
                onClick={() => playEngineStart()}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
              >
                <Volume2 className="h-3.5 w-3.5" /> Escuchar motor
              </button>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-[11px] text-white/35">
              <MousePointer2 className="h-3.5 w-3.5" /> Desliza para subir de marcha
            </p>
          </Reveal>
        </div>

        <Reveal delay={160} className="relative flex justify-center">
          <div
            className={cn(
              'absolute inset-0 m-auto h-[80%] w-[80%] rounded-full blur-[90px] transition-colors duration-300',
              redline ? 'bg-brand/40' : 'bg-white/10',
            )}
          />
          <div className="relative">
            <Tachometer rpm={rpm} size={340} className="hidden sm:block" />
            <Tachometer rpm={rpm} size={250} className="sm:hidden" />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] backdrop-blur transition-colors',
                  redline
                    ? 'border-brand/60 bg-brand/20 text-brand-200'
                    : 'border-white/10 bg-ink-950/60 text-white/45',
                )}
              >
                {redline ? 'Redline' : 'Ralentí'}
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

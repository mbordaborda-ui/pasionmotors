import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Power, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/motion'
import { getSoundEnabled, playEngineStart, setSoundEnabled } from '@/lib/engine'
import { Tachometer } from '@/components/Tachometer'

interface IgnitionScreenProps {
  onDone: () => void
}

/** Puntos aproximados de las luces del Mustang en la fotografía. */
const HEADLIGHTS = [
  { x: 20.5, y: 47 },
  { x: 79.5, y: 47 },
]

function HeadlightMasks() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {HEADLIGHTS.map((light, i) => (
        <span key={`mask-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${light.x}%`,
            top: '49.5%',
            width: '19%',
            height: '17%',
            background:
              'radial-gradient(closest-side, rgba(2,3,6,0.99), rgba(2,3,6,0.9) 62%, transparent 88%)',
            filter: 'blur(5px)',
          }}
        />
      ))}
      {HEADLIGHTS.map((light, i) => (
        <span key={`lower-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${light.x}%`,
            top: '60.5%',
            width: '13%',
            height: '3%',
            background:
              'radial-gradient(closest-side, rgba(2,3,6,0.98), rgba(2,3,6,0.8) 60%, transparent 90%)',
            filter: 'blur(4px)',
          }}
        />
      ))}
    </div>
  )
}

function LightsOn() {
  return (
    <div className="pointer-events-none absolute inset-0 animate-lights-on" aria-hidden="true">
      {HEADLIGHTS.map((light, i) => (
        <span key={`light-${i}`}>
          <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${light.x}%`,
              top: `${light.y}%`,
              width: '15%',
              height: '12%',
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.98), rgba(228,240,255,0.8) 28%, rgba(168,205,255,0.4) 58%, transparent 80%)',
              filter: 'blur(4px)',
            }}
          />
          <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${light.x}%`,
              top: `${light.y}%`,
              width: '5.7%',
              height: '5.5%',
              background:
                'radial-gradient(closest-side, #ffffff, rgba(255,255,255,0.65) 55%, transparent 82%)',
              filter: 'blur(1px)',
            }}
          />
          <span
            className="absolute origin-top"
            style={{
              left: `${light.x}%`,
              top: `${light.y}%`,
              width: '30%',
              height: '30%',
              transform: `translateX(-50%) rotate(${i === 0 ? -14 : 14}deg)`,
              background:
                'linear-gradient(180deg, rgba(235,244,255,0.4), rgba(200,222,255,0.12) 45%, transparent 80%)',
              clipPath: 'polygon(43% 0%, 57% 0%, 100% 100%, 0% 100%)',
              filter: 'blur(8px)',
            }}
          />
        </span>
      ))}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          top: '56%',
          width: '110%',
          height: '62%',
          background:
            'radial-gradient(closest-side, rgba(232,242,255,0.3), rgba(170,205,255,0.09) 45%, transparent 74%)',
          filter: 'blur(12px)',
        }}
      />
    </div>
  )
}

/**
 * Pantalla de encendido: el Mustang GT del garage se enciende antes de entrar
 * a la tienda. Se muestra una vez por sesión y puede saltarse.
 */
export function IgnitionScreen({ onDone }: IgnitionScreenProps) {
  const reduced = usePrefersReducedMotion()
  const [starting, setStarting] = useState(false)
  const [sound, setSound] = useState(() => getSoundEnabled())
  const timers = useRef<number[]>([])
  const finished = useRef(false)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    onDone()
  }

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
      timers.current.forEach((timer) => window.clearTimeout(timer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = () => {
    if (starting) return
    setStarting(true)
    if (sound) playEngineStart()
    const delay = reduced ? 900 : 2500
    timers.current.push(window.setTimeout(finish, delay))
  }

  const toggleSound = () => {
    setSound((current) => {
      const next = !current
      setSoundEnabled(next)
      return next
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] overflow-hidden bg-ink-950"
      role="dialog"
      aria-modal="true"
      aria-label="Encendido del motor"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative aspect-video"
          style={{
            width: 'min(100%, calc(100svh * 16 / 9))',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 15%, #000 84%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, #000 15%, #000 84%, transparent 100%)',
          }}
        >
          <img
            src="/images/hero/mustang-front.jpg"
            alt="Ford Mustang GT del garage PASION MOTORS"
            loading="eager"
            decoding="async"
            {...({ fetchpriority: 'high' } as Record<string, string>)}
            className={cn(
              'h-full w-full object-cover transition-[filter,transform] duration-[1700ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              starting
                ? 'scale-[1.02] brightness-[0.78] contrast-[1.05] saturate-[1.05]'
                : 'scale-100 brightness-[0.38] contrast-[1.12] saturate-[0.7]',
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-ink-950/55" />
          <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0,rgba(255,255,255,0.035),transparent_55%)]" />
          {!starting && <HeadlightMasks />}
          {starting && <LightsOn />}
        </div>
      </div>

      {starting && (
        <div className="pointer-events-none absolute inset-0 animate-lights-on bg-[radial-gradient(ellipse_at_50%_52%,rgba(225,6,0,0.3),transparent_62%)]" />
      )}

      <div
        className={cn(
          'relative flex h-full flex-col items-center justify-between px-6 py-14 text-center sm:py-20',
          starting && 'animate-engine-shake',
        )}
      >
        <div className="pt-2">
          <p className="font-display text-[11px] uppercase tracking-[0.5em] text-brand">Pasion Motors</p>
          <h1 className="mt-3 font-display text-4xl font-semibold uppercase leading-none tracking-tight text-white sm:text-6xl">
            The Garage
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            {starting ? 'Encendiendo…' : 'Bienvenido al garage. Aquí vive tu cultura motor.'}
          </p>
        </div>

        {!starting ? (
          <div className="flex flex-col items-center gap-4 pb-2">
            <button
              type="button"
              onClick={start}
              className="group inline-flex h-16 items-center gap-3 rounded-full bg-brand px-9 text-base font-semibold uppercase tracking-[0.14em] text-white shadow-red transition hover:-translate-y-0.5 hover:bg-brand-400 active:translate-y-0"
            >
              <Power className="h-5 w-5 transition-transform group-hover:rotate-12" />
              Start Engine
            </button>

            <button
              type="button"
              onClick={toggleSound}
              className="flex items-center gap-2 text-xs text-white/45 transition hover:text-white/80"
              aria-pressed={sound}
            >
              {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              Sonido {sound ? 'activado' : 'desactivado'}
            </button>

            <button
              type="button"
              onClick={finish}
              className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45 underline-offset-4 transition hover:text-white hover:underline"
            >
              Entrar sin encender
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 pb-4">
            <div className="flex items-end gap-2">
              <span className="h-10 w-1.5 animate-pulse rounded-full bg-brand" />
              <span className="h-16 w-1.5 animate-pulse rounded-full bg-brand-300 [animation-delay:120ms]" />
              <span className="h-24 w-1.5 animate-pulse rounded-full bg-white [animation-delay:240ms]" />
              <span className="h-16 w-1.5 animate-pulse rounded-full bg-brand-300 [animation-delay:360ms]" />
              <span className="h-10 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:480ms]" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/45">Motor encendido</p>
          </div>
        )}
      </div>

      {/* Tacómetro de la escena: sube al arrancar y cae a ralentí. */}
      <div className="pointer-events-none absolute bottom-8 right-8 hidden lg:block">
        <Tachometer rpm={starting ? 5600 : 900} size={140} className="drop-shadow-[0_22px_50px_rgba(0,0,0,0.75)]" />
      </div>

      <button
        type="button"
        onClick={finish}
        className="absolute right-5 top-5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50 backdrop-blur transition hover:border-white/35 hover:text-white"
      >
        Saltar
      </button>
    </div>,
    document.body,
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMediaQuery, usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'
import { Tachometer } from '@/components/Tachometer'
import { cn } from '@/lib/utils'

const IDLE_RPM = 900
const HIDE_AFTER = 1500

/**
 * HUD de conducción: un tacómetro fijo que reacciona a la velocidad del scroll.
 * Solo se enciende mientras hay movimiento y se apaga al detenerse, para no
 * tapar contenido ni competir con el botón de volver arriba.
 */
export function TachometerHud() {
  const [rpm, setRpm] = useState(IDLE_RPM)
  const [active, setActive] = useState(false)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const settle = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const reduced = usePrefersReducedMotion()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const location = useLocation()
  const onProduct = location.pathname.startsWith('/producto/')
  const onHome = location.pathname === '/'

  const wake = () => {
    setActive(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setActive(false), HIDE_AFTER)
  }

  useScrollFrame(() => {
    const now = performance.now()
    const y = window.scrollY
    if (!lastT.current) {
      lastY.current = y
      lastT.current = now
      return
    }
    const dy = Math.abs(y - lastY.current)
    lastY.current = y
    lastT.current = now

    if (dy > 2) wake()

    if (reduced) {
      setRpm(IDLE_RPM)
      return
    }
    const dt = Math.max(16, now - lastT.current + 16)
    const next = Math.min(7800, Math.round(IDLE_RPM + (dy / dt) * 7200))
    if (next > IDLE_RPM + 60) {
      setRpm(next)
      if (settle.current) window.clearTimeout(settle.current)
      settle.current = window.setTimeout(() => setRpm(IDLE_RPM), 220)
    }
  })

  useEffect(() => {
    lastY.current = window.scrollY
    lastT.current = performance.now()
    return () => {
      if (settle.current) window.clearTimeout(settle.current)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [])

  // Al cambiar de ruta el HUD vuelve a dormirse.
  useEffect(() => {
    setActive(false)
    setRpm(IDLE_RPM)
  }, [location.pathname])

  if (onProduct) return null

  const gear = Math.min(6, Math.max(1, Math.floor(rpm / 1400) + 1))

  return (
    <>
      {desktop ? (
        <div
          aria-hidden="true"
          className={cn(
            // En escritorio vive en la esquina inferior derecha, por encima del
            // botón «volver arriba» para que ninguno tape al otro.
            'pointer-events-none fixed bottom-20 right-6 z-40 hidden transition-all duration-500 ease-out lg:block',
            active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <Tachometer rpm={rpm} size={120} className="drop-shadow-[0_22px_50px_rgba(0,0,0,0.75)]" />
        </div>
      ) : (
        onHome && (
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 z-30 flex items-center gap-2 transition-all duration-500 ease-out lg:hidden',
              active ? 'translate-y-0 opacity-95' : 'translate-y-2 opacity-0',
            )}
          >
            <Tachometer
              rpm={rpm}
              size={76}
              showDigital={false}
              className="drop-shadow-[0_16px_34px_rgba(0,0,0,0.85)]"
            />
            <div className="rounded-full border border-white/10 bg-ink-950/85 px-3 py-1.5 backdrop-blur">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Marcha
              </p>
              <p className="font-display text-sm leading-none text-white">
                <span className="text-brand">{gear}</span>
                <span className="mx-1 text-white/25">·</span>
                <span className="tabular-nums">{rpm}</span>
                <span className="ml-1 text-[9px] text-white/40">RPM</span>
              </p>
            </div>
          </div>
        )
      )}
    </>
  )
}

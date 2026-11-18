import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ *
 * Preferencias del usuario / dispositivo
 * ------------------------------------------------------------------ */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [query])
  return matches
}

/** Animaciones ricas habilitadas: pantalla amplia + sin preferencia de movimiento reducido. */
export function useRichMotion(minWidth = 768): boolean {
  const reduced = usePrefersReducedMotion()
  const wide = useMediaQuery(`(min-width: ${minWidth}px)`)
  return wide && !reduced
}

/* ------------------------------------------------------------------ *
 * Motor de scroll compartido (una sola suscripción, con rAF)
 * ------------------------------------------------------------------ */

const subscribers = new Set<() => void>()
let ticking = false

function flush() {
  ticking = false
  subscribers.forEach((cb) => cb())
}

function requestFlush() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(flush)
}

function ensureListeners() {
  if (typeof window === 'undefined') return
  if (subscribers.size === 1) {
    window.addEventListener('scroll', requestFlush, { passive: true })
    window.addEventListener('resize', requestFlush)
  }
}

function removeListeners() {
  if (typeof window === 'undefined') return
  if (subscribers.size === 0) {
    window.removeEventListener('scroll', requestFlush)
    window.removeEventListener('resize', requestFlush)
  }
}

/**
 * Ejecuta `callback` en cada frame de scroll/resize (throttled por rAF).
 * El callback se guarda en un ref para no re-suscribir en cada render.
 */
export function useScrollFrame(callback: () => void) {
  const cb = useRef(callback)
  cb.current = callback
  useEffect(() => {
    const run = () => cb.current()
    subscribers.add(run)
    ensureListeners()
    run()
    return () => {
      subscribers.delete(run)
      removeListeners()
    }
  }, [])
}

/* ------------------------------------------------------------------ *
 * Utilidades de medición
 * ------------------------------------------------------------------ */

/** Progreso de un elemento a través del viewport: 0 (entra por abajo) → 1 (sale por arriba). */
export function elementProgress(rect: DOMRect, viewportH: number): number {
  const total = rect.height + viewportH
  const passed = viewportH - rect.top
  return Math.min(1, Math.max(0, passed / total))
}

/* ------------------------------------------------------------------ *
 * In-view (una sola vez o continuo)
 * ------------------------------------------------------------------ */

interface InViewOptions {
  once?: boolean
  threshold?: number
  rootMargin?: string
}

export function useInView<T extends HTMLElement>(options: InViewOptions = {}) {
  const { once = true, threshold = 0.18, rootMargin = '0px 0px -8% 0px' } = options
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setInView(false)
          }
        })
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return { ref, inView } as const
}

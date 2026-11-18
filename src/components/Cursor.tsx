import { useEffect, useRef } from 'react'
import { useMediaQuery, usePrefersReducedMotion } from '@/lib/motion'

/**
 * Puntero personalizado (punto + anillo con retardo) que se agranda sobre
 * elementos interactivos. Solo se activa en dispositivos con puntero fino y
 * sin preferencia de movimiento reducido. No oculta el cursor nativo.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = usePrefersReducedMotion()
  const enabled = fine && !reduced

  useEffect(() => {
    if (!enabled) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let raf = 0

    const loop = () => {
      rx += (mx - rx) * 0.18
      ry += (my - ry) * 0.18
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`
      if (Math.abs(mx - rx) > 0.08 || Math.abs(my - ry) > 0.08) {
        raf = requestAnimationFrame(loop)
      } else {
        rx = mx
        ry = my
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`
        raf = 0
      }
    }

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }

    const onMove = (e: PointerEvent) => {
      mx = e.clientX
      my = e.clientY
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`
      const target = e.target as HTMLElement | null
      const interactive = !!target?.closest(
        'a, button, input, select, textarea, [role="button"], [data-cursor]',
      )
      ring.dataset.active = interactive ? 'true' : 'false'
      wake()
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] hidden md:block">
      <div ref={dotRef} className="pm-cursor-dot" />
      <div ref={ringRef} className="pm-cursor-ring" data-active="false" />
    </div>
  )
}

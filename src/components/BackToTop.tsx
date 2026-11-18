import { useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion, useScrollFrame } from '@/lib/motion'

export function BackToTop() {
  const [show, setShow] = useState(false)
  const visibleRef = useRef(false)
  const lastY = useRef(0)
  const reduced = usePrefersReducedMotion()

  useScrollFrame(() => {
    const y = window.scrollY
    const delta = y - lastY.current
    lastY.current = y

    // Aparece al subir y se esconde al bajar: así no tapa los botones de
    // compra rápida de las tarjetas mientras el usuario explora.
    let next = visibleRef.current
    if (y < 700) next = false
    else if (delta < -4) next = true
    else if (delta > 4) next = false

    if (next === visibleRef.current) return
    visibleRef.current = next
    setShow(next)
  })

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
      className={cn(
        'fixed bottom-20 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-ink-950/85 text-white shadow-2xl backdrop-blur transition-all duration-300 hover:border-brand hover:text-brand lg:bottom-6 lg:right-6',
        show ? 'visible translate-y-0 opacity-100' : 'invisible pointer-events-none translate-y-3 opacity-0',
      )}
      aria-label="Volver arriba"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}

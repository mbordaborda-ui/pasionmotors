import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react'

/**
 * Aviso global de conexión. Muestra un banner mientras no hay red y confirma
 * brevemente cuando vuelve, sin bloquear la navegación.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [restored, setRestored] = useState(false)
  const wasOffline = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    wasOffline.current = !navigator.onLine

    const onOnline = () => {
      setOnline(true)
      if (!wasOffline.current) return
      wasOffline.current = false
      setRestored(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setRestored(false), 3500)
    }

    const onOffline = () => {
      wasOffline.current = true
      setRestored(false)
      setOnline(false)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  if (online && !restored) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,460px)] -translate-x-1/2 lg:bottom-6"
    >
      <div
        className={
          online
            ? 'flex items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/12 px-4 py-3 text-xs text-emerald-100 shadow-2xl backdrop-blur-xl'
            : 'flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/35 bg-ink-950/95 px-4 py-3 text-xs text-amber-100 shadow-2xl backdrop-blur-xl'
        }
      >
        {online ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 leading-relaxed">
          {online
            ? 'Conexión restablecida. Todo listo para seguir.'
            : 'Sin conexión. Puedes seguir navegando, pero algunas acciones necesitan internet.'}
        </span>
        {!online && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/35 px-3 py-1.5 font-semibold uppercase tracking-wider text-white transition hover:border-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

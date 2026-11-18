import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Item {
  id: number
  text: string
}

/**
 * Aviso global de guardado fallido. Escucha `pm:save-error` y muestra el motivo
 * real devuelto por Supabase, para que nunca se dé por guardado algo que no lo está.
 */
export function SaveErrorToast() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev.slice(-2), { id, text: detail || 'No se pudo guardar.' }])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }, 9000)
    }

    window.addEventListener('pm:save-error', onError)
    return () => window.removeEventListener('pm:save-error', onError)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-[90] w-[min(92vw,440px)] -translate-x-1/2 space-y-2 lg:bottom-8">
      {items.map((item) => (
        <div
          key={item.id}
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-2xl border border-brand/50 bg-ink-950/95 p-4 text-xs shadow-2xl backdrop-blur"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div className="min-w-0 flex-1 leading-relaxed">
            <p className="font-semibold text-brand-300">No se pudo guardar</p>
            <p className="mt-0.5 text-white/70">{item.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}
            className="shrink-0 text-white/40 transition hover:text-white"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

import { cn } from '@/lib/utils'
import { logos } from '@/config'

interface PlaceholderProps {
  /** Texto principal bajo el logo. */
  label?: string
  /** Línea secundaria opcional (por ejemplo, el estado de la foto). */
  note?: string
  className?: string
}

/**
 * Imagen de reemplazo de la marca para productos sin fotografía.
 * Deliberadamente NO usa fotos genéricas para no confundir al comprador.
 */
export function ProductPlaceholder({
  label = 'Fotografía pendiente',
  note,
  className,
}: PlaceholderProps) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-ink-900',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-grid-lines [background-size:38px_38px] opacity-60" />
      <div className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-b from-brand/25 via-brand/5 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute right-[-10%] top-1/2 h-[140%] w-24 -translate-y-1/2 -skew-x-12 bg-gradient-to-b from-white/10 to-transparent" />
      <img
        src={logos.badge}
        alt=""
        className="relative z-10 mb-3 w-16 opacity-45 grayscale sm:w-20"
        loading="lazy"
      />
      <p className="relative z-10 max-w-[85%] px-2 text-center text-[10px] font-semibold uppercase leading-relaxed tracking-[0.24em] text-white/55">
        {label}
      </p>
      <p className="relative z-10 mt-1 text-[9px] uppercase tracking-[0.35em] text-brand/70">
        {note ?? 'PASION MOTORS'}
      </p>
    </div>
  )
}

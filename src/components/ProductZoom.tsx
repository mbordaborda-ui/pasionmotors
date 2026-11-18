import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { useMediaQuery, usePrefersReducedMotion } from '@/lib/motion'
import { Img } from '@/components/Img'

interface ProductZoomProps {
  src?: string | null
  alt: string
  driveWidth?: number
  sizes?: string
  label?: string
  eager?: boolean
}

/** Zoom con el punto del cursor como origen. Solo se activa con mouse preciso. */
export function ProductZoom({ src, alt, driveWidth, sizes, label, eager }: ProductZoomProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = usePrefersReducedMotion()
  const enabled = finePointer && !reduced

  const setZoom = (active: boolean) => {
    const surface = surfaceRef.current
    if (!surface) return
    surface.style.transform = active ? 'scale(1.8)' : 'scale(1)'
    if (!active) surface.style.transformOrigin = '50% 50%'
  }

  return (
    <div
      className={cn('group relative aspect-square w-full overflow-hidden', enabled && 'cursor-zoom-in')}
      onPointerEnter={() => enabled && setZoom(true)}
      onPointerMove={(e) => {
        if (!enabled) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
        const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
        if (surfaceRef.current) {
          surfaceRef.current.style.transformOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`
          surfaceRef.current.style.transform = 'scale(1.8)'
        }
      }}
      onPointerLeave={() => setZoom(false)}
    >
      <div
        ref={surfaceRef}
        className="absolute inset-0 transition-transform duration-200 ease-out will-change-transform"
      >
        <Img
          src={src}
          alt={alt}
          driveWidth={driveWidth}
          sizes={sizes}
          className="h-full w-full"
          label={label}
          eager={eager}
        />
      </div>
      {enabled && (
        <span className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/15 bg-ink-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65 opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
          Zoom
        </span>
      )}
    </div>
  )
}

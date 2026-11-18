import { useState } from 'react'
import { cn } from '@/lib/utils'
import { isGoogleDriveUrl, resolveImageUrl, toDriveImageUrl } from '@/lib/images'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'

interface ImgProps {
  src?: string | null
  alt: string
  className?: string
  imgClassName?: string
  /** Ancho solicitado a Google Drive (px). */
  driveWidth?: number
  /** Ancho real en pantalla; activa versiones responsive para fotos de Drive. */
  sizes?: string
  label?: string
  /** Línea secundaria del placeholder cuando no hay imagen. */
  note?: string
  eager?: boolean
  onLoad?: () => void
}

/**
 * <img> con conversión automática de enlaces de Google Drive y
 * fallback a la imagen de reemplazo de la marca si la URL falla o está vacía.
 */
const POSITION_CLASS = /(?:^|\s)(?:absolute|fixed|relative|sticky)(?:\s|$)/

export function Img({
  src,
  alt,
  className,
  imgClassName,
  driveWidth,
  sizes,
  label,
  note,
  eager,
  onLoad,
}: ImgProps) {
  const [failed, setFailed] = useState(false)
  const resolved = src ? resolveImageUrl(src, driveWidth) : ''
  const showPlaceholder = !resolved || failed
  // Solo pedimos variantes cuando la pantalla nos dice su ancho real; así no
  // descargamos fotos de 1200 px para una miniatura de 80 px.
  const srcSet =
    sizes && src && isGoogleDriveUrl(src)
      ? [320, 480, 640, 800, 1200]
          .map((w) => `${toDriveImageUrl(src, w)} ${w}w`)
          .join(', ')
      : undefined
  // Solo aplicamos `relative` si quien lo usa no definió ya su propio
  // posicionamiento (por ejemplo `absolute inset-0`). Sin esto, ambas clases
  // conviven y `relative` gana en la hoja de estilos, rompiendo la altura.
  const hasPosition = POSITION_CLASS.test(className ?? '')

  return (
    <div className={cn('overflow-hidden bg-ink-900', !hasPosition && 'relative', className)}>
      {showPlaceholder ? (
        <ProductPlaceholder label={label} note={note} className={imgClassName} />
      ) : (
        <img
          src={resolved}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={onLoad}
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      )}
    </div>
  )
}

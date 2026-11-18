import { useRef, useState } from 'react'
import { ImageIcon, Upload, X } from 'lucide-react'
import { describeImageError, optimizeImage } from '@/lib/image'
import { uploadImage } from '@/lib/storage'
import { Img } from '@/components/Img'

interface AdminImageFieldProps {
  label: string
  value?: string
  onChange: (value: string) => void
  hint?: string
  className?: string
  /** Carpeta dentro del bucket de imágenes (ej. `hero/`). */
  prefix?: string
  /**
   * Si Storage falla, guarda una versión base64 comprimida. Para fotos que
   * deben vivir solo en Storage (hero, galería) conviene desactivarlo.
   */
  allowInlineFallback?: boolean
  /** Límites de optimización antes de subir. */
  maxWidth?: number
  maxHeight?: number
  maxBytes?: number
}

export function AdminImageField({
  label,
  value,
  onChange,
  hint = 'Pega una URL, un enlace de Google Drive o sube una imagen.',
  className = 'aspect-[4/3] w-36',
  prefix = 'catalogo/',
  allowInlineFallback = true,
  maxWidth = 1800,
  maxHeight = 1800,
  maxBytes = 900 * 1024,
}: AdminImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isData = value?.startsWith('data:')

  const pick = async (file?: File) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const optimized = await optimizeImage(file, {
        maxWidth,
        maxHeight,
        maxBytes,
      })
      try {
        const url = await uploadImage('product-images', optimized.blob, prefix)
        onChange(url)
        return
      } catch (uploadError) {
        console.warn('[admin.image]', uploadError)
        if (!allowInlineFallback) {
          setError(
            'No se pudo subir la foto al almacenamiento. Revisa tu conexión e intenta de nuevo.',
          )
          return
        }
        setError(
          'No se pudo subir al almacenamiento. Se guardó una versión comprimida; revisa tu conexión.',
        )
      }
      // Si Storage no está disponible, guardamos una copia ligera para no
      // incrustar cientos de KB en cada carga del catálogo.
      const fallback = await optimizeImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        maxBytes: 220 * 1024,
      })
      onChange(fallback.dataUrl)
    } catch (err) {
      setError(describeImageError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {label && (
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
          {label}
        </label>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Img
          src={value}
          alt={label}
          className={`${className} shrink-0 rounded-xl border border-white/10`}
          label="Sin imagen"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {isData ? (
            <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/55">
              <ImageIcon className="h-4 w-4 shrink-0 text-brand" /> Imagen cargada desde el
              dispositivo
            </p>
          ) : (
            <input
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              className="field"
              placeholder="https://…"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-ghost !px-4 !py-2 !text-[11px] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? 'Procesando…' : 'Subir imagen'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="btn-ghost !px-4 !py-2 !text-[11px] !text-brand-300"
              >
                <X className="h-3.5 w-3.5" /> Quitar
              </button>
            )}
          </div>
          {hint && <p className="text-[11px] leading-relaxed text-white/35">{hint}</p>}
          {error && <p className="text-[11px] text-brand-300">{error}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

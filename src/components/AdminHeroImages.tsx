import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Shuffle,
  Trash2,
} from 'lucide-react'
import { AdminImageField } from '@/components/AdminImageField'
import {
  HERO_ROTATION_LABELS,
  MAX_HERO_IMAGES,
  heroImagesOf,
  heroRotationOf,
  pickHeroImage,
} from '@/lib/hero'
import type { HeroRotation, SiteConfig } from '@/types'

interface AdminHeroImagesProps {
  site: SiteConfig
  onChange: (patch: Partial<SiteConfig>) => void
}

/**
 * Editor de la portada: una sola foto o una lista que rota por día, semana
 * o al azar. Las fotos se suben al bucket público y en la base solo queda la URL.
 */
export function AdminHeroImages({ site, onChange }: AdminHeroImagesProps) {
  const rotation = heroRotationOf(site)
  const isRandom = rotation === 'random'
  const images = site.heroImages ?? []
  const valid = heroImagesOf(site)
  const today = isRandom ? undefined : pickHeroImage(site)
  const todayImageIndex = today ? images.findIndex((url) => url.trim() === today) : -1
  const todayOrdinal = today ? valid.indexOf(today) + 1 : 0

  const setRotation = (value: HeroRotation) => {
    if (value === 'off') {
      onChange({
        heroRotation: 'off',
        heroImage: site.heroImage?.trim() || valid[0] || '',
        heroImages: images,
      })
      return
    }

    onChange({
      heroRotation: value,
      heroImages: valid.length ? valid : site.heroImage?.trim() ? [site.heroImage.trim()] : [],
    })
  }

  const updateAt = (index: number, value: string) => {
    const next = [...images]
    next[index] = value
    onChange({ heroImages: next })
  }

  const add = () => {
    const next = images.filter((url) => url.trim()).slice(0, MAX_HERO_IMAGES - 1)
    next.push('')
    onChange({ heroImages: next })
  }

  const removeAt = (index: number) => {
    onChange({ heroImages: images.filter((_, i) => i !== index) })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ heroImages: next })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
            Fotos de la portada
          </label>
          <p className="text-[11px] leading-relaxed text-white/40">
            Sube las fotos que quieres que roten. Si eliges aleatoria, cada visita al inicio verá
            una distinta; si eliges diaria o semanal, cambiará a medianoche.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Frecuencia
          </span>
          <select
            value={rotation}
            onChange={(e) => setRotation(e.target.value as HeroRotation)}
            className="field max-w-xs"
          >
            {(Object.keys(HERO_ROTATION_LABELS) as HeroRotation[]).map((value) => (
              <option key={value} value={value}>
                {HERO_ROTATION_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rotation === 'off' ? (
        <div className="mt-5">
          <AdminImageField
            label="Imagen principal"
            value={site.heroImage}
            onChange={(heroImage) => onChange({ heroImage })}
            hint="Pega una URL, un enlace de Google Drive o sube una imagen. Déjala vacía para usar el fondo gráfico de la marca."
            className="aspect-video w-full sm:w-56"
            prefix="hero/"
            allowInlineFallback={false}
            maxWidth={1920}
            maxHeight={1920}
            maxBytes={560 * 1024}
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-[11px] leading-relaxed text-white/50">
            {isRandom ? (
              <Shuffle className="h-4 w-4 shrink-0 text-brand" />
            ) : (
              <CalendarClock className="h-4 w-4 shrink-0 text-brand" />
            )}
            {isRandom ? (
              valid.length > 1 ? (
                <span>
                  Se elegirá una <strong className="text-white">al azar</strong> entre {valid.length}{' '}
                  fotos cada vez que alguien entre al inicio.
                </span>
              ) : (
                <span>Agrega al menos 2 fotos para que la rotación se note.</span>
              )
            ) : valid.length > 1 ? (
              <span>
                Hoy se muestra la <strong className="text-white">foto {todayOrdinal}</strong> de{' '}
                {valid.length}. Cambia cada {rotation === 'daily' ? 'día' : 'semana'} a medianoche.
              </span>
            ) : (
              <span>Agrega al menos 2 fotos para que la rotación se note.</span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {images.map((url, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                    Foto {index + 1}
                    {!isRandom && valid[index] && index === todayImageIndex && (
                      <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] text-brand">
                        Hoy
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover foto ${index + 1} hacia arriba`}
                      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label={`Mover foto ${index + 1} hacia abajo`}
                      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45 transition hover:border-brand/50 hover:text-brand"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar foto
                    </button>
                  </div>
                </div>
                <AdminImageField
                  label=""
                  value={url}
                  onChange={(value) => updateAt(index, value)}
                  hint=""
                  className="aspect-video w-full sm:w-52"
                  prefix="hero/"
                  allowInlineFallback={false}
                  maxWidth={1920}
                  maxHeight={1920}
                  maxBytes={560 * 1024}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={add}
            disabled={valid.length >= MAX_HERO_IMAGES}
            className="btn-ghost mt-4 !py-2.5 !text-[11px] disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" /> Añadir foto ({valid.length}/{MAX_HERO_IMAGES})
          </button>
        </>
      )}
    </div>
  )
}

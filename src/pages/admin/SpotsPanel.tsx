import { useEffect } from 'react'
import { Camera, Heart, MapPin, MessageCircle, Trash2 } from 'lucide-react'
import { useGallery } from '@/store/gallery'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function SpotsPanel() {
  const { spots, removeSpot, clearSpots, ensureLoaded } = useGallery()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  const clearAll = () => {
    if (spots.length === 0) return
    if (window.confirm(`¿Eliminar las ${spots.length} fotos del Car Spotting? Esta acción no se puede deshacer.`)) {
      clearSpots()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-white/55">
          Fotos publicadas por la comunidad en el Car Spotting. Elimina aquí las que no correspondan
          al espíritu de la marca o no cumplan las normas.
        </p>
        <button
          type="button"
          onClick={clearAll}
          disabled={spots.length === 0}
          className="btn-ghost shrink-0 !px-5 !py-2.5 !text-[12px] disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" /> Borrar todas
        </button>
      </div>

      <p className="text-xs uppercase tracking-wider text-white/40">
        {spots.length} {spots.length === 1 ? 'foto publicada' : 'fotos publicadas'}
      </p>

      {spots.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
          Todavía no hay fotos en el Car Spotting.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {spots.map((spot) => (
            <div
              key={spot.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-800/50"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-900">
                <img
                  src={spot.image}
                  alt={spot.car || 'Car spotting'}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSpot(spot.id)}
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-ink-950/80 text-white/80 backdrop-blur transition hover:bg-brand hover:text-white"
                  aria-label="Eliminar foto"
                  title="Eliminar foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 p-4">
                <p className="flex items-center gap-2 font-display text-sm uppercase tracking-tight text-white">
                  <Camera className="h-4 w-4 text-brand" />
                  {spot.car || 'Sin modelo'}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
                  {spot.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-brand" /> {spot.location}
                    </span>
                  )}
                  {spot.author && <span>por {spot.author}</span>}
                </div>
                <p className="flex items-center gap-3 text-[11px] text-white/40">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3 text-brand" /> {spot.likeCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-sky-300" /> {spot.comments.length}
                  </span>
                </p>
                <p className="text-[11px] text-white/35">{formatDate(spot.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

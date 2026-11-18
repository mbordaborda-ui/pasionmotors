import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  MessageCircle,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { KineticText } from '@/components/KineticText'
import { MaskImage } from '@/components/MaskImage'
import { SpotCommentsDialog } from '@/components/SpotCommentsDialog'
import { useGallery, MAX_SPOTS } from '@/store/gallery'
import { useAuth } from '@/store/auth'
import { describeImageError, optimizeImage } from '@/lib/image'
import { resolveImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { Spot } from '@/types'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function Spots() {
  const { spots, addSpot, removeSpot, socialReady, toggleLike, ensureLoaded } = useGallery()
  const { user, isAdmin } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  const [preview, setPreview] = useState('')
  const [previewBytes, setPreviewBytes] = useState(0)
  const [url, setUrl] = useState('')
  const [car, setCar] = useState('')
  const [location, setLocation] = useState('')
  const [author, setAuthor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [done, setDone] = useState(false)
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null)

  const activeSpot = spots.find((spot) => spot.id === activeSpotId) ?? null

  const pickFile = async (file?: File) => {
    if (!file) return
    setError('')
    setActionError('')
    setBusy(true)
    try {
      // Redimensiona y comprime en el mismo teléfono: la subida pesa < 1 MB.
      const optimized = await optimizeImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        maxBytes: 900 * 1024,
      })
      setPreview(optimized.dataUrl)
      setPreviewBytes(optimized.bytes)
      setUrl('')
    } catch (err) {
      setError(describeImageError(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPreview('')
    setPreviewBytes(0)
    setUrl('')
    setCar('')
    setLocation('')
    setAuthor('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setActionError('')
    setDone(false)

    const image = preview || resolveImageUrl(url)
    if (!image) {
      setError('Sube una foto o pega el enlace de una imagen.')
      return
    }

    setBusy(true)
    const result = await addSpot({
      image,
      car: car.trim() || undefined,
      location: location.trim() || undefined,
      author: author.trim() || undefined,
    })
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'No pudimos publicar la foto. Inténtalo de nuevo.')
      return
    }

    reset()
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  const handleLike = async (spot: Spot) => {
    setActionError('')
    if (!user) {
      navigate('/login?next=/spotting')
      return
    }
    const result = await toggleLike(spot.id)
    if (!result.ok && result.error !== 'auth_required') {
      setActionError(result.error ?? 'No se pudo guardar tu «me gusta».')
    }
  }

  return (
    <div className="pt-[68px] lg:pt-20">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-[120px]" />
        <div className="container-pm relative py-14 lg:py-20">
          <Reveal>
            <span className="eyebrow">Comunidad · Car Spotting</span>
          </Reveal>
          <h1 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">
            <KineticText text="Los autos que" as="span" className="block" stagger={0.06} />
            <KineticText text="encontramos" as="span" className="block text-brand" delay={0.12} stagger={0.06} />
          </h1>
          <Reveal delay={180}>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Comparte el vehículo que viste por la calle, un clásico escondido o esa máquina que te
              robó la mirada. Publica tu foto y ayúdanos a mantener viva la cultura del motor.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-pm py-10 lg:py-14">
        {/* FORMULARIO */}
        <Reveal>
          <form
            onSubmit={submit}
            className="card-surface grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:p-8"
          >
            {/* Zona de carga */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                Foto del vehículo
              </label>
              <div
                className={cn(
                  'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-ink-800/60',
                )}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Vista previa" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPreview('')
                        setPreviewBytes(0)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink-950/80 text-white/80 backdrop-blur transition hover:text-brand"
                      aria-label="Quitar foto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {previewBytes > 0 && (
                      <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur">
                        {Math.max(1, Math.round(previewBytes / 1024))} KB · lista
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/50 transition hover:text-white"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white/5">
                      {busy ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <ImagePlus className="h-6 w-6" />
                      )}
                    </span>
                    <span className="text-sm font-semibold">
                      {busy ? 'Optimizando imagen…' : 'Toca para subir una foto'}
                    </span>
                    <span className="text-[11px] text-white/35">JPG, PNG, WebP o HEIC</span>
                    <span className="text-[10px] text-white/25">Se optimiza sola antes de subir</span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void pickFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/35">
                <span className="h-px flex-1 bg-white/10" /> o pega un enlace <span className="h-px flex-1 bg-white/10" />
              </div>
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (e.target.value) setPreview('')
                }}
                placeholder="https://… (enlace directo a la imagen)"
                className="field mt-3"
              />
            </div>

            {/* Datos */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                  Auto o modelo
                </label>
                <div className="relative">
                  <Camera className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={car}
                    onChange={(e) => setCar(e.target.value)}
                    placeholder="Ej: Nissan Skyline R34, Ford Raptor…"
                    className="field pl-11"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                    Lugar
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ciudad o sitio"
                      className="field pl-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                    Tu nombre
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Opcional"
                      className="field pl-11"
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-white/35">
                Al publicar, aceptas que tu foto sea visible para toda la comunidad. El equipo de
                PASION MOTORS puede revisarla o eliminarla si no cumple con las normas.
              </p>

              {error && (
                <p className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-xs text-brand-300">
                  {error}
                </p>
              )}
              {done && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-300">
                  ¡Foto publicada! Gracias por compartir tu spotting.
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary mt-auto w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Publicar foto
              </button>
              <p className="text-center text-[11px] uppercase tracking-wider text-white/30">
                {spots.length} / {MAX_SPOTS} fotos
              </p>
            </div>
          </form>
        </Reveal>

        {actionError && (
          <p className="mt-4 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-xs text-brand-300">
            {actionError}{' '}
            {!user && (
              <a href="/login?next=/spotting" className="font-semibold underline underline-offset-4">
                Iniciar sesión
              </a>
            )}
          </p>
        )}

        {!socialReady && (
          <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-xs text-amber-100/80">
            Los «me gusta» y comentarios se activan al ejecutar{' '}
            <span className="font-mono">supabase/spots-social.sql</span> en Supabase.
          </p>
        )}

        {/* GALERÍA */}
        <div className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="display text-2xl uppercase tracking-tight text-white sm:text-3xl">
              Galería de la comunidad
            </h2>
            {spots.length > 0 && (
              <span className="text-xs uppercase tracking-wider text-white/40">
                {spots.length} {spots.length === 1 ? 'foto' : 'fotos'}
              </span>
            )}
          </div>

          {spots.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-ink-800/40 py-20 text-center">
              <Camera className="h-8 w-8 text-white/30" />
              <p className="font-display text-xl uppercase tracking-tight text-white">
                Aún no hay fotos
              </p>
              <p className="max-w-sm text-sm text-white/55">
                Sé el primero en compartir el auto que viste. Sube tu mejor spotting arriba.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {spots.map((spot, i) => (
                <Reveal key={spot.id} delay={(i % 6) * 60}>
                  <article className="group relative overflow-hidden rounded-[1.6rem] border border-white/10">
                    <MaskImage
                      src={spot.image}
                      alt={spot.car || 'Car spotting'}
                      driveWidth={1200}
                      className="aspect-[4/3] w-full"
                      imgClassName="transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                      label={spot.car}
                      parallax={0.12}
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-t from-ink-950 via-ink-950/25 to-transparent" />

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => removeSpot(spot.id)}
                        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink-950/80 text-white/80 backdrop-blur transition hover:bg-brand hover:text-white"
                        aria-label="Eliminar foto"
                        title="Eliminar foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <div className="pointer-events-none absolute inset-x-5 bottom-5">
                      {spot.car && (
                        <h3 className="font-display text-xl uppercase leading-none text-white">
                          {spot.car}
                        </h3>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
                        {spot.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-brand" /> {spot.location}
                          </span>
                        )}
                        {spot.author && <span>por {spot.author}</span>}
                        <span className="text-white/35">{formatDate(spot.createdAt)}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleLike(spot)}
                          aria-pressed={spot.likedByMe}
                          aria-label={spot.likedByMe ? 'Quitar me gusta' : 'Me gusta'}
                          className={cn(
                            'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur transition',
                            spot.likedByMe
                              ? 'border-brand/50 bg-brand/20 text-brand-200'
                              : 'border-white/15 bg-ink-950/55 text-white/70 hover:border-brand/40 hover:text-white',
                          )}
                        >
                          <Heart className={cn('h-3.5 w-3.5', spot.likedByMe && 'fill-current')} />
                          {spot.likeCount}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSpotId(spot.id)}
                          aria-label="Ver comentarios"
                          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-ink-950/55 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:border-brand/40 hover:text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {spot.comments.length}
                        </button>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeSpot && (
        <SpotCommentsDialog spot={activeSpot} onClose={() => setActiveSpotId(null)} />
      )}
    </div>
  )
}

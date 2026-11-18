import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Camera, MapPin } from 'lucide-react'
import { MaskImage } from '@/components/MaskImage'
import { Reveal } from '@/components/Reveal'
import { SectionHeading } from '@/components/SectionHeading'
import { useGallery } from '@/store/gallery'
import { cn } from '@/lib/utils'

/** Vista previa en el inicio de las últimas fotos del Car Spotting. */
export function SpottingTeaser({ className }: { className?: string }) {
  const { spots, ensureLoaded } = useGallery()
  const latest = spots.slice(0, 6)

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  return (
    <section className={cn('bg-ink py-20 lg:py-28', className)}>
      <div className="container-pm">
        <SectionHeading
          eyebrow="Comunidad · Car Spotting"
          title={
            <>
              Autos que <span className="text-brand">vemos por la calle</span>
            </>
          }
          description="La comunidad captura los vehículos que encuentra. Comparte tu propia foto y haz parte de la galería."
          action={
            <div className="flex flex-wrap gap-3">
              <Link to="/spotting" className="btn-primary">
                <Camera className="h-4 w-4" /> Ver galería
              </Link>
              <Link to="/spotting" className="btn-ghost">
                Subir mi foto
              </Link>
            </div>
          }
        />

        {latest.length === 0 ? (
          <Reveal>
            <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-ink-800/40 py-16 text-center">
              <Camera className="h-8 w-8 text-white/30" />
              <p className="font-display text-xl uppercase tracking-tight text-white">
                Sé el primero en publicar
              </p>
              <p className="max-w-sm text-sm text-white/55">
                Aún no hay fotos de la comunidad. Sube tu mejor spotting y estrena la galería.
              </p>
              <Link to="/spotting" className="btn-primary mt-1">
                Subir una foto
              </Link>
            </div>
          </Reveal>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((spot, i) => (
              <Reveal key={spot.id} delay={(i % 3) * 80}>
                <Link
                  to="/spotting"
                  className="group relative block overflow-hidden rounded-[1.6rem] border border-white/10"
                >
                  <MaskImage
                    src={spot.image}
                    alt={spot.car || 'Car spotting'}
                    driveWidth={900}
                    className="aspect-[4/3] w-full"
                    imgClassName="transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                    label={spot.car}
                    parallax={0.12}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-t from-ink-950 via-ink-950/25 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-5 bottom-5">
                    <h3 className="font-display text-xl uppercase leading-none text-white">
                      {spot.car || 'Spotting'}
                    </h3>
                    {spot.location && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/60">
                        <MapPin className="h-3 w-3 text-brand" /> {spot.location}
                      </p>
                    )}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

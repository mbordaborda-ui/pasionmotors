import { cn } from '@/lib/utils'
import { garage as defaultGarage } from '@/data/garage'
import { useSettings } from '@/store/settings'
import { MaskImage } from '@/components/MaskImage'
import { Reveal } from '@/components/Reveal'
import { SectionHeading } from '@/components/SectionHeading'

/**
 * Galería "El garage": autos que inspiran la marca con fotografías de licencia
 * libre (Pexels) y revelado cinematográfico por scroll.
 */
export function GarageGallery({ className }: { className?: string }) {
  const { site } = useSettings()
  const garage = site.garage?.length ? site.garage : defaultGarage

  return (
    <section className={cn('bg-ink py-20 lg:py-28', className)}>
      <div className="container-pm">
        <SectionHeading
          eyebrow="El garage"
          title={
            <>
              Máquinas que <span className="text-brand">nos inspiran</span>
            </>
          }
          description="La cultura del motor en su forma más pura. Íconos que dieron forma a PASION MOTORS."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {garage.map((car, i) => (
            <Reveal key={car.id} delay={i * 90}>
              <article className="group relative overflow-hidden rounded-[1.6rem] border border-white/10">
                <MaskImage
                  src={car.image}
                  alt={car.name}
                  driveWidth={1200}
                  className="aspect-[4/3] w-full"
                  imgClassName="transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                  label={car.name}
                  parallax={0.14}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-t from-ink-950 via-ink-950/35 to-transparent" />
                <div className="pointer-events-none absolute inset-x-5 bottom-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand">
                    {car.tag}
                  </span>
                  <h3 className="mt-1 font-display text-2xl uppercase leading-none text-white">
                    {car.name}
                  </h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/60">{car.note}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-[11px] text-white/35">
          Fotografías de Pexels — licencia libre para uso comercial, sin atribución obligatoria.
        </p>
      </div>
    </section>
  )
}

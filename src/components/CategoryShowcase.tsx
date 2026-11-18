import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Category, Product } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { Img } from '@/components/Img'
import { Reveal } from '@/components/Reveal'
import { SectionHeading } from '@/components/SectionHeading'

const fallbackImages: Record<string, string> = {
  camisetas: '/images/categories/camisetas.jpg',
  accesorios: '/images/categories/accesorios.jpg',
  coleccionables: '/images/categories/coleccionables.jpg',
}

interface CategoryShowcaseProps {
  categories: Category[]
  products: Product[]
  className?: string
}

/**
 * Escaparate de categorías: tarjetas grandes con fotografía, número de piezas
 * y precio de entrada. Es la primera parada de compra después del hero.
 */
export function CategoryShowcase({ categories, products, className }: CategoryShowcaseProps) {
  const visible = categories.slice(0, 3)

  return (
    <section className={cn('relative overflow-hidden bg-ink py-20 lg:py-28', className)}>
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-brand/10 blur-[130px]" />
      <div className="container-pm relative">
        <SectionHeading
          eyebrow="Compra por categoría"
          title={
            <>
              Encuentra tu <span className="text-brand">pasión</span>
            </>
          }
          description="Tres puertas de entrada a la cultura del motor. Elige por dónde empezar tu garage."
          action={
            <Link to="/catalogo" className="btn-ghost">
              Ver todo el catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((category, index) => {
            const list = products.filter((p) => p.category === category.id)
            const prices = list
              .map((p) => p.price)
              .filter((price): price is number => typeof price === 'number' && price > 0)
            const from = prices.length ? Math.min(...prices) : null
            const image = category.image?.trim() || fallbackImages[category.id] || ''

            return (
              <Reveal
                key={category.id}
                delay={index * 90}
                className={cn(index === 2 && 'sm:col-span-2 lg:col-span-1')}
              >
                <Link
                  to={`/catalogo?cat=${category.id}`}
                  data-cursor
                  className="group relative isolate flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[1.8rem] border border-white/10 bg-ink-900 p-6 transition-colors duration-300 hover:border-brand/40 sm:p-8 lg:min-h-[520px]"
                >
                  <Img
                    src={image}
                    alt={category.name}
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                    label={category.name}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/10" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950/80 via-ink-950/20 to-transparent" />

                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <span className="font-display text-sm tracking-[0.3em] text-white/45">
                      0{index + 1}
                    </span>
                    <span className="rounded-full border border-white/15 bg-ink-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
                      {list.length} {list.length === 1 ? 'pieza' : 'piezas'}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <p className="eyebrow">{category.short}</p>
                    <h3 className="display mt-3 text-4xl leading-[0.92] text-white sm:text-5xl">
                      {category.name}
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
                      {category.description}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        {from !== null ? `Desde ${formatPrice(from)}` : 'Próximamente'}
                      </span>
                      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                        Ver categoría
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 transition-all duration-300 group-hover:border-brand group-hover:bg-brand">
                          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

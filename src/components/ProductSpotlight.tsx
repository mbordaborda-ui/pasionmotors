import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, PackageCheck, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import type { Product } from '@/types'
import { availabilityLabel, cn, formatPrice, isAvailable } from '@/lib/utils'
import { MaskImage } from '@/components/MaskImage'
import { Img } from '@/components/Img'
import { Reveal } from '@/components/Reveal'
import { useCart } from '@/store/cart'
import { useCatalog } from '@/store/catalog'

interface ProductSpotlightProps {
  product: Product
  className?: string
}

/**
 * Foco editorial para una pieza con fotografía real. Sirve para que el
 * producto estrella no se pierda entre las tarjetas del catálogo.
 */
export function ProductSpotlight({ product, className }: ProductSpotlightProps) {
  const { addItem } = useCart()
  const { categoryMap } = useCatalog()
  const [added, setAdded] = useState(false)
  const category = categoryMap[product.category]
  const price = formatPrice(product.price)
  const compareAt = formatPrice(product.compareAtPrice ?? null)
  const availability = availabilityLabel(product)
  const available = isAvailable(product)
  const images = product.images?.filter(Boolean) ?? []

  const add = () => {
    const result = addItem(product, {}, 1)
    if (result.ok) {
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1800)
    }
  }

  return (
    <section className={cn('relative overflow-hidden border-y border-white/10 bg-ink-950 py-20 lg:py-28', className)}>
      <div className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-brand/15 blur-[150px]" />
      <div className="container-pm relative grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-20">
        <Reveal>
          <span className="eyebrow">{available ? 'Producto destacado' : 'Pieza de la casa'}</span>
          <h2 className="display mt-5 text-4xl leading-[0.94] sm:text-5xl lg:text-6xl">
            {product.name.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-brand">{product.name.split(' ').slice(-1)}</span>
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65 sm:text-base">
            {product.description ||
              product.tagline ||
              'Una pieza seleccionada para elevar el carácter de tu vehículo.'}
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            <span className="chip">{category?.short ?? product.category}</span>
            <span className="chip">{availability.label}</span>
            {product.badge && <span className="chip border-brand/40 text-brand-200">{product.badge}</span>}
            <span className="chip">Envío nacional</span>
          </div>

          <div className="mt-8 flex flex-wrap items-end gap-3">
            {price ? (
              <span className="font-display text-4xl leading-none text-white">{price}</span>
            ) : (
              <span className="text-lg font-medium text-white/55">Precio por confirmar</span>
            )}
            {compareAt && (
              <span className="pb-1 text-sm text-white/35 line-through">{compareAt}</span>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {available ? (
              <button
                type="button"
                onClick={add}
                className={cn('btn-primary', added && '!bg-emerald-500 hover:!bg-emerald-500')}
              >
                {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                {added ? 'Añadido' : 'Añadir al carrito'}
              </button>
            ) : (
              <button type="button" disabled className="btn-ghost">
                <ShoppingBag className="h-4 w-4" /> Agotado
              </button>
            )}
            <Link to={`/producto/${product.slug}`} className="btn-ghost">
              Ver detalles <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {!available && (
            <p className="mt-4 text-xs leading-relaxed text-white/40">
              Esta pieza ya encontró dueño. Entra al detalle para pedir una reposición.
            </p>
          )}

          <div className="mt-10 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            {[
              { icon: Truck, label: 'Envío nacional', note: 'Bogotá 24–48 h' },
              { icon: ShieldCheck, label: 'Compra protegida', note: 'Pago seguro' },
              { icon: PackageCheck, label: 'Empaque de marca', note: 'Listo para regalar' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={140} className="relative">
          <div className="relative mx-auto max-w-xl">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-brand/10 blur-2xl" />
            <MaskImage
              src={images[0]}
              alt={product.name}
              driveWidth={1200}
              className="aspect-[4/3] w-full rounded-[1.8rem] border border-white/10 shadow-card"
              imgClassName="transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.04]"
              label={product.name}
              parallax={0.1}
              eager
            />
            <span className="absolute left-5 top-5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
              {!available ? 'Pieza de la casa' : product.isNew ? 'Nuevo' : 'Favorito'}
            </span>
            {images[1] && (
              <div className="absolute -bottom-8 -left-4 hidden w-40 overflow-hidden rounded-2xl border border-white/15 bg-ink-900 shadow-2xl sm:block lg:-left-10 lg:w-48">
                <Img
                  src={images[1]}
                  alt={`${product.name} — detalle`}
                  className="aspect-square w-full"
                  imgClassName="h-full w-full object-cover"
                  label="Detalle"
                />
              </div>
            )}
            <div className="absolute -bottom-6 right-6 rounded-2xl border border-white/10 bg-ink-950/90 px-4 py-3 text-right backdrop-blur">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">
                PASION MOTORS
              </p>
              <p className="mt-1 font-display text-sm uppercase tracking-[0.18em] text-brand">
                Drive the passion
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BellRing, Check, Heart, Plus } from 'lucide-react'
import type { Product } from '@/types'
import { availabilityLabel, cn, formatPrice, isAvailable, stockLeft } from '@/lib/utils'
import { useMediaQuery, usePrefersReducedMotion, useRichMotion } from '@/lib/motion'
import { Img } from '@/components/Img'
import { RestockRequestDialog } from '@/components/RestockRequestDialog'
import { useCart } from '@/store/cart'
import { useCatalog } from '@/store/catalog'
import { useFavorites } from '@/store/favorites'

const toneClass: Record<'ok' | 'warn' | 'off', string> = {
  ok: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  warn: 'text-amber-200 border-amber-300/25 bg-amber-300/10',
  off: 'text-white/50 border-white/15 bg-white/5',
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { categoryMap } = useCatalog()
  const { isFavorite, toggle: toggleFavorite } = useFavorites()
  const [added, setAdded] = useState(false)
  const [note, setNote] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [altReady, setAltReady] = useState(false)
  const [altLoaded, setAltLoaded] = useState(false)
  const tiltRef = useRef<HTMLAnchorElement>(null)
  const rich = useRichMotion(1024)
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = usePrefersReducedMotion()
  const swapImages = canHover && !reduced
  const category = categoryMap[product.category]
  const price = formatPrice(product.price)
  const availability = availabilityLabel(product)
  const avail = isAvailable(product)
  const left = stockLeft(product)
  const primaryImage = product.images?.[0]
  const alternateImage = product.images?.[1]
  // La vista alterna solo se descarga en equipos con hover (escritorio).
  // En móvil ahorramos la mitad de las imágenes del catálogo.
  const showAlternate = Boolean(alternateImage) && swapImages && altReady
  const swapToAlternate = showAlternate && altLoaded
  const favorite = isFavorite(product.slug)

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!avail) {
      setRequestOpen(true)
      return
    }
    const res = addItem(product, {}, 1)
    if (res.ok) {
      setAdded(true)
      setTimeout(() => setAdded(false), 1600)
    } else {
      setNote(res.message)
      setTimeout(() => setNote(''), 2400)
    }
  }

  const onTiltMove = (e: React.PointerEvent) => {
    if (!rich) return
    const el = tiltRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(1000px) rotateY(${(px * 9).toFixed(2)}deg) rotateX(${(-py * 9).toFixed(2)}deg)`
  }

  const onTiltLeave = () => {
    const el = tiltRef.current
    if (el) el.style.transform = ''
  }

  return (
    <article className="group relative flex flex-col">
      <Link
        ref={tiltRef}
        to={`/producto/${product.slug}`}
        onPointerMove={onTiltMove}
        onPointerLeave={onTiltLeave}
        onPointerEnter={() => {
          if (alternateImage && swapImages && !altReady) setAltReady(true)
        }}
        className="relative block overflow-hidden rounded-[1.4rem] border border-white/10 bg-ink-900 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:border-brand/35 hover:shadow-card"
        style={{ transformStyle: 'preserve-3d' }}
        data-cursor
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-900">
          <div
            className={cn(
              'pm-product-primary absolute inset-0',
              swapToAlternate && 'pm-has-alt',
            )}
          >
            <Img
              src={primaryImage}
              alt={product.name}
              driveWidth={800}
              sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
              className="h-full w-full"
              imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              label={product.name}
              note="Foto pendiente"
            />
          </div>
          {showAlternate && (
            <div className="pm-product-alt absolute inset-0" aria-hidden="true">
              <Img
                src={alternateImage}
                alt={`${product.name} — vista alterna`}
                driveWidth={800}
                sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
                className="h-full w-full"
                imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                label={product.name}
                note="Foto pendiente"
                onLoad={() => setAltLoaded(true)}
              />
            </div>
          )}
        </div>

        {/* Veladuras */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/75 via-transparent to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 -top-1/2 h-[80%] -translate-y-full bg-gradient-to-b from-transparent via-white/[0.07] to-transparent transition-transform duration-[1200ms] ease-out group-hover:translate-y-[280%]" />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
          {product.badge ? (
            <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-red">
              {product.badge}
            </span>
          ) : product.isNew ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
              Nuevo
            </span>
          ) : null}
        </div>

        <span
          className={cn(
            'absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur',
            toneClass[availability.tone],
          )}
        >
          {availability.label}
        </span>

        {/* CTA hover */}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-4 items-center justify-between opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-full bg-white/95 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-ink">
            Ver detalles
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white shadow-red">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand/90">
          {category?.short ?? product.category}
        </p>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-white">
          <Link to={`/producto/${product.slug}`} className="transition hover:text-brand-300">
            {product.name}
          </Link>
        </h3>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="leading-tight">
            {price ? (
              <span className="text-base font-bold text-white">{price}</span>
            ) : (
              <span className="text-sm font-medium text-white/55">Precio por confirmar</span>
            )}
            {left !== null && left > 0 && left <= 3 && (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                {left === 1 ? 'Última unidad' : `Quedan ${left}`}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleFavorite(product.slug)
              }}
              aria-label={favorite ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
              aria-pressed={favorite}
              title={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-300',
                favorite
                  ? 'border-brand/60 bg-brand/10 text-brand'
                  : 'border-white/15 bg-white/[0.04] text-white/60 hover:border-brand hover:text-brand',
              )}
            >
              <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
            </button>

            <button
              type="button"
              onClick={quickAdd}
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-300',
                !avail && 'w-auto grid-flow-col gap-1.5 px-3 border-brand/40 bg-brand/10 text-brand hover:bg-brand hover:text-white',
                avail &&
                  added &&
                  'border-emerald-400/60 bg-emerald-500 text-white',
                avail &&
                  !added &&
                  'border-white/15 bg-white/[0.04] text-white/80 hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white',
              )}
              aria-label={avail ? `Añadir ${product.name} al carrito` : `Solicitar ${product.name}`}
              title={avail ? 'Añadir al carrito' : 'Solicitar producto agotado'}
            >
              {avail ? (
                added ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )
              ) : (
                <>
                  <BellRing className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Solicitar</span>
                </>
              )}
            </button>
          </div>
        </div>
        {note && <p className="mt-2 text-[11px] font-medium text-brand-300">{note}</p>}
      </div>

      <RestockRequestDialog
        product={product}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
      />
    </article>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react'
import { cn, formatPrice, isAvailable } from '@/lib/utils'
import { shippingBenefits } from '@/lib/promos'
import { ESTIMATED_SHIPPING, SHIPPING_CARRIER } from '@/lib/shipping'
import { useCart } from '@/store/cart'
import { useCatalog } from '@/store/catalog'
import { useSettings } from '@/store/settings'
import { Img } from '@/components/Img'
import { ShippingMessage } from '@/components/ShippingMessage'
import type { Product } from '@/types'

const ADDON_RE = /llavero|sticker|parche|pin|calcoman/i
const KEYCHAIN_RE = /llavero/i

function isKeychain(product: Product): boolean {
  return KEYCHAIN_RE.test(product.name)
}

function isSmallAddon(product: Product): boolean {
  if (product.category !== 'accesorios' || product.price == null) return false
  return ADDON_RE.test(product.name) || product.price <= 19900
}

export function CartDrawer() {
  const {
    lines,
    isOpen,
    closeCart,
    setQty,
    removeLine,
    subtotal,
    hasUnpricedItems,
    count,
    clear,
    addItem,
  } = useCart()
  const { getById, products } = useCatalog()
  const { site, activePromos } = useSettings()
  const [recommendationNote, setRecommendationNote] = useState('')

  const totals = new Map<string, number>()
  for (const l of lines) totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.qty)
  const stockOf = (id: string): number | null => {
    const p = getById(id)
    if (!p) return null
    if (!isAvailable(p)) return 0
    return typeof p.stock === 'number' ? p.stock : null
  }

  const subtotalLabel = formatPrice(subtotal)

  const hasShirt = lines.some((l) => getById(l.productId)?.category === 'camisetas')
  const shipping = shippingBenefits(activePromos, subtotal, hasShirt)

  const recommendations = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.productId))
    const cartCategories = new Set(
      lines.map((l) => getById(l.productId)?.category).filter(Boolean),
    )
    const missingForShipping = shipping.free ? 0 : shipping.missing
    const hasAddon = lines.some((l) => {
      const p = getById(l.productId)
      return !!p && isSmallAddon(p)
    })

    const scored = products
      .filter((p) => !inCart.has(p.id) && p.price != null && isAvailable(p))
      .map((p) => {
        let score = 0
        if (!cartCategories.has(p.category)) score += 60
        if (shipping.shirtPromo && !hasShirt && p.category === 'camisetas') score += 140

        // Prioriza detalles pequeños (llaveros, stickers, parches) para sumar al pedido.
        // Si aún falta la camiseta que activa el envío gratis, esa recomendación va primero.
        if (isSmallAddon(p)) {
          const shirtPending = shipping.shirtPromo && !hasShirt
          score += shirtPending ? 45 : 95
          if (!hasAddon) score += shirtPending ? 25 : 65
        }

        if (missingForShipping > 0 && p.price != null) {
          if (p.price >= missingForShipping) {
            score += 90 - Math.min(50, ((p.price - missingForShipping) / missingForShipping) * 50)
          } else {
            score += (p.price / missingForShipping) * 45
          }
        }

        if (p.featured) score += 15
        if (p.isNew) score += 5
        score += Math.min(10, (p.sold ?? 0) / 5)
        return { product: p, score }
      })

    const byScore = (a: { product: Product; score: number }, b: { product: Product; score: number }) =>
      b.score - a.score || (a.product.order ?? 999) - (b.product.order ?? 999)

    // 1) Llaveros (del más económico al más caro), 2) otros detalles pequeños,
    // 3) el resto de recomendaciones. Así siempre hay variedad para sumar.
    const keychains = scored
      .filter(({ product }) => isKeychain(product))
      .sort((a, b) => (a.product.price ?? 0) - (b.product.price ?? 0) || byScore(a, b))
      .slice(0, 4)
    const smalls = scored
      .filter(({ product }) => !isKeychain(product) && isSmallAddon(product))
      .sort(byScore)
      .slice(0, 2)
    const chosen = new Set([...keychains, ...smalls].map(({ product }) => product.id))
    const filler = scored
      .filter(({ product }) => !chosen.has(product.id) && !isKeychain(product))
      .sort(byScore)

    return [...keychains, ...smalls, ...filler].slice(0, 8).map(({ product }) => product)
  }, [products, lines, getById, shipping.free, shipping.missing, shipping.shirtPromo, hasShirt])

  const addRecommended = (product: Product) => {
    const res = addItem(product, {}, 1, true)
    if (res.ok) {
      setRecommendationNote('')
      return
    }
    setRecommendationNote(res.message)
    window.setTimeout(() => setRecommendationNote(''), 3200)
  }

  return (
    <div
      className={cn('fixed inset-0 z-[60]', isOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden={!isOpen}
    >
      <div
        onClick={closeCart}
        className={cn(
          'absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="Carrito de compras"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand" />
            <h2 className="font-display text-xl uppercase tracking-tight">Tu carrito</h2>
            <span className="text-sm text-white/40">({count})</span>
          </div>
          <button
            onClick={closeCart}
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
              <ShoppingBag className="h-6 w-6 text-white/40" />
            </div>
            <p className="mt-5 font-display text-xl uppercase tracking-tight text-white">
              Tu carrito está vacío
            </p>
            <p className="mt-2 text-sm text-white/50">
              Explora el catálogo y añade tus productos favoritos.
            </p>
            <Link to="/catalogo" onClick={closeCart} className="btn-primary mt-6">
              Explorar productos
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {lines.map((line) => (
                  <li key={line.key} className="pm-line-enter flex gap-4">
                    <Link to={`/producto/${line.slug}`} onClick={closeCart} className="shrink-0">
                      <Img
                        src={line.image}
                        alt={line.name}
                        driveWidth={200}
                        className="h-24 w-20 rounded-xl"
                        label="Foto pend."
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/producto/${line.slug}`}
                          onClick={closeCart}
                          className="text-sm font-semibold leading-snug text-white transition hover:text-brand-300"
                        >
                          {line.name}
                        </Link>
                        <button
                          onClick={() => removeLine(line.key)}
                          className="shrink-0 text-white/35 transition hover:text-brand"
                          aria-label={`Quitar ${line.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {Object.entries(line.selections).length > 0 && (
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
                          {Object.entries(line.selections)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-white/90">
                        {formatPrice(line.price) ?? (
                          <span className="text-[12px] font-medium text-amber-200/80">
                            Precio por confirmar
                          </span>
                        )}
                      </p>
                      <div className="mt-auto flex items-center gap-3 pt-3">
                        <div className="flex items-center rounded-full border border-white/15">
                          <button
                            onClick={() => setQty(line.key, line.qty - 1)}
                            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:text-white"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold">{line.qty}</span>
                          <button
                            onClick={() => setQty(line.key, line.qty + 1)}
                            disabled={
                              stockOf(line.productId) !== null &&
                              (totals.get(line.productId) ?? 0) >= (stockOf(line.productId) as number)
                            }
                            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={clear}
                className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 transition hover:text-brand"
              >
                Vaciar carrito
              </button>

              {recommendations.length > 0 && (
                <section className="mt-7 border-t border-white/10 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                        Completa tu compra
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        Suma un recomendado y aprovecha mejor el envío.
                      </p>
                    </div>
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {recommendations.map((product) => {
                      const price = formatPrice(product.price)
                      return (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 transition hover:border-white/20"
                        >
                          <Link
                            to={`/producto/${product.slug}`}
                            onClick={closeCart}
                            className="shrink-0"
                          >
                            <Img
                              src={product.images?.[0]}
                              alt={product.name}
                              driveWidth={160}
                              className="h-14 w-14 rounded-lg"
                              label="Foto"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/producto/${product.slug}`}
                              onClick={closeCart}
                              className="line-clamp-2 text-xs font-semibold leading-snug text-white transition hover:text-brand-300"
                            >
                              {product.name}
                            </Link>
                            <p className="mt-1 text-xs font-semibold text-white/60">{price}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addRecommended(product)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-brand transition hover:bg-brand hover:text-white"
                            aria-label={`Añadir ${product.name} al carrito`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <Link
                    to="/catalogo?cat=accesorios"
                    onClick={closeCart}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 transition hover:text-brand-300"
                  >
                    Ver todos los detalles <span aria-hidden>→</span>
                  </Link>
                  {recommendationNote && (
                    <p className="mt-2 text-[11px] font-medium text-amber-200">
                      {recommendationNote}
                    </p>
                  )}
                </section>
              )}
            </div>

            <div className="border-t border-white/10 bg-ink-950/50 px-5 py-5">
              <ShippingMessage shipping={shipping} hasShirt={hasShirt} className="mb-4" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Subtotal</span>
                <span
                  key={subtotal}
                  className="pm-price-tick font-display text-2xl uppercase tracking-tight text-white"
                >
                  {subtotalLabel ?? '—'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                <span>Envío estimado · {SHIPPING_CARRIER}</span>
                {shipping.free ? (
                  <span className="font-semibold text-emerald-300">¡Gratis!</span>
                ) : (
                  <span className="text-white/80">{formatPrice(ESTIMATED_SHIPPING)}</span>
                )}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
                Valor estimado. Se paga contra entrega al recibir el pedido.
              </p>

              {hasUnpricedItems && (
                <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
                  Algunos productos aún no tienen precio publicado. Se confirmará antes de finalizar la
                  compra.
                </p>
              )}
              <Link to="/checkout" onClick={closeCart} className="btn-primary mt-4 w-full">
                Finalizar compra
              </Link>
              <button onClick={closeCart} className="btn-ghost mt-2 w-full">
                Seguir comprando
              </button>
              <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
                Envíos y pagos · {site.city}
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

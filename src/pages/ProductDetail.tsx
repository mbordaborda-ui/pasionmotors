import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { useCart } from '@/store/cart'
import { useFavorites } from '@/store/favorites'
import { useSettings } from '@/store/settings'
import { Img } from '@/components/Img'
import { ProductDetailSkeleton } from '@/components/Skeletons'
import { ProductZoom } from '@/components/ProductZoom'
import { Reveal } from '@/components/Reveal'
import { ProductCard } from '@/components/ProductCard'
import { RestockRequestDialog } from '@/components/RestockRequestDialog'
import { availabilityLabel, cn, formatPrice, isAvailable, stockLeft } from '@/lib/utils'
import type { Product } from '@/types'

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { getBySlug, getCategory, products, loading, error, retry } = useCatalog()
  const { addItem, availableFor } = useCart()
  const { isFavorite, toggle: toggleFavorite } = useFavorites()
  const { site, activeGifts } = useSettings()

  const product = slug ? getBySlug(slug) : undefined
  const favorite = product ? isFavorite(product.slug) : false

  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [added, setAdded] = useState(false)
  const [missing, setMissing] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)

  const related = useMemo(() => {
    if (!product) return [] as Product[]
    return products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)
  }, [products, product])

  useEffect(() => {
    setActiveImage(0)
    setSelections({})
    setQty(1)
    setMissing([])
    setAdded(false)
    setNotice('')
    setRequestOpen(false)
  }, [slug])

  if (!product) {
    if (loading) return <ProductDetailSkeleton />

    if (error) {
      return (
        <div className="container-pm flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <RotateCcw className="h-7 w-7" />
          </span>
          <p className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            No pudimos cargar este producto
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/55">{error}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={retry} className="btn-primary">
              <RotateCcw className="h-4 w-4" /> Reintentar
            </button>
            <Link to="/catalogo" className="btn-ghost">
              Volver al catálogo
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="container-pm flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-24 text-center">
        <p className="font-display text-4xl uppercase tracking-tight">Producto no encontrado</p>
        <p className="max-w-sm text-sm text-white/55">
          El producto que buscas no existe o fue movido. Vuelve al catálogo para seguir explorando.
        </p>
        <Link to="/catalogo" className="btn-primary mt-2">
          Volver al catálogo
        </Link>
      </div>
    )
  }

  const category = getCategory(product.category)
  const price = formatPrice(product.price)
  const availability = availabilityLabel(product)
  const images = product.images?.length ? product.images : ['']
  const hasVariants = (product.variants?.length ?? 0) > 0
  const canAdd = isAvailable(product)
  const left = stockLeft(product)
  const maxQty = availableFor(product)
  const cappedQty = Number.isFinite(maxQty) ? Math.min(qty, Math.max(1, maxQty)) : qty
  const atMax = Number.isFinite(maxQty) && cappedQty >= maxQty

  const handleAdd = () => {
    const pending = (product.variants ?? [])
      .filter((v) => !selections[v.name])
      .map((v) => v.name)
    if (pending.length) {
      setMissing(pending)
      return
    }
    setMissing([])
    const res = addItem(product, selections, cappedQty)
    if (res.ok) {
      setAdded(true)
      setTimeout(() => setAdded(false), 2200)
    }
    if (res.message) {
      setNotice(res.message)
      setTimeout(() => setNotice(''), 3200)
    }
  }

  const inquiryHref = site.whatsapp
    ? `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
        `Hola PASION MOTORS, me interesa: ${product.name}`,
      )}`
    : '/contacto'

  return (
    <div className="pt-[68px] lg:pt-20">
      <div className="container-pm py-6">
        <nav className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
          <Link to="/" className="transition hover:text-white">
            Inicio
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/catalogo" className="transition hover:text-white">
            Catálogo
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/catalogo?cat=${product.category}`} className="transition hover:text-white">
            {category?.short}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white/70">{product.name}</span>
        </nav>
      </div>

      {error && (
        <div className="container-pm -mt-2 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs leading-relaxed text-amber-100/85">
            <span>
              <strong className="text-white">Mostrando la última copia guardada.</strong> {error}
            </span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-200/35 px-3 py-1.5 font-semibold uppercase tracking-wider text-white transition hover:border-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        </div>
      )}

      <div className="container-pm grid gap-10 pb-16 lg:grid-cols-2 lg:gap-16">
        {/* GALLERY */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div
            key={activeImage}
            className="pm-image-enter relative overflow-hidden rounded-3xl border border-white/10"
          >
            <ProductZoom
              src={images[activeImage]}
              alt={product.name}
              driveWidth={1200}
              sizes="(min-width: 1024px) 48vw, 92vw"
              label="Fotografía pendiente"
              eager
            />
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              {product.isNew && (
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                  Nuevo
                </span>
              )}
              {product.badge && (
                <span className="rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  {product.badge}
                </span>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border transition',
                    activeImage === i ? 'border-brand' : 'border-white/10 opacity-60 hover:opacity-100',
                  )}
                >
                  <Img src={img} alt={`${product.name} ${i + 1}`} driveWidth={300} sizes="80px" className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div>
          <Reveal>
            <Link
              to={`/catalogo?cat=${product.category}`}
              className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand"
            >
              {category?.name}
            </Link>
            <h1 className="display mt-3 text-3xl sm:text-4xl lg:text-5xl">{product.name}</h1>
            {product.tagline && <p className="mt-3 text-base text-white/60">{product.tagline}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              {price ? (
                <span className="font-display text-3xl uppercase tracking-tight text-white">
                  {price}
                </span>
              ) : (
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100">
                  Precio por confirmar
                </span>
              )}
              <span
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
                  availability.tone === 'ok' && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
                  availability.tone === 'warn' && 'border-amber-300/25 bg-amber-300/10 text-amber-200',
                  availability.tone === 'off' && 'border-white/15 bg-white/5 text-white/50',
                )}
              >
                {availability.label}
              </span>
            </div>
          </Reveal>

          {product.description && (
            <Reveal delay={80}>
              <p className="mt-6 text-[15px] leading-relaxed text-white/65">{product.description}</p>
            </Reveal>
          )}

          {/* VARIANTS */}
          {hasVariants && (
            <Reveal delay={120}>
              <div className="mt-8 space-y-5">
                {product.variants!.map((variant) => (
                  <div key={variant.id}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      {variant.name}
                      {selections[variant.name] && (
                        <span className="ml-2 text-white/40">{selections[variant.name]}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variant.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setSelections((s) => ({ ...s, [variant.name]: opt.label }))
                          }
                          className={cn(
                            'min-w-12 rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                            selections[variant.name] === opt.label
                              ? 'border-brand bg-brand text-white'
                              : 'border-white/15 text-white/75 hover:border-white/40',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* ADD TO CART */}
          <Reveal delay={160}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center justify-between rounded-full border border-white/15 px-2 py-1 sm:w-auto">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition hover:text-white"
                  aria-label="Disminuir"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-semibold">{cappedQty}</span>
                <button
                  onClick={() =>
                    setQty((q) => Math.min(q + 1, Number.isFinite(maxQty) ? maxQty : q + 1))
                  }
                  disabled={atMax}
                  className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
                  aria-label="Aumentar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className={cn('btn-primary flex-1', added && '!bg-emerald-500')}
              >
                {!canAdd ? (
                  <>
                    <ShoppingBag className="h-4 w-4" /> Agotado
                  </>
                ) : added ? (
                  <>
                    <Check className="h-4 w-4" /> Añadido al carrito
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" /> Añadir al carrito
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(product.slug)}
                aria-label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                aria-pressed={favorite}
                title={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                className={cn(
                  'btn-ghost !px-4',
                  favorite && '!border-brand/60 !text-brand',
                )}
              >
                <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
              </button>
            </div>

            {!canAdd && (
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="btn-primary mt-3 w-full"
              >
                <BellRing className="h-4 w-4" /> Solicitar este producto
              </button>
            )}

            {missing.length > 0 && (
              <p className="mt-3 text-xs font-medium text-brand-300">
                Selecciona una opción de: {missing.join(', ')}
              </p>
            )}
            {notice && <p className="mt-3 text-xs font-medium text-amber-200">{notice}</p>}
            {!canAdd ? (
              <p className="mt-3 text-xs font-medium text-white/50">
                Este producto está agotado. Déjanos tus datos y te avisamos cuando vuelva.
              </p>
            ) : (
              left !== null &&
              left <= 3 && (
                <p className="mt-3 text-xs font-medium text-amber-300/90">
                  {left === 1 ? 'Última unidad disponible.' : `Quedan ${left} unidades disponibles.`}
                </p>
              )
            )}

            <a href={inquiryHref} className="mt-4 inline-flex text-sm font-semibold text-white/70 underline decoration-white/20 underline-offset-4 transition hover:text-white">
              ¿Dudas? Consúltanos por este producto
            </a>
          </Reveal>

          {/* SPECS */}
          {product.specs && product.specs.length > 0 && (
            <Reveal delay={200}>
              <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
                {product.specs.map((spec, i) => (
                  <div
                    key={spec.label}
                    className={cn(
                      'flex items-center justify-between px-5 py-3.5 text-sm',
                      i % 2 === 0 ? 'bg-white/[0.02]' : '',
                    )}
                  >
                    <span className="text-white/50">{spec.label}</span>
                    <span className="font-medium text-white/85">{spec.value}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* TRUST */}
          <Reveal delay={240}>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, title: 'Envíos', text: 'Cobertura nacional' },
                { icon: ShieldCheck, title: 'Compra segura', text: 'Pago por integrar' },
                { icon: RotateCcw, title: 'Cambios', text: 'Política por definir' },
              ].map((t) => (
                <div key={t.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <t.icon className="h-5 w-5 text-brand" />
                  <p className="mt-3 text-sm font-semibold text-white">{t.title}</p>
                  <p className="text-xs text-white/45">{t.text}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {activeGifts.length > 0 && (
            <Reveal delay={280}>
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/[0.06] p-5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <p className="text-sm leading-relaxed text-white/75">
                  <span className="font-semibold text-white">Regalos PASION MOTORS:</span>{' '}
                  {activeGifts.map((g) => g.name).join(', ')} incluidos con tu compra.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </div>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="border-t border-white/10 bg-ink-900">
          <div className="container-pm py-16 lg:py-20">
            <div className="flex items-end justify-between gap-4">
              <h2 className="display text-2xl sm:text-3xl">
                También te puede <span className="text-brand">gustar</span>
              </h2>
              <Link
                to={`/catalogo?cat=${product.category}`}
                className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60 transition hover:text-white sm:inline-flex"
              >
                Ver categoría <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <RestockRequestDialog
        product={product}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
      />
    </div>
  )
}

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Trash2 } from 'lucide-react'
import { useFavorites } from '@/store/favorites'
import { useCatalog } from '@/store/catalog'
import { ProductCard } from '@/components/ProductCard'
import { Reveal } from '@/components/Reveal'
import { KineticText } from '@/components/KineticText'
import { ProductGridSkeleton } from '@/components/Skeletons'
import type { Product } from '@/types'

export function Favoritos() {
  const { ids, count, clear } = useFavorites()
  const { products, loading } = useCatalog()

  const favorites = useMemo(() => {
    // Se guarda el slug (no el id): sobrevive al paso del catálogo local al de Supabase.
    const bySlug = new Map(products.map((product) => [product.slug, product]))
    return ids
      .map((slug) => bySlug.get(slug))
      .filter((product): product is Product => Boolean(product))
  }, [ids, products])

  return (
    <div className="pt-[68px] lg:pt-20">
      <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-[120px]" />
        <div className="container-pm relative py-14 lg:py-20">
          <Reveal>
            <span className="eyebrow">Tu selección</span>
          </Reveal>
          <h1 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">
            <KineticText text="Piezas que" as="span" className="block" stagger={0.07} />
            <KineticText text="te gustan" as="span" className="block text-brand" delay={0.12} stagger={0.07} />
          </h1>
          <Reveal delay={180}>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Guarda tus favoritos y vuelve cuando quieras. Quedan almacenados en este dispositivo,
              incluso si cierras la tienda.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-pm py-10 lg:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            {count === 0
              ? 'Todavía no has guardado productos'
              : `${count} ${count === 1 ? 'producto guardado' : 'productos guardados'}`}
          </p>
          {count > 0 && (
            <button type="button" onClick={clear} className="btn-ghost !py-2.5 !text-[11px]">
              <Trash2 className="h-3.5 w-3.5" /> Limpiar lista
            </button>
          )}
        </div>

        {loading && count > 0 && favorites.length === 0 ? (
          <ProductGridSkeleton count={Math.min(Math.max(count, 1), 4)} />
        ) : favorites.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-ink-800/40 px-6 py-20 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Heart className="h-7 w-7" />
            </span>
            <p className="font-display text-2xl uppercase tracking-tight text-white">
              Tu lista está vacía
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-white/55">
              Toca el corazón en la ficha de un producto para guardarlo aquí y encontrarlo después.
            </p>
            <Link to="/catalogo" className="btn-primary mt-2">
              Explorar catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {favorites.map((product, i) => (
              <Reveal key={product.id} delay={(i % 8) * 45}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

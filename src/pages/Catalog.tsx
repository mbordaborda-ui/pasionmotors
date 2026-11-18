import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, RefreshCw } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { KineticText } from '@/components/KineticText'
import { ProductCard } from '@/components/ProductCard'
import { useCatalog } from '@/store/catalog'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Availability, CategoryId } from '@/types'

type SortKey = 'relevancia' | 'nombre' | 'precio-asc' | 'precio-desc'

const sortLabels: Record<SortKey, string> = {
  relevancia: 'Relevancia',
  nombre: 'Nombre (A-Z)',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
}

export function Catalog() {
  const [params, setParams] = useSearchParams()
  const { products, categories, loading, error, retry } = useCatalog()

  const activeCat = (params.get('cat') as CategoryId | null) ?? 'todas'
  const query = params.get('q') ?? ''
  const [sort, setSort] = useState<SortKey>('relevancia')
  const [availability, setAvailability] = useState<Availability | 'todas'>('todas')
  const [localQuery, setLocalQuery] = useState(query)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = products.filter((p) => {
      const matchCat = activeCat === 'todas' || p.category === activeCat
      const matchAvail = availability === 'todas' || p.availability === availability
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.tagline ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      return matchCat && matchAvail && matchQuery
    })

    if (sort === 'nombre') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'precio-asc')
      list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    if (sort === 'precio-desc')
      list = [...list].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))

    return list
  }, [products, activeCat, availability, query, sort])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setParam('q', localQuery.trim() || null)
  }

  return (
    <div className="pt-[68px] lg:pt-20">
      <section className="relative overflow-hidden border-b border-white/10 bg-ink-900">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-[120px]" />
        <div className="container-pm relative py-14 lg:py-20">
          <Reveal>
            <span className="eyebrow">Catálogo</span>
          </Reveal>
          <h1 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">
            <KineticText text="Todo para tu" as="span" className="block" stagger={0.07} />
            <KineticText text="pasión" as="span" className="block text-brand" delay={0.12} stagger={0.07} />
          </h1>
          <Reveal delay={180}>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Explora camisetas, accesorios y coleccionables. Usa la búsqueda y los filtros para
              encontrar justo lo que buscas.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-pm py-10 lg:py-14">
        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs leading-relaxed text-amber-100/85">
            <strong className="text-white">Modo local:</strong> faltan{' '}
            <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en Netlify. Se muestra
            el catálogo de respaldo; las cuentas, pedidos y pagos no estarán disponibles hasta
            configurarlas.
          </div>
        )}
        {error && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-xs leading-relaxed text-white/70">
            <span>
              <strong className="text-white">No se pudo actualizar el catálogo.</strong> {error}
            </span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 font-semibold uppercase tracking-wider text-white transition hover:border-brand hover:text-brand"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        )}
        {/* Filters */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={submit} className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Buscar en el catálogo…"
                className="w-full bg-transparent py-2 text-sm text-white placeholder-white/40 outline-none"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalQuery('')
                    setParam('q', null)
                  }}
                  className="text-white/40 transition hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-3">
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as Availability | 'todas')}
                  className="appearance-none rounded-full border border-white/10 bg-ink-800/70 py-2.5 pl-9 pr-8 text-xs font-semibold uppercase tracking-wider text-white/80 outline-none focus:border-brand"
                >
                  <option value="todas">Disponibilidad</option>
                  <option value="disponible">Disponible</option>
                  <option value="pendiente">Por confirmar</option>
                  <option value="agotado">Agotado</option>
                </select>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none rounded-full border border-white/10 bg-ink-800/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/80 outline-none focus:border-brand"
              >
                {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {sortLabels[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setParam('cat', null)}
              className={cn('chip', activeCat === 'todas' && 'chip-active')}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setParam('cat', c.id)}
                className={cn('chip', activeCat === c.id && 'chip-active')}
              >
                {c.name}
              </button>
            ))}
            <span className="ml-auto text-xs uppercase tracking-wider text-white/40">
              {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading && products.length === 0 ? (
          <div className="mt-16 flex items-center justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-ink-800/40 py-20 text-center">
            <p className="font-display text-2xl uppercase tracking-tight text-white">
              Sin resultados
            </p>
            <p className="max-w-sm text-sm text-white/55">
              No encontramos productos con esos criterios. Prueba con otra búsqueda o cambia los
              filtros.
            </p>
            <button
              onClick={() => {
                setLocalQuery('')
                setAvailability('todas')
                setParams({}, { replace: true })
              }}
              className="btn-ghost mt-2"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div
            key={`${activeCat}-${availability}-${sort}-${query}`}
            className="pm-grid-enter mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4"
          >
            {filtered.map((p, i) => (
              <Reveal key={p.id} delay={(i % 8) * 50}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

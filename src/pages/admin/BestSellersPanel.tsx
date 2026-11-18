import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Search, TrendingUp, X } from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { formatPrice } from '@/lib/utils'
import { Img } from '@/components/Img'

export function BestSellersPanel() {
  const catalog = useCatalog()
  const [filter, setFilter] = useState('')

  const selected = catalog.bestSellers()
  const selectedIds = useMemo(() => selected.map((p) => p.id), [selected])

  const available = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return catalog.products
      .filter((p) => {
        if (p.bestSeller) return false
        return !q || p.name.toLowerCase().includes(q) || p.slug.includes(q)
      })
      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
  }, [catalog.products, filter])

  const move = (index: number, dir: -1 | 1) => {
    const next = [...selectedIds]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    catalog.setBestSellers(next)
  }

  const add = (id: string) => catalog.setBestSellers([...selectedIds, id])
  const remove = (id: string) => catalog.setBestSellers(selectedIds.filter((x) => x !== id))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand/[0.05] p-4 text-xs leading-relaxed text-white/60">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>
          Elige qué productos aparecen en la sección{' '}
          <strong className="text-white/80">«Los más vendidos»</strong> del inicio y en qué orden.
          La sección muestra hasta <strong className="text-white/80">4</strong> productos. Si no
          eliges ninguno, se usarán automáticamente los que tengan más unidades vendidas.
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg uppercase tracking-tight">
              En más vendidos <span className="text-brand">{selected.length}</span>
            </h3>
            {selected.length > 0 && (
              <button
                onClick={() => catalog.setBestSellers([])}
                className="text-[11px] font-semibold uppercase tracking-wider text-white/45 transition hover:text-white"
              >
                Vaciar
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {selected.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm text-white/50">
                Aún no hay productos elegidos. Añádelos desde la lista.
              </p>
            )}
            {selected.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand-300">
                  {i + 1}
                </span>
                <Img
                  src={p.images?.[0]}
                  alt={p.name}
                  driveWidth={120}
                  className="h-12 w-12 shrink-0 rounded-xl"
                  label="—"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                  <p className="truncate text-[11px] text-white/45">
                    {formatPrice(p.price) ?? '—'} · {p.sold ?? 0} vendidos
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    aria-label="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    aria-label="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/50 transition hover:border-brand hover:text-brand"
                    aria-label="Quitar de más vendidos"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-lg uppercase tracking-tight">Todos los productos</h3>
          <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-4 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full bg-transparent py-1.5 text-sm text-white placeholder-white/40 outline-none"
            />
          </div>

          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {available.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
                {filter ? 'Sin resultados.' : 'Todos los productos ya están en más vendidos.'}
              </p>
            )}
            {available.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/25"
              >
                <Img
                  src={p.images?.[0]}
                  alt={p.name}
                  driveWidth={120}
                  className="h-12 w-12 shrink-0 rounded-xl"
                  label="—"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                  <p className="truncate text-[11px] uppercase tracking-wider text-white/40">
                    {catalog.getCategory(p.category)?.short ?? p.category} ·{' '}
                    {formatPrice(p.price) ?? 'Precio por confirmar'} · {p.sold ?? 0} vendidos
                  </p>
                </div>
                <button
                  onClick={() => add(p.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 transition hover:border-brand hover:bg-brand hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-white/40">
        <Check className="h-4 w-4 text-emerald-300/80" /> Los cambios se guardan al instante y se
        sincronizan en todas las pestañas.
      </p>
    </div>
  )
}

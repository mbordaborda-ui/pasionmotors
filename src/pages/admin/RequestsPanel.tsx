import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  CheckCircle2,
  Mail,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Truck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { describeError, reportSaveError } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import { AdminListSkeleton } from '@/components/Skeletons'
import { useCatalog } from '@/store/catalog'
import { cn, isAvailable, stockLeft } from '@/lib/utils'
import type { RestockRequest, RestockStatus } from '@/types'

const STATUS: Record<RestockStatus, { label: string; className: string }> = {
  new: { label: 'Nueva', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
  contacted: { label: 'Contactado', className: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  ordered: { label: 'Pedido al proveedor', className: 'border-violet-400/30 bg-violet-400/10 text-violet-300' },
  restocked: { label: 'Reabastecido', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  closed: { label: 'Cerrada', className: 'border-white/15 bg-white/5 text-white/50' },
}

interface RestockRow {
  id: string
  product_id: string | null
  product_name: string
  product_slug: string | null
  product_category: string | null
  email: string
  name: string | null
  phone: string | null
  qty: number
  notes: string | null
  status: RestockStatus
  created_at: string
  updated_at: string
}

const rowToRequest = (row: RestockRow): RestockRequest => ({
  id: row.id,
  productId: row.product_id,
  productName: row.product_name,
  productSlug: row.product_slug,
  productCategory: row.product_category,
  email: row.email,
  name: row.name,
  phone: row.phone,
  qty: row.qty,
  notes: row.notes,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const statusKeys = Object.keys(STATUS) as RestockStatus[]

export function RequestsPanel() {
  const { getById } = useCatalog()
  const [requests, setRequests] = useState<RestockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<RestockStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const { data, error: queryError } = await withTimeout(
        supabase
          .from('restock_requests')
          .select('*')
          .order('created_at', { ascending: false }),
        15_000,
        'Las solicitudes tardaron demasiado en cargar.',
      )
      if (queryError) {
        setError(queryError.message)
      } else {
        setRequests(((data as RestockRow[]) ?? []).map(rowToRequest))
        setError('')
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduled = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void load(), 400)
    }
    const channel = supabase
      .channel('restock-requests-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restock_requests' },
        scheduled,
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [load])

  const updateStatus = async (id: string, status: RestockStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    const { error: updateError } = await supabase
      .from('restock_requests')
      .update({ status })
      .eq('id', id)
    if (updateError) {
      const message = describeError(updateError)
      setError(message)
      reportSaveError('No se pudo guardar el estado de la solicitud.', message)
      // La interfaz vuelve a mostrar lo que hay realmente en la base de datos.
      void load()
    }
  }

  const remove = async (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
    const { error: deleteError } = await supabase.from('restock_requests').delete().eq('id', id)
    if (deleteError) {
      const message = describeError(deleteError)
      setError(message)
      reportSaveError('No se pudo eliminar la solicitud.', message)
      void load()
    }
  }

  const markGroupRestocked = async (ids: string[]) => {
    if (ids.length === 0) return
    setRequests((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status: 'restocked' } : r)))
    const { error: updateError } = await supabase
      .from('restock_requests')
      .update({ status: 'restocked' })
      .in('id', ids)
    if (updateError) {
      const message = describeError(updateError)
      setError(message)
      reportSaveError('No se pudo actualizar el grupo de solicitudes.', message)
      void load()
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return requests.filter((r) => {
      const matchStatus = filter === 'all' || r.status === filter
      const matchQuery =
        !q ||
        r.productName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q)
      return matchStatus && matchQuery
    })
  }, [requests, filter, query])

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        productId: string | null
        productName: string
        productSlug: string | null
        productCategory: string | null
        items: RestockRequest[]
        totalQty: number
      }
    >()
    for (const r of visible) {
      const key = r.productId ?? `name:${r.productName}`
      const current = map.get(key)
      if (current) {
        current.items.push(r)
        current.totalQty += r.qty
      } else {
        map.set(key, {
          key,
          productId: r.productId,
          productName: r.productName,
          productSlug: r.productSlug,
          productCategory: r.productCategory,
          items: [r],
          totalQty: r.qty,
        })
      }
    }
    return [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || b.totalQty - a.totalQty,
    )
  }, [visible])

  const demand = useMemo(() => {
    const map = new Map<string, { name: string; slug: string | null; count: number; qty: number }>()
    for (const r of requests) {
      const key = r.productId ?? `name:${r.productName}`
      const current = map.get(key)
      if (current) {
        current.count += 1
        current.qty += r.qty
      } else {
        map.set(key, { name: r.productName, slug: r.productSlug, count: 1, qty: r.qty })
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.qty - a.qty).slice(0, 5)
  }, [requests])

  const maxDemand = demand[0]?.count ?? 1
  const pending = requests.filter((r) => r.status === 'new').length
  const productsCount = new Set(requests.map((r) => r.productId ?? r.productName)).size
  const totalUnits = requests.reduce((sum, r) => sum + r.qty, 0)

  if (loading) {
    return <AdminListSkeleton rows={6} />
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Solicitudes totales" value={requests.length} icon={BellRing} />
        <Stat label="Pendientes" value={pending} icon={CheckCircle2} />
        <Stat label="Productos pedidos" value={productsCount} icon={PackageSearch} />
        <Stat label="Unidades solicitadas" value={totalUnits} icon={Truck} />
      </div>

      {demand.length > 0 && (
        <section className="card-surface p-6">
          <h3 className="font-display text-lg uppercase tracking-tight">Productos más solicitados</h3>
          <p className="mt-1 text-xs text-white/45">
            Ordenado por número de clientes. Úsalo para decidir qué reabastecer primero.
          </p>
          <ul className="mt-5 space-y-4">
            {demand.map((d) => {
              return (
                <li key={`${d.slug ?? d.name}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-white">
                      {d.slug ? (
                        <Link to={`/producto/${d.slug}`} className="hover:text-brand-300">
                          {d.name}
                        </Link>
                      ) : (
                        d.name
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-white/50">
                      {d.count} {d.count === 1 ? 'cliente' : 'clientes'} · {d.qty} unid.
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-300"
                      style={{ width: `${Math.max(8, (d.count / maxDemand) * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn('chip', filter === 'all' && 'chip-active')}
          >
            Todas ({requests.length})
          </button>
          {statusKeys.map((key) => {
            const count = requests.filter((r) => r.status === key).length
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn('chip', filter === key && 'chip-active')}
              >
                {STATUS[key].label} ({count})
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-4 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto o cliente…"
              className="w-full bg-transparent py-1.5 text-sm text-white placeholder-white/40 outline-none"
            />
          </div>
          <button onClick={() => void load()} className="btn-ghost !px-4 !py-2.5" aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-xs text-white">{error}</p>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <BellRing className="h-8 w-8 text-white/30" />
          <p className="text-sm text-white/55">
            {requests.length === 0
              ? 'Aún no hay solicitudes. Aparecerán cuando un cliente pida un producto agotado.'
              : 'No hay solicitudes que coincidan con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const product = group.productId ? getById(group.productId) : undefined
            const current = product
              ? isAvailable(product)
                ? 'Disponible ahora'
                : stockLeft(product) === 0
                  ? 'Sigue agotado'
                  : 'No disponible'
              : 'Producto no encontrado'
            const restockIds = group.items
              .filter((r) => r.status !== 'restocked')
              .map((r) => r.id)

            return (
              <div key={group.key} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
                      {group.productCategory ?? 'Producto'}
                    </p>
                    <h3 className="mt-1 font-display text-xl uppercase tracking-tight text-white">
                      {group.productSlug ? (
                        <Link to={`/producto/${group.productSlug}`} className="hover:text-brand-300">
                          {group.productName}
                        </Link>
                      ) : (
                        group.productName
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      {group.items.length} {group.items.length === 1 ? 'cliente' : 'clientes'} ·{' '}
                      {group.totalQty} {group.totalQty === 1 ? 'unidad' : 'unidades'} · {current}
                    </p>
                  </div>
                  {restockIds.length > 0 && (
                    <button
                      onClick={() => void markGroupRestocked(restockIds)}
                      className="btn-ghost !py-2 !text-[11px]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Marcar reabastecido
                    </button>
                  )}
                </div>

                <ul className="mt-4 divide-y divide-white/10">
                  {group.items.map((r) => {
                    const status = STATUS[r.status] ?? STATUS.new
                    return (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            {r.name || 'Cliente'} · {r.qty}{' '}
                            {r.qty === 1 ? 'unidad' : 'unidades'}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
                            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 hover:text-white">
                              <Mail className="h-3.5 w-3.5 text-brand" /> {r.email}
                            </a>
                            {r.phone && (
                              <a
                                href={`https://wa.me/${r.phone.replace(/[^\d]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 hover:text-white"
                              >
                                <Phone className="h-3.5 w-3.5 text-brand" /> {r.phone}
                              </a>
                            )}
                            <span>{new Date(r.createdAt).toLocaleString('es-CO')}</span>
                          </div>
                          {r.notes && <p className="mt-1 text-xs text-white/40">Nota: {r.notes}</p>}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <select
                            value={r.status}
                            onChange={(e) => void updateStatus(r.id, e.target.value as RestockStatus)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider outline-none',
                              status.className,
                            )}
                          >
                            {statusKeys.map((key) => (
                              <option key={key} value={key} className="bg-ink-900 text-white">
                                {STATUS[key].label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void remove(r.id)}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-brand hover:text-brand"
                            aria-label="Eliminar solicitud"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof BellRing
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <p className="mt-3 font-display text-3xl uppercase tracking-tight text-white">{value}</p>
    </div>
  )
}

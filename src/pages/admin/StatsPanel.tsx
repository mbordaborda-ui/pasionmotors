import { useMemo } from 'react'
import { AlertTriangle, Boxes, CheckCircle2, DollarSign, PackageCheck, ShoppingCart, TrendingUp } from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { useOrders } from '@/store/orders'
import { cn, formatPrice, isAvailable } from '@/lib/utils'

const LOW_STOCK = 3

export function StatsPanel() {
  const { products } = useCatalog()
  const { orders } = useOrders()

  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'paid')
    const revenue = paidOrders.reduce((sum, o) => sum + (o.total ?? o.subtotal ?? 0), 0)
    const unitsSold = paidOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.qty, 0),
      0,
    )

    const inStock = products.filter((p) => isAvailable(p))
    const lowStock = products
      .filter(
        (p) =>
          isAvailable(p) &&
          typeof p.stock === 'number' &&
          p.stock > 0 &&
          p.stock <= LOW_STOCK,
      )
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    const outOfStock = products.filter((p) => !isAvailable(p))
    // El valor real del inventario es lo que costó la mercancía que está en
    // bodega: stock × costo. El precio de venta se muestra aparte como
    // "potencial de venta" para no inflar la cifra.
    const inventoryValue = products.reduce(
      (sum, p) => sum + (typeof p.stock === 'number' ? p.stock * (p.cost ?? 0) : 0),
      0,
    )
    const retailValue = products.reduce(
      (sum, p) => sum + (typeof p.stock === 'number' ? p.stock * (p.price ?? 0) : 0),
      0,
    )
    const missingCost = products.filter(
      (p) => (p.stock ?? 0) > 0 && !(typeof p.cost === 'number' && p.cost > 0),
    ).length

    const soldByProduct = new Map<string, { id: string; name: string; qty: number }>()
    for (const order of paidOrders) {
      for (const item of order.items) {
        const key = item.productId || `name:${item.name}`
        const current = soldByProduct.get(key)
        if (current) {
          current.qty += item.qty
        } else {
          soldByProduct.set(key, {
            id: item.productId || key,
            name: item.name,
            qty: item.qty,
          })
        }
      }
    }
    const bestSellers = [...soldByProduct.values()]
      .filter((p) => p.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
    const maxSold = bestSellers.reduce((max, p) => Math.max(max, p.qty), 1)

    // "Por reponer" = solo lo que está agotado. Los productos con stock 1
    // son piezas únicas ("última unidad") y se informan aparte para no
    // llenar el panel de alertas que no requieren acción inmediata.
    const reorder = [...outOfStock].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))

    return {
      revenue,
      unitsSold,
      inStockCount: inStock.length,
      lowStock,
      outOfStock,
      reorder,
      inventoryValue,
      retailValue,
      missingCost,
      bestSellers,
      maxSold,
      ordersCount: orders.length,
      paidOrdersCount: paidOrders.length,
    }
  }, [products, orders])

  const cards = [
    { icon: ShoppingCart, label: 'Pedidos', value: String(stats.ordersCount) },
    { icon: CheckCircle2, label: 'Pedidos pagados', value: String(stats.paidOrdersCount) },
    { icon: DollarSign, label: 'Ingresos pagados', value: formatPrice(stats.revenue) ?? '—' },
    { icon: TrendingUp, label: 'Unidades vendidas', value: String(stats.unitsSold) },
    { icon: PackageCheck, label: 'Productos con stock', value: String(stats.inStockCount) },
    {
      icon: Boxes,
      label: 'Valor de inventario',
      value: formatPrice(stats.inventoryValue) ?? '—',
      hint: 'Stock × costo de compra',
    },
    {
      icon: TrendingUp,
      label: 'Potencial de venta',
      value: formatPrice(stats.retailValue) ?? '—',
      hint: 'Stock × precio de lista',
    },
    {
      icon: AlertTriangle,
      label: 'Por reponer',
      value: String(stats.reorder.length),
      hint: 'Productos agotados',
    },
  ]

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <c.icon className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-wider text-white/50">{c.label}</p>
            </div>
            <p className="mt-4 font-display text-3xl uppercase tracking-tight text-white">{c.value}</p>
            {c.hint && <p className="mt-1 text-[11px] leading-relaxed text-white/35">{c.hint}</p>}
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        El <strong className="font-semibold text-white/60">valor de inventario</strong> usa el costo de
        compra de cada producto. El <strong className="font-semibold text-white/60">potencial de venta</strong>{' '}
        es lo que valdría todo el stock a precio de lista.
        {stats.missingCost > 0 &&
          ` ${stats.missingCost} producto(s) sin costo registrado no están incluidos en el valor de inventario.`}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* MÁS VENDIDOS */}
        <div className="card-surface p-6">
          <h3 className="font-display text-lg uppercase tracking-tight">Más vendidos</h3>
          {stats.bestSellers.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">
              Aún no hay pedidos pagados. Los más vendidos se calculan con las ventas reales.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {stats.bestSellers.map((p) => (
                <li key={p.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate pr-3 text-white/80">{p.name}</span>
                    <span className="shrink-0 font-semibold text-white">{p.qty} u.</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(p.qty / stats.maxSold) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* POR REPONER */}
        <div className="card-surface p-6">
          <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
            <AlertTriangle className="h-4 w-4 text-brand" /> Necesitan reponer stock
          </h3>
          {stats.reorder.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-300/80">No hay productos agotados.</p>
          ) : (
            <ul className="mt-5 divide-y divide-white/10">
              {stats.reorder.map((p) => {
                const out = !isAvailable(p)
                return (
                  <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="truncate pr-3 text-white/80">{p.name}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                        out
                          ? 'bg-brand/15 text-brand-300'
                          : 'bg-amber-300/15 text-amber-200',
                      )}
                    >
                      {out ? 'Agotado' : `Quedan ${p.stock}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {stats.lowStock.length > 0 && (
            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/40">
              {stats.lowStock.length} producto(s) están en sus últimas unidades ({LOW_STOCK} o menos).
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

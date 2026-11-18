import { Link } from 'react-router-dom'
import { ExternalLink, LogOut, Package, ShieldCheck, Truck, User } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useOrders } from '@/store/orders'
import { SHIPPING_CARRIER, trackingUrlFor } from '@/lib/shipping'
import { cn, formatPrice } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente de pago', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
  paid: { label: 'Pagado', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  failed: { label: 'Pago fallido', className: 'border-brand/40 bg-brand/10 text-brand-300' },
  refunded: { label: 'Reembolsado', className: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  expired: { label: 'Expirado', className: 'border-white/15 bg-white/5 text-white/50' },
  cancelled: { label: 'Cancelado', className: 'border-white/15 bg-white/5 text-white/50' },
}

export function Cuenta() {
  const { user, logout } = useAuth()
  const { orders } = useOrders()

  if (!user) return null

  const mine = orders.filter(
    (o) => o.userId === user.id || o.customer.email.toLowerCase() === user.email.toLowerCase(),
  )

  return (
    <div className="pt-[68px] lg:pt-20">
      <section className="border-b border-white/10 bg-ink-900">
        <div className="container-pm py-12 lg:py-16">
          <span className="eyebrow">Mi cuenta</span>
          <h1 className="display mt-3 text-3xl sm:text-4xl lg:text-5xl">Hola, {user.name}</h1>
          <p className="mt-3 text-sm text-white/55">{user.email}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {user.role === 'admin' && (
              <Link to="/admin" className="btn-primary !py-2.5 !text-[12px]">
                <ShieldCheck className="h-4 w-4" /> Panel de administración
              </Link>
            )}
            <button onClick={logout} className="btn-ghost !py-2.5 !text-[12px]">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      </section>

      <div className="container-pm py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl uppercase tracking-tight">Mis pedidos</h2>
            <p className="mt-1 text-xs text-white/45">
              Aquí se guardan tus compras y los datos de entrega de cada pedido.
            </p>
          </div>
          <Link to="/catalogo" className="btn-ghost !py-2.5 !text-[12px]">
            Seguir comprando
          </Link>
        </div>

        {mine.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <Package className="h-8 w-8 text-white/30" />
            <p className="text-sm text-white/55">Aún no tienes pedidos registrados.</p>
            <Link to="/catalogo" className="btn-primary mt-1">
              Explorar productos
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {mine.map((order) => {
              const status = STATUS[order.status] ?? STATUS.pending
              return (
                <li key={order.id} className="card-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Pedido <span className="font-mono text-white/60">{order.id.slice(0, 8).toUpperCase()}</span>
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {new Date(order.createdAt).toLocaleString('es-CO')}
                      </p>
                    </div>
                    <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider', status.className)}>
                      {status.label}
                    </span>
                  </div>

                  <ul className="mt-4 divide-y divide-white/10">
                    {order.items.map((item, index) => (
                      <li key={`${item.name}-${index}`} className="py-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-white/75">
                            {item.qty} × {item.name}
                          </span>
                          <span className="shrink-0 text-white/55">{formatPrice(item.price) ?? '—'}</span>
                        </div>
                        {Object.keys(item.selections ?? {}).length > 0 && (
                          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/35">
                            {Object.entries(item.selections)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' · ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {order.gifts.length > 0 && (
                    <p className="mt-3 rounded-xl border border-brand/20 bg-brand/[0.05] px-3 py-2 text-xs text-brand-300">
                      Regalos incluidos: {order.gifts.join(', ')}
                    </p>
                  )}

                  <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/55 sm:grid-cols-2">
                    <p className="flex items-start gap-2">
                      <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                      <span>
                        {order.customer.name}
                        {order.customer.document ? ` · CC ${order.customer.document}` : ''}
                      </span>
                    </p>
                    <p>{order.customer.phone}</p>
                    <p className="truncate">{order.customer.email}</p>
                    <p>{order.customer.city}</p>
                    <p className="sm:col-span-2">{order.customer.address}</p>
                    {order.customer.notes && (
                      <p className="sm:col-span-2 text-white/40">Notas: {order.customer.notes}</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-xs uppercase tracking-wider text-white/45">
                      {order.count} {order.count === 1 ? 'artículo' : 'artículos'}
                    </span>
                    <span className="font-display text-xl uppercase tracking-tight text-white">
                      {formatPrice(order.total) ?? 'Por confirmar'}
                    </span>
                  </div>

                  {order.trackingNumber ? (
                    <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-xs text-sky-100">
                      <p className="flex flex-wrap items-center gap-2">
                        <Truck className="h-4 w-4 shrink-0 text-sky-300" />
                        <span>
                          Guía <strong className="font-mono text-white">{order.trackingNumber}</strong>
                          {` · ${order.trackingCarrier?.trim() || SHIPPING_CARRIER}`}
                        </span>
                        <a
                          href={trackingUrlFor(order.trackingUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 font-semibold text-sky-300 transition hover:text-white"
                        >
                          Consultar <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </p>
                      <p className="mt-1.5 text-[11px] text-sky-100/60">
                        Ingresa la guía en el portal de {SHIPPING_CARRIER} para ver el recorrido de tu envío.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/35">
                      {order.status === 'paid'
                        ? 'Tu pago fue confirmado. Cargaremos el número de guía aquí cuando el pedido salga.'
                        : 'El seguimiento aparecerá cuando el pago esté confirmado y el pedido sea despachado.'}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

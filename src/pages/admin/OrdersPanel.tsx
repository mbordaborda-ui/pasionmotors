import { useMemo, useState } from 'react'
import { Check, CreditCard, ExternalLink, Gift, Package, Phone, Printer, Save, Search, Truck, User, XCircle } from 'lucide-react'
import { useOrders } from '@/store/orders'
import { supabase } from '@/lib/supabase'
import { openShippingLabel } from '@/lib/shipping-label'
import { SHIPPING_CARRIER, SHIPPING_TRACKING_URL } from '@/lib/shipping'
import { formatPrice } from '@/lib/utils'
import type { Order, OrderStatus } from '@/types'

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
  paid: { label: 'Pagado', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  failed: { label: 'Fallido', className: 'border-brand/40 bg-brand/10 text-brand-300' },
  refunded: { label: 'Reembolsado', className: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  expired: { label: 'Expirado', className: 'border-white/15 bg-white/5 text-white/50' },
  cancelled: { label: 'Cancelado', className: 'border-white/15 bg-white/5 text-white/50' },
}

function OrderCard({ order, onCancel }: { order: Order; onCancel?: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '')
  const [trackingCarrier, setTrackingCarrier] = useState(
    order.trackingCarrier ?? SHIPPING_CARRIER,
  )
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? SHIPPING_TRACKING_URL)
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingSaved, setTrackingSaved] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const { refresh } = useOrders()
  const status = STATUS[order.status] ?? STATUS.pending

  const saveTracking = async () => {
    setSavingTracking(true)
    setTrackingError('')
    setEmailNote('')
    const cleanNumber = trackingNumber.trim()
    const cleanUrl = trackingUrl.trim()
    const { error } = await supabase
      .from('orders')
      .update({
        tracking_number: cleanNumber || null,
        tracking_carrier: trackingCarrier.trim() || SHIPPING_CARRIER,
        tracking_url: cleanUrl || SHIPPING_TRACKING_URL,
        shipped_at: cleanNumber ? order.shippedAt ?? new Date().toISOString() : null,
      })
      .eq('id', order.id)
    if (error) {
      setSavingTracking(false)
      setTrackingError(error.message)
      return
    }
    await refresh()

    if (cleanNumber) {
      const { data, error: emailError } = await supabase.functions.invoke<{
        ok: boolean
        error?: string
      }>('send-order-email', { body: { orderId: order.id, type: 'shipping' } })
      if (emailError || !data?.ok) {
        setEmailNote(
          data?.error === 'not_configured'
            ? 'Guía guardada. Para enviarla por correo configura RESEND_API_KEY y ORDER_FROM_EMAIL.'
            : data?.error === 'order_not_paid'
              ? 'Guía guardada. El pedido aún no está pagado; el correo se envía cuando se confirme el pago.'
              : 'Guía guardada, pero no se pudo enviar el correo al cliente.',
        )
      } else {
        setEmailNote('Guía guardada y enviada al correo del cliente.')
      }
    }

    setSavingTracking(false)
    setTrackingSaved(true)
    window.setTimeout(() => setTrackingSaved(false), 1800)
    window.setTimeout(() => setEmailNote(''), 7000)
  }

  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-white">{order.id}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-white/45">{new Date(order.createdAt).toLocaleString('es-CO')}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.className}`}>
              {status.label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-xl uppercase tracking-tight text-white">
            {formatPrice(order.total) ?? 'Por confirmar'}
          </p>
          <p className="text-xs text-white/45">
            {order.count} {order.count === 1 ? 'artículo' : 'artículos'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <User className="h-4 w-4 text-brand" /> {order.customer.name}
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-brand" /> {order.customer.phone}
        </p>
        <p className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-brand" /> {order.customer.document || 'Sin documento'}
        </p>
        <p className="truncate">{order.customer.email}</p>
        <p className="sm:col-span-2 text-white/50">
          {order.customer.address}, {order.customer.city}
        </p>
      </div>

      {order.trackingNumber && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs text-sky-100">
          <Truck className="h-4 w-4 shrink-0 text-sky-300" />
          <span>
            Guía <strong className="font-mono text-white">{order.trackingNumber}</strong>
            {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ''}
          </span>
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-semibold text-sky-300 transition hover:text-white"
            >
              Consultar <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-semibold uppercase tracking-wider text-white/50 transition hover:text-white"
        >
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!openShippingLabel(order)) {
                alert('Permite las ventanas emergentes del navegador para imprimir la guía.')
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60 transition hover:border-brand hover:text-white"
            aria-label="Imprimir guía de envío"
            title="Imprimir guía de envío"
          >
            <Printer className="h-4 w-4" /> Guía
          </button>
          {onCancel && (
            <button
              onClick={async () => {
                if (cancelling) return
                if (!confirm('¿Cancelar este pedido pendiente? Se libera el stock reservado y la acción no se puede deshacer.')) {
                  return
                }
                setCancelling(true)
                await onCancel()
                setCancelling(false)
              }}
              disabled={cancelling}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50 transition hover:border-brand hover:text-brand disabled:opacity-50"
              aria-label="Cancelar pedido pendiente"
              title="Cancelar pedido y liberar stock"
            >
              <XCircle className="h-4 w-4" /> {cancelling ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <ul className="space-y-1.5 text-sm text-white/70">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.qty} × {it.name}
                  {Object.keys(it.selections).length > 0 && (
                    <span className="ml-2 text-xs text-white/40">
                      ({Object.entries(it.selections).map(([k, v]) => `${k}: ${v}`).join(', ')})
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(it.price) ?? '—'}</span>
              </li>
            ))}
          </ul>
          {order.gifts.length > 0 && (
            <div className="rounded-xl border border-brand/20 bg-brand/[0.05] p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
                <Gift className="h-3.5 w-3.5" /> Regalos incluidos
              </p>
              <ul className="mt-1.5 list-inside list-disc text-xs text-white/70">
                {order.gifts.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {order.customer.notes && (
            <p className="text-xs text-white/50">
              <span className="font-semibold text-white/70">Notas:</span> {order.customer.notes}
            </p>
          )}
          {order.paymentId && (
            <p className="text-xs text-white/40">
              <span className="font-semibold text-white/60">Pago:</span>{' '}
              <span className="font-mono">{order.paymentId}</span>
            </p>
          )}
          {order.termsAcceptedAt && (
            <p className="text-xs text-white/40">
              <span className="font-semibold text-white/60">Términos:</span> aceptados el{' '}
              {new Date(order.termsAcceptedAt).toLocaleString('es-CO')}
              {order.termsVersion ? ` · versión ${order.termsVersion}` : ''}
            </p>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              <Truck className="h-3.5 w-3.5 text-brand" /> Seguimiento del envío
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="field !py-2 !text-xs"
                placeholder="Número de guía"
              />
              <input
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                className="field !py-2 !text-xs"
                placeholder={SHIPPING_CARRIER}
              />
              <input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="field !py-2 !text-xs sm:col-span-2"
                placeholder={SHIPPING_TRACKING_URL}
                type="url"
              />
            </div>
            {trackingError && (
              <p className="mt-2 text-[11px] text-brand-300">No se pudo guardar: {trackingError}</p>
            )}
            {emailNote && (
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/80">{emailNote}</p>
            )}
            <button
              onClick={saveTracking}
              disabled={savingTracking}
              className={trackingSaved ? 'btn-primary mt-3 !py-2 !text-[11px] !bg-emerald-500' : 'btn-primary mt-3 !py-2 !text-[11px]'}
            >
              {trackingSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Guía guardada
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> {savingTracking ? 'Guardando...' : 'Guardar guía'}
                </>
              )}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-white/35">
              Al guardar el número de guía se envía automáticamente al cliente el correo con el
              enlace de {SHIPPING_CARRIER} (solo si el pedido está pagado). El cliente también verá
              la guía y el enlace en su cuenta y en la página de Envíos.
            </p>
            <button
              onClick={() => {
                if (!openShippingLabel(order)) {
                  alert('Permite las ventanas emergentes del navegador para imprimir la guía.')
                }
              }}
              className="btn-ghost mt-3 w-full !py-2 !text-[11px]"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir guía (100 × 150 mm)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function OrdersPanel() {
  const { orders, cancelOrder } = useOrders()
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q) ||
        (o.trackingNumber ?? '').toLowerCase().includes(q),
    )
  }, [orders, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-4 py-2">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente o pedido…"
            className="w-full bg-transparent py-1.5 text-sm text-white placeholder-white/40 outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-white/50">
        Los pedidos no se pueden eliminar: son el registro contable de la tienda. Si un pedido
        pendiente ya no se va a pagar, puedes <strong className="text-white/70">cancelarlo</strong> y
        el stock vuelve al inventario. Los pedidos pagados se conservan para garantías, facturación y
        auditoría.
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <Package className="h-8 w-8 text-white/30" />
          <p className="text-sm text-white/55">
            {orders.length === 0
              ? 'Aún no hay pedidos. Se registran al confirmar una compra en el checkout.'
              : 'No hay pedidos que coincidan con la búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onCancel={o.status === 'pending' ? () => cancelOrder(o.id).then(() => undefined) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

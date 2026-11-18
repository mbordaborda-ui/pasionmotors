import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  Lock,
  Package,
  Plus,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { useCart } from '@/store/cart'
import { useCatalog, type UnavailableItem } from '@/store/catalog'
import { useSettings } from '@/store/settings'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'
import { startCheckout } from '@/lib/payments'
import { Img } from '@/components/Img'
import { PromoMessages } from '@/components/PromoMessages'
import { ShippingMessage } from '@/components/ShippingMessage'
import { cn, formatPrice, isAvailable } from '@/lib/utils'
import { shippingBenefits } from '@/lib/promos'
import {
  ESTIMATED_SHIPPING,
  SHIPPING_CARRIER,
  SHIPPING_ESTIMATE_NOTE,
} from '@/lib/shipping'
import type { Product } from '@/types'

/** Mismo criterio que valida `create-checkout`: dominio con punto y extensión. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** Mensaje concreto según el dato que rechazó el servidor o el propio formulario. */
function customerErrorMessage(field?: string): string {
  switch (field) {
    case 'name':
      return 'Escribe tu nombre y apellido (mínimo 2 caracteres).'
    case 'email':
      return 'El correo no es válido. Debe incluir el dominio completo, por ejemplo: nombre@gmail.com'
    case 'phone':
      return 'Escribe un teléfono válido (mínimo 7 dígitos).'
    case 'document':
      return 'Escribe tu número de documento (mínimo 4 dígitos).'
    case 'address':
      return 'Escribe una dirección de entrega válida.'
    case 'city':
      return 'Escribe tu ciudad o municipio.'
    default:
      return 'Revisa tus datos de contacto e inténtalo de nuevo.'
  }
}

/** Devuelve el primer campo inválido del formulario, o `null` si todo está bien. */
function firstInvalidCustomer(customer: {
  name: string
  email: string
  phone: string
  document: string
  city: string
  address: string
}): string | null {
  if (customer.name.trim().length < 2) return 'name'
  if (!EMAIL_RE.test(customer.email.trim())) return 'email'
  if (customer.phone.replace(/\D/g, '').length < 7) return 'phone'
  if (customer.document.trim().length < 4) return 'document'
  if (customer.address.trim().length < 3) return 'address'
  if (customer.city.trim().length < 2) return 'city'
  return null
}

export function Checkout() {
  const { lines, subtotal, hasUnpricedItems, count, clear, addItem } = useCart()
  const { products } = useCatalog()
  const { activeGifts, site, activePromos } = useSettings()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const status = params.get('status')
  const orderRef = params.get('ref')

  const [unavailable, setUnavailable] = useState<UnavailableItem[]>([])
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedGifts, setSelectedGifts] = useState<string[]>(() =>
    activeGifts.map((g) => g.id),
  )
  // Clave de idempotencia estable mientras el carrito no cambie (evita duplicados).
  const idemRef = useRef<{ signature: string; key: string } | null>(null)
  const cartSignature = useMemo(
    () =>
      JSON.stringify({
        items: lines.map((l) => [l.productId, l.qty, l.selections]),
        gifts: [...selectedGifts].sort(),
      }),
    [lines, selectedGifts],
  )

  const subtotalLabel = formatPrice(subtotal)

  const minOrder = site.minOrder ?? 0

  const hasShirt = lines.some(
    (l) => products.find((p) => p.id === l.productId)?.category === 'camisetas',
  )
  const shipping = shippingBenefits(activePromos, subtotal, hasShirt)

  const crossSell = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.productId))
    return products
      .filter((p) => !inCart.has(p.id) && isAvailable(p))
      .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
      .slice(0, 8)
  }, [products, lines])

  // El carrito se vacía solo cuando el pago se confirma. Si el pago falla o
  // queda pendiente, se conserva para poder reintentar sin volver a armarlo.
  useEffect(() => {
    if (status === 'success') clear()
  }, [status, clear])

  if (status) return <CheckoutResultScreen status={status} orderRef={orderRef} />

  const toggleGift = (id: string) =>
    setSelectedGifts((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  if (lines.length === 0) {
    return (
      <div className="container-pm flex min-h-[75vh] flex-col items-center justify-center gap-4 pt-24 text-center">
        <h1 className="display text-3xl uppercase tracking-tight sm:text-4xl">Tu carrito está vacío</h1>
        <p className="max-w-sm text-sm text-white/55">
          Añade productos para continuar con la compra.
        </p>
        <Link to="/catalogo" className="btn-primary mt-2">
          Explorar productos
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-[68px] lg:pt-20">
      <div className="container-pm py-14">
        <span className="eyebrow">Finalizar compra</span>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Revisa tu pedido</h1>

        <PromoMessages compact className="mt-8" />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* FORM */}
          <div>
            <div className="card-surface p-6 lg:p-8">
              <h2 className="text-lg font-semibold text-white">Datos de contacto y envío</h2>
              <p className="mt-1 text-xs text-white/45">
                Completa tus datos para registrar el pedido y coordinar el pago y el envío.
              </p>
              <form
                className="mt-6 grid gap-4 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const customer = {
                    name: String(fd.get('name') ?? ''),
                    email: String(fd.get('email') ?? ''),
                    phone: String(fd.get('phone') ?? ''),
                    document: String(fd.get('document') ?? ''),
                    city: String(fd.get('city') ?? ''),
                    address: String(fd.get('address') ?? ''),
                    notes: String(fd.get('notes') ?? ''),
                  }

                  // Validación inmediata: evita un viaje al servidor para avisar
                  // de un correo incompleto (p. ej. «holaaa@gmail» sin .com).
                  const invalidField = firstInvalidCustomer(customer)
                  if (invalidField) {
                    setSubmitError(customerErrorMessage(invalidField))
                    const field = e.currentTarget.elements.namedItem(invalidField)
                    if (field instanceof HTMLElement) field.focus()
                    return
                  }

                  setSubmitError('')
                  setUnavailable([])
                  setSubmitting(true)

                  if (!idemRef.current || idemRef.current.signature !== cartSignature) {
                    idemRef.current = { signature: cartSignature, key: crypto.randomUUID() }
                  }

                  const res = await startCheckout({
                    idempotencyKey: idemRef.current.key,
                    items: lines.map((l) => ({
                      productId: l.productId,
                      qty: l.qty,
                      selections: l.selections,
                    })),
                    giftIds: selectedGifts,
                    termsAccepted: true,
                    termsVersion: site.legalUpdatedAt ?? '',
                    customer,
                  })

                  if (!res.ok) {
                    setSubmitting(false)
                    // Si el error es definitivo, el próximo intento usa una clave nueva.
                    if (res.error !== 'network') idemRef.current = null

                    if (res.error === 'unavailable') {
                      setUnavailable(res.unavailable ?? [])
                    } else if (res.error === 'rate_limited') {
                      setSubmitError(
                        'Has iniciado varios pedidos en muy poco tiempo. Espera unos minutos o escríbenos por WhatsApp para completar tu compra.',
                      )
                    } else if (res.error === 'terms_required') {
                      setSubmitError(
                        'Debes aceptar los términos y la política de datos personales para continuar.',
                      )
                    } else if (res.error === 'min_order') {
                      setSubmitError(
                        `El pedido mínimo es ${formatPrice(res.minOrder ?? minOrder)}. Ajusta tu carrito para continuar.`,
                      )
                    } else if (res.error === 'unpriced_product') {
                      setSubmitError(
                        `"${res.productName ?? 'Un producto'}" no tiene precio publicado. Escríbenos para completar tu compra.`,
                      )
                    } else if (res.error === 'invalid_customer') {
                      setSubmitError(customerErrorMessage(res.field))
                    } else if (res.error === 'invalid_items' || res.error === 'invalid_qty') {
                      setSubmitError('Revisa tu carrito: hay cantidades o productos no válidos.')
                    } else if (res.error === 'order_not_pending') {
                      setSubmitError(
                        'Este pedido ya no está disponible para pago. Vuelve a intentarlo desde el carrito.',
                      )
                    } else if (res.error === 'not_configured') {
                      setSubmitError(
                        'El pago en línea aún no está configurado. Escríbenos y completamos tu compra.',
                      )
                    } else {
                      setSubmitError(
                        'No pudimos iniciar el pago con Mercado Pago. Inténtalo de nuevo en unos minutos.',
                      )
                    }
                    return
                  }

                  // Redirección a la pasarela: los datos de tarjeta nunca pasan por la app.
                  window.location.assign(res.initPoint)
                }}
              >
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Nombre</label>
                  <input
                    required
                    name="name"
                    defaultValue={user?.name ?? ''}
                    className="field"
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                    Cédula / Documento de quien recibe
                  </label>
                  <input
                    required
                    name="document"
                    className="field"
                    placeholder="Número de documento"
                    inputMode="numeric"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Correo</label>
                  <input
                    required
                    type="email"
                    name="email"
                    defaultValue={user?.email ?? ''}
                    className="field"
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Teléfono</label>
                  <input required name="phone" className="field" placeholder="Celular / WhatsApp" />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Ciudad</label>
                  <input required name="city" className="field" placeholder="Ciudad / Municipio" />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Dirección</label>
                  <input required name="address" className="field" placeholder="Dirección de entrega" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Notas (opcional)</label>
                  <textarea
                    rows={3}
                    name="notes"
                    className="field resize-none"
                    placeholder="Referencias, horario de entrega, etc."
                  />
                </div>

                <div className="sm:col-span-2 mt-2 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-xs leading-relaxed text-emerald-100/80">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Al continuar serás redirigido a <strong className="text-white">Mercado Pago</strong> para
                    pagar de forma segura. El monto se calcula en el servidor y no almacenamos datos de
                    tarjeta.
                  </span>
                </div>

                {unavailable.length > 0 && (
                  <div className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-xs leading-relaxed text-white">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div>
                      <p className="font-semibold">No pudimos completar la compra:</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-white/80">
                        {unavailable.map((u) => (
                          <li key={u.productId}>
                            <span className="font-medium text-white">{u.name}</span>: pediste {u.requested}{' '}
                            {u.requested === 1 ? 'unidad' : 'unidades'} y solo {u.available === 0 ? 'no quedan' : `quedan ${u.available}`}.
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-white/60">Ajusta tu carrito para continuar.</p>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-xs leading-relaxed text-white">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{submitError}</span>
                  </div>
                )}

                <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-white/55">
                  <input
                    required
                    type="checkbox"
                    name="terms"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>
                    Acepto los{' '}
                    <Link
                      to="/politicas"
                      target="_blank"
                      className="text-brand-300 underline underline-offset-4 hover:text-white"
                    >
                      términos y condiciones
                    </Link>{' '}
                    y la{' '}
                    <Link
                      to="/politicas#datos"
                      target="_blank"
                      className="text-brand-300 underline underline-offset-4 hover:text-white"
                    >
                      política de tratamiento de datos personales
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary sm:col-span-2 mt-2 w-full disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />{' '}
                  {submitting ? 'Redirigiendo a Mercado Pago…' : 'Pagar con Mercado Pago'}
                </button>
              </form>
            </div>

            {/* REGALOS */}
            {activeGifts.length > 0 && (
              <div className="card-surface mt-6 p-6 lg:p-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Gift className="h-5 w-5 text-brand" /> Tus regalos
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Elige los regalos que quieres incluir con tu pedido. Sin costo adicional.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {activeGifts.map((g) => {
                    const checked = selectedGifts.includes(g.id)
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => toggleGift(g.id)}
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                          checked
                            ? 'border-brand bg-brand/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/25',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                            checked ? 'border-brand bg-brand text-white' : 'border-white/25',
                          )}
                        >
                          {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">{g.name}</span>
                          {g.description && (
                            <span className="mt-0.5 block text-xs leading-relaxed text-white/50">
                              {g.description}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SUMMARY */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="card-surface p-6">
              <h2 className="text-lg font-semibold text-white">
                Resumen <span className="text-white/40">({count})</span>
              </h2>
              <ul className="mt-5 space-y-4">
                {lines.map((line) => (
                  <li key={line.key} className="flex gap-3">
                    <Img src={line.image} alt={line.name} driveWidth={200} className="h-16 w-14 shrink-0 rounded-lg" label="Foto" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{line.name}</p>
                      <p className="text-xs text-white/45">Cantidad: {line.qty}</p>
                      <p className="mt-0.5 text-sm text-white/80">
                        {formatPrice(line.price) ?? (
                          <span className="text-xs text-amber-200/80">Por confirmar</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal productos</span>
                  <span className="text-white">{subtotalLabel ?? '—'}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Envío estimado · {SHIPPING_CARRIER}</span>
                  {shipping.free ? (
                    <span className="font-semibold text-emerald-300">¡Gratis!</span>
                  ) : (
                    <span className="text-white">{formatPrice(ESTIMATED_SHIPPING)}</span>
                  )}
                </div>
              </div>

              <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/45">
                {SHIPPING_ESTIMATE_NOTE}
              </p>

              <ShippingMessage shipping={shipping} hasShirt={hasShirt} className="mt-4" />

              {hasUnpricedItems && (
                <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
                  Hay productos sin precio publicado. El total se confirmará antes de cobrar.
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <span className="text-sm uppercase tracking-wider text-white/60">
                    Total a pagar ahora
                  </span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
                    Solo productos. El envío se paga al recibir el pedido.
                  </p>
                </div>
                <span className="font-display text-2xl uppercase tracking-tight">
                  {subtotalLabel ?? 'Por confirmar'}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
                <ShieldCheck className="h-4 w-4" /> Pago seguro con Mercado Pago. No almacenamos datos
                de tarjeta.
              </div>
              {site.city && (
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Envíos y pagos · {site.city}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CROSS-SELL */}
        {crossSell.length > 0 && (
          <section className="mt-16 border-t border-white/10 pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="eyebrow">Súmalo a tu pedido</span>
                <h2 className="display mt-3 text-2xl sm:text-3xl">
                  Productos que te <span className="text-brand">pueden interesar</span>
                </h2>
                <p className="mt-2 max-w-xl text-sm text-white/55">
                  Completa tu pedido con un detalle extra de la marca.
                </p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
              {crossSell.map((p) => (
                <CrossSellCard key={p.id} product={p} onAdd={() => addItem(p, {}, 1, true)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function CrossSellCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const price = formatPrice(product.price)
  const out = !isAvailable(product)
  return (
    <div className="group">
      <Link
        to={`/producto/${product.slug}`}
        className="block overflow-hidden rounded-2xl border border-white/10"
      >
        <Img
          src={product.images?.[0]}
          alt={product.name}
          driveWidth={500}
          className="aspect-square w-full"
          imgClassName="transition-transform duration-700 group-hover:scale-105"
          label="Foto"
        />
      </Link>
      <p className="mt-3 truncate text-sm font-medium text-white">{product.name}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white/90">
          {price ?? <span className="text-xs text-white/50">Por confirmar</span>}
        </span>
        <button
          onClick={onAdd}
          disabled={out}
          className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white shadow-red transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Añadir ${product.name} al carrito`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface ConfirmationItem {
  name: string
  qty: number
  price: number | null
  selections: Record<string, string> | null
}

interface OrderConfirmation {
  id: string
  status: string
  created_at: string
  customer_name: string | null
  customer_city: string | null
  subtotal: number
  total: number
  count: number
  currency: string
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_url: string | null
  items: ConfirmationItem[]
  gifts: string[]
}

function CheckoutResultScreen({ status, orderRef }: { status: string; orderRef: string | null }) {
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const [loading, setLoading] = useState(Boolean(orderRef))

  useEffect(() => {
    if (!orderRef) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.rpc('get_order_confirmation', {
            p_order_id: orderRef,
          }),
          15_000,
          'La confirmación del pedido tardó demasiado en cargar.',
        )
        if (!active) return
        if (!error && data) setOrder(data as OrderConfirmation)
      } catch (err) {
        console.error('[checkout.confirmation]', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [orderRef])

  // Mientras el pago está en proceso, refresca el estado unas cuantas veces.
  useEffect(() => {
    if (
      !orderRef ||
      !order ||
      order.status !== 'pending' ||
      (status !== 'success' && status !== 'pending')
    ) {
      return
    }
    let active = true
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts += 1
      const { data, error } = await supabase.rpc('get_order_confirmation', {
        p_order_id: orderRef,
      })
      if (active && !error && data) {
        const next = data as OrderConfirmation
        if (next.status !== 'pending') {
          setOrder(next)
          window.clearInterval(timer)
        }
      }
      if (attempts >= 6) window.clearInterval(timer)
    }, 4000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [orderRef, order?.status, status])

  const effectiveStatus =
    order?.status ?? (status === 'success' || status === 'pending' ? 'pending' : 'failed')
  const isPaid = effectiveStatus === 'paid'
  const isPending = effectiveStatus === 'pending'
  const isFailure = !isPaid && !isPending

  const title = isPaid
    ? '¡Compra confirmada!'
    : isPending
      ? 'Pago en proceso'
      : 'Pago no completado'

  return (
    <div className="container-pm flex min-h-[75vh] flex-col items-center justify-center gap-5 pb-16 pt-24 text-center">
      {isPaid && (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
      )}
      {isPending && (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-400/15 text-amber-300">
          <Clock className="h-8 w-8" />
        </div>
      )}
      {isFailure && (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand">
          <AlertTriangle className="h-8 w-8" />
        </div>
      )}

      <h1 className="display text-3xl uppercase tracking-tight sm:text-4xl">{title}</h1>

      <p className="max-w-lg text-sm leading-relaxed text-white/60">
        {isPaid &&
          'Tu pedido quedó registrado. Te enviaremos la confirmación y la guía de envío al correo de la compra.'}
        {isPending &&
          'Estamos confirmando el pago con Mercado Pago. Esta pantalla se actualizará cuando el pago sea aprobado.'}
        {isFailure &&
          'No se completó el cobro. Tu carrito se mantiene para que puedas intentarlo de nuevo o escribirnos si el cobro aparece en tu banco.'}
      </p>

      {loading && orderRef && (
        <span className="inline-flex items-center gap-2 text-xs text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu pedido…
        </span>
      )}

      {order && (
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-left sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Pedido
              </p>
              <p className="mt-1 font-mono text-sm text-white">{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="mt-1 text-[11px] text-white/40">
                {new Date(order.created_at).toLocaleString('es-CO')}
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {isPaid ? 'Pagado' : isPending ? 'Pendiente' : 'No completado'}
            </span>
          </div>

          <ul className="divide-y divide-white/10">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="py-2.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-white/85">
                    {item.qty} × {item.name}
                  </span>
                  <span className="shrink-0 text-white/70">{formatPrice(item.price) ?? '—'}</span>
                </div>
                {item.selections && Object.keys(item.selections).length > 0 && (
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

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-xs uppercase tracking-wider text-white/50">Total</span>
            <span className="font-display text-xl uppercase tracking-tight text-white">
              {formatPrice(order.total) ?? 'Por confirmar'}
            </span>
          </div>

          <p className="mt-3 text-xs text-white/45">
            <Package className="mr-1.5 inline h-3.5 w-3.5 text-brand" />
            Entrega: {order.customer_name ?? 'Confirmada'}
            {order.customer_city ? ` · ${order.customer_city}` : ''}
          </p>

          {order.tracking_number && (
            <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-xs text-sky-100">
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-sky-300" />
                Guía <strong className="font-mono text-white">{order.tracking_number}</strong>
                {order.tracking_carrier ? ` · ${order.tracking_carrier}` : ''}
              </p>
              {order.tracking_url && (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex font-semibold text-sky-300 hover:text-white"
                >
                  Consultar envío
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {user ? (
          <Link to="/cuenta" className="btn-primary mt-2">
            Ver mis pedidos
          </Link>
        ) : (
          <Link to="/login?next=/cuenta" className="btn-primary mt-2">
            Ingresar para ver mis pedidos
          </Link>
        )}
        {isFailure && (
          <Link to="/checkout" className="btn-ghost mt-2">
            Intentar de nuevo
          </Link>
        )}
        <Link to="/catalogo" className="btn-ghost mt-2">
          Seguir explorando
        </Link>
      </div>

      {orderRef && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">
          Pedido {orderRef.slice(0, 8).toUpperCase()}
        </p>
      )}
    </div>
  )
}
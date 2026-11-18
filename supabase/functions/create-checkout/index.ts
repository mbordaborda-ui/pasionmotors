// ============================================================================
// create-checkout · PASION MOTORS
// ----------------------------------------------------------------------------
// El cliente envía SOLO intención (ids, cantidades). El SERVIDOR:
//   1) valida el payload,
//   2) calcula precios, total y stock (RPC create_order),
//   3) crea la preferencia de pago en Mercado Pago,
//   4) devuelve la URL de pago.
// Los secretos (ACCESS_TOKEN) viven en variables de entorno de la función.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const MP_API = 'https://api.mercadopago.com'
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Desarrollo local y previews de Netlify: el origen debe reflejarse tal cual,
// porque Access-Control-Allow-Origin no admite comodines en subdominios.
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/
const NETLIFY_ORIGIN_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.netlify\.app$/i

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  const clean = origin.replace(/\/+$/, '')
  return (
    ALLOWED_ORIGINS.includes(clean) ||
    LOCAL_ORIGIN_RE.test(clean) ||
    NETLIFY_ORIGIN_RE.test(clean)
  )
}

/** Origen al que Mercado Pago devuelve al comprador tras pagar. */
function returnOrigin(origin: string | null): string {
  return isAllowedOrigin(origin) ? origin!.replace(/\/+$/, '') : SITE_URL
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin!.replace(/\/+$/, '') : ALLOWED_ORIGINS[0] ?? '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

type Selection = Record<string, string>

interface Item {
  productId: string
  qty: number
  selections: Selection
}

interface Payload {
  idempotencyKey: string
  items: Item[]
  giftIds: string[]
  termsAccepted: boolean
  termsVersion: string
  customer: {
    name: string
    email: string
    phone: string
    document: string
    city: string
    address: string
    notes?: string
  }
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Valida y normaliza. Devuelve el payload o un mensaje de error. */
function validate(
  raw: unknown,
): { ok: true; value: Payload } | { ok: false; code: string; field?: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, code: 'invalid_payload' }
  const body = raw as Record<string, unknown>

  const idempotencyKey = str(body.idempotencyKey, 100)
  if (idempotencyKey.length < 8) return { ok: false, code: 'invalid_payload' }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 40) {
    return { ok: false, code: 'invalid_items' }
  }
  const items: Item[] = []
  for (const entry of body.items) {
    if (!entry || typeof entry !== 'object') return { ok: false, code: 'invalid_items' }
    const it = entry as Record<string, unknown>
    const productId = str(it.productId, 40)
    const qty = Number(it.qty)
    if (!UUID_RE.test(productId)) return { ok: false, code: 'invalid_items' }
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { ok: false, code: 'invalid_items' }

    const selections: Selection = {}
    if (it.selections && typeof it.selections === 'object') {
      const entries = Object.entries(it.selections as Record<string, unknown>).slice(0, 10)
      for (const [k, v] of entries) {
        if (typeof v === 'string') selections[str(k, 40)] = v.trim().slice(0, 80)
      }
    }
    items.push({ productId, qty, selections })
  }

  const giftIds: string[] = []
  if (Array.isArray(body.giftIds)) {
    for (const g of body.giftIds.slice(0, 20)) {
      if (typeof g === 'string' && g.length > 0 && g.length <= 80) giftIds.push(g)
    }
  }

  const c = (body.customer ?? {}) as Record<string, unknown>
  const customer = {
    name: str(c.name, 160),
    email: str(c.email, 200).toLowerCase(),
    phone: str(c.phone, 40),
    document: str(c.document, 40),
    city: str(c.city, 120),
    address: str(c.address, 240),
    notes: str(c.notes, 1000),
  }
  // Se devuelve el campo que falla para que la tienda pueda señalar el dato
  // exacto en vez de un mensaje genérico.
  const customerError = (field: string) =>
    ({ ok: false as const, code: 'invalid_customer', field })
  if (customer.name.length < 2) return customerError('name')
  if (!EMAIL_RE.test(customer.email)) return customerError('email')
  if (customer.phone.replace(/\D/g, '').length < 7) return customerError('phone')
  if (customer.document.length < 4) return customerError('document')
  if (customer.address.length < 3) return customerError('address')
  if (customer.city.length < 2) return customerError('city')

  if (body.termsAccepted !== true) return { ok: false, code: 'terms_required' }

  return {
    ok: true,
    value: {
      idempotencyKey,
      items,
      giftIds,
      termsAccepted: true,
      termsVersion: str(body.termsVersion, 40),
      customer,
    },
  }
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Huella de la IP (nunca se guarda la IP en claro) para limitar abuso. */
async function ipHash(req: Request): Promise<string | null> {
  const raw =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    ''
  if (!raw) return null
  const secret = Deno.env.get('MP_WEBHOOK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!secret) return null
  return hmacHex(secret, `checkout-ip:${raw}`)
}

interface OrderItemOut {
  productId: string | null
  name: string
  qty: number
  price: number
  selections: Selection | null
}

interface OrderOut {
  id: string
  total: number
  subtotal: number
  count: number
  status: string
  currency: string
  items: OrderItemOut[]
}

function itemTitle(name: string, selections: Selection | null): string {
  const entries = Object.entries(selections ?? {})
  if (entries.length === 0) return name.slice(0, 250)
  return `${name} (${entries.map(([k, v]) => `${k}: ${v}`).join(', ')})`.slice(0, 250)
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin)

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN || !SITE_URL) {
    console.error('[create-checkout] faltan variables de entorno (SITE_URL / MP_ACCESS_TOKEN).')
    return json({ ok: false, error: 'not_configured' }, 500, origin)
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_payload' }, 400, origin)
  }

  const parsed = validate(raw)
  if (!parsed.ok) {
    return json(
      { ok: false, error: parsed.code, ...(parsed.field ? { field: parsed.field } : {}) },
      400,
      origin,
    )
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Identidad opcional y verificada (nunca se confía en un userId del cliente).
  let userId: string | null = null
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
  if (token && token !== ANON_KEY) {
    try {
      const { data } = await admin.auth.getUser(token)
      userId = data.user?.id ?? null
    } catch {
      userId = null
    }
  }

  // 1) Crear el pedido con montos calculados en el servidor.
  //    checkoutIpHash permite limitar abusos sin guardar la IP en claro.
  const { data, error } = await admin.rpc('create_order', {
    p_payload: { ...parsed.value, userId, checkoutIpHash: await ipHash(req) },
  })
  if (error) {
    console.error('[create-checkout] create_order:', error.message)
    return json({ ok: false, error: 'server_error' }, 500, origin)
  }

  const result = data as { ok: boolean; error?: string; unavailable?: unknown[]; minOrder?: number; subtotal?: number; productName?: string; order?: OrderOut } | null
  if (!result || !result.ok || !result.order) {
    return json(
      { ok: false, error: result?.error ?? 'server_error', unavailable: result?.unavailable, minOrder: result?.minOrder, productName: result?.productName },
      200,
      origin,
    )
  }
  const order = result.order

  // Solo se puede iniciar el pago de un pedido pendiente.
  if (order.status !== 'pending') {
    return json({ ok: false, error: 'order_not_pending', status: order.status }, 200, origin)
  }

  const cancel = async (reason: string) => {
    await admin.rpc('cancel_order', { p_order_id: order.id })
    console.error('[create-checkout] cancelado:', reason)
  }

  // 2) Construir los ítems de Mercado Pago con precios del servidor.
  const mpItems = order.items.map((it) => ({
    id: it.productId ?? it.name,
    title: itemTitle(it.name, it.selections),
    quantity: it.qty,
    unit_price: Math.round(it.price),
    currency_id: order.currency,
  }))
  const mpTotal = mpItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0)
  if (mpTotal !== Math.round(order.total)) {
    await cancel('mismatch entre total del pedido y de los ítems')
    return json({ ok: false, error: 'configuration_error' }, 500, origin)
  }

  // 3) Crear la preferencia de pago.
  const nameParts = parsed.value.customer.name.trim().split(/\s+/)
  const payerName = nameParts[0] || parsed.value.customer.name
  const payerSurname = nameParts.slice(1).join(' ') || undefined
  const backBase = returnOrigin(origin)
  // Mercado Pago rechaza `auto_return` si back_urls apunta a localhost/127.0.0.1.
  const canAutoReturn = !LOCAL_ORIGIN_RE.test(backBase)
  const preference = {
    items: mpItems,
    payer: {
      name: payerName,
      surname: payerSurname,
      email: parsed.value.customer.email,
      phone: { number: parsed.value.customer.phone },
      ...(parsed.value.customer.document
        ? { identification: { type: 'CC', number: parsed.value.customer.document } }
        : {}),
    },
    external_reference: order.id,
    notification_url: `${SUPABASE_URL}/functions/v1/payment-webhook`,
    back_urls: {
      success: `${backBase}/checkout?status=success&ref=${order.id}`,
      pending: `${backBase}/checkout?status=pending&ref=${order.id}`,
      failure: `${backBase}/checkout?status=failure&ref=${order.id}`,
    },
    ...(canAutoReturn ? { auto_return: 'approved' } : {}),
    statement_descriptor: 'PASION MOTORS',
    metadata: { order_id: order.id },
  }

  let mpResponse: Response
  try {
    mpResponse = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': parsed.value.idempotencyKey,
      },
      body: JSON.stringify(preference),
    })
  } catch (e) {
    await cancel(`error de red con Mercado Pago: ${(e as Error).message}`)
    return json({ ok: false, error: 'payment_provider_error' }, 502, origin)
  }

  if (!mpResponse.ok) {
    const detail = await mpResponse.text()
    await cancel(`Mercado Pago ${mpResponse.status}: ${detail.slice(0, 300)}`)
    return json({ ok: false, error: 'payment_provider_error' }, 502, origin)
  }

  const pref = (await mpResponse.json()) as { id?: string; init_point?: string; sandbox_init_point?: string }
  const isTest = MP_ACCESS_TOKEN.startsWith('TEST-')
  const initPoint = (isTest ? pref.sandbox_init_point : pref.init_point) ?? pref.init_point

  if (!initPoint) {
    await cancel('Mercado Pago no devolvió init_point')
    return json({ ok: false, error: 'payment_provider_error' }, 502, origin)
  }

  return json({ ok: true, orderId: order.id, total: order.total, initPoint }, 200, origin)
})

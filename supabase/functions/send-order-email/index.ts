// ============================================================================
// send-order-email · PASION MOTORS
// ----------------------------------------------------------------------------
// Envía la confirmación de compra y/o la guía de envío al correo del cliente.
//   POST { orderId: uuid, type: 'confirmation' | 'shipping' }
//
// Autorización:
//   · service_role (llamada desde payment-webhook)
//   · administrador autenticado (llamada desde el panel)
//
// Requiere:
//   RESEND_API_KEY
//   ORDER_FROM_EMAIL (o RESET_FROM_EMAIL como respaldo)
//   SITE_URL
//   TRACKING_URL (opcional: portal de rastreo; por defecto Interrapidísimo)
//   SHIPPING_CARRIER (opcional: nombre de la transportadora)
//   ORDER_EMAIL_TEST_TO (opcional: desvía los correos a un buzón de prueba)
//
// El correo de guía (type: 'shipping') SOLO se envía cuando el pedido está
// pagado y tiene `tracking_number`. Se dispara desde el panel al guardar la
// guía, e incluye el enlace https://siguetuenvio.interrapidisimo.com.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('ORDER_FROM_EMAIL') ?? Deno.env.get('RESET_FROM_EMAIL') ?? ''
const TEST_TO = (Deno.env.get('ORDER_EMAIL_TEST_TO') ?? '').trim()
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
// Portal de rastreo de la transportadora (Interrapidísimo). El cliente ingresa
// allí el número de guía. Se puede cambiar con la variable TRACKING_URL.
const TRACKING_URL = (
  Deno.env.get('TRACKING_URL') ?? 'https://siguetuenvio.interrapidisimo.com'
).replace(/\/+$/, '')
const SHIPPING_CARRIER = (Deno.env.get('SHIPPING_CARRIER') ?? 'Interrapidísimo').trim()
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '*'
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
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function money(value: unknown, currency: string): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return ''
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

interface EmailItem {
  name: string
  qty: number
  price: number | null
  selections: Record<string, string> | null
}

interface EmailOrder {
  id: string
  status: string
  created_at: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  customer_document: string | null
  customer_city: string | null
  customer_address: string | null
  notes: string | null
  total: number
  currency: string | null
  count: number
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_url: string | null
  order_items: EmailItem[]
  order_gifts: { name: string | null }[]
}

function itemLines(order: EmailOrder): string {
  return (order.order_items ?? [])
    .map((item) => {
      const selections = Object.entries(item.selections ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #262626;color:#e8e8e8;font-size:14px">
          ${escapeHtml(item.name)}${selections ? `<br><span style="color:#8a8a8a;font-size:11px">${escapeHtml(selections)}</span>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #262626;color:#b8b8b8;font-size:13px;text-align:center">${item.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #262626;color:#e8e8e8;font-size:13px;text-align:right">${escapeHtml(money(item.price, order.currency ?? 'COP'))}</td>
      </tr>`
    })
    .join('')
}

function emailHtml(order: EmailOrder, type: 'confirmation' | 'shipping'): string {
  const isShipping = type === 'shipping'
  const title = isShipping ? 'Tu pedido está en camino' : 'Pedido confirmado'
  const intro = isShipping
    ? 'Ya despachamos tu pedido. Aquí tienes el número de guía para seguirlo.'
    : 'Recibimos tu pago y tu pedido quedó confirmado. Gracias por ser parte de PASION MOTORS.'
  const gifts = (order.order_gifts ?? []).map((gift) => gift.name).filter(Boolean)
  const accountUrl = SITE_URL ? `${SITE_URL}/cuenta` : ''
  const carrier = order.tracking_carrier?.trim() || SHIPPING_CARRIER
  const trackingUrl = order.tracking_url?.trim() || TRACKING_URL

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:36px 22px">
      <p style="margin:0 0 24px;color:#ed1c24;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase">PASION MOTORS</p>
      <h1 style="margin:0 0 12px;font-size:27px;line-height:1.2;color:#fff">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;color:#b8b8b8;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>

      <div style="border:1px solid #2a2a2a;border-radius:16px;background:#141414;padding:22px">
        <p style="margin:0 0 4px;color:#777;font-size:10px;letter-spacing:2px;text-transform:uppercase">Pedido</p>
        <p style="margin:0 0 2px;color:#fff;font-size:16px;font-weight:700">#${escapeHtml(order.id.slice(0, 8).toUpperCase())}</p>
        <p style="margin:0;color:#777;font-size:12px">${escapeHtml(new Date(order.created_at).toLocaleString('es-CO'))}</p>

        <table style="width:100%;border-collapse:collapse;margin-top:18px">
          <thead>
            <tr>
              <th style="text-align:left;padding-bottom:6px;color:#777;font-size:10px;letter-spacing:1px;text-transform:uppercase">Producto</th>
              <th style="text-align:center;padding-bottom:6px;color:#777;font-size:10px;letter-spacing:1px;text-transform:uppercase">Cant.</th>
              <th style="text-align:right;padding-bottom:6px;color:#777;font-size:10px;letter-spacing:1px;text-transform:uppercase">Precio</th>
            </tr>
          </thead>
          <tbody>${itemLines(order)}</tbody>
        </table>

        <p style="margin:16px 0 0;text-align:right;color:#fff;font-size:19px;font-weight:700">Total: ${escapeHtml(money(order.total, order.currency ?? 'COP'))}</p>

        ${
          gifts.length > 0
            ? `<p style="margin:12px 0 0;color:#f3b3b6;font-size:12px">Regalos incluidos: ${escapeHtml(gifts.join(', '))}</p>`
            : ''
        }
      </div>

      ${
        isShipping
          ? `<div style="margin-top:18px;border:1px solid #334155;border-radius:16px;background:#101827;padding:22px">
              <p style="margin:0 0 8px;color:#93c5fd;font-size:10px;letter-spacing:2px;text-transform:uppercase">Seguimiento</p>
              <p style="margin:0;color:#fff;font-size:22px;font-weight:700;font-family:Consolas,monospace">${escapeHtml(order.tracking_number ?? '')}</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px">${escapeHtml(carrier)}</p>
              <p style="margin:16px 0 0">
                <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#ed1c24;color:#fff;text-decoration:none;border-radius:999px;padding:11px 20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Rastrear mi envío</a>
              </p>
              <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">
                Ingresa la guía <strong style="color:#fff">${escapeHtml(order.tracking_number ?? '')}</strong> en
                <a href="${escapeHtml(trackingUrl)}" style="color:#93c5fd;text-decoration:none">${escapeHtml(trackingUrl.replace(/^https?:\/\//, ''))}</a>
                para ver el recorrido de tu pedido con ${escapeHtml(carrier)}.
              </p>
            </div>`
          : ''
      }

      <div style="margin-top:18px;border:1px solid #2a2a2a;border-radius:16px;background:#141414;padding:22px">
        <p style="margin:0 0 8px;color:#777;font-size:10px;letter-spacing:2px;text-transform:uppercase">Entrega</p>
        <p style="margin:0;color:#fff;font-size:14px;font-weight:700">${escapeHtml(order.customer_name)}</p>
        ${order.customer_document ? `<p style="margin:3px 0 0;color:#aaa;font-size:12px">Documento: ${escapeHtml(order.customer_document)}</p>` : ''}
        <p style="margin:3px 0 0;color:#aaa;font-size:12px">${escapeHtml(order.customer_address ?? '')}</p>
        <p style="margin:3px 0 0;color:#aaa;font-size:12px">${escapeHtml(order.customer_city ?? '')}</p>
        ${order.customer_phone ? `<p style="margin:3px 0 0;color:#aaa;font-size:12px">Tel: ${escapeHtml(order.customer_phone)}</p>` : ''}
        ${order.notes ? `<p style="margin:8px 0 0;color:#777;font-size:11px">Notas: ${escapeHtml(order.notes)}</p>` : ''}
      </div>

      ${
        accountUrl
          ? `<p style="margin:24px 0 0;text-align:center"><a href="${escapeHtml(accountUrl)}" style="color:#ed1c24;font-size:13px;font-weight:700;text-decoration:none">Ver mis pedidos en PASION MOTORS</a></p>`
          : ''
      }
      <p style="margin:24px 0 0;color:#666;font-size:11px;line-height:1.6;text-align:center">
        Si tienes dudas, responde a este correo o escríbenos desde la tienda.
      </p>
    </div>
  </body>
</html>`
}

function emailText(order: EmailOrder, type: 'confirmation' | 'shipping'): string {
  const lines = (order.order_items ?? [])
    .map((item) => `${item.qty} x ${item.name}`)
    .join('\n')
  const carrier = order.tracking_carrier?.trim() || SHIPPING_CARRIER
  const trackingUrl = order.tracking_url?.trim() || TRACKING_URL
  const tracking = type === 'shipping' && order.tracking_number
    ? `\nGuía: ${order.tracking_number} (${carrier})\nRastrea tu envío: ${trackingUrl}\nIngresa la guía ${order.tracking_number} en el portal de ${carrier}.`
    : ''
  return `PASION MOTORS\n\n${
    type === 'shipping' ? 'Tu pedido está en camino' : 'Pedido confirmado'
  }\nPedido #${order.id.slice(0, 8).toUpperCase()}\n\n${lines}\n\nTotal: ${money(order.total, order.currency ?? 'COP')}${tracking}\n\nEntrega: ${order.customer_name}, ${order.customer_address ?? ''}, ${order.customer_city ?? ''}`
}

async function isAdminToken(token: string): Promise<boolean> {
  if (!token || !ANON_KEY) return false
  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await userClient.auth.getUser(token)
    if (error || !data.user) return false
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()
    return profile?.role === 'admin'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin)

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ ok: false, error: 'not_configured' }, 500, origin)
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  const authorized = token === SERVICE_ROLE || (await isAdminToken(token))
  if (!authorized) return json({ ok: false, error: 'unauthorized' }, 401, origin)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'invalid_payload' }, 400, origin)
  }

  const orderId = String(body.orderId ?? '').trim()
  const type = body.type === 'shipping' ? 'shipping' : 'confirmation'
  if (!UUID_RE.test(orderId)) return json({ ok: false, error: 'invalid_order' }, 400, origin)

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return json({ ok: false, error: 'not_configured', missing: ['RESEND_API_KEY', 'ORDER_FROM_EMAIL'] }, 503, origin)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin
    .from('orders')
    .select('*, order_items ( name, qty, price, selections ), order_gifts ( name )')
    .eq('id', orderId)
    .maybeSingle()

  if (error) return json({ ok: false, error: 'server_error' }, 500, origin)
  if (!data) return json({ ok: false, error: 'not_found' }, 404, origin)

  const order = data as unknown as EmailOrder
  if (type === 'shipping' && order.status !== 'paid') {
    return json({ ok: false, error: 'order_not_paid' }, 400, origin)
  }
  if (type === 'shipping' && !order.tracking_number) {
    return json({ ok: false, error: 'tracking_missing' }, 400, origin)
  }

  const subject =
    type === 'shipping'
      ? `Tu pedido está en camino · ${order.id.slice(0, 8).toUpperCase()}`
      : `Pedido confirmado · ${order.id.slice(0, 8).toUpperCase()}`

  // Mientras se verifica el dominio propio, todos los correos pueden ir a un
  // buzón de prueba. Elimina ORDER_EMAIL_TEST_TO para enviar a clientes.
  const recipient = TEST_TO || order.customer_email

  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipient],
        subject,
        html: emailHtml(order, type),
        text: emailText(order, type),
      }),
    })
  } catch (err) {
    console.error('[send-order-email] red:', (err as Error).message)
    return json({ ok: false, error: 'email_failed' }, 502, origin)
  }

  if (!res.ok) {
    const detail = await res.text()
    console.error('[send-order-email] Resend respondió', res.status, detail.slice(0, 300))
    return json({ ok: false, error: 'email_failed' }, 502, origin)
  }

  return json({ ok: true, type, to: recipient, test: Boolean(TEST_TO) }, 200, origin)
})

// ============================================================================
// payment-webhook · PASION MOTORS
// ----------------------------------------------------------------------------
// Recibe las notificaciones de Mercado Pago. Es la ÚNICA fuente de verdad del
// pago. Nunca confía en el cuerpo de la notificación:
//   1) verifica la firma x-signature (HMAC-SHA256),
//   2) consulta el pago real a la API de Mercado Pago,
//   3) confirma la orden comparando monto y moneda (RPC mark_order_payment).
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET') ?? ''

const MP_API = 'https://api.mercadopago.com'
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function parseSignature(header: string): { ts: string; v1: string } {
  const out: Record<string, string> = {}
  for (const part of header.split(',')) {
    const [k, v] = part.split('=')
    if (k && v) out[k.trim()] = v.trim()
  }
  return { ts: out.ts ?? '', v1: out.v1 ?? '' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const url = new URL(req.url)
  const type = (body.type as string) ?? (body.topic as string) ??
    url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  const dataId = String(
    (body.data as Record<string, unknown> | undefined)?.id ??
      url.searchParams.get('data.id') ??
      url.searchParams.get('id') ??
      '',
  )

  // Solo se procesan pagos.
  if (type !== 'payment' || !dataId) return new Response('ignored', { status: 200 })
  if (!MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET) {
    console.error('[payment-webhook] faltan MP_ACCESS_TOKEN o MP_WEBHOOK_SECRET')
    return new Response('not_configured', { status: 500 })
  }

  // 1) Verificar firma. Sin firma válida no se procesa ningún pago.
  {
    const { ts, v1 } = parseSignature(req.headers.get('x-signature') ?? '')
    const requestId = req.headers.get('x-request-id') ?? ''
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
    const expected = await hmacHex(MP_WEBHOOK_SECRET, manifest)
    if (!ts || !v1 || !timingSafeEqual(expected, v1)) {
      console.warn('[payment-webhook] firma inválida')
      return new Response('invalid_signature', { status: 401 })
    }
  }

  // 2) Consultar el pago real a Mercado Pago.
  let payment: Record<string, unknown>
  try {
    const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!res.ok) throw new Error(`MP ${res.status}`)
    payment = (await res.json()) as Record<string, unknown>
  } catch (e) {
    console.error('[payment-webhook] no se pudo consultar el pago:', (e as Error).message)
    return new Response('error', { status: 500 }) // MP reintentará
  }

  const reference = String(payment.external_reference ?? '')
  if (!reference) return new Response('no_reference', { status: 200 })

  const status = String(payment.status ?? '')
  const amount = Number(payment.transaction_amount ?? 0)
  const currency = String(payment.currency_id ?? '')
  const paymentId = String(payment.id ?? dataId)

  // 3) Confirmar la orden (idempotente, con validación de monto/moneda).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.rpc('mark_order_payment', {
    p_reference: reference,
    p_provider: 'mercadopago',
    p_payment_id: paymentId,
    p_amount: amount,
    p_currency: currency,
    p_status: status,
  })

  if (error) {
    console.error('[payment-webhook] mark_order_payment:', error.message)
    return new Response('error', { status: 500 })
  }

  const res = data as { ok: boolean; error?: string; status?: string; already?: boolean } | null
  if (!res?.ok) {
    // No reintentar por discrepancias: se registran para revisión manual.
    console.warn('[payment-webhook] rechazado:', reference, res?.error, status, amount)
    try {
      await admin.rpc('log_payment_issue', {
        p_order_id: UUID_RE.test(reference) ? reference : null,
        p_provider: 'mercadopago',
        p_payment_id: paymentId.slice(0, 120),
        p_reference: reference.slice(0, 200),
        p_amount: Number.isFinite(amount) ? amount : null,
        p_currency: currency.slice(0, 10),
        p_status: status.slice(0, 40),
        p_error: (res?.error ?? 'unknown').slice(0, 200),
      })
    } catch (e) {
      console.error('[payment-webhook] no se pudo registrar la incidencia:', (e as Error).message)
    }
    return new Response('rejected', { status: 200 })
  }

  // Los correos se envían manualmente desde el panel al guardar la guía:
  // el cliente recibe la confirmación y el número de guía en un solo correo.
  // No se envía nada automáticamente al aprobarse el pago.

  console.log('[payment-webhook] ok:', reference, '->', res.status)
  return new Response('ok', { status: 200 })
})

// ============================================================================
// request-password-reset · PASION MOTORS
// ----------------------------------------------------------------------------
// Recibe { email }. Si el correo existe:
//   1) genera un código de 6 dígitos (criptográfico),
//   2) guarda solo su hash HMAC (caduca en 15 min, 5 intentos),
//   3) lo envía desde el servidor con Resend (recomendado) o EmailJS.
// La respuesta normaliza el tiempo para no revelar si el correo existe. Si el
// proveedor de correo falla, se invalida el código y se devuelve email_failed
// para que el usuario sepa que debe reintentar o contactar a la tienda.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID') ?? ''
const EMAILJS_TEMPLATE_ID = Deno.env.get('EMAILJS_TEMPLATE_ID') ?? ''
const EMAILJS_PUBLIC_KEY = Deno.env.get('EMAILJS_PUBLIC_KEY') ?? ''
const EMAILJS_PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Se reutiliza el remitente verificado de los pedidos si no hay uno específico
// para recuperación; así el código deja de fallar por una variable faltante.
const RESET_FROM_EMAIL =
  Deno.env.get('RESET_FROM_EMAIL') ?? Deno.env.get('ORDER_FROM_EMAIL') ?? ''
const PEPPER = Deno.env.get('PASSWORD_RESET_PEPPER') ?? ''

const HAS_EMAILJS = Boolean(
  EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY,
)
const HAS_RESEND = Boolean(RESEND_API_KEY && RESET_FROM_EMAIL)

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_RESPONSE_MS = 1500
const MAX_JITTER_MS = 300
const EMAIL_TIMEOUT_MS = 10000

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
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
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

/**
 * 6 dígitos sin sesgo de módulo (rejection sampling).
 */
function generateCode(): string {
  const buf = new Uint32Array(1)
  const space = 0x1_0000_0000
  const limit = Math.floor(space / 1_000_000) * 1_000_000
  let n = 0
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % 1_000_000).padStart(6, '0')
}

function resetEmailHtml(code: string, ttlMinutes: number): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:36px 24px">
      <p style="margin:0 0 22px;color:#ed1c24;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase">PASION MOTORS</p>
      <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2">Recupera tu contraseña</h1>
      <p style="margin:0 0 24px;color:#b8b8b8;font-size:15px;line-height:1.6">Usa este código para crear una nueva contraseña. Vence en ${ttlMinutes} minutos y solo puede usarse una vez.</p>
      <div style="border:1px solid #333;border-radius:14px;background:#151515;padding:24px;text-align:center">
        <p style="margin:0 0 8px;color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase">Código de seguridad</p>
        <p style="margin:0;font-family:Consolas,monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:#ffffff">${code}</p>
      </div>
      <p style="margin:24px 0 0;color:#777;font-size:12px;line-height:1.6">Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual seguirá funcionando.</p>
    </div>
  </body>
</html>`
}

async function sendWithResend(payload: {
  email: string
  code: string
  ttlMinutes: number
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        from: RESET_FROM_EMAIL,
        to: [payload.email],
        subject: 'Código de recuperación · PASION MOTORS',
        html: resetEmailHtml(payload.code, payload.ttlMinutes),
        text: `Tu código de recuperación de PASION MOTORS es ${payload.code}. Vence en ${payload.ttlMinutes} minutos y solo puede usarse una vez.`,
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('[request-password-reset] Resend respondió', res.status, detail.slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[request-password-reset] Resend red:', (e as Error).message)
    return false
  }
}

async function sendWithEmailJs(payload: {
  email: string
  code: string
  ttlMinutes: number
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: payload.email,
          email: payload.email,
          user_email: payload.email,
          passcode: payload.code,
          code: payload.code,
          expires_minutes: String(payload.ttlMinutes),
          app_name: 'PASION MOTORS',
        },
      }),
    })
    if (!res.ok) {
      console.error('[request-password-reset] EmailJS respondió', res.status)
      return false
    }
    return true
  } catch (e) {
    console.error('[request-password-reset] EmailJS red:', (e as Error).message)
    return false
  }
}

async function sendResetCode(payload: {
  email: string
  code: string
  ttlMinutes: number
}): Promise<boolean> {
  if (HAS_RESEND) {
    const ok = await sendWithResend(payload)
    if (ok) return true
    if (!HAS_EMAILJS) return false
    console.warn('[request-password-reset] Resend falló; probando EmailJS.')
  }
  if (HAS_EMAILJS) return sendWithEmailJs(payload)
  return false
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const startedAt = Date.now()

  // Normaliza el tiempo de respuesta para las rutas que dependen del correo.
  const finish = async (body: unknown, status = 200): Promise<Response> => {
    const target = MIN_RESPONSE_MS + Math.floor(Math.random() * MAX_JITTER_MS)
    const wait = target - (Date.now() - startedAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    return json(body, status, origin)
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin)

  if (!SUPABASE_URL || !SERVICE_ROLE || !PEPPER) {
    console.error('[request-password-reset] faltan secretos (PASSWORD_RESET_PEPPER).')
    return json({ ok: false, error: 'not_configured' }, 503, origin)
  }
  if (!HAS_RESEND && !HAS_EMAILJS) {
    console.error(
      '[request-password-reset] falta configurar correo: usa RESEND_API_KEY + RESET_FROM_EMAIL o las claves de EmailJS.',
    )
    return json({ ok: false, error: 'not_configured' }, 503, origin)
  }

  let body: { email?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_payload' }, 400, origin)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400, origin)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userId, error: findError } = await admin.rpc('find_user_by_email', { p_email: email })
  if (findError) {
    console.error('[request-password-reset] find_user_by_email:', findError.message)
    return finish({ ok: true })
  }

  // Respuesta genérica si el correo no existe (anti-enumeración).
  if (!userId) return finish({ ok: true })

  const code = generateCode()
  const codeHash = await hmacHex(PEPPER, `${email}:${code}`)

  const rawIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    ''
  // Solo se persiste un hash de la IP (nunca la IP en claro).
  const ipHash = rawIp ? await hmacHex(PEPPER, `ip:${rawIp}`) : ''

  const { data: created, error: createError } = await admin.rpc('create_password_reset', {
    p_user_id: userId,
    p_email: email,
    p_code_hash: codeHash,
    p_ttl_minutes: 15,
    p_ip: ipHash,
  })

  if (createError) {
    console.error('[request-password-reset] create_password_reset:', createError.message)
    return finish({ ok: true })
  }

  const result = created as { ok: boolean; id?: string; ttlMinutes?: number } | null
  // Rate limit: respuesta genérica para no dar pistas.
  if (!result?.ok || !result.id) return finish({ ok: true })

  const sent = await sendResetCode({
    email,
    code,
    ttlMinutes: result.ttlMinutes ?? 15,
  })

  if (!sent) {
    // El código no llegó: se invalida para que no quede utilizable.
    await admin.rpc('consume_password_reset', { p_reset_id: result.id })
    return finish({ ok: false, error: 'email_failed' }, 502)
  }

  return finish({ ok: true })
})

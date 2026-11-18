// ============================================================================
// reset-password · PASION MOTORS
// ----------------------------------------------------------------------------
// Recibe { email, code, password }.
//   1) valida el código (hash HMAC, caducidad, intentos),
//   2) lo consume de forma atómica (un solo uso),
//   3) cambia la contraseña con la Admin API de Supabase (service_role).
// La contraseña viaja por HTTPS y nunca se guarda en la base de la app.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)
const PEPPER = Deno.env.get('PASSWORD_RESET_PEPPER') ?? ''

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CODE_RE = /^\d{6}$/

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

function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'weak_password'
  if (password.length > 72) return 'weak_password'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'weak_password'
  return null
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin)

  if (!SUPABASE_URL || !SERVICE_ROLE || !PEPPER) {
    console.error('[reset-password] faltan secretos (PASSWORD_RESET_PEPPER).')
    return json({ ok: false, error: 'not_configured' }, 503, origin)
  }

  let body: { email?: unknown; code?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_payload' }, 400, origin)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400, origin)
  if (!CODE_RE.test(code)) return json({ ok: false, error: 'invalid_code' }, 400, origin)
  const problem = passwordProblem(password)
  if (problem) return json({ ok: false, error: problem }, 400, origin)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const codeHash = await hmacHex(PEPPER, `${email}:${code}`)

  const { data: verified, error: verifyError } = await admin.rpc('verify_password_reset', {
    p_email: email,
    p_code_hash: codeHash,
  })
  if (verifyError) {
    console.error('[reset-password] verify_password_reset:', verifyError.message)
    return json({ ok: false, error: 'server_error' }, 500, origin)
  }

  const v = verified as { ok: boolean; error?: string; resetId?: string; userId?: string } | null
  if (!v?.ok) {
    return json({ ok: false, error: v?.error ?? 'invalid_code' }, 400, origin)
  }

  const { data: consumed, error: consumeError } = await admin.rpc('consume_password_reset', {
    p_reset_id: v.resetId,
  })
  if (consumeError) {
    console.error('[reset-password] consume_password_reset:', consumeError.message)
    return json({ ok: false, error: 'server_error' }, 500, origin)
  }
  if (!consumed) return json({ ok: false, error: 'invalid_code' }, 400, origin)

  const { error: updateError } = await admin.auth.admin.updateUserById(v.userId!, { password })
  if (updateError) {
    console.error('[reset-password] updateUserById:', updateError.message)
    const weak = /weak|password/i.test(updateError.message) && /policy|weak/i.test(updateError.message)
    return json({ ok: false, error: weak ? 'weak_password' : 'server_error' }, weak ? 400 : 500, origin)
  }

  return json({ ok: true }, 200, origin)
})

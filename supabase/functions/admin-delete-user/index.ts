// ============================================================================
// admin-delete-user · PASION MOTORS
// ----------------------------------------------------------------------------
// Elimina una cuenta COMPLETA (auth.users + perfil + datos en cascada).
// Solo puede ejecutarla un administrador autenticado.
//
// Antes el panel solo borraba la fila de `profiles`: la cuenta seguía existiendo
// en Supabase Auth y la persona podía seguir iniciando sesión. Esto lo corrige.
//
//   POST { userId: "<uuid>" }
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin)
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ ok: false, error: 'not_configured' }, 500, origin)
  }

  // 1) Verificar la sesión del solicitante.
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json({ ok: false, error: 'unauthorized' }, 401, origin)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const caller = authData?.user
  if (authError || !caller) return json({ ok: false, error: 'unauthorized' }, 401, origin)

  // 2) Debe ser administrador (se consulta con service_role para evitar RLS).
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()

  if (profileError) {
    console.error('[admin-delete-user] profiles:', profileError.message)
    return json({ ok: false, error: 'server_error' }, 500, origin)
  }
  if (profile?.role !== 'admin') return json({ ok: false, error: 'not_allowed' }, 403, origin)

  // 3) Validar el objetivo.
  let body: { userId?: unknown }
  try {
    body = (await req.json()) as { userId?: unknown }
  } catch {
    return json({ ok: false, error: 'invalid_payload' }, 400, origin)
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!UUID_RE.test(userId)) return json({ ok: false, error: 'invalid_user' }, 400, origin)
  if (userId === caller.id) return json({ ok: false, error: 'cannot_delete_self' }, 400, origin)

  // 4) Eliminar la cuenta de Auth (el perfil se borra en cascada).
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('[admin-delete-user] deleteUser:', deleteError.message)
    return json({ ok: false, error: 'delete_failed' }, 500, origin)
  }

  return json({ ok: true }, 200, origin)
})

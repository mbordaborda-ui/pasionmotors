// ============================================================================
// email-health · PASION MOTORS
// ----------------------------------------------------------------------------
// Devuelve únicamente si los proveedores de correo están configurados.
// No expone claves, correos ni secretos. Se usa en el panel de administración.
// ============================================================================

const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? SITE_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const hasResend = Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RESET_FROM_EMAIL'))
const hasEmailJs = Boolean(
  Deno.env.get('EMAILJS_SERVICE_ID') &&
    Deno.env.get('EMAILJS_TEMPLATE_ID') &&
    Deno.env.get('EMAILJS_PUBLIC_KEY') &&
    Deno.env.get('EMAILJS_PRIVATE_KEY'),
)
const hasPepper = Boolean(Deno.env.get('PASSWORD_RESET_PEPPER'))
const hasSiteUrl = Boolean(SITE_URL)

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

Deno.serve((req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  return json(
    {
      ok: true,
      ready: hasPepper && hasSiteUrl && (hasResend || hasEmailJs),
      provider: hasResend ? 'resend' : hasEmailJs ? 'emailjs' : null,
      resend: hasResend,
      emailjs: hasEmailJs,
      pepper: hasPepper,
      siteUrl: hasSiteUrl,
    },
    origin,
  )
})

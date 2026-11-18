import { supabase } from '@/lib/supabase'

export interface PasswordResetResponse {
  ok: boolean
  error?: string
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body })
  if (error) {
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const parsed = (await ctx.json()) as T
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      // sin cuerpo útil
    }
    return { ok: false, error: 'network' } as T
  }
  return (data ?? { ok: false, error: 'server_error' }) as T
}

function translateAuthError(message: string): string {
  const value = message.toLowerCase()
  if (value.includes('rate') || value.includes('security purposes') || value.includes('too many')) {
    return 'rate_limited'
  }
  if (value.includes('redirect') || value.includes('url')) return 'redirect_not_allowed'
  if (value.includes('session') || value.includes('token')) return 'session_missing'
  return 'link_failed'
}

/** Pide un código de recuperación. La respuesta es genérica (no revela si el correo existe). */
export function requestResetCode(email: string): Promise<PasswordResetResponse> {
  return invoke<PasswordResetResponse>('request-password-reset', { email })
}

/** Cambia la contraseña usando el código recibido por correo. */
export function resetPasswordWithCode(
  email: string,
  code: string,
  password: string,
): Promise<PasswordResetResponse> {
  return invoke<PasswordResetResponse>('reset-password', { email, code, password })
}

/**
 * Respaldo con el correo nativo de Supabase Auth. Se usa cuando no hay un
 * proveedor de códigos configurado (Resend/EmailJS). El usuario recibe un
 * enlace y define la contraseña en esta misma página.
 */
export async function sendPasswordResetLink(email: string): Promise<PasswordResetResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/recuperar`,
    })
    if (error) return { ok: false, error: translateAuthError(error.message) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Cambia la contraseña de la sesión de recuperación abierta desde el enlace. */
export async function updateRecoveredPassword(password: string): Promise<PasswordResetResponse> {
  try {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, error: translateAuthError(error.message) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export function passwordResetMessage(error?: string): string {
  switch (error) {
    case 'invalid_email':
      return 'Escribe un correo válido.'
    case 'email_failed':
      return 'No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.'
    case 'not_configured':
      return 'La recuperación por correo aún no está configurada. Escríbenos para ayudarte.'
    case 'rate_limited':
      return 'Hiciste varias solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.'
    case 'network':
      return 'Revisa tu conexión e inténtalo de nuevo.'
    case 'redirect_not_allowed':
      return 'La URL de recuperación no está autorizada. Agrega el dominio del sitio en Supabase → Authentication → URL Configuration.'
    case 'session_missing':
      return 'El enlace expiró o ya fue usado. Solicita uno nuevo.'
    case 'link_failed':
      return 'No pudimos enviar el enlace de recuperación. Revisa la configuración de correo en Supabase.'
    case 'invalid_code':
      return 'Código incorrecto. Revísalo o pide uno nuevo.'
    case 'expired':
      return 'El código expiró. Pide uno nuevo.'
    case 'too_many_attempts':
      return 'Demasiados intentos con este código. Pide uno nuevo.'
    case 'weak_password':
      return 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.'
    case 'server_error':
      return 'Tuvimos un problema al procesar la solicitud. Inténtalo de nuevo.'
    default:
      return 'No pudimos completar la operación. Inténtalo de nuevo.'
  }
}

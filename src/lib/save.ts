/**
 * Utilidades para que la interfaz nunca “finga” un guardado.
 *
 * Cualquier error de escritura en Supabase se emite como evento global
 * (`pm:save-error`) y <SaveErrorToast /> lo muestra al usuario. Así, si la base
 * de datos rechaza un cambio, nadie se queda con la impresión de que se guardó.
 */

export interface SaveResult {
  ok: boolean
  error?: string
}

const RPC_MISSING = /PGRST202|could not find the function|schema cache|does not exist/i

/** Convierte errores de Supabase/Postgres en un texto entendible. */
export function describeError(error: unknown, fallback = 'Error inesperado.'): string {
  const message =
    typeof error === 'string'
      ? error
      : ((error as { message?: string } | null)?.message ?? fallback)

  if (RPC_MISSING.test(message)) {
    return 'Falta ejecutar supabase/refuerzo-seguridad.sql en el SQL Editor de Supabase.'
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'Ya existe otro registro con ese mismo dato (por ejemplo, el slug o el correo).'
  }
  if (/row-level security|permission denied|42501/i.test(message)) {
    return 'Tu sesión no tiene permiso para este cambio. Vuelve a iniciar sesión como administrador.'
  }
  return message
}

/** Avisa al usuario (y a la consola) de que algo no se guardó. */
export function reportSaveError(scope: string, detail?: string): void {
  const text = detail ? `${scope} ${detail}` : scope
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<string>('pm:save-error', { detail: text }))
  }
  console.error('[save]', text)
}

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** `true` si hay credenciales de Supabase configuradas (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[PASION MOTORS] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env.local y completa tus credenciales de Supabase.',
  )
}

/**
 * Cliente de Supabase para el navegador. Usa la clave pública (anon key).
 * Nunca incluyas aquí la service_role key.
 */
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

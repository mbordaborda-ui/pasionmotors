import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@supabase/supabase-js'
import type { AppUser, Role } from '@/types'
import { supabase } from '@/lib/supabase'
import { describeError, reportSaveError, type SaveResult } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import { rowToProfile, type ProfileRow } from '@/lib/db'

/** Cliente secundario SIN persistencia de sesión: sirve para crear usuarios
 * desde el panel sin cerrar la sesión del administrador.
 */
const signupClient = createClient(
  import.meta.env.VITE_SUPABASE_URL?.trim() ?? 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? 'anon',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
)

export interface AuthResult {
  ok: boolean
  error?: string
}

interface AuthContextValue {
  /** Usuario de la sesión actual. */
  user: AppUser | null
  users: AppUser[]
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  addUser: (name: string, email: string, password: string, role: Role) => Promise<AuthResult>
  updateUser: (id: string, patch: Partial<AppUser>) => Promise<SaveResult>
  removeUser: (id: string) => Promise<SaveResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (id: string): Promise<AppUser | null> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (error) {
      console.error('[auth.profile]', error.message)
      return null
    }
    return data ? rowToProfile(data as ProfileRow) : null
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[auth.users]', error.message)
      return
    }
    setUsers((data as ProfileRow[]).map(rowToProfile))
  }, [])

  useEffect(() => {
    let active = true

    const applySession = async (session: { user?: { id: string } } | null) => {
      const uid = session?.user?.id ?? null
      try {
        const p = uid
          ? await withTimeout(
              fetchProfile(uid),
              10_000,
              'La sesión tardó demasiado en responder.',
            )
          : null
        if (!active) return
        setProfile(p)
        // La lista completa de cuentas solo la necesita un administrador.
        // Así un visitante anónimo no descarga todos los perfiles.
        if (p?.role === 'admin') void fetchUsers()
        else setUsers([])
      } catch (err) {
        console.error('[auth.session]', err)
        if (!active) return
        setProfile(null)
        setUsers([])
      }
    }

    const boot = async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          'La sesión tardó demasiado en responder.',
        )
        await applySession(data.session)
      } catch (err) {
        console.error('[auth.boot]', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    void boot()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      // El primer evento repite la sesión que ya cargó `boot()`.
      if (event === 'INITIAL_SESSION') return
      await applySession(session)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [fetchProfile, fetchUsers])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
    [],
  )

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      if (!name.trim()) return { ok: false, error: 'Ingresa tu nombre.' }
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return {
          ok: false,
          error: 'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número.',
        }
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() } },
      })
      if (error) return { ok: false, error: error.message }
      if (!data.session) {
        return {
          ok: false,
          error: 'Cuenta creada. Revisa tu correo para confirmarla antes de ingresar.',
        }
      }
      return { ok: true }
    },
    [],
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const addUser = useCallback(
    async (name: string, email: string, password: string, role: Role): Promise<AuthResult> => {
      const clean = email.trim().toLowerCase()
      if (!name.trim() || !clean) return { ok: false, error: 'Nombre y correo son obligatorios.' }
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return {
          ok: false,
          error: 'Asigna una contraseña de al menos 8 caracteres, con una letra y un número.',
        }
      }

      const { data, error } = await signupClient.auth.signUp({
        email: clean,
        password,
        options: { data: { name: name.trim() } },
      })
      if (error) return { ok: false, error: error.message }

      // Con la confirmación de correo activada, Supabase devuelve un usuario
      // «fantasma» (sin identidades) cuando el correo ya existe. No se debe
      // tocar ese perfil: podría cambiar el rol de una cuenta ajena.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { ok: false, error: 'Ya existe una cuenta con ese correo.' }
      }

      const newId = data.user?.id
      if (role === 'admin') {
        const query = supabase.from('profiles').update({ role: 'admin' })
        const target = newId ? query.eq('id', newId) : query.eq('email', clean)
        const { error: roleError } = await target

        if (roleError) {
          const message = describeError(roleError)
          reportSaveError('La cuenta se creó, pero no se pudo asignar el rol de administrador.', message)
          await fetchUsers()
          return {
            ok: false,
            error: `La cuenta se creó como cliente, pero no se pudo hacer administrador: ${message}`,
          }
        }
      }

      await fetchUsers()
      return { ok: true }
    },
    [fetchUsers],
  )

  const updateUser = useCallback(
    async (id: string, patch: Partial<AppUser>): Promise<SaveResult> => {
      if (id === profile?.id && patch.role && patch.role !== 'admin') {
        return {
          ok: false,
          error: 'No puedes quitarte a ti mismo el rol de administrador.',
        }
      }

      const row: Record<string, unknown> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.role !== undefined) row.role = patch.role
      if (Object.keys(row).length === 0) return { ok: true }

      const { error } = await supabase.from('profiles').update(row).eq('id', id)
      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo actualizar el usuario.', message)
        void fetchUsers()
        return { ok: false, error: message }
      }

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
      setProfile((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
      return { ok: true }
    },
    [fetchUsers, profile?.id],
  )

  const removeUser = useCallback(
    async (id: string): Promise<SaveResult> => {
      if (id === profile?.id) {
        return { ok: false, error: 'No puedes eliminar tu propia cuenta.' }
      }

      // Se elimina la cuenta completa de Auth (no solo el perfil): así la
      // persona deja de poder iniciar sesión. Requiere desplegar la función
      // `admin-delete-user` y que quien la invoca sea administrador.
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
        'admin-delete-user',
        { body: { userId: id } },
      )

      let code = data?.error
      if (error) {
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx && typeof ctx.json === 'function') {
            const body = (await ctx.json()) as { error?: string }
            code = body?.error ?? code
          }
        } catch {
          // sin cuerpo útil
        }
      }

      if (error || !data?.ok) {
        const message =
          code === 'not_allowed'
            ? 'Solo un administrador puede eliminar cuentas.'
            : code === 'cannot_delete_self'
              ? 'No puedes eliminar tu propia cuenta.'
              : code === 'not_configured'
                ? 'Falta configurar la función admin-delete-user en Supabase.'
                : code === 'delete_failed'
                  ? 'Supabase Auth no pudo eliminar la cuenta. Inténtalo de nuevo.'
                  : 'No se pudo eliminar la cuenta. Revisa que la función admin-delete-user esté desplegada.'
        reportSaveError('No se eliminó la cuenta.', message)
        return { ok: false, error: message }
      }

      setUsers((prev) => prev.filter((u) => u.id !== id))
      await fetchUsers()
      return { ok: true }
    },
    [fetchUsers, profile?.id],
  )

  const user = profile

  const value: AuthContextValue = {
    user,
    users,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    addUser,
    updateUser,
    removeUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

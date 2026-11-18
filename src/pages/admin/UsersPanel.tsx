import { useState } from 'react'
import { Plus, ShieldCheck, Trash2, User } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

export function UsersPanel() {
  const { users, user, addUser, updateUser, removeUser } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const showMsg = (kind: 'ok' | 'error', text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg(null), 5000)
  }

  const changeRole = async (id: string, nextRole: Role) => {
    setWorkingId(id)
    const res = await updateUser(id, { role: nextRole })
    setWorkingId(null)
    if (!res.ok) {
      showMsg('error', res.error ?? 'No se pudo cambiar el rol.')
      return
    }
    showMsg('ok', 'Rol actualizado en la base de datos.')
  }

  const deleteUser = async (id: string, email: string) => {
    if (
      !confirm(
        `¿Eliminar la cuenta de ${email}? Se borrará de Supabase Auth y la persona no podrá volver a iniciar sesión. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setWorkingId(id)
    const res = await removeUser(id)
    setWorkingId(null)
    if (!res.ok) {
      showMsg('error', res.error ?? 'No se pudo eliminar la cuenta.')
      return
    }
    showMsg('ok', 'Cuenta eliminada por completo.')
  }

  const submit = async () => {
    setBusy(true)
    const res = await addUser(name, email, password, role)
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'error', text: res.error ?? 'No se pudo crear el usuario.' })
      return
    }
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    setMsg({ kind: 'ok', text: 'Usuario creado.' })
    setTimeout(() => setMsg(null), 3000)  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* LISTA */}
      <div className="space-y-3">
        {msg && (
          <p
            className={cn(
              'rounded-xl border p-3 text-xs',
              msg.kind === 'ok'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-brand/40 bg-brand/10 text-white',
            )}
          >
            {msg.text}
          </p>
        )}
        {users.map((u) => (
          <div key={u.id} className="card-surface flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/70">
                {u.role === 'admin' ? <ShieldCheck className="h-5 w-5 text-brand" /> : <User className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {u.name} {u.id === user?.id && <span className="text-white/40">(tú)</span>}
                </p>
                <p className="text-xs text-white/45">{u.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                disabled={u.id === user?.id || workingId === u.id}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider outline-none disabled:opacity-50',
                  u.role === 'admin'
                    ? 'border-brand/40 bg-brand/10 text-brand-300'
                    : 'border-white/15 bg-white/5 text-white/70',
                )}
              >
                <option value="user">Cliente</option>
                <option value="admin">Administrador</option>
              </select>
              <button
                onClick={() => void deleteUser(u.id, u.email)}
                disabled={u.id === user?.id || workingId === u.id}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Eliminar usuario"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* NUEVO USUARIO */}
      <div className="card-surface h-fit p-6">
        <h3 className="font-display text-lg uppercase tracking-tight">Crear usuario</h3>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
              Nombre
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Nombre" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
              Correo
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
              Contraseña
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres, con letra y número"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
              Rol
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field">
              <option value="user">Cliente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {msg && (
            <p
              className={cn(
                'rounded-xl border p-3 text-xs',
                msg.kind === 'ok'
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : 'border-brand/40 bg-brand/10 text-white',
              )}
            >
              {msg.text}
            </p>
          )}

          <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-60">
            <Plus className="h-4 w-4" /> {busy ? 'Creando…' : 'Crear usuario'}
          </button>

          <p className="text-[11px] leading-relaxed text-white/40">
            Las cuentas se crean en Supabase Auth. Si tu proyecto exige confirmar el correo, la persona
            recibirá un mensaje para activar su cuenta. El botón de eliminar borra la cuenta completa
            (Authentication → Users) mediante la función segura{' '}
            <strong className="text-white/60">admin-delete-user</strong>; no es posible recuperarla.
          </p>
        </div>
      </div>
    </div>
  )
}

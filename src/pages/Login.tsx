import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, LockKeyhole, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import { logos } from '@/config'

type Mode = 'login' | 'register'

export function Login() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const justReset = params.get('reset') === '1'

  if (user) return <Navigate to={next} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = mode === 'login' ? await login(email, password) : await register(name, email, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'No se pudo completar la operación.')
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <div className="container-pm flex min-h-[100svh] items-center justify-center py-28">
      <div className="w-full max-w-md">
        <div className="text-center">
          <img src={logos.secondary} alt="PASION MOTORS" className="mx-auto h-16 w-auto object-contain" />
          <h1 className="display mt-6 text-3xl sm:text-4xl">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-3 text-sm text-white/55">
            {mode === 'login'
              ? 'Ingresa para gestionar tus pedidos.'
              : 'Únete a la comunidad PASION MOTORS.'}
          </p>
        </div>

        <div className="mt-8 flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError('')
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                mode === m ? 'bg-brand text-white' : 'text-white/60 hover:text-white',
              )}
            >
              {m === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {m === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="card-surface mt-6 space-y-4 p-6 lg:p-7">
          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
                placeholder="Nombre y apellido"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'login' && (
              <div className="mt-2 text-right">
                <Link
                  to="/recuperar"
                  className="text-[11px] text-white/45 transition hover:text-white"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
          </div>

          {justReset && mode === 'login' && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-100">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>Contraseña actualizada. Inicia sesión con tu nueva contraseña.</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-brand/40 bg-brand/10 p-3 text-xs text-white">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          <Link to="/" className="transition hover:text-white">
            Volver a la tienda
          </Link>
        </p>
      </div>
    </div>
  )
}

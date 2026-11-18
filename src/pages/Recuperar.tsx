import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { logos } from '@/config'
import {
  passwordResetMessage,
  requestResetCode,
  resetPasswordWithCode,
  sendPasswordResetLink,
  updateRecoveredPassword,
} from '@/lib/password-reset'

type Step = 'email' | 'code' | 'sent' | 'update' | 'done'

const STEP_INDEX: Record<Step, number> = { email: 1, code: 2, sent: 2, update: 2, done: 3 }

export function Recuperar() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step !== 'code') return
    const timer = setTimeout(() => codeRef.current?.focus(), 60)
    return () => clearTimeout(timer)
  }, [step])

  // Detecta el regreso desde el enlace de recuperación de Supabase Auth.
  useEffect(() => {
    let active = true
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const errorDescription = hash.get('error_description') || query.get('error_description')
    const recovery =
      hash.get('type') === 'recovery' ||
      query.get('type') === 'recovery' ||
      hash.has('access_token') ||
      query.has('code')
    const resumedRecovery = sessionStorage.getItem('pm.recovery') === '1'

    if (errorDescription) {
      sessionStorage.removeItem('pm.recovery')
      setError(passwordResetMessage('session_missing'))
      window.history.replaceState(null, '', window.location.pathname)
    }

    if (recovery) sessionStorage.setItem('pm.recovery', '1')

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('pm.recovery', '1')
        setStep('update')
        setError('')
      }
    })

    if (recovery || resumedRecovery) {
      const timer = window.setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        if (data.session) {
          setStep('update')
          setError('')
        } else {
          sessionStorage.removeItem('pm.recovery')
          setError(passwordResetMessage('session_missing'))
        }
        window.history.replaceState(null, '', window.location.pathname)
      }, 350)
      return () => {
        active = false
        window.clearTimeout(timer)
        sub.subscription.unsubscribe()
      }
    }

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const rules = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
  const score =
    Number(rules.length) + Number(rules.letter) + Number(rules.number) + Number(rules.symbol)
  const passwordOk =
    rules.length && rules.letter && rules.number && confirm.length > 0 && password === confirm
  const canSubmit = !busy && code.length === 6 && passwordOk
  const canUpdate = !busy && passwordOk

  const resetMessages = () => {
    setError('')
    setNotice('')
  }

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    resetMessages()
    setBusy(true)
    const res = await requestResetCode(email.trim())

    if (res.ok) {
      setBusy(false)
      setStep('code')
      setCooldown(60)
      setNotice('Si el correo está registrado, enviamos un código de 6 dígitos. Revisa también spam.')
      return
    }

    const shouldFallback =
      res.error === 'not_configured' || res.error === 'email_failed' || res.error === 'network'
    if (shouldFallback) {
      const link = await sendPasswordResetLink(email.trim())
      setBusy(false)
      if (link.ok) {
        setStep('sent')
        setCooldown(60)
        return
      }
      setError(passwordResetMessage(link.error ?? res.error))
      return
    }

    setBusy(false)
    setError(passwordResetMessage(res.error))
  }

  const resend = async () => {
    if (cooldown > 0 || busy) return
    resetMessages()
    setBusy(true)

    if (step === 'sent') {
      const res = await sendPasswordResetLink(email.trim())
      setBusy(false)
      if (!res.ok) {
        setError(passwordResetMessage(res.error))
        return
      }
      setCooldown(60)
      setNotice('Enlace reenviado. Revisa tu correo y la carpeta de spam.')
      return
    }

    const res = await requestResetCode(email.trim())
    setBusy(false)
    if (!res.ok) {
      setError(passwordResetMessage(res.error))
      return
    }
    setCooldown(60)
    setNotice('Código reenviado. Revisa tu correo y la carpeta de spam.')
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    resetMessages()
    setBusy(true)
    const res = await updateRecoveredPassword(password)
    if (!res.ok) {
      setBusy(false)
      setError(passwordResetMessage(res.error))
      return
    }
    sessionStorage.removeItem('pm.recovery')
    await supabase.auth.signOut()
    setBusy(false)
    setStep('done')
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    resetMessages()
    setBusy(true)
    const res = await resetPasswordWithCode(email.trim(), code, password)
    setBusy(false)
    if (!res.ok) {
      if (res.error === 'invalid_code' || res.error === 'expired' || res.error === 'too_many_attempts') {
        setCode('')
        requestAnimationFrame(() => codeRef.current?.focus())
      }
      setError(passwordResetMessage(res.error))
      return
    }
    setStep('done')
  }

  const changeEmail = () => {
    setStep('email')
    setCode('')
    setPassword('')
    setConfirm('')
    setShowPassword(false)
    setCooldown(0)
    resetMessages()
  }

  return (
    <div className="container-pm flex min-h-[100svh] items-center justify-center py-28">
      <div className="w-full max-w-md">
        <div className="text-center">
          <img src={logos.secondary} alt="PASION MOTORS" className="mx-auto h-16 w-auto object-contain" />
          <h1 className="display mt-6 text-3xl sm:text-4xl">
            {step === 'done'
              ? 'Contraseña actualizada'
              : step === 'update'
                ? 'Define una nueva contraseña'
                : 'Recupera tu cuenta'}
          </h1>
          <p className="mt-3 text-sm text-white/55">
            {step === 'email' && 'Te enviaremos un código o enlace de seguridad a tu correo.'}
            {step === 'code' && 'Ingresa el código y define tu nueva contraseña.'}
            {step === 'sent' && 'Revisa tu correo y abre el enlace de recuperación.'}
            {step === 'update' && 'Ya validamos tu identidad. Elige tu nueva contraseña.'}
            {step === 'done' && 'Ya puedes iniciar sesión con tu nueva contraseña.'}
          </p>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                n <= STEP_INDEX[step] ? 'w-8 bg-brand' : 'w-4 bg-white/15',
              )}
            />
          ))}
        </div>

        {step === 'email' && (
          <form onSubmit={sendCode} className="card-surface mt-6 space-y-4 p-6 lg:p-7">
            <div>
              <label htmlFor="reset-email" className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                Correo
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="field"
                placeholder="tu@correo.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy ? 'Enviando…' : 'Enviar instrucciones'}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-white/40">
              Si el correo está registrado, recibirás un código o un enlace seguro. Revisa también la
              carpeta de spam.
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode} className="card-surface mt-6 space-y-5 p-6 lg:p-7">
            <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-white/50">
              Enviamos un código a <strong className="break-all text-white/80">{email}</strong>. Caduca en 15
              minutos.
            </p>

            {notice && <NoticeBox text={notice} />}

            <div>
              <label htmlFor="reset-code" className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                Código de 6 dígitos
              </label>
              <input
                ref={codeRef}
                id="reset-code"
                required
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setError('')
                }}
                className="field text-center font-mono text-2xl tracking-[0.45em]"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!error}
              />
            </div>

            <PasswordField
              id="reset-password"
              label="Nueva contraseña"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setError('')
              }}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />

            <Strength score={score} />

            <ul className="grid gap-1.5 sm:grid-cols-2">
              <Rule ok={rules.length} label="Mínimo 8 caracteres" />
              <Rule ok={rules.letter} label="Al menos una letra" />
              <Rule ok={rules.number} label="Al menos un número" />
              {confirm.length > 0 && <Rule ok={password === confirm} label="Las contraseñas coinciden" />}
            </ul>

            <PasswordField
              id="reset-confirm"
              label="Repite la contraseña"
              value={confirm}
              onChange={(v) => {
                setConfirm(v)
                setError('')
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />

            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? 'Guardando…' : 'Cambiar contraseña'}
            </button>

            <div className="flex items-center justify-between gap-3 text-[11px]">
              <button
                type="button"
                onClick={changeEmail}
                className="flex items-center gap-1 text-white/45 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Usar otro correo
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={cooldown > 0 || busy}
                className="text-white/45 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}

        {step === 'sent' && (
          <div className="card-surface mt-6 space-y-5 p-6 lg:p-7">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-brand/15 text-brand">
                <MailCheck className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                Si el correo está registrado, enviamos un enlace a{' '}
                <strong className="break-all text-white/85">{email}</strong>. Ábrelo desde este
                dispositivo para definir tu nueva contraseña.
              </p>
            </div>

            {notice && <NoticeBox text={notice} />}
            {error && <ErrorBox text={error} />}

            <button type="button" onClick={changeEmail} className="btn-ghost w-full">
              <ArrowLeft className="h-4 w-4" /> Usar otro correo
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || busy}
              className="w-full text-center text-xs text-white/45 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cooldown > 0 ? `Reenviar enlace en ${cooldown}s` : 'Reenviar enlace'}
            </button>
          </div>
        )}

        {step === 'update' && (
          <form onSubmit={submitPassword} className="card-surface mt-6 space-y-5 p-6 lg:p-7">
            <PasswordField
              id="recovered-password"
              label="Nueva contraseña"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setError('')
              }}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />

            <Strength score={score} />

            <ul className="grid gap-1.5 sm:grid-cols-2">
              <Rule ok={rules.length} label="Mínimo 8 caracteres" />
              <Rule ok={rules.letter} label="Al menos una letra" />
              <Rule ok={rules.number} label="Al menos un número" />
              {confirm.length > 0 && <Rule ok={password === confirm} label="Las contraseñas coinciden" />}
            </ul>

            <PasswordField
              id="recovered-confirm"
              label="Repite la contraseña"
              value={confirm}
              onChange={(v) => {
                setConfirm(v)
                setError('')
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />

            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={!canUpdate} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="card-surface mt-6 flex flex-col items-center gap-4 p-6 text-center lg:p-7">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-sm leading-relaxed text-white/60">
              Tu contraseña se cambió correctamente. Por seguridad, cierra sesión en otros dispositivos e
              ingresa de nuevo.
            </p>
            <Link to={`/login?reset=1&email=${encodeURIComponent(email)}`} className="btn-primary w-full">
              Iniciar sesión
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-6 flex items-center justify-center gap-1 text-center text-xs text-white/40">
            <LockKeyhole className="h-3.5 w-3.5" />
            <Link to="/login" className="transition hover:text-white">
              Volver a iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  show,
  onToggle,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
  show: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs uppercase tracking-wider text-white/50">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field pr-12"
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/40 transition hover:text-white"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function Strength({ score }: { score: number }) {
  const labels = ['Muy débil', 'Débil', 'Media', 'Buena', 'Fuerte']
  const tones = ['bg-white/15', 'bg-brand', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-400']
  const texts = ['text-white/40', 'text-brand', 'text-amber-300', 'text-lime-300', 'text-emerald-300']
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < score ? tones[score] : 'bg-white/10',
            )}
          />
        ))}
      </div>
      <p className={cn('mt-1.5 text-[11px]', texts[score])}>
        {score > 0 ? `Seguridad: ${labels[score]}` : 'Seguridad de la contraseña'}
      </p>
    </div>
  )
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 text-[11px] transition-colors',
        ok ? 'text-emerald-300' : 'text-white/40',
      )}
    >
      <span
        className={cn(
          'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border',
          ok ? 'border-emerald-400/50 bg-emerald-400/15' : 'border-white/15',
        )}
      >
        {ok && <Check className="h-2.5 w-2.5" />}
      </span>
      {label}
    </li>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-brand/40 bg-brand/10 p-3 text-xs text-white"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <span>{text}</span>
    </div>
  )
}

function NoticeBox({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-100"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <span>{text}</span>
    </div>
  )
}

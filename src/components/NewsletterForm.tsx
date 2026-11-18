import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { supabase } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function NewsletterForm() {
  const { site } = useSettings()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setState('error')
      setMessage('Escribe un correo válido para suscribirte.')
      return
    }

    setState('loading')
    setMessage('')
    const { data, error } = await supabase.rpc('subscribe_newsletter', {
      p_email: clean,
      p_source: 'home',
    })

    let already = false

    if (error) {
      // Respaldo: si la función aún no está desplegada, intenta insertar directo.
      const fallback = await supabase
        .from('newsletter_subscribers')
        .insert({ email: clean, source: 'home' })
      if (fallback.error && fallback.error.code !== '23505') {
        setState('error')
        setMessage('No pudimos registrar tu correo. Inténtalo de nuevo en unos minutos.')
        return
      }
      already = fallback.error?.code === '23505'
    } else {
      const result = data as { ok?: boolean; status?: string; error?: string } | null
      if (result && result.ok === false) {
        setState('error')
        setMessage(
          result.error === 'invalid_email'
            ? 'Escribe un correo válido para suscribirte.'
            : 'No pudimos registrar tu correo. Inténtalo de nuevo en unos minutos.',
        )
        return
      }
      already = result?.status === 'existing'
    }

    setEmail('')
    setState('ok')
    setMessage(
      already
        ? 'Ya estás en la lista. Te avisaremos de las próximas novedades.'
        : 'Listo. Te escribiremos con lanzamientos, colecciones y experiencias de la marca.',
    )
  }

  return (
    <div>
      <form onSubmit={submit} className="flex w-full flex-col gap-3 rounded-3xl bg-ink-950/30 p-5 backdrop-blur sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (state !== 'loading') setState('idle')
          }}
          placeholder="tu@correo.com"
          aria-label="Correo electrónico"
          className="w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/60 outline-none focus:border-white"
        />
        <button type="submit" disabled={state === 'loading'} className="btn-light whitespace-nowrap disabled:opacity-70">
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {state === 'loading' ? 'Enviando…' : state === 'ok' ? 'Suscrito' : 'Suscribirme'}
        </button>
      </form>
      <p
        className={
          state === 'error'
            ? 'mt-3 text-[11px] font-medium text-white'
            : 'mt-3 text-[11px] text-white/70'
        }
      >
        {message || (
          <>
            Novedades y lanzamientos de {site.name}. Al suscribirte aceptas nuestra{' '}
            <Link to="/politicas#datos" className="underline underline-offset-2 hover:text-white">
              política de datos
            </Link>
            . Puedes darte de baja escribiendo a {site.email}.
          </>
        )}
      </p>
    </div>
  )
}

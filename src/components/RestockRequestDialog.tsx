import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BellRing, CheckCircle2, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Img } from '@/components/Img'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface RestockRequestDialogProps {
  product: Product
  open: boolean
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RestockRequestDialog({ product, open, onClose }: RestockRequestDialogProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setEmail((prev) => prev || user?.email || '')
    setName((prev) => prev || user?.name || '')
    setState('idle')
    setMessage('')
  }, [open, user])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setState('error')
      setMessage('Escribe un correo válido para poder avisarte.')
      return
    }

    setState('loading')
    setMessage('')
    const { data, error } = await supabase.rpc('request_restock', {
      p_product_id: product.id,
      p_email: clean,
      p_name: name.trim() || null,
      p_phone: phone.trim() || null,
      p_qty: Math.max(1, Math.min(99, Number(qty) || 1)),
      p_notes: notes.trim() || null,
    })

    if (error) {
      setState('error')
      setMessage('No pudimos registrar tu solicitud. Inténtalo de nuevo en unos minutos.')
      return
    }

    const result = data as { ok?: boolean; status?: string; error?: string } | null
    if (!result?.ok) {
      setState('error')
      setMessage(
        result?.error === 'invalid_email'
          ? 'Escribe un correo válido para poder avisarte.'
          : result?.error === 'available'
            ? 'Este producto ya está disponible. Recarga la página y agrégalo al carrito.'
            : 'No pudimos registrar tu solicitud. Inténtalo de nuevo en unos minutos.',
      )
      return
    }

    setState('ok')
    setMessage(
      result.status === 'existing'
        ? 'Ya teníamos tu solicitud para este producto. Te avisaremos cuando vuelva.'
        : 'Tu solicitud quedó registrada. Te avisaremos cuando el producto vuelva a estar disponible.',
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/75 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Solicitar ${product.name}`}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/15 text-brand">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">
                Producto agotado
              </p>
              <h2 className="font-display text-xl uppercase tracking-tight text-white">
                Solicitar producto
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
          <Img
            src={product.images?.[0]}
            alt={product.name}
            driveWidth={120}
            className="h-14 w-14 shrink-0 rounded-xl"
            label="Foto"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{product.name}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Agotado por ahora</p>
          </div>
        </div>

        {state === 'ok' ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="mt-4 font-display text-xl uppercase tracking-tight text-white">
              Solicitud registrada
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{message}</p>
            <button type="button" onClick={onClose} className="btn-primary mt-6 w-full">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Déjanos tus datos y te avisamos cuando vuelva. Tu solicitud también nos ayuda a saber qué
              productos reabastecer.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                  Correo *
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (state === 'error') setState('idle')
                  }}
                  className="field"
                  placeholder="tu@correo.com"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                    Nombre
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                    WhatsApp
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="field"
                    placeholder="Opcional"
                    inputMode="tel"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                  Cantidad que te interesa
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
                  Nota (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="field resize-none"
                  placeholder="Talla, color o algo que debamos saber"
                />
              </div>

              {message && (
                <p
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs leading-relaxed',
                    state === 'error'
                      ? 'border-brand/40 bg-brand/10 text-white'
                      : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
                  )}
                >
                  {message}
                </p>
              )}

              <button type="submit" disabled={state === 'loading'} className="btn-primary w-full disabled:opacity-60">
                {state === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                {state === 'loading' ? 'Enviando…' : 'Solicitar producto'}
              </button>
              <p className="text-center text-[10px] leading-relaxed text-white/30">
                Usaremos tus datos solo para avisarte sobre este producto. Al enviar aceptas nuestra{' '}
                <Link to="/politicas#datos" target="_blank" className="underline underline-offset-2 hover:text-white/60">
                  política de datos
                </Link>
                .
              </p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Mail, RefreshCw, Trash2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { describeError, reportSaveError } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import { AdminListSkeleton } from '@/components/Skeletons'

interface Subscriber {
  id: string
  email: string
  source: string | null
  created_at: string
}

export function InboxPanel() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await withTimeout(
        supabase
          .from('newsletter_subscribers')
          .select('*')
          .order('created_at', { ascending: false }),
        15_000,
        'La lista de suscriptores tardó demasiado en cargar.',
      )

      if (queryError) {
        setError(queryError.message)
      } else {
        setSubscribers((data as Subscriber[]) ?? [])
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const removeSubscriber = async (id: string) => {
    setSubscribers((prev) => prev.filter((s) => s.id !== id))
    const { error: deleteError } = await supabase
      .from('newsletter_subscribers')
      .delete()
      .eq('id', id)
    if (deleteError) {
      const message = describeError(deleteError)
      setError(message)
      reportSaveError('No se pudo eliminar el suscriptor.', message)
      void load()
    }
  }

  if (loading) {
    return <AdminListSkeleton rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
            <Users className="h-5 w-5 text-brand" /> Suscriptores del boletín
            <span className="text-white/40">({subscribers.length})</span>
          </h3>
          <p className="mt-1 text-sm text-white/50">
            Correos registrados desde el formulario del inicio. El correo público se cambia en Ajustes.
          </p>
        </div>
        <button onClick={() => void load()} className="btn-ghost !py-2.5 !text-[12px]">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {error && (
        <p className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-xs text-white">{error}</p>
      )}

      {subscribers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <Mail className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 text-sm text-white/55">Aún no hay suscriptores.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {subscribers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{s.email}</p>
                <p className="text-[11px] text-white/40">
                  {new Date(s.created_at).toLocaleString('es-CO')}
                  {s.source ? ` · ${s.source}` : ''}
                </p>
              </div>
              <button
                onClick={() => void removeSubscriber(s.id)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-brand hover:text-brand"
                aria-label={`Eliminar ${s.email}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-white/35">
        Los correos se guardan en Supabase. Para enviar campañas automáticas conecta un proveedor SMTP o
        una Edge Function con Resend usando el correo configurado en Ajustes.
      </p>
    </div>
  )
}

import { Shirt, Sparkles, Truck } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { promoText } from '@/lib/promos'
import { cn } from '@/lib/utils'
import type { Promo } from '@/types'

export function PromosPanel() {
  const { promos, upsertPromo, togglePromo } = useSettings()

  const set = (promo: Promo, patch: Partial<Promo>) => upsertPromo({ ...promo, ...patch })

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm leading-relaxed text-white/55">
        Activa o edita las promociones de envío. Se muestran como mensajes en el inicio, el carrito y
        el checkout. Si dejas el mensaje en blanco, se genera automáticamente según el tipo y el monto.
      </p>

      <div className="space-y-4">
        {promos.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
            No hay promociones configuradas.
          </p>
        )}

        {promos.map((promo) => {
          const Icon = promo.kind === 'shirt' ? Shirt : Truck
          const amountLabel = promo.kind === 'shirt' ? 'Cobertura máxima ($)' : 'Compra mínima ($)'
          return (
            <div key={promo.id} className="card-surface p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{promo.title}</p>
                    <p className="text-[11px] uppercase tracking-wider text-white/40">
                      {promo.kind === 'shirt' ? 'Envío gratis con camiseta' : 'Envío gratis por monto'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    role="switch"
                    aria-checked={promo.enabled}
                    onClick={() => togglePromo(promo.id)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition',
                      promo.enabled ? 'bg-brand' : 'bg-white/15',
                    )}
                    title={promo.enabled ? 'Activa' : 'Desactivada'}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                        promo.enabled ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                  <span
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      promo.enabled ? 'text-emerald-300' : 'text-white/40',
                    )}
                  >
                    {promo.enabled ? 'Activa' : 'Desactivada'}
                  </span>
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/45">
                    Orden
                    <input
                      type="number"
                      value={promo.order}
                      onChange={(e) => set(promo, { order: Number(e.target.value) || 0 })}
                      className="w-16 rounded-lg border border-white/10 bg-ink-800/80 px-2 py-1 text-center text-sm text-white outline-none focus:border-brand"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                    Título
                  </label>
                  <input
                    value={promo.title}
                    onChange={(e) => set(promo, { title: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                    {amountLabel}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={promo.amount ?? ''}
                    onChange={(e) =>
                      set(promo, { amount: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className="field"
                    placeholder="Ej: 17000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                    Mensaje (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={promo.message ?? ''}
                    onChange={(e) => set(promo, { message: e.target.value })}
                    className="field resize-none"
                    placeholder="Déjalo vacío para usar el mensaje automático"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p className="text-xs leading-relaxed text-white/70">
                  <span className="text-white/45">Así se verá: </span>
                  {promoText(promo)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

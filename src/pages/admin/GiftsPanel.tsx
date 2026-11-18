import { Gift as GiftIcon, Plus, Trash2 } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { cn } from '@/lib/utils'
import type { Gift } from '@/types'

export function GiftsPanel() {
  const { gifts, upsertGift, addGift, toggleGift, removeGift } = useSettings()

  const set = (gift: Gift, patch: Partial<Gift>) => upsertGift({ ...gift, ...patch })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm leading-relaxed text-white/55">
          Activa o desactiva los regalos que acompañan el pedido. Los desactivados no se muestran en la
          tienda ni en el checkout.
        </p>
        <button onClick={() => addGift()} className="btn-primary shrink-0 !px-5 !py-2.5 !text-[12px]">
          <Plus className="h-4 w-4" /> Nuevo regalo
        </button>
      </div>

      <div className="space-y-4">
        {gifts.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
            No hay regalos configurados.
          </p>
        )}
        {gifts.map((g) => (
          <div key={g.id} className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <GiftIcon className="h-5 w-5" />
                </div>
                <button
                  role="switch"
                  aria-checked={g.enabled}
                  onClick={() => toggleGift(g.id)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition',
                    g.enabled ? 'bg-brand' : 'bg-white/15',
                  )}
                  title={g.enabled ? 'Activo' : 'Desactivado'}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                      g.enabled ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    g.enabled ? 'text-emerald-300' : 'text-white/40',
                  )}
                >
                  {g.enabled ? 'Activo' : 'Desactivado'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/45">
                  Orden
                  <input
                    type="number"
                    value={g.order}
                    onChange={(e) => set(g, { order: Number(e.target.value) || 0 })}
                    className="w-16 rounded-lg border border-white/10 bg-ink-800/80 px-2 py-1 text-center text-sm text-white outline-none focus:border-brand"
                  />
                </label>
                <button
                  onClick={() => removeGift(g.id)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-brand hover:text-brand"
                  aria-label="Eliminar regalo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                  Nombre
                </label>
                <input value={g.name} onChange={(e) => set(g, { name: e.target.value })} className="field" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                  Descripción
                </label>
                <input
                  value={g.description}
                  onChange={(e) => set(g, { description: e.target.value })}
                  className="field"
                  placeholder="Texto que verá el cliente"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

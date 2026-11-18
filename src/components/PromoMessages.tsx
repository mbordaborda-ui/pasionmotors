import { Sparkles, Shirt, Truck } from 'lucide-react'
import { useSettings } from '@/store/settings'
import { promoText } from '@/lib/promos'
import { cn } from '@/lib/utils'
import type { Promo } from '@/types'

function PromoCard({ promo, compact }: { promo: Promo; compact?: boolean }) {
  const Icon = promo.kind === 'shirt' ? Shirt : Truck
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/15 via-ink-800/60 to-ink-900',
        compact ? 'p-5' : 'p-6 lg:p-7',
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand/25 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-red">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">
            <Sparkles className="h-3 w-3" /> Beneficio
          </p>
          <h3 className="mt-1.5 font-display text-xl uppercase leading-tight tracking-tight text-white">
            {promo.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{promoText(promo)}</p>
        </div>
      </div>
    </div>
  )
}

/** Mensajes de promociones activas (envío gratis). */
export function PromoMessages({
  className,
  compact,
}: {
  className?: string
  compact?: boolean
}) {
  const { activePromos } = useSettings()
  if (activePromos.length === 0) return null

  return (
    <div className={cn('grid gap-5 sm:grid-cols-2', className)}>
      {activePromos.map((promo) => (
        <PromoCard key={promo.id} promo={promo} compact={compact} />
      ))}
    </div>
  )
}

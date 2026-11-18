import { PartyPopper, Shirt, Truck } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { ShippingBenefits } from '@/lib/promos'

/** Mensaje de envío gratis: avisa cuánto falta o felicita al desbloquearlo. */
export function ShippingMessage({
  shipping,
  hasShirt,
  className,
}: {
  shipping: ShippingBenefits
  hasShirt: boolean
  className?: string
}) {
  if (!shipping.amountPromo && !shipping.shirtPromo) return null

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-[12px] leading-relaxed',
        shipping.free
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
          : 'border-brand/30 bg-brand/10 text-white/80',
        className,
      )}
    >
      {shipping.free ? (
        <p className="flex items-start gap-2">
          <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <span>
            <strong className="text-white">¡Envío gratis desbloqueado!</strong>{' '}
            {shipping.reason === 'shirt'
              ? 'Tu camiseta activó el envío por nuestra cuenta.'
              : 'Tu compra superó el monto mínimo.'}
          </span>
        </p>
      ) : (
        <div className="space-y-1.5">
          {shipping.amountPromo && (
            <p className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                Te faltan <strong className="text-white">{formatPrice(shipping.missing)}</strong> para
                el envío gratis.
              </span>
            </p>
          )}
          {shipping.shirtPromo && !hasShirt && (
            <p className="flex items-start gap-2 text-white/65">
              <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                O suma una camiseta y el envío corre por nuestra cuenta.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

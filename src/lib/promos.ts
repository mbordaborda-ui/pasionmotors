import type { Promo } from '@/types'
import { formatPrice } from '@/lib/utils'

/** Texto final de una promoción (mensaje propio o generado según tipo y monto). */
export function promoText(promo: Promo): string {
  if (promo.message && promo.message.trim()) return promo.message.trim()
  const money = promo.amount != null ? formatPrice(promo.amount) : null

  if (promo.kind === 'shirt') {
    return 'Compra al menos una camiseta y el envío va por nuestra cuenta en Colombia.'
  }

  return money
    ? `Envío gratis en compras desde ${money}. Suma camisetas, miniaturas y accesorios y aprovecha.`
    : 'Envío gratis en compras por un monto mínimo. Suma camisetas, miniaturas y accesorios.'
}

export interface ShippingBenefits {
  amountPromo?: Promo
  shirtPromo?: Promo
  /** Envío gratis desbloqueado (por monto o por camiseta). */
  free: boolean
  /** Motivo del envío gratis, cuando aplica. */
  reason?: 'amount' | 'shirt'
  /** Falta para alcanzar el envío gratis por monto (0 si no aplica). */
  missing: number
  threshold: number
}

/**
 * Evalúa el estado del envío gratis a partir de las promociones activas,
 * el subtotal y si el carrito contiene camisetas.
 */
export function shippingBenefits(
  promos: Promo[],
  subtotal: number,
  hasShirt: boolean,
): ShippingBenefits {
  const amountPromo = promos.find((p) => p.kind === 'amount')
  const shirtPromo = promos.find((p) => p.kind === 'shirt')
  const threshold = amountPromo?.amount ?? 0

  const amountReached = !!amountPromo && threshold > 0 && subtotal >= threshold
  const free = amountReached || (!!shirtPromo && hasShirt)

  return {
    amountPromo,
    shirtPromo,
    free,
    reason: amountReached ? 'amount' : shirtPromo && hasShirt ? 'shirt' : undefined,
    missing: amountPromo && threshold > 0 ? Math.max(0, threshold - subtotal) : 0,
    threshold,
  }
}

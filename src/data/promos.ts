import type { Promo } from '@/types'

/**
 * Promociones de envío. Se muestran como mensajes en la tienda, el carrito y el
 * checkout, y se pueden editar desde el panel de administración.
 */
export const promosSeed: Promo[] = [
  {
    id: 'promo-shirt',
    kind: 'shirt',
    title: 'Envío gratis con tu camiseta',
    message: '',
    amount: 17000,
    enabled: true,
    order: 1,
  },
  {
    id: 'promo-amount',
    kind: 'amount',
    title: 'Envío gratis por monto',
    message: '',
    amount: 99900,
    enabled: true,
    order: 2,
  },
]

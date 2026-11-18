import type { Gift } from '@/types'

/**
 * Regalos / complementos que acompañan el pedido. Se pueden activar o
 * desactivar desde el panel de administración (pestaña "Regalos").
 *
 * Nota: la bolsa con logo y el llavero quedan DESACTIVADOS por ahora.
 */
export const giftsSeed: Gift[] = [
  {
    id: 'gift-bolsa',
    name: 'Bolsa con logo',
    description: 'Tu pedido llega en nuestra bolsa de marca, lista para regalar.',
    enabled: false,
    order: 1,
  },
  {
    id: 'gift-llavero',
    name: 'Llavero PASION MOTORS',
    description: 'El detalle final: un llavero oficial de la marca.',
    enabled: false,
    order: 2,
  },
  {
    id: 'gift-sticker-redondo',
    name: 'Sticker redondo',
    description: 'El emblema circular de PASION MOTORS para que formes parte de esta comunidad.',
    enabled: true,
    order: 3,
  },
  {
    id: 'gift-stickers-cars',
    name: '3 stickers de Culture of Cars',
    description: 'Stickers animados de autos para personalizar lo que quieras.',
    enabled: true,
    order: 4,
  },
  {
    id: 'gift-sticker-lamina',
    name: '1 sticker de lámina para personalizar PASION MOTORS',
    description: 'Sticker de lámina para personalizar tu PASION MOTORS.',
    enabled: true,
    order: 5,
  },
]

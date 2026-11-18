/**
 * Datos de la transportadora con la que trabaja la tienda.
 * Se usan en el panel, en la cuenta del cliente, en la página de Envíos y en
 * el correo de guía, para que el enlace de rastreo siempre sea el correcto.
 */
export const SHIPPING_CARRIER = 'Interrapidísimo'

/** Portal oficial de seguimiento: el cliente ingresa allí su número de guía. */
export const SHIPPING_TRACKING_URL = 'https://siguetuenvio.interrapidisimo.com'

/** Datos del remitente que se imprimen en la guía de envío. */
export const SHIPPING_SENDER = {
  name: 'MIGUEL ANGEL BORDA ANGARITA',
  document: '1076242945',
  address: 'ZIPAQUIRA',
}

/**
 * Valor estimado del envío nacional (COP) con Interrapidísimo para pedidos de
 * hasta 1 kg. Es solo una referencia: el valor final depende del destino y el
 * peso, y se paga contra entrega.
 */
export const ESTIMATED_SHIPPING = 15_000

/** Nota que acompaña al valor estimado en el carrito y el checkout. */
export const SHIPPING_ESTIMATE_NOTE =
  'El envío es un valor estimado con Interrapidísimo y se paga contra entrega al recibir el pedido; el valor final puede variar según destino y peso. Si tu compra cumple los requisitos de envío gratis, no pagas envío.'

/** Devuelve el enlace guardado o, si falta, el portal de la transportadora. */
export function trackingUrlFor(value?: string | null): string {
  const clean = value?.trim()
  return clean ? clean : SHIPPING_TRACKING_URL
}

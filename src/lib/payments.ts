import { supabase } from '@/lib/supabase'
import type { UnavailableItem } from '@/store/catalog'

export interface CheckoutCustomer {
  name: string
  email: string
  phone: string
  /** Documento de identidad de quien recibe. */
  document: string
  city: string
  address: string
  notes?: string
}

export interface CheckoutLineInput {
  productId: string
  qty: number
  selections: Record<string, string>
}

export interface CheckoutPayload {
  idempotencyKey: string
  items: CheckoutLineInput[]
  giftIds: string[]
  /** El servidor rechaza el pedido si no llega `true` (evidencia legal). */
  termsAccepted: boolean
  /** Versión/fecha de las políticas aceptadas (site.legalUpdatedAt). */
  termsVersion: string
  customer: CheckoutCustomer
}

export interface CheckoutError {
  ok: false
  error: string
  /** Campo concreto que rechazó el servidor (p. ej. `email`). */
  field?: string
  unavailable?: UnavailableItem[]
  minOrder?: number
  productName?: string
}

export interface CheckoutSuccess {
  ok: true
  orderId: string
  total: number
  initPoint: string
}

export type CheckoutResult = CheckoutSuccess | CheckoutError

/**
 * Pide al servidor que cree el pedido (precios y stock calculados allí) y la
 * preferencia de pago en Mercado Pago. Devuelve la URL de checkout.
 * El navegador NUNCA envía precios ni totales.
 */
export async function startCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke<CheckoutResult>('create-checkout', {
      body: payload,
    })
    if (error) {
      // Las respuestas no-2xx llegan como error: intentamos leer el cuerpo JSON.
      try {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          const body = (await ctx.json()) as CheckoutResult
          if (body && typeof body === 'object' && 'ok' in body) return body
        }
      } catch {
        // sin cuerpo útil
      }
      console.error('[startCheckout]', error.message)
      return { ok: false, error: 'network' }
    }
    if (!data) return { ok: false, error: 'server_error' }
    return data
  } catch (e) {
    console.error('[startCheckout]', e)
    return { ok: false, error: 'network' }
  }
}

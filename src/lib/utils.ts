import type { Product } from '@/types'
import { site } from '@/config'

/** Une clases condicionales. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

let currentLocale = site.locale
let currentCurrency = site.currency
let currencyFmt = new Intl.NumberFormat(currentLocale, {
  style: 'currency',
  currency: currentCurrency,
  maximumFractionDigits: 0,
})

/** Actualiza la moneda/formato activos (lo usa el panel de ajustes). */
export function setCurrencyConfig(locale: string, currency: string) {
  if (locale === currentLocale && currency === currentCurrency) return
  currentLocale = locale
  currentCurrency = currency
  try {
    currencyFmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
  } catch {
    /* mantiene el formateador anterior */
  }
}

/** Formatea un precio. Si es null devuelve null para poder mostrar "Precio por confirmar". */
export function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined || Number.isNaN(price)) return null
  try {
    return currencyFmt.format(price)
  } catch {
    return `${currentCurrency} ${price.toLocaleString('es-CO')}`
  }
}

export function discountPercent(p: Product): number | null {
  if (p.price == null || p.compareAtPrice == null) return null
  if (p.compareAtPrice <= p.price) return null
  return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
}

/**
 * ¿El producto se puede comprar? Un producto marcado como agotado nunca se
 * puede comprar, aunque tenga stock cargado por error. Si hay stock definido,
 * también manda el inventario.
 */
export function isAvailable(p: Product): boolean {
  if (p.availability === 'agotado') return false
  if (typeof p.stock === 'number') return p.stock > 0
  return true
}

/** Unidades disponibles (null = sin control de inventario). */
export function stockLeft(p: Product): number | null {
  return typeof p.stock === 'number' ? Math.max(0, p.stock) : null
}

export function availabilityLabel(p: Product): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (p.availability === 'agotado' || (typeof p.stock === 'number' && p.stock <= 0)) {
    return { label: 'Agotado', tone: 'off' }
  }
  if (typeof p.stock === 'number') {
    if (p.stock <= 3) return { label: `Últimas ${p.stock}`, tone: 'warn' }
    return { label: 'Disponible', tone: 'ok' }
  }
  switch (p.availability) {
    case 'disponible':
      return { label: 'Disponible', tone: 'ok' }
    default:
      return { label: 'Disponibilidad por confirmar', tone: 'warn' }
  }
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

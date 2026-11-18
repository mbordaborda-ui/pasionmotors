import type { SiteConfig } from '@/types'

export const site: SiteConfig = {
  name: 'PASION MOTORS',
  tagline: 'DRIVE THE PASSION',
  currency: 'COP',
  locale: 'es-CO',
  whatsapp: '', // ej: '573001112233' — completar cuando esté disponible
  email: '', // correo público de la tienda (se configura en Admin → Configuración)
  instagram: '@pasionmotors',
  tiktok: '@pasionmotors',
  city: 'Colombia',
  freeShippingFrom: null,
  minOrder: 0,
  /** Foto del hero (auto deportivo). Acepta URL pública o enlace de Google Drive. Vacío = fondo gráfico de marca. */
  heroImage: '/images/hero/porsche-green.jpg',
  featuredEyebrow: 'Selección',
  featuredTitle: 'Piezas destacadas',
  featuredDescription: 'Los favoritos de la comunidad. Desliza para recorrer la colección.',
  legalUpdatedAt: '2026-10-27',
}

/** Rutas públicas de los logos de la marca (carpeta /public/logos). */
export const logos = {
  main: '/logos/logo-main.png',
  secondary: '/logos/logo-secondary.png',
  black: '/logos/logo-black.png',
  badge: '/logos/logo-badge.png',
}

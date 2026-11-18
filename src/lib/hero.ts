import type { HeroRotation, SiteConfig } from '@/types'

/** Etiquetas usadas en el panel de administración. */
export const HERO_ROTATION_LABELS: Record<HeroRotation, string> = {
  off: 'Sin rotación (una sola foto)',
  random: 'Rotación aleatoria (cada visita)',
  daily: 'Rotación diaria',
  weekly: 'Rotación semanal',
}

export const MAX_HERO_IMAGES = 6

export function heroRotationOf(site: Pick<SiteConfig, 'heroRotation'>): HeroRotation {
  return site.heroRotation === 'random' ||
    site.heroRotation === 'daily' ||
    site.heroRotation === 'weekly'
    ? site.heroRotation
    : 'off'
}

/**
 * Índice del periodo actual. Se calcula con la fecha local del dispositivo
 * (año/mes/día) para que el cambio ocurra a medianoche y sea igual para todos
 * los visitantes de la misma zona horaria.
 */
function periodIndex(date: Date, rotation: 'daily' | 'weekly'): number {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  )
  // La semana empieza en lunes: el 5 de enero de 1970 fue el primer lunes.
  return rotation === 'daily' ? day : Math.floor((day - 4) / 7)
}

/** Lista limpia de fotos configuradas para el hero. */
export function heroImagesOf(site: Pick<SiteConfig, 'heroImage' | 'heroImages'>): string[] {
  return (site.heroImages ?? []).map((url) => url.trim()).filter(Boolean)
}

/**
 * Foto que debe mostrarse ahora.
 * - `random`: elige una al azar usando `randomSeed` (estable durante la visita).
 * - `daily`/`weekly`: elige según el día o la semana.
 * - `off`: usa `heroImage` y, si está vacía, la primera de la lista.
 */
export function pickHeroImage(
  site: Pick<SiteConfig, 'heroImage' | 'heroImages' | 'heroRotation'>,
  date: Date = new Date(),
  randomSeed?: number,
): string | undefined {
  const images = heroImagesOf(site)
  const rotation = heroRotationOf(site)

  if (rotation !== 'off' && images.length > 0) {
    let index: number
    if (rotation === 'random') {
      const seed = Math.abs(randomSeed ?? Math.random())
      index = Math.min(images.length - 1, Math.floor(seed * images.length))
    } else {
      index = Math.abs(periodIndex(date, rotation)) % images.length
    }
    return images[index]
  }

  const fixed = site.heroImage?.trim()
  return fixed || images[0] || undefined
}

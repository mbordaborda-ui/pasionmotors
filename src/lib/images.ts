/**
 * Utilidades para normalizar enlaces de Google Drive y otras URLs públicas
 * en URLs de imagen utilizables directamente dentro de un <img src>.
 *
 * El dueño de la tienda puede pegar el enlace normal de "Compartir" de Drive:
 *   https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing
 * y aquí se convierte automáticamente a:
 *   https://drive.google.com/thumbnail?id=1AbCdEfGhIjK&sz=w1600
 *
 * Importante: el archivo debe estar compartido como
 * "Cualquier persona con el enlace" (lector). Si está privado la imagen
 * no cargará y se mostrará la imagen de reemplazo de la marca.
 */

const DRIVE_FILE = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/
const DRIVE_ANY_ID = /[?&]id=([\w-]{10,})/

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com/.test(url)
}

/** Extrae el ID de archivo de un enlace de Google Drive. */
export function extractDriveId(url: string): string | null {
  const m = url.match(DRIVE_FILE) || url.match(DRIVE_ANY_ID)
  return m ? m[1] : null
}

/** Convierte cualquier enlace de Drive en una URL de imagen directa (tamaño grande). */
export function toDriveImageUrl(url: string, width = 1600): string {
  const id = extractDriveId(url)
  if (!id) return url
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
}

/**
 * Devuelve la mejor URL de imagen disponible a partir de lo que pegue el usuario.
 * - Enlaces de Drive -> URL de miniatura directa.
 * - URLs http(s) normales -> se dejan igual.
 * - Datos base64 (subida desde el dispositivo) -> se dejan igual.
 * - Rutas locales (/logos/...) -> se dejan igual.
 */
export function resolveImageUrl(raw?: string | null, width = 1600): string {
  if (!raw) return ''
  const url = raw.trim()
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('/')) return url
  if (isGoogleDriveUrl(url)) return toDriveImageUrl(url, width)
  return url
}

/** Normaliza un arreglo de imágenes (una por línea / coma en el panel). */
export function parseImageList(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => resolveImageUrl(u))
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 70)
}

export function uid(prefix = 'pm'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

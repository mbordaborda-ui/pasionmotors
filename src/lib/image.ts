/**
 * Optimización de imágenes en el navegador.
 *
 * Las fotos de celular suelen pesar entre 3 y 12 MB (y algunas vienen en HEIC).
 * Aquí las decodificamos, las giramos según su orientación, las reducimos y las
 * convertimos a JPEG antes de subirlas. Así funcionan en cualquier teléfono y
 * nunca llegan al límite de Storage.
 */

export interface CompressOptions {
  /** Ancho máximo en px (se mantiene la proporción). */
  maxWidth?: number
  /** Alto máximo en px (se mantiene la proporción). */
  maxHeight?: number
  /** Calidad JPEG inicial entre 0 y 1. */
  quality?: number
  /** Peso objetivo del JPEG final, en bytes. */
  maxBytes?: number
}

export interface OptimizedImage {
  /** Data URL JPEG lista para previsualizar o usar como respaldo. */
  dataUrl: string
  /** Archivo comprimido listo para subir a Storage. */
  blob: Blob
  width: number
  height: number
  bytes: number
}

export type ImageErrorCode = 'too_large' | 'unsupported' | 'decode' | 'canvas'

export class ImageError extends Error {
  readonly code: ImageErrorCode

  constructor(code: ImageErrorCode, message: string) {
    super(message)
    this.name = 'ImageError'
    this.code = code
  }
}

/** Tamaño máximo del archivo original que aceptamos leer. */
export const MAX_INPUT_BYTES = 30 * 1024 * 1024

/** Peso al que intentamos dejar cada foto (muy por debajo del límite del bucket). */
export const TARGET_IMAGE_BYTES = 900 * 1024

function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ImageError('decode', 'No se pudo leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

/** Convierte HEIC/HEIF a JPEG usando heic2any (solo se carga si hace falta). */
async function heicToJpeg(file: File): Promise<Blob> {
  const module = await import('heic2any')
  const converted = await module.default({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob) throw new ImageError('unsupported', 'No se pudo convertir la foto HEIC.')
  return blob
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

async function decodeBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Safari antiguo o formato que createImageBitmap no entiende: probamos <img>.
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('decode'))
      image.src = objectUrl
    })
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('decode')
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function decodeAny(file: File): Promise<DecodedImage> {
  try {
    return await decodeBlob(file)
  } catch {
    if (!isHeic(file)) {
      throw new ImageError(
        'decode',
        'La imagen está dañada o el formato no es compatible con este navegador.',
      )
    }
    try {
      return await decodeBlob(await heicToJpeg(file))
    } catch {
      throw new ImageError(
        'unsupported',
        'No se pudo leer la foto HEIC. Cambia el formato de cámara a «Más compatible» o compártela como JPG.',
      )
    }
  }
}

function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new ImageError('canvas', 'El dispositivo no pudo preparar la imagen.')
  }
  // Fondo blanco: evita que los PNG con transparencia queden negros al pasar a JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ImageError('canvas', 'El dispositivo no pudo comprimir la imagen.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Convierte cualquier foto (incluida HEIC) en un JPEG liviano.
 * Ajusta calidad y tamaño hasta acercarse a `maxBytes`.
 */
export async function optimizeImage(
  file: File,
  options: CompressOptions = {},
): Promise<OptimizedImage> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    maxBytes = TARGET_IMAGE_BYTES,
  } = options

  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError(
      'too_large',
      `La foto pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es 30 MB.`,
    )
  }
  if (!file.type.startsWith('image/') && !isHeic(file)) {
    throw new ImageError('unsupported', 'El archivo no es una imagen.')
  }

  const decoded = await decodeAny(file)
  try {
    let { width, height } = fitWithin(decoded.width, decoded.height, maxWidth, maxHeight)
    let canvas = drawToCanvas(decoded.source, width, height)

    let currentQuality = quality
    let blob = await canvasToBlob(canvas, currentQuality)

    // 1) Bajar calidad.
    for (let attempt = 0; attempt < 5 && blob.size > maxBytes && currentQuality > 0.55; attempt += 1) {
      currentQuality = Math.max(0.55, currentQuality - 0.08)
      blob = await canvasToBlob(canvas, currentQuality)
    }

    // 2) Si aún pesa demasiado, reducir dimensiones.
    let scale = 1
    while (blob.size > maxBytes && scale > 0.55) {
      scale *= 0.85
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
      canvas = drawToCanvas(decoded.source, width, height)
      blob = await canvasToBlob(canvas, currentQuality)
    }

    return {
      blob,
      dataUrl: await readAsDataUrl(blob),
      width,
      height,
      bytes: blob.size,
    }
  } finally {
    decoded.cleanup()
  }
}

/** Compatibilidad con los formularios que solo necesitan el Data URL. */
export async function fileToCompressedDataUrl(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  return (await optimizeImage(file, options)).dataUrl
}

/** Mensaje listo para mostrar al usuario según el tipo de fallo. */
export function describeImageError(error: unknown): string {
  if (error instanceof ImageError) {
    switch (error.code) {
      case 'too_large':
        return 'La foto es demasiado pesada (máximo 30 MB). Elige otra o hazle una captura de pantalla.'
      case 'unsupported':
        return 'No pudimos leer esa foto. Si viene de un iPhone en formato HEIC, en Ajustes → Cámara → Formatos elige «Más compatible» y vuelve a intentarlo.'
      case 'decode':
        return 'La imagen está dañada o su formato no es compatible. Prueba con otra foto.'
      case 'canvas':
        return 'El teléfono no pudo procesar la imagen por falta de memoria. Cierra otras apps e intenta de nuevo.'
    }
  }
  return error instanceof Error ? error.message : 'No pudimos procesar la imagen.'
}

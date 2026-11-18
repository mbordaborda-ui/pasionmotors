import { supabase } from '@/lib/supabase'

export type ImageBucket = 'spots' | 'product-images'

const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|timeout|fetch/i
const SIZE_ERROR = /exceeded the maximum allowed size|payload too large|entity too large|too large|413/i
const MIME_ERROR = /mime type|not allowed|invalid.*type|415/i
const PERMISSION_ERROR = /row-level security|permission|not authorized|unauthorized|forbidden|403|401/i
const MISSING_BUCKET = /bucket not found|not found/i

/** Traduce el error de Storage a algo que el usuario pueda entender. */
export function describeStorageError(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : ((error as { message?: string } | null)?.message ?? 'No se pudo subir la foto.')

  if (MISSING_BUCKET.test(message)) {
    return 'El almacén de fotos no está configurado. Ejecuta supabase/arreglo-fotos.sql en Supabase.'
  }
  if (SIZE_ERROR.test(message)) {
    return 'La foto sigue siendo muy pesada. Intenta con otra o hazle una captura de pantalla.'
  }
  if (MIME_ERROR.test(message)) {
    return 'Ese formato de imagen no está permitido. Usa JPG, PNG, WebP o HEIC.'
  }
  if (PERMISSION_ERROR.test(message)) {
    return 'No tenemos permiso para subir esta foto. Vuelve a iniciar sesión o escríbenos.'
  }
  if (NETWORK_ERROR.test(message)) {
    return 'No pudimos conectar con el almacenamiento. Revisa tu conexión e intenta de nuevo.'
  }
  return message
}

function extensionFor(blob: Blob): string {
  const type = (blob.type || 'image/jpeg').toLowerCase()
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('avif')) return 'avif'
  if (type.includes('heic') || type.includes('heif')) return 'heic'
  return 'jpg'
}

async function uploadOnce(bucket: ImageBucket, path: string, blob: Blob): Promise<{ error: unknown }> {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  return { error }
}

/**
 * Sube una imagen al bucket indicado y devuelve su URL pública.
 * Reintenta una vez si el fallo parece de red.
 */
export async function uploadImage(
  bucket: ImageBucket,
  blob: Blob,
  prefix = '',
): Promise<string> {
  const path = `${prefix}${crypto.randomUUID()}.${extensionFor(blob)}`

  let { error } = await uploadOnce(bucket, path, blob)
  if (error && NETWORK_ERROR.test(String((error as { message?: string }).message ?? error))) {
    await new Promise((resolve) => setTimeout(resolve, 700))
    ;({ error } = await uploadOnce(bucket, path, blob))
  }

  if (error) {
    console.error('[storage.upload]', bucket, error)
    throw new Error(describeStorageError(error))
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Borra una imagen pública del bucket a partir de su URL. */
export async function removeImageByUrl(bucket: ImageBucket, url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index < 0) return
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0])
  if (!path) return
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) console.warn('[storage.remove]', bucket, error.message)
}

/**
 * Limita cuánto puede tardar una promesa. Sirve para que una petición de red
 * colgada (red móvil lenta, Supabase sin responder, etc.) nunca deje la
 * interfaz en estado «cargando» de forma indefinida.
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message = 'La conexión tardó demasiado. Inténtalo de nuevo.',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

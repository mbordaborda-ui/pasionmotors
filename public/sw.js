/*
 * Service worker de PASION MOTORS.
 * - Navegación: red primero y, si no hay conexión, shell guardado u offline.html.
 * - Estáticos (JS, CSS, imágenes): cache primero con actualización en segundo plano.
 * - Supabase y terceros: siempre red (no se cachean datos privados).
 */
const CACHE = 'pm-cache-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/logos/logo-badge.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Solo controlamos el propio sitio; Supabase y Google Fonts siguen yendo a la red.
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return

  // Navegación de la SPA: red primero, con respaldo offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            const cache = await caches.open(CACHE)
            await cache.put('/index.html', response.clone())
          }
          return response
        } catch {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/offline.html')) ||
            Response.error()
          )
        }
      })(),
    )
    return
  }

  // Estáticos: se sirve la copia guardada y se refresca en segundo plano.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)

      return cached || network
    })(),
  )
})

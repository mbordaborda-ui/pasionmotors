import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { CartDrawer } from '@/components/CartDrawer'
import { Cursor } from '@/components/Cursor'
import { BackToTop } from '@/components/BackToTop'
import { MobileNav } from '@/components/MobileNav'
import { TachometerHud } from '@/components/TachometerHud'
import { SaveErrorToast } from '@/components/SaveErrorToast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PageSkeleton } from '@/components/Skeletons'
import { SettingsProvider } from '@/store/settings'
import { AuthProvider, useAuth } from '@/store/auth'
import { CatalogProvider } from '@/store/catalog'
import { FavoritesProvider } from '@/store/favorites'
import { OrdersProvider } from '@/store/orders'
import { CartProvider } from '@/store/cart'
import { GalleryProvider } from '@/store/gallery'
import { Home } from '@/pages/Home'
import { Catalog } from '@/pages/Catalog'
import { ProductDetail } from '@/pages/ProductDetail'

// Las secciones pesadas (admin, checkout, legales) se descargan solo al entrar.
// El catálogo y la ficha de producto quedan en el paquete inicial para que la
// compra nunca dependa de una descarga extra.
const Spots = lazy(() => import('@/pages/Spots').then((m) => ({ default: m.Spots })))
const Checkout = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.Checkout })))
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })))
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Recuperar = lazy(() => import('@/pages/Recuperar').then((m) => ({ default: m.Recuperar })))
const Cuenta = lazy(() => import('@/pages/Cuenta').then((m) => ({ default: m.Cuenta })))
const Favoritos = lazy(() => import('@/pages/Favoritos').then((m) => ({ default: m.Favoritos })))
const Contacto = lazy(() => import('@/pages/info').then((m) => ({ default: m.Contacto })))
const Envios = lazy(() => import('@/pages/info').then((m) => ({ default: m.Envios })))
const Nosotros = lazy(() => import('@/pages/info').then((m) => ({ default: m.Nosotros })))
const NotFound = lazy(() => import('@/pages/info').then((m) => ({ default: m.NotFound })))
const Politicas = lazy(() => import('@/pages/info').then((m) => ({ default: m.Politicas })))

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <PageSkeleton />
  if (!user) return <Navigate to="/login?next=/admin" replace />
  if (!isAdmin) {
    return (
      <div className="container-pm flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-24 text-center">
        <h1 className="display text-3xl uppercase tracking-tight sm:text-4xl">Acceso restringido</h1>
        <p className="max-w-sm text-sm text-white/55">
          Esta sección es solo para administradores. Ingresa con una cuenta de administrador.
        </p>
        <Link to="/" className="btn-primary mt-2">
          Volver al inicio
        </Link>
      </div>
    )
  }
  return <>{children}</>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSkeleton />
  if (!user) return <Navigate to="/login?next=/cuenta" replace />
  return <>{children}</>
}

function Shell() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col bg-ink pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <main key={pathname} className="animate-page flex-1">
        <ErrorBoundary key={pathname} compact>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/favoritos" element={<Favoritos />} />
              <Route path="/spotting" element={<Spots />} />
              <Route path="/producto/:slug" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/nosotros" element={<Nosotros />} />
              <Route path="/envios" element={<Envios />} />
              <Route path="/politicas" element={<Politicas />} />
              <Route path="/contacto" element={<Contacto />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recuperar" element={<Recuperar />} />
              <Route
                path="/cuenta"
                element={
                  <RequireAuth>
                    <Cuenta />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <Admin />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <MobileNav />
      <BackToTop />
      <TachometerHud />
      <OfflineBanner />
      <SaveErrorToast />
      <div className="film-grain" aria-hidden="true" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <CatalogProvider>
            <FavoritesProvider>
              <OrdersProvider>
                <CartProvider>
                  <GalleryProvider>
                    <BrowserRouter>
                      <Shell />
                      <CartDrawer />
                      <Cursor />
                    </BrowserRouter>
                  </GalleryProvider>
                </CartProvider>
              </OrdersProvider>
            </FavoritesProvider>
          </CatalogProvider>
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  )
}

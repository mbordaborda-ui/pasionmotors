import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Heart, LayoutDashboard, LogIn, LogOut, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollFrame } from '@/lib/motion'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { useCatalog } from '@/store/catalog'
import { useFavorites } from '@/store/favorites'
import { logos } from '@/config'

const nav = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/spotting', label: 'Spotting' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/envios', label: 'Envíos' },
  { to: '/contacto', label: 'Contacto' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { count, openCart } = useCart()
  const { user, isAdmin, logout } = useAuth()
  const { categories } = useCatalog()
  const { count: favoriteCount } = useFavorites()
  const location = useLocation()
  const navigate = useNavigate()
  const progressRef = useRef<HTMLDivElement>(null)

  const onHome = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useScrollFrame(() => {
    const el = progressRef.current
    if (!el) return
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    el.style.transform = `scaleX(${p})`
  })

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const solid = scrolled || !onHome || menuOpen

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo')
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          solid
            ? 'border-b border-white/10 bg-ink-950/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div
          className={cn(
            'container-pm flex items-center justify-between gap-4 transition-[height] duration-300 ease-out',
            scrolled ? 'h-16 lg:h-[72px]' : 'h-[68px] lg:h-20',
          )}
        >
          <Link to="/" aria-label="PASION MOTORS — Inicio" className="flex shrink-0 items-center">
            <img
              src={logos.secondary}
              alt="PASION MOTORS"
              className="h-10 w-auto object-contain sm:h-11"
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-full px-4 py-2 text-[13px] font-semibold uppercase tracking-wider transition-colors',
                    isActive ? 'text-white' : 'text-white/60 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-brand" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Buscar productos"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            <Link
              to="/favoritos"
              className="relative grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label={
                favoriteCount > 0
                  ? `Favoritos, ${favoriteCount} ${favoriteCount === 1 ? 'guardado' : 'guardados'}`
                  : 'Ver favoritos'
              }
            >
              <Heart className="h-5 w-5" />
              {favoriteCount > 0 && (
                <span className="pm-price-tick absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {favoriteCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span
                  key={count}
                  className="pm-price-tick absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white"
                >
                  {count}
                </span>
              )}
            </button>

            <Link to="/catalogo" className="btn-primary ml-1 hidden !px-5 !py-2.5 !text-[12px] xl:inline-flex">
              Comprar ahora
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
                aria-label="Cuenta"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <User className="h-5 w-5" />
              </button>
              <div
                aria-hidden={!accountOpen}
                className={cn(
                  'absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 p-2 shadow-2xl backdrop-blur-xl transition-[opacity,transform,visibility] duration-200 ease-out',
                  accountOpen
                    ? 'visible translate-y-0 opacity-100'
                    : 'invisible -translate-y-2 opacity-0 pointer-events-none',
                )}
              >
                  {user ? (
                    <>
                      <div className="px-3 py-2">
                        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                        <p className="truncate text-[11px] text-white/45">{user.email}</p>
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                      <Link
                        to="/cuenta"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
                      >
                        <User className="h-4 w-4" /> Mi cuenta
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
                        >
                          <LayoutDashboard className="h-4 w-4" /> Panel de administración
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logout()
                          setAccountOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-brand-300 transition hover:bg-white/5"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
                      >
                        <LogIn className="h-4 w-4" /> Ingresar
                      </Link>
                      <p className="px-3 pb-1 pt-1 text-[11px] leading-relaxed text-white/40">
                        Inicia sesión para ver tus pedidos.
                      </p>
                    </>
                  )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 lg:hidden"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="pm-dropdown border-t border-white/10 bg-ink-950/95 backdrop-blur-xl">
            <form onSubmit={submitSearch} className="container-pm flex items-center gap-3 py-4">
              <Search className="h-5 w-5 text-white/40" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar camisetas, accesorios, coleccionables…"
                className="w-full bg-transparent py-2 text-sm text-white placeholder-white/40 outline-none"
              />
              <button type="submit" className="btn-primary !px-5 !py-2 !text-[11px]">
                Buscar
              </button>
            </form>
          </div>
        )}

        <div
          ref={progressRef}
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-brand"
          style={{ transform: 'scaleX(0)' }}
        />
      </header>

      {/* Mobile menu */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink-950 transition-[opacity,transform,visibility] duration-300 ease-out lg:hidden',
          menuOpen
            ? 'visible pointer-events-auto translate-y-0 opacity-100'
            : 'invisible pointer-events-none -translate-y-3 opacity-0',
        )}
      >
        <div className="container-pm flex h-full flex-col pb-10 pt-[92px]">
          <nav className="flex flex-col divide-y divide-white/10 border-y border-white/10">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="py-5 font-display text-2xl uppercase tracking-tight text-white/90 transition hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
            Categorías
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} to={`/catalogo?cat=${c.id}`} className="chip">
                {c.short}
              </Link>
            ))}
          </div>
          <div className="mt-auto space-y-3 pt-8">
            {user ? (
              <>
                <Link
                  to="/cuenta"
                  className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50"
                >
                  Mi cuenta
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50"
                  >
                    Panel de administración
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-300"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50"
              >
                Ingresar / Crear cuenta
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

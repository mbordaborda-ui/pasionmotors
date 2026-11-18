import { NavLink } from 'react-router-dom'
import { Camera, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'

/** Barra de navegación inferior para móvil: acceso rápido a lo esencial. */
export function MobileNav() {
  const { count, openCart } = useCart()
  const { user } = useAuth()

  const base = 'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition'
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn(base, isActive ? 'text-white' : 'text-white/50 hover:text-white')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        <NavLink to="/" end className={cls}>
          <Home className="h-5 w-5" /> Inicio
        </NavLink>
        <NavLink to="/catalogo" className={cls}>
          <LayoutGrid className="h-5 w-5" /> Catálogo
        </NavLink>
        <NavLink to="/spotting" className={cls}>
          <Camera className="h-5 w-5" /> Spotting
        </NavLink>
        <NavLink to={user ? '/cuenta' : '/login'} className={cls}>
          <User className="h-5 w-5" /> {user ? 'Cuenta' : 'Ingresar'}
        </NavLink>
        <button type="button" onClick={openCart} className={cn(base, 'text-white/50 hover:text-white')}>
          <span className="relative">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                {count}
              </span>
            )}
          </span>
          Carrito
        </button>
      </div>
    </nav>
  )
}

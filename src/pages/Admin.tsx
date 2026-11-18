import { lazy, Suspense, useRef, useState } from 'react'
import {
  BarChart3,
  BadgePercent,
  Camera,
  ChevronLeft,
  ChevronRight,
  Gift as GiftIcon,
  ImageIcon,
  Inbox,
  LayoutGrid,
  Package,
  PackageSearch,
  Settings,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AdminPanelSkeleton } from '@/components/Skeletons'

// Cada pestaña se descarga al abrirla: el panel no arrastra las 13 secciones.
const ProductsPanel = lazy(() =>
  import('@/pages/admin/ProductsPanel').then((m) => ({ default: m.ProductsPanel })),
)
const OrdersPanel = lazy(() =>
  import('@/pages/admin/OrdersPanel').then((m) => ({ default: m.OrdersPanel })),
)
const StatsPanel = lazy(() =>
  import('@/pages/admin/StatsPanel').then((m) => ({ default: m.StatsPanel })),
)
const SettingsPanel = lazy(() =>
  import('@/pages/admin/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)
const GiftsPanel = lazy(() =>
  import('@/pages/admin/GiftsPanel').then((m) => ({ default: m.GiftsPanel })),
)
const UsersPanel = lazy(() =>
  import('@/pages/admin/UsersPanel').then((m) => ({ default: m.UsersPanel })),
)
const SpotsPanel = lazy(() =>
  import('@/pages/admin/SpotsPanel').then((m) => ({ default: m.SpotsPanel })),
)
const PromosPanel = lazy(() =>
  import('@/pages/admin/PromosPanel').then((m) => ({ default: m.PromosPanel })),
)
const FeaturedPanel = lazy(() =>
  import('@/pages/admin/FeaturedPanel').then((m) => ({ default: m.FeaturedPanel })),
)
const BestSellersPanel = lazy(() =>
  import('@/pages/admin/BestSellersPanel').then((m) => ({ default: m.BestSellersPanel })),
)
const ContentPanel = lazy(() =>
  import('@/pages/admin/ContentPanel').then((m) => ({ default: m.ContentPanel })),
)
const InboxPanel = lazy(() =>
  import('@/pages/admin/InboxPanel').then((m) => ({ default: m.InboxPanel })),
)
const RequestsPanel = lazy(() =>
  import('@/pages/admin/RequestsPanel').then((m) => ({ default: m.RequestsPanel })),
)

type TabId = 'productos' | 'destacados' | 'masvendidos' | 'pedidos' | 'solicitudes' | 'spotting' | 'estadisticas' | 'ajustes' | 'contenido' | 'regalos' | 'promos' | 'usuarios' | 'bandeja'

const tabs: { id: TabId; label: string; icon: typeof Package; desc: string }[] = [
  { id: 'productos', label: 'Productos', icon: Package, desc: 'Crea y edita productos, precios, fotos y stock.' },
  { id: 'destacados', label: 'Destacados', icon: Star, desc: 'Elige y ordena los productos de «Piezas destacadas».' },
  { id: 'masvendidos', label: 'Más vendidos', icon: TrendingUp, desc: 'Elige y ordena los productos de la sección «Los más vendidos».' },
  { id: 'pedidos', label: 'Pedidos', icon: LayoutGrid, desc: 'Pedidos registrados desde el checkout.' },
  { id: 'solicitudes', label: 'Solicitudes', icon: PackageSearch, desc: 'Productos agotados que los clientes están pidiendo.' },
  { id: 'spotting', label: 'Car Spotting', icon: Camera, desc: 'Modera las fotos que publica la comunidad.' },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3, desc: 'Ventas, más vendidos y stock por reponer.' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings, desc: 'Personaliza la identidad y los textos de la tienda.' },
  { id: 'contenido', label: 'Contenido', icon: ImageIcon, desc: 'Administra categorías, imágenes y la galería del garage.' },
  { id: 'regalos', label: 'Regalos', icon: GiftIcon, desc: 'Activa o desactiva los regalos del pedido.' },
  { id: 'promos', label: 'Promociones', icon: BadgePercent, desc: 'Configura los mensajes de envío gratis.' },
  { id: 'usuarios', label: 'Usuarios', icon: Users, desc: 'Cuentas y roles de la tienda.' },
  { id: 'bandeja', label: 'Suscriptores', icon: Inbox, desc: 'Correos suscritos al boletín de novedades.' },
]

export function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('productos')
  const tabsRef = useRef<HTMLDivElement>(null)
  const active = tabs.find((t) => t.id === tab)!

  const scrollTabs = (direction: -1 | 1) => {
    const el = tabsRef.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.getBoundingClientRect().width + 8 : el.clientWidth * 0.7
    el.scrollBy({ left: direction * Math.max(step, 140), behavior: 'smooth' })
  }

  return (
    <div className="pt-[68px] lg:pt-20">
      <section className="border-b border-white/10 bg-ink-900">
        <div className="container-pm py-10 lg:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="eyebrow">Panel de administración</span>
              <h1 className="display mt-3 text-3xl sm:text-4xl lg:text-5xl">
                Administra tu tienda <span className="text-brand">sin código</span>
              </h1>
            </div>
            {user && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Sesión</p>
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-[11px] text-brand-300">Administrador</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container-pm py-8">
        {/* TABS */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollTabs(-1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-brand hover:text-white active:scale-95"
            aria-label="Ver pestañas anteriores"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div
            ref={tabsRef}
            className="hide-scrollbar pm-carousel flex flex-1 gap-2 overflow-x-auto pb-1"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={(e) => {
                  setTab(t.id)
                  e.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest',
                  })
                }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition',
                  tab === t.id
                    ? 'border-brand bg-brand text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white',
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollTabs(1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-brand hover:text-white active:scale-95"
            aria-label="Ver más pestañas"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-white/50">{active.desc}</p>

        <div className="mt-8">
          <Suspense fallback={<AdminPanelSkeleton />}>
            <ErrorBoundary
              key={tab}
              compact
              title="No pudimos abrir esta pestaña"
              description="El panel no terminó de cargar. Reintenta o cambia de pestaña; el resto de la tienda sigue funcionando."
            >
              {tab === 'productos' && <ProductsPanel />}
              {tab === 'destacados' && <FeaturedPanel />}
              {tab === 'masvendidos' && <BestSellersPanel />}
              {tab === 'pedidos' && <OrdersPanel />}
              {tab === 'solicitudes' && <RequestsPanel />}
              {tab === 'spotting' && <SpotsPanel />}
              {tab === 'estadisticas' && <StatsPanel />}
              {tab === 'ajustes' && <SettingsPanel />}
              {tab === 'contenido' && <ContentPanel />}
              {tab === 'regalos' && <GiftsPanel />}
              {tab === 'promos' && <PromosPanel />}
              {tab === 'usuarios' && <UsersPanel />}
              {tab === 'bandeja' && <InboxPanel />}
            </ErrorBoundary>
          </Suspense>
        </div>
      </div>
    </div>
  )
}

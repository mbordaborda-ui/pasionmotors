import { cn } from '@/lib/utils'

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-full bg-white/[0.07] motion-reduce:animate-none',
        className,
      )}
    />
  )
}

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-white/[0.055] motion-reduce:animate-none',
        className,
      )}
    />
  )
}

/** Reemplazo del spinner mientras se descarga una ruta. */
export function PageSkeleton() {
  return (
    <div className="container-pm min-h-[70vh] py-16" aria-hidden="true">
      <Bar className="h-3 w-24" />
      <Bar className="mt-6 h-10 w-[min(90%,520px)] rounded-xl" />
      <Bar className="mt-3 h-10 w-[min(65%,360px)] rounded-xl" />
      <div className="mt-10 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <Block className="aspect-[4/5] w-full rounded-[1.4rem]" />
            <Bar className="mt-4 h-2.5 w-16" />
            <Bar className="mt-2 h-4 w-3/4" />
            <Bar className="mt-3 h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Esqueleto de una ficha de producto mientras llega el catálogo. */
export function ProductDetailSkeleton() {
  return (
    <div className="container-pm py-10 lg:py-14" aria-hidden="true">
      <Bar className="h-3 w-40" />
      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Block className="aspect-square w-full rounded-3xl" />
        <div className="py-4">
          <Bar className="h-3 w-24" />
          <Bar className="mt-5 h-11 w-4/5 rounded-xl" />
          <Bar className="mt-3 h-5 w-2/3" />
          <Bar className="mt-8 h-8 w-32 rounded-lg" />
          <Bar className="mt-8 h-12 w-full rounded-full" />
          <Bar className="mt-3 h-12 w-full rounded-full" />
          <div className="mt-8 space-y-3">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-11/12" />
            <Bar className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Esqueleto de una cuadrícula de productos. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Block className="aspect-[4/5] w-full rounded-[1.4rem]" />
          <Bar className="mt-4 h-2.5 w-16" />
          <Bar className="mt-2 h-4 w-3/4" />
          <Bar className="mt-3 h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

/** Esqueleto general del panel de administración. */
export function AdminPanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Bar className="h-5 w-44" />
          <Bar className="mt-3 h-3 w-72 max-w-full" />
        </div>
        <Bar className="h-10 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <Block className="aspect-[4/3] w-full" />
            <Bar className="mt-4 h-4 w-2/3" />
            <Bar className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Esqueleto de listas del admin (solicitudes, suscriptores, pedidos). */
export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Bar className="h-5 w-52" />
          <Bar className="mt-3 h-3 w-80 max-w-full" />
        </div>
        <Bar className="h-10 w-32" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <Bar className="h-3.5 w-2/5" />
              <Bar className="mt-2 h-3 w-3/5" />
            </div>
            <Bar className="h-9 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

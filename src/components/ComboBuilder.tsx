import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Plus, ShoppingBag, Sparkles } from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { useCart } from '@/store/cart'
import { Img } from '@/components/Img'
import { formatPrice, isAvailable } from '@/lib/utils'
import type { Product } from '@/types'

type ComboRole = 'camiseta' | 'llavero' | 'sticker'

const ROLES: {
  key: ComboRole
  label: string
  helper: string
  match: (product: Product) => boolean
}[] = [
  {
    key: 'camiseta',
    label: 'Camiseta',
    helper: 'Elige tu favorita',
    match: (p) => p.category === 'camisetas',
  },
  {
    key: 'llavero',
    label: 'Llavero',
    helper: 'El detalle que siempre suma',
    match: (p) => /llavero/i.test(p.name),
  },
  {
    key: 'sticker',
    label: 'Sticker',
    helper: 'Personaliza tu estilo',
    match: (p) => /sticker|parche/i.test(p.name),
  },
]

function variantOf(product: Product | undefined) {
  return product?.variants?.find((v) => v.options.length > 0)
}

export function ComboBuilder() {
  const { products, loading } = useCatalog()
  const { addItem, openCart } = useCart()
  const [picked, setPicked] = useState<Partial<Record<ComboRole, string>>>({})
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const options = useMemo(() => {
    const map = {} as Record<ComboRole, Product[]>
    for (const role of ROLES) {
      map[role.key] = products
        .filter((p) => p.price != null && isAvailable(p) && role.match(p))
        .sort(
          (a, b) =>
            (role.key === 'llavero' ? (a.price ?? 0) - (b.price ?? 0) : 0) ||
            (a.order ?? 999) - (b.order ?? 999),
        )
    }
    return map
  }, [products])

  const selected = useMemo(() => {
    const map = {} as Record<ComboRole, Product | undefined>
    for (const role of ROLES) {
      const list = options[role.key] ?? []
      map[role.key] = list.find((p) => p.id === picked[role.key]) ?? list[0]
    }
    return map
  }, [options, picked])

  const chosen = ROLES.map((role) => selected[role.key]).filter(
    (p): p is Product => !!p,
  )
  const total = chosen.reduce((sum, p) => sum + (p.price ?? 0), 0)

  const selectionFor = (product: Product): Record<string, string> => {
    const variant = variantOf(product)
    if (!variant) return {}
    return {
      [variant.name]: variantChoice[product.id] ?? variant.options[0].label,
    }
  }

  const addCombo = () => {
    let added = 0
    for (const product of chosen) {
      const res = addItem(product, selectionFor(product), 1, true)
      if (res.ok) added += 1
    }
    if (added === 0) {
      setNote('No pudimos agregar el combo. Revisa la disponibilidad.')
    } else {
      setNote(
        added === chosen.length
          ? '¡Combo agregado! Revisa tu carrito para confirmar.'
          : 'Agregamos los productos disponibles. Revisa tu carrito.',
      )
      openCart()
    }
    window.setTimeout(() => setNote(''), 4200)
  }

  if (loading) {
    return (
      <div className="card-surface p-8 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
        <p className="mt-3 text-sm text-white/50">Preparando el combo…</p>
      </div>
    )
  }

  if (chosen.length === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-white/30" />
        <p className="mt-3 text-sm text-white/55">Estamos actualizando el combo. Vuelve pronto.</p>
        <Link to="/catalogo" className="btn-primary mt-5">
          Explorar catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-brand/25 via-ink-900 to-ink-950 p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
        <p className="relative inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">
          <Sparkles className="h-3 w-3" /> Combo PASION
        </p>
        <h2 className="relative mt-2 font-display text-3xl uppercase leading-none tracking-tight text-white">
          Arma tu <span className="text-brand">combo</span>
        </h2>
        <p className="relative mt-3 max-w-sm text-sm leading-relaxed text-white/65">
          Una camiseta, un llavero y un sticker. Elige tus favoritos y llévalos juntos en un solo paso.
        </p>
      </div>

      <div className="space-y-3 p-6">
        {ROLES.map((role) => {
          const product = selected[role.key]
          const list = options[role.key] ?? []
          const variant = variantOf(product)
          if (list.length === 0) return null
          return (
            <div
              key={role.key}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5"
            >
              <Img
                src={product?.images?.[0]}
                alt={product?.name ?? role.label}
                driveWidth={120}
                className="h-12 w-12 shrink-0 rounded-xl"
                label="Foto"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                  {role.label}
                </p>
                <select
                  value={product?.id ?? ''}
                  onChange={(e) => setPicked((prev) => ({ ...prev, [role.key]: e.target.value }))}
                  className="mt-1 w-full cursor-pointer truncate rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs font-medium text-white outline-none transition hover:border-white/25 focus:border-brand"
                  aria-label={role.helper}
                >
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {variant && product && (
                  <select
                    value={variantChoice[product.id] ?? variant.options[0].label}
                    onChange={(e) =>
                      setVariantChoice((prev) => ({ ...prev, [product.id]: e.target.value }))
                    }
                    className="mt-1 w-full cursor-pointer rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11px] text-white/70 outline-none transition hover:border-white/25 focus:border-brand"
                    aria-label={variant.name}
                  >
                    {variant.options.map((option) => (
                      <option key={option.id} value={option.label}>
                        {variant.name}: {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <span className="shrink-0 text-xs font-semibold text-white/80">
                {formatPrice(product?.price) ?? '—'}
              </span>
            </div>
          )
        })}

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs uppercase tracking-wider text-white/50">Total del combo</span>
          <span className="font-display text-2xl uppercase tracking-tight text-white">
            {formatPrice(total) ?? '—'}
          </span>
        </div>

        {note && (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-100/85">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {note}
          </p>
        )}

        <button onClick={addCombo} className="btn-primary w-full">
          <Plus className="h-4 w-4" /> Agregar combo al carrito
        </button>
        <Link to="/catalogo" className="btn-ghost w-full">
          Ver todo el catálogo
        </Link>
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
          Elige tu talla arriba y ajusta cantidades en el carrito
        </p>
      </div>
    </div>
  )
}

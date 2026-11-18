import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, Product } from '@/types'
import { resolveImageUrl } from '@/lib/images'
import { isAvailable } from '@/lib/utils'
import { useCatalog } from '@/store/catalog'

const STORAGE_KEY = 'pm.cart.v1'

export interface AddResult {
  ok: boolean
  added: number
  message: string
}

function lineKey(productId: string, selections: Record<string, string>): string {
  const sig = Object.keys(selections)
    .sort()
    .map((k) => `${k}:${selections[k]}`)
    .join('|')
  return `${productId}::${sig}`
}

function inCartQty(productId: string, lines: CartLine[]): number {
  return lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.qty, 0)
}

function load(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

interface CartContextValue {
  lines: CartLine[]
  count: number
  subtotal: number
  hasUnpricedItems: boolean
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (
    product: Product,
    selections?: Record<string, string>,
    qty?: number,
    silent?: boolean,
  ) => AddResult
  setQty: (key: string, qty: number) => void
  removeLine: (key: string) => void
  clear: () => void
  /** Unidades que aún se pueden añadir de este producto (stock menos lo que ya está en el carrito). */
  availableFor: (product: Product) => number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { products } = useCatalog()
  const [lines, setLines] = useState<CartLine[]>(() => load())
  const [isOpen, setIsOpen] = useState(false)
  const linesRef = useRef<CartLine[]>(lines)
  linesRef.current = lines
  const productsRef = useRef<Product[]>(products)
  productsRef.current = products

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* noop */
    }
  }, [lines])

  // Normaliza el carrito cuando el catálogo real reemplaza al de respaldo y,
  // si el inventario baja o el producto se agota, ajusta las cantidades.
  useEffect(() => {
    setLines((prev) => {
      let changed = false

      // El catálogo local de respaldo se pinta al instante mientras llega la
      // base de datos. Si alguien añadió antes de la carga, la línea guardó un
      // id de ejemplo (no UUID) y el backend rechazaría el pago. La pasamos al
      // producto real por slug y unimos duplicados.
      const normalized: CartLine[] = []
      for (const line of prev) {
        const real = products.some((p) => p.id === line.productId)
          ? undefined
          : products.find((p) => p.slug === line.slug)
        const nextLine: CartLine = real
          ? {
              ...line,
              key: lineKey(real.id, line.selections),
              productId: real.id,
              name: real.name,
              price: real.price,
            }
          : line
        if (real) changed = true
        const existing = normalized.find((l) => l.key === nextLine.key)
        if (existing) {
          existing.qty += nextLine.qty
          changed = true
        } else {
          normalized.push({ ...nextLine })
        }
      }

      const used = new Map<string, number>()
      const next: CartLine[] = []
      for (const l of normalized) {
        const product = products.find((p) => p.id === l.productId)
        // Solo se descarta si el producto desapareció del catálogo o el admin lo
        // marcó como agotado. Un stock en 0 puede significar que un pedido en
        // curso lo tiene reservado: conservamos la línea para no vaciar el
        // carrito cuando el pago falla o el comprador vuelve de la pasarela.
        if (!product || product.availability === 'agotado') {
          changed = true
          continue
        }
        if (typeof product.stock !== 'number' || product.stock <= 0) {
          next.push(l)
          continue
        }
        const usedQty = used.get(l.productId) ?? 0
        const allow = Math.max(0, product.stock - usedQty)
        const q = Math.min(l.qty, allow)
        if (q !== l.qty) changed = true
        if (q > 0) {
          used.set(l.productId, usedQty + q)
          next.push(q === l.qty ? l : { ...l, qty: q })
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [products])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const availableFor = useCallback((product: Product): number => {
    const resolved =
      productsRef.current.find((p) => p.id === product.id) ??
      productsRef.current.find((p) => p.slug === product.slug) ??
      product
    if (!isAvailable(resolved)) return 0
    const stock = typeof resolved.stock === 'number' ? resolved.stock : Number.POSITIVE_INFINITY
    if (!Number.isFinite(stock)) return Number.POSITIVE_INFINITY
    return Math.max(0, stock - inCartQty(resolved.id, linesRef.current))
  }, [])

  const addItem = useCallback(
    (product: Product, selections: Record<string, string> = {}, qty = 1, silent = false): AddResult => {
      // Si el objeto viene del catálogo local de respaldo, usa el real.
      const resolved =
        productsRef.current.find((p) => p.id === product.id) ??
        productsRef.current.find((p) => p.slug === product.slug) ??
        product
      if (!isAvailable(resolved)) {
        return { ok: false, added: 0, message: 'Producto agotado.' }
      }
      const stock = typeof resolved.stock === 'number' ? resolved.stock : Number.POSITIVE_INFINITY
      const current = linesRef.current
      const remaining = stock - inCartQty(resolved.id, current)
      if (remaining <= 0) {
        return {
          ok: false,
          added: 0,
          message:
            stock === 0
              ? 'Producto agotado.'
              : 'Ya tienes todas las unidades disponibles en el carrito.',
        }
      }
      const addQty = Math.min(qty, remaining)
      const key = lineKey(resolved.id, selections)
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key)
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + addQty } : l))
        }
        const line: CartLine = {
          key,
          productId: resolved.id,
          name: resolved.name,
          slug: resolved.slug,
          image: resolved.images?.[0] ? resolveImageUrl(resolved.images[0]) : undefined,
          price: resolved.price,
          qty: addQty,
          selections,
        }
        return [...prev, line]
      })
      if (!silent) setIsOpen(true)
      return {
        ok: true,
        added: addQty,
        message: addQty < qty ? `Solo quedaban ${addQty} unidad(es) disponibles.` : '',
      }
    },
    [],
  )

  const setQty = useCallback(
    (key: string, qty: number) => {
      setLines((prev) => {
        const line = prev.find((l) => l.key === key)
        if (!line) return prev
        const product = products.find((p) => p.id === line.productId)
        if (product && !isAvailable(product)) {
          return prev.filter((l) => l.key !== key)
        }
        const stock = product && typeof product.stock === 'number' ? product.stock : Number.POSITIVE_INFINITY
        const others = inCartQty(line.productId, prev) - line.qty
        const max = Number.isFinite(stock) ? Math.max(1, stock - others) : Number.POSITIVE_INFINITY
        const nextQty = Math.max(1, Math.min(qty, max))
        return prev.map((l) => (l.key === key ? { ...l, qty: nextQty } : l))
      })
    },
    [products],
  )

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const { count, subtotal, hasUnpricedItems } = useMemo(() => {
    let c = 0
    let s = 0
    let unpriced = false
    for (const l of lines) {
      c += l.qty
      if (l.price == null) unpriced = true
      else s += l.price * l.qty
    }
    return { count: c, subtotal: s, hasUnpricedItems: unpriced }
  }, [lines])

  const value: CartContextValue = {
    lines,
    count,
    subtotal,
    hasUnpricedItems,
    isOpen,
    openCart,
    closeCart,
    addItem,
    setQty,
    removeLine,
    clear,
    availableFor,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}

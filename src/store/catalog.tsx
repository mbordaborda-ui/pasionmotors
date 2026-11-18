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
import type { Category, CategoryId, Product } from '@/types'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  categoryToRow,
  isUuid,
  productToRow,
  rowToCategory,
  rowToProduct,
  type CategoryRow,
  type ProductRow,
} from '@/lib/db'
import { describeError, reportSaveError, type SaveResult } from '@/lib/save'
import { uploadImage } from '@/lib/storage'
import { withTimeout } from '@/lib/timeout'
import seedData from '@/data/catalog.json'
import { categories as fallbackCategories } from '@/data/categories'

/** Catálogo local de respaldo: se usa si Netlify no tiene las variables de Supabase. */
const seedProducts = (seedData as { products: Product[] }).products

/**
 * Última copia buena del catálogo. Se muestra al instante al abrir la tienda
 * (aunque la red móvil tarde) y se refresca en segundo plano con Supabase.
 */
const CACHE_KEY = 'pm-catalog-cache-v1'
const CATALOG_TIMEOUT_MS = 12_000
/** Por encima de esto el catálogo trae fotos incrustadas: no conviene cachearlo. */
const MAX_CACHE_BYTES = 500_000

interface CatalogCache {
  products: Product[]
  categories: Category[]
  savedAt: string
}

function readCache(): CatalogCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    if (raw.length > MAX_CACHE_BYTES) {
      window.localStorage.removeItem(CACHE_KEY)
      return null
    }
    const parsed = JSON.parse(raw) as Partial<CatalogCache>
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) return null
    return {
      products: parsed.products,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function writeCache(products: Product[], categories: Category[]) {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify({ products, categories, savedAt: new Date().toISOString() })
    // Evita bloquear el hilo principal (y llenar el almacenamiento) con fotos
    // incrustadas en base64.
    if (payload.length > MAX_CACHE_BYTES) return
    window.localStorage.setItem(CACHE_KEY, payload)
  } catch {
    // Sin espacio o almacenamiento bloqueado: el catálogo sigue funcionando.
  }
}

/** Selección con los recursos anidados de cada producto. */
const PRODUCT_SELECT = `
  id, slug, name, category_id, price, cost, compare_at_price, availability, stock, sold,
  tagline, description, badge, featured, featured_order, best_seller, best_seller_order,
  is_new, sort_order,
  product_images ( url, position ),
  product_variants ( id, name, position, product_variant_options ( id, label, position ) ),
  product_specs ( label, value, position )
`

export interface UnavailableItem {
  productId: string
  name: string
  requested: number
  available: number
}

interface CatalogContextValue {
  products: Product[]
  categories: Category[]
  categoryMap: Record<CategoryId, Category>
  /** `true` mientras se cargan los datos por primera vez. */
  loading: boolean
  /** Motivo de la última actualización fallida (si la hubo). */
  error: string | null
  /** Vuelve a pedir el catálogo a la base de datos. */
  retry: () => void
  getBySlug: (slug: string) => Product | undefined
  getById: (id: string) => Product | undefined
  getCategory: (id: CategoryId) => Category | undefined
  byCategory: (category: CategoryId) => Product[]
  featured: () => Product[]
  bestSellers: () => Product[]
  newest: () => Product[]
  /** Actualiza una categoría (nombre, textos, imagen y orden). */
  upsertCategory: (category: Category) => Promise<SaveResult>
  /**
   * Guarda (crea o actualiza) un producto en la base de datos.
   * Devuelve el producto definitivo solo si la base confirmó el guardado.
   */
  upsertProduct: (
    product: Product,
    options?: { stockExpected?: number | null },
  ) => Promise<SaveResult & { product?: Product }>
  removeProduct: (id: string) => Promise<SaveResult>
  duplicateProduct: (id: string) => Promise<SaveResult>
  /**
   * Mueve a Storage las fotos incrustadas (base64) que hacen que el catálogo
   * pese varios MB y tarde en cargar en móvil. No cambia el contenido visible.
   */
  optimizeInlineImages: () => Promise<SaveResult & { migrated?: number; failed?: number }>
  resetCatalog: () => Promise<SaveResult>
  importCatalog: (json: string) => Promise<SaveResult & { count?: number }>
  exportCatalog: () => string
  /** Define, en orden, los productos destacados. El resto se desmarca. */
  setFeatured: (ids: string[]) => Promise<SaveResult>
  /** Define, en orden, los productos de «Más vendidos». El resto se desmarca. */
  setBestSellers: (ids: string[]) => Promise<SaveResult>
  isCustomized: boolean
  lastUpdated: string
  rev: number
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))
}

const seedBySlug = new Map(seedProducts.map((product) => [product.slug, product]))

/**
 * La base de datos puede no tener todavía las fotos de un producto que sí
 * están en el catálogo local. Completamos imágenes y textos pendientes para
 * que la tienda nunca muestre un espacio vacío cuando existe el recurso.
 */
function withSeedAssets(list: Product[]): Product[] {
  return list.map((product) => {
    const seed = seedBySlug.get(product.slug)
    if (!seed) return product
    const staleCopy = /pendiente de confirmar/i.test(product.description ?? '')
    return {
      ...product,
      images: product.images?.length ? product.images : seed.images,
      tagline: staleCopy && seed.tagline ? seed.tagline : product.tagline,
      description: staleCopy && seed.description ? seed.description : product.description,
    }
  })
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return withSeedAssets((data as unknown as ProductRow[]).map(rowToProduct))
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as CategoryRow[]).map(rowToCategory)
}

/** Convierte el producto al formato que espera la RPC `save_product`. */
function productPayload(p: Product, stockExpected?: number | null): Record<string, unknown> {
  return {
    ...productToRow(p),
    id: p.id,
    ...(typeof stockExpected === 'number' ? { stock_expected: stockExpected } : {}),
    images: p.images ?? [],
    variants: (p.variants ?? []).map((v) => ({
      name: v.name,
      options: (v.options ?? []).map((o) => o.label),
    })),
    specs: (p.specs ?? []).map((s) => ({ label: s.label, value: s.value })),
  }
}

interface RpcResult {
  ok?: boolean
  error?: string
  count?: number
  id?: string
  stock?: number | null
}

/**
 * Guarda el producto, sus imágenes, variantes y especificaciones en UNA sola
 * transacción del servidor (`save_product`). Si algo falla, no queda nada a
 * medias y se devuelve el error real en lugar de fingir que se guardó.
 */
async function persistProduct(
  p: Product,
  stockExpected?: number | null,
): Promise<SaveResult & { stock?: number | null }> {
  if (!isSupabaseConfigured) return { ok: true }

  const { data, error } = await supabase.rpc('save_product', {
    p_product: productPayload(p, stockExpected),
  })
  if (error) return { ok: false, error: describeError(error) }

  const res = data as RpcResult | null
  if (!res?.ok) {
    return { ok: false, error: res?.error ?? 'La base de datos no confirmó el guardado.' }
  }
  return { ok: true, stock: res.stock ?? null }
}

/** Reemplaza todo el catálogo de forma atómica (si un producto falla, se revierte). */
async function persistCatalog(list: Product[]): Promise<SaveResult> {
  if (!isSupabaseConfigured) return { ok: true }
  if (list.length === 0) {
    return { ok: false, error: 'El catálogo no puede quedar vacío.' }
  }

  const payload = list.map((p) =>
    productPayload({ ...p, id: isUuid(p.id) ? p.id : crypto.randomUUID() }),
  )
  const { data, error } = await supabase.rpc('replace_catalog', { p_products: payload })
  if (error) return { ok: false, error: describeError(error) }

  const res = data as RpcResult | null
  if (!res?.ok) {
    return { ok: false, error: res?.error ?? 'La base de datos no confirmó el reemplazo.' }
  }
  return { ok: true }
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  // Copia guardada en el dispositivo: permite pintar el catálogo al instante.
  const [initialCache] = useState<CatalogCache | null>(() =>
    isSupabaseConfigured ? readCache() : null,
  )
  const [products, setProducts] = useState<Product[]>(
    () => initialCache?.products ?? seedProducts,
  )
  const [categories, setCategories] = useState<Category[]>(() =>
    initialCache?.categories?.length ? initialCache.categories : fallbackCategories,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rev, setRev] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(
    () => initialCache?.savedAt ?? new Date().toISOString(),
  )
  const productsRef = useRef<Product[]>([])
  productsRef.current = products
  const cacheReady = useRef(false)
  const inflight = useRef<Promise<void> | null>(null)
  const inflightCategories = useRef<Promise<void> | null>(null)

  const refresh = useCallback((): Promise<void> => {
    if (!isSupabaseConfigured) {
      setProducts(seedProducts)
      setLoading(false)
      return Promise.resolve()
    }
    // Evita peticiones duplicadas (StrictMode, realtime y reintentos a la vez).
    if (inflight.current) return inflight.current

    const run = (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('Sin conexión. Se muestra el catálogo guardado en este dispositivo.')
        }
        const list = await withTimeout(
          fetchProducts(),
          CATALOG_TIMEOUT_MS,
          'La carga del catálogo tardó demasiado. Se muestra la última copia guardada.',
        )
        setProducts(list)
        setError(null)
        setLastUpdated(new Date().toISOString())
        setRev((r) => r + 1)
        cacheReady.current = true
      } catch (err) {
        console.error('[catalog.refresh]', err)
        setError(describeError(err, 'No se pudo actualizar el catálogo.'))
        // Nunca vaciamos la tienda: se conserva lo último bueno que haya.
        setProducts((prev) => (prev.length > 0 ? prev : seedProducts))
      } finally {
        setLoading(false)
      }
    })()

    inflight.current = run
    void run.finally(() => {
      if (inflight.current === run) inflight.current = null
    })
    return run
  }, [])

  const refreshCategories = useCallback((): Promise<void> => {
    if (!isSupabaseConfigured) return Promise.resolve()
    if (inflightCategories.current) return inflightCategories.current

    const run = (async () => {
      try {
        const list = await withTimeout(
          fetchCategories(),
          CATALOG_TIMEOUT_MS,
          'La carga de categorías tardó demasiado.',
        )
        if (list.length > 0) setCategories(list)
      } catch (err) {
        console.error('[catalog.categories]', err)
      }
    })()

    inflightCategories.current = run
    void run.finally(() => {
      if (inflightCategories.current === run) inflightCategories.current = null
    })
    return run
  }, [])

  const retry = useCallback(() => {
    void refresh()
    void refreshCategories()
  }, [refresh, refreshCategories])

  // Carga inicial
  useEffect(() => {
    void refresh()
    void refreshCategories()
  }, [refresh, refreshCategories])

  // Guarda la última copia buena para la próxima visita.
  useEffect(() => {
    if (!cacheReady.current) return
    writeCache(products, categories)
  }, [products, categories])

  // Al recuperar la conexión se reintenta sin que el usuario haga nada.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      void refresh()
      void refreshCategories()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh, refreshCategories])

  // Sincronización en vivo entre pestañas y con otros dispositivos.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void refresh()
        void refreshCategories()
      }, 400)
    }
    const channel = supabase
      .channel('catalog-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variant_options' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_specs' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, schedule)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [refresh, refreshCategories])

  const getBySlug = useCallback((slug: string) => products.find((p) => p.slug === slug), [products])
  const getById = useCallback((id: string) => products.find((p) => p.id === id), [products])
  const getCategory = useCallback(
    (id: CategoryId) => categories.find((c) => c.id === id),
    [categories],
  )
  const categoryMap = useMemo(
    () =>
      Object.fromEntries(categories.map((c) => [c.id, c])) as Record<CategoryId, Category>,
    [categories],
  )
  const byCategory = useCallback(
    (category: CategoryId) => products.filter((p) => p.category === category),
    [products],
  )
  const featuredList = useMemo(
    () =>
      products
        .filter((p) => p.featured)
        .sort(
          (a, b) =>
            (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0) ||
            (a.order ?? 999) - (b.order ?? 999),
        ),
    [products],
  )
  const bestSellerList = useMemo(
    () =>
      products
        .filter((p) => p.bestSeller)
        .sort(
          (a, b) =>
            (a.bestSellerOrder ?? 0) - (b.bestSellerOrder ?? 0) ||
            (b.sold ?? 0) - (a.sold ?? 0) ||
            (a.order ?? 999) - (b.order ?? 999),
        ),
    [products],
  )
  const newestList = useMemo(() => products.filter((p) => p.isNew), [products])
  const featured = useCallback(() => featuredList, [featuredList])
  const bestSellers = useCallback(() => bestSellerList, [bestSellerList])
  const newest = useCallback(() => newestList, [newestList])

  const upsertCategory = useCallback(async (category: Category): Promise<SaveResult> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('categories').upsert(categoryToRow(category))
      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo guardar la categoría.', message)
        void refreshCategories()
        return { ok: false, error: message }
      }
    }
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id)
      return exists
        ? prev.map((c) => (c.id === category.id ? category : c))
        : [...prev, category].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    })
    return { ok: true }
  }, [refreshCategories])

  const upsertProduct = useCallback(
    async (
      input: Product,
      options?: { stockExpected?: number | null },
    ): Promise<SaveResult & { product?: Product }> => {
      const id = isUuid(input.id) ? input.id : crypto.randomUUID()
      const product: Product = { ...input, id }

      const res = await persistProduct(product, options?.stockExpected)
      if (!res.ok) {
        reportSaveError('No se pudo guardar el producto.', res.error)
        return { ok: false, error: res.error }
      }

      // Se refleja el stock real que quedó en la base (pudo cambiar por ventas).
      const saved: Product = {
        ...product,
        stock: typeof res.stock === 'number' ? res.stock : undefined,
      }

      setProducts((prev) => {
        const exists = prev.some((p) => p.id === saved.id)
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
      })
      setLastUpdated(new Date().toISOString())
      return { ok: true, product: saved }
    },
    [],
  )

  const removeProduct = useCallback(
    async (id: string): Promise<SaveResult> => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) {
          const message = describeError(error)
          reportSaveError('No se pudo eliminar el producto.', message)
          return { ok: false, error: message }
        }
      }
      setProducts((prev) => prev.filter((p) => p.id !== id))
      setLastUpdated(new Date().toISOString())
      return { ok: true }
    },
    [],
  )

  const duplicateProduct = useCallback(
    async (id: string): Promise<SaveResult> => {
      const source = productsRef.current.find((p) => p.id === id)
      if (!source) return { ok: false, error: 'El producto ya no existe.' }

      const copy: Product = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        slug: `${source.slug}-copia-${Math.random().toString(36).slice(2, 6)}`,
        name: `${source.name} (copia)`,
        order: (source.order ?? 999) + 1,
        featured: false,
        featuredOrder: 0,
      }

      const res = await persistProduct(copy)
      if (!res.ok) {
        reportSaveError('No se pudo duplicar el producto.', res.error)
        return res
      }
      setProducts((prev) => [...prev, copy])
      setLastUpdated(new Date().toISOString())
      return { ok: true }
    },
    [],
  )

  const optimizeInlineImages = useCallback(
    async (): Promise<SaveResult & { migrated?: number; failed?: number }> => {
      if (!isSupabaseConfigured) return { ok: true, migrated: 0, failed: 0 }

      const candidates = productsRef.current.filter((p) =>
        (p.images ?? []).some((img) => img.startsWith('data:')),
      )
      if (candidates.length === 0) return { ok: true, migrated: 0, failed: 0 }

      const updated = new Map<string, Product>()
      let migrated = 0
      let failed = 0

      for (const product of candidates) {
        const images: string[] = []
        let replaced = 0
        for (const image of product.images ?? []) {
          if (!image.startsWith('data:')) {
            images.push(image)
            continue
          }
          try {
            const blob = await (await fetch(image)).blob()
            images.push(await uploadImage('product-images', blob, 'catalogo/'))
            replaced++
          } catch (err) {
            console.error('[catalog.inlineImage]', err)
            images.push(image)
            failed++
          }
        }

        if (replaced === 0) continue

        const res = await persistProduct({ ...product, images })
        if (!res.ok) {
          failed++
          continue
        }
        updated.set(product.id, {
          ...product,
          images,
          stock: typeof res.stock === 'number' ? res.stock : product.stock,
        })
        migrated += replaced
      }

      if (updated.size > 0) {
        setProducts((prev) => prev.map((p) => updated.get(p.id) ?? p))
        setLastUpdated(new Date().toISOString())
      }

      return {
        ok: failed === 0,
        migrated,
        failed,
        error:
          failed > 0
            ? 'Algunas fotos no se pudieron mover. Revisa la conexión e inténtalo de nuevo.'
            : undefined,
      }
    },
    [],
  )

  const setFeatured = useCallback(async (ids: string[]): Promise<SaveResult> => {
    setProducts((prev) =>
      prev.map((p) => {
        const idx = ids.indexOf(p.id)
        if (idx >= 0) return { ...p, featured: true, featuredOrder: idx }
        return p.featured ? { ...p, featured: false, featuredOrder: 0 } : p
      }),
    )

    if (!isSupabaseConfigured) return { ok: true }

    const { error: clearError } = await supabase
      .from('products')
      .update({ featured: false, featured_order: 0 })
      .eq('featured', true)
    if (clearError) {
      const message = describeError(clearError)
      reportSaveError('No se pudieron guardar los destacados.', message)
      void refresh()
      return { ok: false, error: message }
    }

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('products')
        .update({ featured: true, featured_order: i })
        .eq('id', ids[i])
      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudieron guardar los destacados.', message)
        void refresh()
        return { ok: false, error: message }
      }
    }
    return { ok: true }
  }, [refresh])

  const setBestSellers = useCallback(async (ids: string[]): Promise<SaveResult> => {
    setProducts((prev) =>
      prev.map((p) => {
        const idx = ids.indexOf(p.id)
        if (idx >= 0) return { ...p, bestSeller: true, bestSellerOrder: idx }
        return p.bestSeller ? { ...p, bestSeller: false, bestSellerOrder: 0 } : p
      }),
    )

    if (!isSupabaseConfigured) return { ok: true }

    const { error: clearError } = await supabase
      .from('products')
      .update({ best_seller: false, best_seller_order: 0 })
      .eq('best_seller', true)
    if (clearError) {
      const message = describeError(clearError)
      reportSaveError('No se pudieron guardar los más vendidos.', message)
      void refresh()
      return { ok: false, error: message }
    }

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('products')
        .update({ best_seller: true, best_seller_order: i })
        .eq('id', ids[i])
      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudieron guardar los más vendidos.', message)
        void refresh()
        return { ok: false, error: message }
      }
    }
    return { ok: true }
  }, [refresh])

  const resetCatalog = useCallback(async (): Promise<SaveResult> => {
    const seed = (seedData as { products: Product[] }).products
    const res = await persistCatalog(
      seed.map((p) => ({ ...p, id: crypto.randomUUID(), featuredOrder: p.featuredOrder ?? 0 })),
    )
    if (!res.ok) {
      reportSaveError('No se pudo restablecer el catálogo.', res.error)
      return res
    }
    await refresh()
    return { ok: true }
  }, [refresh])

  const importCatalog = useCallback(
    async (json: string): Promise<SaveResult & { count?: number }> => {
      let list: Product[]
      try {
        const parsed = JSON.parse(json) as Product[] | { products: Product[] }
        list = Array.isArray(parsed) ? parsed : parsed.products
      } catch {
        return { ok: false, error: 'El archivo no es un JSON válido.' }
      }
      if (!Array.isArray(list)) {
        return { ok: false, error: 'El archivo no contiene una lista de productos.' }
      }

      const res = await persistCatalog(
        list.map((p) => ({ ...p, id: isUuid(p.id) ? p.id : crypto.randomUUID() })),
      )
      if (!res.ok) {
        reportSaveError('No se pudo importar el catálogo.', res.error)
        return res
      }
      await refresh()
      return { ok: true, count: list.length }
    },
    [refresh],
  )

  const exportCatalog = useCallback(
    () =>
      JSON.stringify(
        { version: 1, updatedAt: new Date().toISOString(), products: productsRef.current },
        null,
        2,
      ),
    [],
  )

  const value: CatalogContextValue = useMemo(
    () => ({
      products,
      categories,
      categoryMap,
      loading,
      error,
      retry,
      getBySlug,
      getById,
      getCategory,
      byCategory,
      featured,
      bestSellers,
      newest,
      upsertCategory,
      upsertProduct,
      removeProduct,
      duplicateProduct,
      optimizeInlineImages,
      resetCatalog,
      importCatalog,
      exportCatalog,
      setFeatured,
      setBestSellers,
      isCustomized: false,
      lastUpdated,
      rev,
    }),
    [
      products,
      categories,
      categoryMap,
      loading,
      error,
      retry,
      getBySlug,
      getById,
      getCategory,
      byCategory,
      featured,
      bestSellers,
      newest,
      upsertCategory,
      upsertProduct,
      removeProduct,
      duplicateProduct,
      optimizeInlineImages,
      resetCatalog,
      importCatalog,
      exportCatalog,
      setFeatured,
      setBestSellers,
      lastUpdated,
      rev,
    ],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>')
  return ctx
}

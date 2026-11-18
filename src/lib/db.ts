/**
 * Traductores entre las filas de Supabase (snake_case) y los tipos de la app.
 * Mantener todo el mapeo aquí evita repetir conversiones en cada store.
 */
import type {
  AppUser,
  Availability,
  CartLine,
  Category,
  CategoryId,
  GarageCar,
  Gift,
  HeroRotation,
  Order,
  OrderCustomer,
  OrderItem,
  OrderStatus,
  Product,
  Promo,
  PromoKind,
  Spec,
  Spot,
  SpotComment,
  Variant,
} from '@/types'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value)
}

/* ------------------------------- Productos ------------------------------- */

interface ImageRow {
  url: string
  position: number
}
interface VariantOptionRow {
  id: string
  label: string
  position: number
}
interface VariantRow {
  id: string
  name: string
  position: number
  product_variant_options?: VariantOptionRow[]
}
interface SpecRow {
  label: string
  value: string
  position: number
}

export interface ProductRow {
  id: string
  slug: string
  name: string
  category_id: string
  price: number | null
  cost: number | null
  compare_at_price: number | null
  availability: Availability
  stock: number | null
  sold: number
  tagline: string | null
  description: string | null
  badge: string | null
  featured: boolean
  featured_order: number
  best_seller: boolean
  best_seller_order: number
  is_new: boolean
  sort_order: number
  product_images?: ImageRow[]
  product_variants?: VariantRow[]
  product_specs?: SpecRow[]
}

const byPosition = <T extends { position: number }>(list: T[] | undefined): T[] =>
  [...(list ?? [])].sort((a, b) => a.position - b.position)

export function rowToProduct(row: ProductRow): Product {
  const variants: Variant[] = byPosition(row.product_variants).map((v) => ({
    id: v.id,
    name: v.name,
    options: byPosition(v.product_variant_options).map((o) => ({ id: o.id, label: o.label })),
  }))
  const specs: Spec[] = byPosition(row.product_specs).map((s) => ({ label: s.label, value: s.value }))
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_id as CategoryId,
    price: row.price,
    cost: row.cost ?? undefined,
    compareAtPrice: row.compare_at_price,
    availability: row.availability,
    stock: row.stock ?? undefined,
    sold: row.sold,
    tagline: row.tagline ?? undefined,
    description: row.description ?? undefined,
    badge: row.badge ?? undefined,
    featured: row.featured,
    featuredOrder: row.featured_order,
    bestSeller: row.best_seller,
    bestSellerOrder: row.best_seller_order,
    isNew: row.is_new,
    order: row.sort_order,
    images: byPosition(row.product_images).map((i) => i.url),
    variants,
    specs,
  }
}

export function productToRow(p: Product): Record<string, unknown> {
  return {
    slug: p.slug,
    name: p.name,
    category_id: p.category,
    price: p.price,
    cost: p.cost ?? null,
    compare_at_price: p.compareAtPrice ?? null,
    availability: p.availability,
    stock: typeof p.stock === 'number' ? p.stock : null,
    sold: p.sold ?? 0,
    tagline: p.tagline ?? null,
    description: p.description ?? null,
    badge: p.badge ?? null,
    featured: !!p.featured,
    featured_order: p.featuredOrder ?? 0,
    best_seller: !!p.bestSeller,
    best_seller_order: p.bestSellerOrder ?? 0,
    is_new: !!p.isNew,
    sort_order: p.order ?? 0,
  }
}

/* ------------------------------- Categorías ------------------------------- */

export interface CategoryRow {
  id: string
  name: string
  short: string | null
  description: string | null
  image: string | null
  accent: string | null
  sort_order: number
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id as CategoryId,
    name: row.name,
    short: row.short ?? row.name,
    description: row.description ?? '',
    image: row.image ?? undefined,
    accent: row.accent ?? '#FF1E2D',
    order: row.sort_order,
  }
}

export function categoryToRow(c: Category): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    short: c.short,
    description: c.description,
    image: c.image || null,
    accent: c.accent,
    sort_order: c.order ?? 0,
  }
}

/* --------------------------------- Ajustes -------------------------------- */

export interface SiteRow {
  name: string
  tagline: string | null
  currency: string
  locale: string
  whatsapp: string | null
  email: string | null
  instagram: string | null
  tiktok: string | null
  city: string | null
  free_shipping_from: number | null
  min_order: number | null
  hero_image: string | null
  hero_images?: string[] | null
  hero_rotation?: string | null
  featured_eyebrow: string | null
  featured_title: string | null
  featured_description: string | null
  garage: GarageCar[] | null
  legal_updated_at: string | null
}

function parseHeroRotation(value: string | null | undefined): HeroRotation | undefined {
  return value === 'off' || value === 'random' || value === 'daily' || value === 'weekly'
    ? value
    : undefined
}

export function rowToSite(row: SiteRow) {
  return {
    name: row.name,
    tagline: row.tagline ?? '',
    currency: row.currency,
    locale: row.locale,
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    instagram: row.instagram ?? undefined,
    tiktok: row.tiktok ?? undefined,
    city: row.city ?? undefined,
    freeShippingFrom: row.free_shipping_from,
    minOrder: row.min_order,
    heroImage: row.hero_image ?? undefined,
    heroImages: Array.isArray(row.hero_images)
      ? row.hero_images.map((url) => String(url ?? '').trim()).filter(Boolean)
      : undefined,
    heroRotation: parseHeroRotation(row.hero_rotation),
    featuredEyebrow: row.featured_eyebrow ?? undefined,
    featuredTitle: row.featured_title ?? undefined,
    featuredDescription: row.featured_description ?? undefined,
    garage: Array.isArray(row.garage) ? row.garage : undefined,
    legalUpdatedAt: row.legal_updated_at ?? undefined,
  }
}

export function siteToRow(s: {
  name: string
  tagline?: string
  currency: string
  locale: string
  whatsapp?: string
  email?: string
  instagram?: string
  tiktok?: string
  city?: string
  freeShippingFrom?: number | null
  minOrder?: number | null
  heroImage?: string
  heroImages?: string[]
  heroRotation?: HeroRotation
  featuredEyebrow?: string
  featuredTitle?: string
  featuredDescription?: string
  garage?: GarageCar[]
  legalUpdatedAt?: string | null
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: s.name,
    tagline: s.tagline ?? null,
    currency: s.currency,
    locale: s.locale,
    whatsapp: s.whatsapp ?? null,
    email: s.email ?? null,
    instagram: s.instagram ?? null,
    tiktok: s.tiktok ?? null,
    city: s.city ?? null,
    free_shipping_from: s.freeShippingFrom ?? null,
    min_order: s.minOrder ?? null,
    hero_image: s.heroImage ?? null,
    featured_eyebrow: s.featuredEyebrow ?? null,
    featured_title: s.featuredTitle ?? null,
    featured_description: s.featuredDescription ?? null,
    garage: s.garage ?? [],
    legal_updated_at: s.legalUpdatedAt ?? null,
  }

  // Solo se envían las columnas nuevas si el ajuste existe. Así el panel sigue
  // guardando aunque todavía no se haya ejecutado supabase/hero-rotativo.sql.
  if (s.heroImages !== undefined || s.heroRotation !== undefined) {
    row.hero_images = (s.heroImages ?? []).map((url) => url.trim()).filter(Boolean)
    row.hero_rotation = s.heroRotation ?? 'off'
  }

  return row
}

/* --------------------------------- Regalos -------------------------------- */

export interface GiftRow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  sort_order: number
}

export const rowToGift = (row: GiftRow): Gift => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  enabled: row.enabled,
  order: row.sort_order,
})

export const giftToRow = (g: Gift) => ({
  id: g.id,
  name: g.name,
  description: g.description,
  enabled: g.enabled,
  sort_order: g.order,
})

/* ------------------------------ Promociones ------------------------------- */

export interface PromoRow {
  id: string
  kind: PromoKind
  title: string
  message: string | null
  amount: number | null
  enabled: boolean
  sort_order: number
}

export const rowToPromo = (row: PromoRow): Promo => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  message: row.message ?? '',
  amount: row.amount,
  enabled: row.enabled,
  order: row.sort_order,
})

export const promoToRow = (p: Promo) => ({
  id: p.id,
  kind: p.kind,
  title: p.title,
  message: p.message,
  amount: p.amount,
  enabled: p.enabled,
  sort_order: p.order,
})

/* --------------------------------- Spots ---------------------------------- */

export interface SpotRow {
  id: string
  image: string
  car: string | null
  location: string | null
  author: string | null
  user_id: string | null
  created_at: string
}

export const rowToSpot = (row: SpotRow): Spot => ({
  id: row.id,
  image: row.image,
  car: row.car ?? undefined,
  location: row.location ?? undefined,
  author: row.author ?? undefined,
  likeCount: 0,
  likedByMe: false,
  comments: [],
  createdAt: row.created_at,
})

export interface SpotCommentRow {
  id: string
  spot_id: string
  user_id: string | null
  author: string | null
  body: string
  created_at: string
}

export const rowToSpotComment = (row: SpotCommentRow): SpotComment => ({
  id: row.id,
  spotId: row.spot_id,
  userId: row.user_id,
  author: row.author?.trim() || 'Comunidad',
  body: row.body,
  createdAt: row.created_at,
})

/* -------------------------------- Perfiles -------------------------------- */

export interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  role: 'admin' | 'user'
  created_at: string
}

export const rowToProfile = (row: ProfileRow): AppUser => ({
  id: row.id,
  name: row.name ?? '',
  email: row.email ?? '',
  role: row.role,
  createdAt: row.created_at,
})

/* --------------------------------- Pedidos -------------------------------- */

export interface OrderItemRow {
  product_id: string | null
  name: string
  qty: number
  price: number | null
  selections: Record<string, string> | null
  position?: number
}

export interface OrderGiftRow {
  gift_id: string | null
  name: string | null
}

export interface OrderRow {
  id: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  customer_document: string | null
  customer_city: string | null
  customer_address: string | null
  notes: string | null
  subtotal: number
  total: number | null
  currency: string | null
  status: string | null
  count: number
  provider_payment_id?: string | null
  tracking_number?: string | null
  tracking_carrier?: string | null
  tracking_url?: string | null
  shipped_at?: string | null
  terms_accepted_at?: string | null
  terms_version?: string | null
  created_at: string
  order_items?: OrderItemRow[]
  order_gifts?: OrderGiftRow[]
}

export function rowToOrder(row: OrderRow): Order {
  const customer: OrderCustomer = {
    name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone ?? '',
    document: row.customer_document ?? undefined,
    city: row.customer_city ?? '',
    address: row.customer_address ?? '',
    notes: row.notes ?? undefined,
  }
  const items: OrderItem[] = (row.order_items ?? []).map((it) => ({
    productId: it.product_id ?? '',
    name: it.name,
    qty: it.qty,
    price: it.price,
    selections: it.selections ?? {},
  }))
  const gifts = (row.order_gifts ?? []).map((g) => g.name ?? g.gift_id ?? '').filter(Boolean)
  const status = (row.status ?? 'pending') as OrderStatus
  return {
    id: row.id,
    createdAt: row.created_at,
    customer,
    items,
    gifts,
    subtotal: row.subtotal,
    total: row.total ?? row.subtotal,
    currency: row.currency ?? 'COP',
    status,
    count: row.count,
    paymentId: row.provider_payment_id ?? undefined,
    userId: row.user_id ?? undefined,
    trackingNumber: row.tracking_number ?? undefined,
    trackingCarrier: row.tracking_carrier ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    shippedAt: row.shipped_at ?? undefined,
    termsAcceptedAt: row.terms_accepted_at ?? undefined,
    termsVersion: row.terms_version ?? undefined,
  }
}

/* --------------------------------- Carrito -------------------------------- */

/** (Sin tabla de carrito: se conserva en localStorage por dispositivo.) */
export type StoredCartLine = CartLine

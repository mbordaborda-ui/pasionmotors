export type CategoryId = 'accesorios' | 'coleccionables' | 'camisetas'

export type Availability = 'disponible' | 'agotado' | 'pendiente'

export interface VariantOption {
  id: string
  label: string
}

export interface Variant {
  id: string
  /** Tipo de variante: talla, color, acabado, etc. */
  name: string
  options: VariantOption[]
}

export interface Spec {
  label: string
  value: string
}

export interface Product {
  id: string
  slug: string
  name: string
  category: CategoryId
  /** Precio en la moneda configurada. `null` = pendiente de configurar. */
  price: number | null
  /** Costo unitario de compra. Solo para calcular márgenes en el panel admin. */
  cost?: number
  /** Precio anterior (solo si existe un descuento REAL configurado). */
  compareAtPrice?: number | null
  availability: Availability
  /**
   * Unidades disponibles en inventario. Cuando es un número, controla la
   * disponibilidad (0 = agotado) y se descuenta en cada venta. Si se omite,
   * se usa el campo `availability` sin control de inventario.
   */
  stock?: number
  /** Unidades vendidas (informativo). */
  sold?: number
  /** Frase corta que aparece en las tarjetas. */
  tagline?: string
  description?: string
  /** URLs de imágenes. Admite enlaces de Google Drive o cualquier URL pública. */
  images: string[]
  variants?: Variant[]
  specs?: Spec[]
  /** Mostrar en la sección "Productos destacados" del inicio. */
  featured?: boolean
  /** Posición dentro de "Productos destacados" (menor = primero). */
  featuredOrder?: number
  /** Mostrar en la sección "Novedades". */
  isNew?: boolean
  /** Mostrar en la sección "Más vendidos" del inicio. */
  bestSeller?: boolean
  /** Posición dentro de "Más vendidos" (menor = primero). */
  bestSellerOrder?: number
  /** Etiqueta libre sobre la tarjeta (ej. "Edición limitada"). */
  badge?: string
  order?: number
}

export interface Category {
  id: CategoryId
  name: string
  short: string
  description: string
  /** Imagen de portada (URL o ruta). Vacío => placeholder de marca. */
  image?: string
  accent: string
  order?: number
}

/** Auto de la galería "El garage" del inicio. */
export interface GarageCar {
  id: string
  name: string
  tag: string
  note: string
  image: string
}

/** Frecuencia con la que cambia la foto principal del inicio. */
export type HeroRotation = 'off' | 'random' | 'daily' | 'weekly'

export interface SiteConfig {
  name: string
  tagline: string
  currency: string
  locale: string
  whatsapp?: string
  email?: string
  instagram?: string
  tiktok?: string
  city?: string
  freeShippingFrom?: number | null
  /** Monto mínimo de compra (subtotal). `null` o 0 = sin mínimo. */
  minOrder?: number | null
  /** Foto fija del hero cuando la rotación está desactivada. */
  heroImage?: string
  /** Fotos que se alternan en el hero (solo las que tengan URL). */
  heroImages?: string[]
  /** `off` = una sola foto; `daily`/`weekly` = rota la lista. */
  heroRotation?: HeroRotation
  /** Encabezado (eyebrow) de la sección "Piezas destacadas" del inicio. */
  featuredEyebrow?: string
  /** Título de la sección "Piezas destacadas". La última palabra se resalta en rojo. */
  featuredTitle?: string
  /** Descripción de la sección "Piezas destacadas". */
  featuredDescription?: string
  /** Autos de la galería "El garage". Si está vacío se usa la galería por defecto. */
  garage?: GarageCar[]
  /** Fecha (ISO) de la última actualización de las políticas legales. */
  legalUpdatedAt?: string | null
}

export interface CartLine {
  key: string
  productId: string
  name: string
  slug: string
  image?: string
  price: number | null
  qty: number
  selections: Record<string, string>
}

/** Regalo / extra que acompaña al pedido. `enabled: false` = oculto en la tienda. */
export interface Gift {
  id: string
  name: string
  description: string
  enabled: boolean
  order: number
}

export type Role = 'admin' | 'user'

/** Cuenta de usuario autenticada con Supabase Auth. */
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export interface OrderItem {
  productId: string
  name: string
  qty: number
  price: number | null
  selections: Record<string, string>
}

export interface OrderCustomer {
  name: string
  email: string
  phone: string
  /** Documento de identidad de quien recibe. */
  document?: string
  city: string
  address: string
  notes?: string
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'expired' | 'cancelled'

export type RestockStatus = 'new' | 'contacted' | 'ordered' | 'restocked' | 'closed'

/** Solicitud de un cliente para un producto agotado. */
export interface RestockRequest {
  id: string
  productId: string | null
  productName: string
  productSlug: string | null
  productCategory: string | null
  email: string
  name: string | null
  phone: string | null
  qty: number
  notes: string | null
  status: RestockStatus
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  createdAt: string
  customer: OrderCustomer
  items: OrderItem[]
  /** IDs de los regalos incluidos. */
  gifts: string[]
  subtotal: number
  /** Total a cobrar, calculado por el servidor. */
  total: number
  currency: string
  status: OrderStatus
  count: number
  /** Id del pago en la pasarela (cuando existe). */
  paymentId?: string
  userId?: string
  /** Número de guía de la transportadora. */
  trackingNumber?: string
  /** Nombre de la transportadora (opcional). */
  trackingCarrier?: string
  /** Enlace público para consultar el envío en la transportadora. */
  trackingUrl?: string
  /** Fecha en que salió el pedido. */
  shippedAt?: string
  /** Fecha en que el comprador aceptó los términos y la política de datos. */
  termsAcceptedAt?: string
  /** Versión/fecha de las políticas aceptadas en el checkout. */
  termsVersion?: string
}

/** Comentario publicado en una foto de Car Spotting. */
export interface SpotComment {
  id: string
  spotId: string
  userId: string | null
  author: string
  body: string
  createdAt: string
}

/** Foto de "Car Spotting": un vehículo avistado por la comunidad. */
export interface Spot {
  id: string
  /** Data URL (subida comprimida) o URL pública. */
  image: string
  /** Auto/modelo avistado (opcional). */
  car?: string
  /** Lugar del avistamiento (opcional). */
  location?: string
  /** Nombre de quien publica (opcional). */
  author?: string
  /** Cantidad de «me gusta». */
  likeCount: number
  /** Si el usuario con sesión ya dio «me gusta». */
  likedByMe: boolean
  /** Comentarios, del más antiguo al más reciente. */
  comments: SpotComment[]
  createdAt: string
}

export type PromoKind = 'shirt' | 'amount'

/** Promoción / beneficio mostrado como mensaje en la tienda. */
export interface Promo {
  id: string
  /**
   * `shirt` = envío gratis al comprar una camiseta (con tope de cobertura).
   * `amount` = envío gratis por monto mínimo de compra.
   */
  kind: PromoKind
  title: string
  /** Mensaje personalizado. Si está vacío, se genera uno según el tipo y el monto. */
  message?: string
  /** Monto asociado: cobertura máxima (shirt) o mínimo de compra (amount). */
  amount: number | null
  enabled: boolean
  order: number
}

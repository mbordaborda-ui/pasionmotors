import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { cn, formatPrice } from '@/lib/utils'
import { parseImageList, resolveImageUrl, slugify, uid } from '@/lib/images'
import { describeImageError, optimizeImage } from '@/lib/image'
import { uploadImage } from '@/lib/storage'
import { Img } from '@/components/Img'
import type { Availability, CategoryId, Product, Variant } from '@/types'

const availabilityOptions: { value: Availability; label: string }[] = [
  { value: 'pendiente', label: 'Por confirmar' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'agotado', label: 'Agotado' },
]

function emptyProduct(nextOrder: number): Product {
  const id = uid('prod')
  return {
    id,
    slug: '',
    name: '',
    category: 'accesorios',
    price: null,
    stock: 0,
    sold: 0,
    availability: 'pendiente',
    tagline: '',
    description: '',
    images: [],
    variants: [],
    specs: [],
    featured: false,
    bestSeller: false,
    bestSellerOrder: 0,
    isNew: true,
    order: nextOrder,
  }
}

export function ProductsPanel() {
  const catalog = useCatalog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Product | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [originalStock, setOriginalStock] = useState<number | undefined>(undefined)
  const [filter, setFilter] = useState('')
  const [catFilter, setCatFilter] = useState<CategoryId | 'todas'>('todas')
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const inlineImages = useMemo(() => {
    let count = 0
    let bytes = 0
    for (const product of catalog.products) {
      for (const image of product.images ?? []) {
        if (!image.startsWith('data:')) continue
        count++
        bytes += Math.max(0, Math.floor((image.length - image.indexOf(',') - 1) * 0.75))
      }
    }
    return { count, bytes }
  }, [catalog.products])

  const optimizeInline = async () => {
    if (optimizing) return
    setOptimizing(true)
    const res = await catalog.optimizeInlineImages()
    setOptimizing(false)
    if (res.ok) {
      showToast(
        'ok',
        res.migrated
          ? `${res.migrated} foto(s) movidas al almacenamiento. El catálogo cargará mucho más rápido.`
          : 'No había fotos incrustadas que mover.',
      )
    } else {
      showToast('error', res.error ?? 'No se pudieron mover todas las fotos.')
    }
  }

  const showToast = (kind: 'ok' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3500)
  }

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return catalog.products.filter((p) => {
      const matchCat = catFilter === 'todas' || p.category === catFilter
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.slug.includes(q)
      return matchCat && matchQ
    })
  }, [catalog.products, filter, catFilter])

  const select = (p: Product) => {
    setSelectedId(p.id)
    setDraft(structuredClone(p))
    setOriginalStock(p.stock)
    setDirty(false)
  }

  const createNew = () => {
    const nextOrder = catalog.products.reduce((m, p) => Math.max(m, p.order ?? 0), 0) + 1
    const p = emptyProduct(nextOrder)
    setSelectedId(null)
    setDraft(p)
    setOriginalStock(undefined)
    setDirty(true)
  }

  const update = (patch: Partial<Product>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }

  const save = async () => {
    if (!draft || saving) return
    if (!draft.name.trim()) {
      showToast('error', 'El producto necesita un nombre.')
      return
    }
    const finalSlug = (draft.slug.trim() || slugify(draft.name)).trim()
    setSaving(true)
    const res = await catalog.upsertProduct(
      { ...draft, slug: finalSlug },
      { stockExpected: originalStock },
    )
    setSaving(false)

    if (!res.ok || !res.product) {
      showToast('error', res.error ?? 'No se pudo guardar en la base de datos.')
      return
    }

    setDraft(res.product)
    setSelectedId(res.product.id)
    setOriginalStock(res.product.stock)
    setDirty(false)
    setSavedFlash(true)
    showToast('ok', 'Producto guardado en la base de datos.')
    setTimeout(() => setSavedFlash(false), 1800)
  }

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return
    const res = await catalog.removeProduct(p.id)
    if (!res.ok) {
      showToast('error', res.error ?? 'No se pudo eliminar el producto.')
      return
    }
    if (selectedId === p.id) {
      setSelectedId(null)
      setDraft(null)
      setOriginalStock(undefined)
      setDirty(false)
    }
    showToast('ok', 'Producto eliminado.')
  }

  const duplicate = async (p: Product) => {
    const res = await catalog.duplicateProduct(p.id)
    if (!res.ok) {
      showToast('error', res.error ?? 'No se pudo duplicar el producto.')
      return
    }
    showToast('ok', 'Producto duplicado.')
  }

  const exportJson = () => {
    const blob = new Blob([catalog.exportCatalog()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pasion-motors-catalogo.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('ok', 'Catálogo exportado.')
  }

  const importJson = async (file: File) => {
    const text = await file.text()
    const res = await catalog.importCatalog(text)
    if (res.ok) {
      showToast('ok', 'Catálogo importado correctamente.')
      setDraft(null)
      setSelectedId(null)
      setOriginalStock(undefined)
    } else {
      showToast('error', res.error ?? 'Error al importar.')
    }
  }

  return (
    <div>
      {/* TOOLBAR */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-4 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full bg-transparent py-1.5 text-sm text-white placeholder-white/40 outline-none"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as CategoryId | 'todas')}
            className="rounded-full border border-white/10 bg-ink-800/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/80 outline-none focus:border-brand"
          >
            <option value="todas">Todas las categorías</option>
            {catalog.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={createNew} className="btn-primary !px-5 !py-2.5 !text-[12px]">
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
          <button onClick={exportJson} className="btn-ghost !px-4 !py-2.5 !text-[12px]">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="btn-ghost !px-4 !py-2.5 !text-[12px]"
          >
            <Upload className="h-4 w-4" /> Importar
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={async () => {
              if (confirm('¿Restablecer el catálogo original? Todos los productos volverán a sus valores iniciales.')) {
                const res = await catalog.resetCatalog()
                if (!res.ok) {
                  showToast('error', res.error ?? 'No se pudo restablecer el catálogo.')
                  return
                }
                setDraft(null)
                setSelectedId(null)
                setOriginalStock(undefined)
                showToast('ok', 'Catálogo restablecido.')
              }
            }}
            className="btn-ghost !px-4 !py-2.5 !text-[12px]"
            title="Restablecer catálogo"
          >
            Restablecer
          </button>
        </div>
      </div>

      {inlineImages.count > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs leading-relaxed text-amber-100/85">
          <span>
            <strong className="text-white">Catálogo pesado:</strong> {inlineImages.count} foto(s)
            están incrustadas en la base de datos
            {inlineImages.bytes > 0 && ` (~${(inlineImages.bytes / 1024 / 1024).toFixed(1)} MB)`}. Eso
            hace que la tienda tarde en cargar en móvil. Muévelas al almacenamiento una sola vez.
          </span>
          <button
            type="button"
            onClick={() => void optimizeInline()}
            disabled={optimizing}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-200/40 px-3 py-1.5 font-semibold uppercase tracking-wider text-white transition hover:border-white disabled:opacity-50"
          >
            {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {optimizing ? 'Moviendo…' : 'Optimizar fotos'}
          </button>
        </div>
      )}

      {/* NOTE */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-white/55">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>
          Los cambios se guardan en la base de datos (Supabase) y quedan visibles para todos los
          clientes al instante. Usa <strong className="text-white/80">Exportar</strong> para respaldar
          el catálogo como archivo JSON.
        </span>
      </div>

      {/* MASTER / DETAIL */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* LIST */}
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
              No hay productos que coincidan.
            </p>
          )}
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                selectedId === p.id
                  ? 'border-brand bg-brand/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/25',
              )}
            >
              <Img
                src={p.images?.[0]}
                alt={p.name}
                driveWidth={160}
                className="h-14 w-14 shrink-0 rounded-xl"
                label="—"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                <p className="truncate text-[11px] uppercase tracking-wider text-white/40">
                  {catalog.categories.find((c) => c.id === p.category)?.short}
                </p>
                <p className="text-[11px] text-white/50">
                  {formatPrice(p.price) ?? 'Precio por confirmar'}
                  {typeof p.stock === 'number' && (
                    <span
                      className={cn(
                        'ml-2',
                        p.stock > 0 ? 'text-emerald-300/80' : 'text-brand-300/80',
                      )}
                    >
                      · {p.stock > 0 ? `${p.stock} en stock` : 'Agotado'}
                    </span>
                  )}
                </p>
              </div>
              {dirty && selectedId === p.id && <span className="h-2 w-2 rounded-full bg-brand" />}
            </button>
          ))}
        </div>

        {/* EDITOR */}
        <div>
          {!draft ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
              <ImagePlus className="h-8 w-8 text-white/30" />
              <p className="font-display text-xl uppercase tracking-tight text-white">
                Selecciona o crea un producto
              </p>
              <p className="max-w-sm text-sm text-white/50">
                Elige un producto de la lista para editarlo o pulsa «Nuevo producto».
              </p>
              <button onClick={createNew} className="btn-primary mt-2">
                <Plus className="h-4 w-4" /> Nuevo producto
              </button>
            </div>
          ) : (
            <ProductEditor
              draft={draft}
              update={update}
              onSave={save}
              onDelete={draft && catalog.getById(draft.id) ? () => remove(draft) : undefined}
              onDuplicate={draft && catalog.getById(draft.id) ? () => duplicate(draft) : undefined}
              dirty={dirty}
              savedFlash={savedFlash}
              saving={saving}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-2xl',
            toast.kind === 'ok' ? 'bg-emerald-500 text-white' : 'bg-brand text-white',
          )}
        >
          {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}
    </div>
  )
}

interface EditorProps {
  draft: Product
  update: (patch: Partial<Product>) => void
  onSave: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  dirty: boolean
  savedFlash: boolean
  saving: boolean
  showToast: (kind: 'ok' | 'error', text: string) => void
}

function ProductEditor({
  draft,
  update,
  onSave,
  onDelete,
  onDuplicate,
  dirty,
  savedFlash,
  saving,
  showToast,
}: EditorProps) {
  const { categories } = useCatalog()
  const margin =
    typeof draft.price === 'number' &&
    draft.price > 0 &&
    typeof draft.cost === 'number' &&
    draft.cost >= 0
      ? (() => {
          const profit = draft.price - draft.cost
          return { profit, percent: (profit / draft.price) * 100 }
        })()
      : null

  return (
    <div className="space-y-6">
      <div className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl uppercase tracking-tight">
            {draft.name || 'Producto sin nombre'}
          </h2>
          <div className="flex items-center gap-2">
            {onDuplicate && (
              <button onClick={onDuplicate} className="btn-ghost !px-4 !py-2 !text-[11px]">
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="btn-ghost !border-brand/30 !px-4 !py-2 !text-[11px] !text-brand-300 hover:!bg-brand hover:!text-white"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              className="field"
              placeholder="Ej: Camiseta Tokio"
            />
          </div>

          <div>
            <Label hint="Se genera del nombre si lo dejas vacío">Enlace (slug)</Label>
            <input
              value={draft.slug}
              onChange={(e) => update({ slug: e.target.value })}
              onBlur={(e) => !e.target.value && update({ slug: slugify(draft.name) })}
              className="field"
              placeholder="camiseta-tokio"
            />
          </div>

          <div>
            <Label>Categoría</Label>
            <select
              value={draft.category}
              onChange={(e) => update({ category: e.target.value as CategoryId })}
              className="field"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label hint="Deja vacío si aún no hay precio">Precio</Label>
            <input
              type="number"
              min={0}
              value={draft.price ?? ''}
              onChange={(e) =>
                update({ price: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="field"
              placeholder="Precio por confirmar"
            />
          </div>

          <div>
            <Label hint="Solo si hay un descuento real">Precio anterior</Label>
            <input
              type="number"
              min={0}
              value={draft.compareAtPrice ?? ''}
              onChange={(e) =>
                update({
                  compareAtPrice: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="field"
              placeholder="—"
            />
          </div>

          <div>
            <Label hint="Costo unitario de compra">Costo</Label>
            <input
              type="number"
              min={0}
              value={draft.cost ?? ''}
              onChange={(e) =>
                update({ cost: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className="field"
              placeholder="Opcional"
            />
          </div>

          {margin && (
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs">
              <span className="text-white/55">
                Ganancia por unidad:{' '}
                <strong className={cn(margin.profit >= 0 ? 'text-emerald-300' : 'text-brand-300')}>
                  {formatPrice(margin.profit)}
                </strong>
              </span>
              <span
                className={cn(
                  'rounded-full px-3 py-1 font-semibold',
                  margin.percent >= 45
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : margin.percent >= 25
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-brand/15 text-brand-300',
                )}
              >
                Margen {margin.percent.toFixed(0)}%
              </span>
            </div>
          )}

          <div>
            <Label hint="El stock manda si está definido">Disponibilidad</Label>
            <select
              value={draft.availability}
              onChange={(e) => update({ availability: e.target.value as Availability })}
              className="field"
            >
              {availabilityOptions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label hint="Orden dentro del catálogo">Orden</Label>
            <input
              type="number"
              value={draft.order ?? 0}
              onChange={(e) => update({ order: Number(e.target.value) })}
              className="field"
            />
          </div>

          <div>
            <Label hint="Menor = primero en Más vendidos">Orden en más vendidos</Label>
            <input
              type="number"
              value={draft.bestSellerOrder ?? 0}
              onChange={(e) => update({ bestSellerOrder: Number(e.target.value) })}
              className="field"
            />
          </div>

          <div>
            <Label hint="Se descuenta al vender. 0 = agotado">Stock (unidades)</Label>
            <input
              type="number"
              min={0}
              value={draft.stock ?? 0}
              onChange={(e) => update({ stock: Math.max(0, Number(e.target.value) || 0) })}
              className="field"
            />
          </div>

          <div>
            <Label hint="Informativo">Vendidos</Label>
            <input
              type="number"
              min={0}
              value={draft.sold ?? 0}
              onChange={(e) => update({ sold: Math.max(0, Number(e.target.value) || 0) })}
              className="field"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Frase corta</Label>
            <input
              value={draft.tagline ?? ''}
              onChange={(e) => update({ tagline: e.target.value })}
              className="field"
              placeholder="Ej: Estética JDM."
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <textarea
              rows={4}
              value={draft.description ?? ''}
              onChange={(e) => update({ description: e.target.value })}
              className="field resize-none"
              placeholder="Describe el producto, materiales, medidas…"
            />
          </div>

          <div>
            <Label>Etiqueta (badge)</Label>
            <input
              value={draft.badge ?? ''}
              onChange={(e) => update({ badge: e.target.value })}
              className="field"
              placeholder="Ej: Edición limitada"
            />
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={!!draft.featured}
                onChange={(e) => update({ featured: e.target.checked })}
                className="h-4 w-4 accent-[rgb(255,30,45)]"
              />
              Destacado
            </label>
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={!!draft.bestSeller}
                onChange={(e) => update({ bestSeller: e.target.checked })}
                className="h-4 w-4 accent-[rgb(255,30,45)]"
              />
              Más vendido
            </label>
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={!!draft.isNew}
                onChange={(e) => update({ isNew: e.target.checked })}
                className="h-4 w-4 accent-[rgb(255,30,45)]"
              />
              Novedad
            </label>
          </div>
        </div>
      </div>

      <ImageManager
        images={draft.images ?? []}
        onChange={(images) => update({ images })}
        showToast={showToast}
      />

      <VariantManager
        variants={draft.variants ?? []}
        onChange={(variants) => update({ variants })}
      />

      <SpecManager specs={draft.specs ?? []} onChange={(specs) => update({ specs })} />

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-950/90 p-4 backdrop-blur">
        <p className="text-xs text-white/45">{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</p>
        <button
          onClick={onSave}
          disabled={saving}
          className={cn('btn-primary disabled:opacity-60', savedFlash && '!bg-emerald-500')}
        >
          {savedFlash ? (
            <>
              <Check className="h-4 w-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">{children}</label>
      {hint && <span className="text-[10px] text-white/35">{hint}</span>}
    </div>
  )
}

function ImageManager({
  images,
  onChange,
  showToast,
}: {
  images: string[]
  onChange: (images: string[]) => void
  showToast: (kind: 'ok' | 'error', text: string) => void
}) {
  const [linkInput, setLinkInput] = useState('')
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addLinks = (raw: string) => {
    const parsed = parseImageList(raw)
    if (!parsed.length) return
    onChange([...images, ...parsed])
    setLinkInput('')
    showToast('ok', `${parsed.length} imagen(es) añadida(s).`)
  }

  const onFiles = async (files: FileList) => {
    const list = Array.from(files)
    if (!list.length || uploading) return
    setUploading(true)
    const uploaded: string[] = []

    // Una por una: evita quedarse sin memoria en el celular.
    for (const file of list) {
      try {
        const optimized = await optimizeImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          maxBytes: 900 * 1024,
        })
        const url = await uploadImage('product-images', optimized.blob, 'catalogo/')
        uploaded.push(url)
      } catch (err) {
        showToast('error', `"${file.name}": ${describeImageError(err)}`)
      }
    }

    if (uploaded.length > 0) {
      onChange([...images, ...uploaded])
      showToast(
        'ok',
        `${uploaded.length} ${uploaded.length === 1 ? 'foto subida' : 'fotos subidas'} y optimizada(s).`,
      )
    }
    setUploading(false)
  }

  const preview = linkInput ? resolveImageUrl(linkInput) : ''

  return (
    <div className="card-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
          <ImagePlus className="h-5 w-5 text-brand" /> Fotografías
        </h3>
        <button
          onClick={() => setShowBulk((v) => !v)}
          className="text-[11px] font-semibold uppercase tracking-wider text-white/45 transition hover:text-white"
        >
          {showBulk ? 'Ocultar' : 'Varias a la vez'}
        </button>
      </div>

      {images.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={i} className="group relative">
              <Img src={img} alt={`Imagen ${i + 1}`} className="aspect-square w-full rounded-2xl" label="—" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Principal
                </span>
              )}
              <button
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink-950/80 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Quitar imagen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-ink-800/70 px-3">
            <Link2 className="h-4 w-4 shrink-0 text-white/40" />
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLinks(linkInput))}
              placeholder="Pega un enlace de Google Drive o URL de imagen…"
              className="w-full bg-transparent py-3 text-sm text-white placeholder-white/35 outline-none"
            />
          </div>
          <button onClick={() => addLinks(linkInput)} className="btn-primary !py-3">
            Añadir enlace
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-ghost !py-3 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Subiendo…' : 'Subir'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {preview && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <Img src={preview} alt="Previsualización" className="h-16 w-16 rounded-lg" label="—" />
            <div className="text-xs text-white/50">
              <p className="font-medium text-white/80">Previsualización del enlace</p>
              <p className="mt-0.5 break-all">{preview}</p>
            </div>
          </div>
        )}

        {showBulk && (
          <div>
            <textarea
              rows={3}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="Un enlace por línea. Se convertirán los enlaces de Drive automáticamente."
              className="field resize-none font-mono text-xs"
            />
            <button
              onClick={() => {
                addLinks(bulk)
                setBulk('')
              }}
              className="btn-ghost mt-2 !py-2.5 !text-[12px]"
            >
              Añadir todos
            </button>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/[0.05] p-4 text-xs leading-relaxed text-white/60">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>
            <strong className="text-white/80">Google Drive:</strong> comparte el archivo como «Cualquier
            persona con el enlace» y pega el enlace normal. Se convierte en URL de imagen compatible. Si
            el archivo es privado, se mostrará la imagen de reemplazo de la marca.
          </span>
        </div>
      </div>
    </div>
  )
}

function VariantManager({
  variants,
  onChange,
}: {
  variants: Variant[]
  onChange: (variants: Variant[]) => void
}) {
  const add = () => onChange([...variants, { id: uid('var'), name: '', options: [] }])

  const setVariant = (id: string, patch: Partial<Variant>) =>
    onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)))

  return (
    <div className="card-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg uppercase tracking-tight">Variantes</h3>
        <button onClick={add} className="btn-ghost !px-4 !py-2 !text-[12px]">
          <Plus className="h-3.5 w-3.5" /> Añadir variante
        </button>
      </div>
      <p className="mt-2 text-xs text-white/45">
        Ej: nombre «Talla» con opciones «S, M, L, XL». Se pedirán al cliente antes de añadir al carrito.
      </p>

      <div className="mt-5 space-y-4">
        {variants.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/45">
            Sin variantes.
          </p>
        )}
        {variants.map((v) => (
          <div key={v.id} className="grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={v.name}
              onChange={(e) => setVariant(v.id, { name: e.target.value })}
              className="field"
              placeholder="Nombre (Talla, Color…)"
            />
            <input
              value={v.options.map((o) => o.label).join(', ')}
              onChange={(e) =>
                setVariant(v.id, {
                  options: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((label) => ({ id: slugify(label) || uid('opt'), label })),
                })
              }
              className="field"
              placeholder="Opciones separadas por coma: S, M, L, XL"
            />
            <button
              onClick={() => onChange(variants.filter((x) => x.id !== v.id))}
              className="grid h-full min-h-11 place-items-center rounded-xl border border-white/10 px-4 text-white/50 transition hover:border-brand hover:text-brand"
              aria-label="Eliminar variante"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpecManager({
  specs,
  onChange,
}: {
  specs: { label: string; value: string }[]
  onChange: (specs: { label: string; value: string }[]) => void
}) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg uppercase tracking-tight">Especificaciones</h3>
        <button
          onClick={() => onChange([...specs, { label: '', value: '' }])}
          className="btn-ghost !px-4 !py-2 !text-[12px]"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>
      <div className="mt-5 space-y-3">
        {specs.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/45">
            Sin especificaciones.
          </p>
        )}
        {specs.map((s, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={s.label}
              onChange={(e) => onChange(specs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
              className="field"
              placeholder="Característica (Material)"
            />
            <input
              value={s.value}
              onChange={(e) => onChange(specs.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
              className="field"
              placeholder="Valor (Algodón)"
            />
            <button
              onClick={() => onChange(specs.filter((_, idx) => idx !== i))}
              className="grid place-items-center rounded-xl border border-white/10 px-4 text-white/50 transition hover:border-brand hover:text-brand"
              aria-label="Eliminar especificación"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

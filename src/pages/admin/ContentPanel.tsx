import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CarFront,
  Check,
  FolderTree,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { useCatalog } from '@/store/catalog'
import { useSettings } from '@/store/settings'
import { garage as defaultGarage } from '@/data/garage'
import { AdminImageField } from '@/components/AdminImageField'
import type { Category, GarageCar } from '@/types'

export function ContentPanel() {
  const { categories, upsertCategory } = useCatalog()
  const { site, updateSite } = useSettings()
  const [catDrafts, setCatDrafts] = useState<Category[]>(categories)
  const [catDirty, setCatDirty] = useState(false)
  const [catSaved, setCatSaved] = useState(false)
  const [catSaving, setCatSaving] = useState(false)
  const [garageDrafts, setGarageDrafts] = useState<GarageCar[]>(
    site.garage?.length ? site.garage : defaultGarage,
  )
  const [garageDirty, setGarageDirty] = useState(false)
  const [garageSaved, setGarageSaved] = useState(false)
  const [garageSaving, setGarageSaving] = useState(false)

  useEffect(() => {
    if (!catDirty) setCatDrafts(categories)
  }, [categories, catDirty])

  useEffect(() => {
    if (!garageDirty) setGarageDrafts(site.garage?.length ? site.garage : defaultGarage)
  }, [site.garage, garageDirty])

  const updateCategory = (id: Category['id'], patch: Partial<Category>) => {
    setCatDrafts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setCatDirty(true)
  }

  const saveCategories = async () => {
    if (catSaving) return
    setCatSaving(true)
    for (const category of catDrafts) {
      const res = await upsertCategory(category)
      if (!res.ok) {
        setCatSaving(false)
        return
      }
    }
    setCatSaving(false)
    setCatDirty(false)
    setCatSaved(true)
    window.setTimeout(() => setCatSaved(false), 1800)
  }

  const updateCar = (id: string, patch: Partial<GarageCar>) => {
    setGarageDrafts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setGarageDirty(true)
  }

  const addCar = () => {
    setGarageDrafts((prev) => [
      ...prev,
      {
        id: `car-${crypto.randomUUID()}`,
        name: 'Nuevo auto',
        tag: '',
        note: '',
        image: '',
      },
    ])
    setGarageDirty(true)
  }

  const moveCar = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= garageDrafts.length) return
    const next = [...garageDrafts]
    ;[next[index], next[j]] = [next[j], next[index]]
    setGarageDrafts(next)
    setGarageDirty(true)
  }

  const saveGarage = async () => {
    if (garageSaving) return
    setGarageSaving(true)
    const res = await updateSite({ garage: garageDrafts })
    setGarageSaving(false)
    if (!res.ok) return
    setGarageDirty(false)
    setGarageSaved(true)
    window.setTimeout(() => setGarageSaved(false), 1800)
  }

  return (
    <div className="space-y-8">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
              <FolderTree className="h-5 w-5 text-brand" /> Categorías
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
              Cambia nombres, descripciones, orden e imagen de portada. Se usan en el menú, el inicio,
              el catálogo y el pie de página.
            </p>
          </div>
          <button
            onClick={saveCategories}
            disabled={!catDirty || catSaving}
            className={
              catSaved
                ? 'btn-primary !bg-emerald-500 disabled:opacity-100'
                : 'btn-primary disabled:opacity-40'
            }
          >
            {catSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {catSaved ? 'Guardado' : catSaving ? 'Guardando…' : 'Guardar categorías'}
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {catDrafts.map((category) => (
            <div key={category.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <AdminImageField
                label="Imagen de portada"
                value={category.image}
                onChange={(image) => updateCategory(category.id, { image })}
                className="aspect-[4/3] w-full"
              />
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Nombre
                  </span>
                  <input
                    value={category.name}
                    onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                    className="field"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Nombre corto
                    </span>
                    <input
                      value={category.short}
                      onChange={(e) => updateCategory(category.id, { short: e.target.value })}
                      className="field"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Orden
                    </span>
                    <input
                      type="number"
                      value={category.order ?? 0}
                      onChange={(e) =>
                        updateCategory(category.id, { order: Number(e.target.value) || 0 })
                      }
                      className="field"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Descripción
                  </span>
                  <textarea
                    rows={2}
                    value={category.description}
                    onChange={(e) => updateCategory(category.id, { description: e.target.value })}
                    className="field resize-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg uppercase tracking-tight">
              <CarFront className="h-5 w-5 text-brand" /> El garage
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
              Administra los autos y fotografías de la galería «Máquinas que nos inspiran» del inicio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setGarageDrafts(defaultGarage)
                setGarageDirty(true)
              }}
              className="btn-ghost !px-4 !py-2.5 !text-[11px]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar galería
            </button>
            <button
              onClick={addCar}
              className="btn-ghost !px-4 !py-2.5 !text-[11px]"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir auto
            </button>
            <button
              onClick={saveGarage}
              disabled={!garageDirty || garageSaving}
              className={
                garageSaved
                  ? 'btn-primary !bg-emerald-500 disabled:opacity-100'
                  : 'btn-primary disabled:opacity-40'
              }
            >
              {garageSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {garageSaved ? 'Guardado' : garageSaving ? 'Guardando…' : 'Guardar garage'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {garageDrafts.map((car, index) => (
            <div key={car.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <AdminImageField
                label={`Foto ${index + 1}`}
                value={car.image}
                onChange={(image) => updateCar(car.id, { image })}
                className="aspect-[4/3] w-full"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Nombre
                  </span>
                  <input
                    value={car.name}
                    onChange={(e) => updateCar(car.id, { name: e.target.value })}
                    className="field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Etiqueta
                  </span>
                  <input
                    value={car.tag}
                    onChange={(e) => updateCar(car.id, { tag: e.target.value })}
                    className="field"
                    placeholder="Leyenda, JDM…"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => moveCar(index, -1)}
                    disabled={index === 0}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    aria-label="Mover antes"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveCar(index, 1)}
                    disabled={index === garageDrafts.length - 1}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white disabled:opacity-25"
                    aria-label="Mover después"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setGarageDrafts((prev) => prev.filter((c) => c.id !== car.id))
                      setGarageDirty(true)
                    }}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-brand hover:text-brand"
                    aria-label="Eliminar auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Descripción
                  </span>
                  <textarea
                    rows={2}
                    value={car.note}
                    onChange={(e) => updateCar(car.id, { note: e.target.value })}
                    className="field resize-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

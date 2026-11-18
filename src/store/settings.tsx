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
import type { Gift, Promo, SiteConfig } from '@/types'
import { site as defaultSite } from '@/config'
import { giftsSeed } from '@/data/gifts'
import { promosSeed } from '@/data/promos'
import { uid } from '@/lib/images'
import { setCurrencyConfig } from '@/lib/utils'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { describeError, reportSaveError, type SaveResult } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import {
  giftToRow,
  promoToRow,
  rowToGift,
  rowToPromo,
  rowToSite,
  siteToRow,
  type GiftRow,
  type PromoRow,
  type SiteRow,
} from '@/lib/db'

/** Foto del hero anterior (Ferrari F40) que se reemplaza por el Porsche verde local. */
const LEGACY_HERO_PHOTO = 'pexels-photo-9113904'

/** Error de Supabase cuando aún no se ejecutó supabase/hero-rotativo.sql. */
function isHeroColumnsError(error: { message?: string } | null): boolean {
  const message = error?.message ?? ''
  return /hero_images|hero_rotation/i.test(message) && /column|schema cache/i.test(message)
}

async function fetchSite(): Promise<SiteConfig> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  const site = data ? rowToSite(data as SiteRow) : defaultSite
  if (site.heroImage?.includes(LEGACY_HERO_PHOTO)) {
    return { ...site, heroImage: defaultSite.heroImage }
  }
  return site
}

async function fetchGifts(): Promise<Gift[]> {
  const { data, error } = await supabase.from('gifts').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data as GiftRow[]).map(rowToGift)
}

async function fetchPromos(): Promise<Promo[]> {
  const { data, error } = await supabase.from('promos').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data as PromoRow[]).map(rowToPromo)
}

const sortByOrder = <T extends { order?: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

interface SettingsContextValue {
  site: SiteConfig
  loading: boolean
  gifts: Gift[]
  /** Regalos activos (los que se muestran en la tienda y en el checkout). */
  activeGifts: Gift[]
  promos: Promo[]
  /** Promociones activas (las que se muestran como mensajes). */
  activePromos: Promo[]
  updateSite: (patch: Partial<SiteConfig>) => Promise<SaveResult>
  resetSite: () => Promise<SaveResult>
  upsertGift: (gift: Gift) => void
  addGift: () => string
  toggleGift: (id: string) => void
  removeGift: (id: string) => void
  upsertPromo: (promo: Promo) => void
  togglePromo: (id: string) => void
  isCustomized: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteConfig>(defaultSite)
  const [gifts, setGifts] = useState<Gift[]>(() => (isSupabaseConfigured ? [] : giftsSeed))
  const [promos, setPromos] = useState<Promo[]>(() => (isSupabaseConfigured ? [] : promosSeed))
  const [loading, setLoading] = useState(true)
  const siteRef = useRef(site)
  siteRef.current = site

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSite(defaultSite)
      setGifts(giftsSeed)
      setPromos(promosSeed)
      setLoading(false)
      return
    }
    try {
      const [s, g, p] = await withTimeout(
        Promise.all([fetchSite(), fetchGifts(), fetchPromos()]),
        12_000,
        'La configuración tardó demasiado en cargar.',
      )
      setSite(s)
      setGifts(g)
      setPromos(p)
    } catch (err) {
      console.error('[settings.refresh]', err)
      setGifts((prev) => (prev.length > 0 ? prev : giftsSeed))
      setPromos((prev) => (prev.length > 0 ? prev : promosSeed))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 400)
    }
    const channel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, schedule)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  useEffect(() => {
    setCurrencyConfig(site.locale, site.currency)
  }, [site.locale, site.currency])

  const updateSite = useCallback(
    async (patch: Partial<SiteConfig>): Promise<SaveResult> => {
      const next = { ...siteRef.current, ...patch }

      if (!isSupabaseConfigured) {
        setSite(next)
        return { ok: true }
      }

      const { error } = await supabase
        .from('site_settings')
        .upsert({ id: 1, ...siteToRow(next) })
      if (error) {
        const message = isHeroColumnsError(error)
          ? 'Falta ejecutar supabase/hero-rotativo.sql en Supabase para guardar la rotación de fotos.'
          : describeError(error)
        reportSaveError('No se pudo guardar la configuración del sitio.', message)
        void refresh()
        return { ok: false, error: message }
      }

      setSite(next)
      return { ok: true }
    },
    [refresh],
  )

  const resetSite = useCallback(async (): Promise<SaveResult> => {
    if (!isSupabaseConfigured) {
      setSite({ ...defaultSite, heroRotation: 'off', heroImages: [] })
      setGifts(giftsSeed)
      setPromos(promosSeed)
      return { ok: true }
    }

    // Si las columnas de rotación ya existen, el reset también las apaga.
    const heroReset =
      siteRef.current.heroRotation === undefined
        ? {}
        : { heroRotation: 'off' as const, heroImages: [] as string[] }

    const { error: siteError } = await supabase
      .from('site_settings')
      .upsert({ id: 1, ...siteToRow({ ...defaultSite, ...heroReset }) })
    if (siteError) {
      const message = isHeroColumnsError(siteError)
        ? 'Falta ejecutar supabase/hero-rotativo.sql en Supabase para restablecer la rotación.'
        : describeError(siteError)
      reportSaveError('No se pudo restablecer la configuración.', message)
      return { ok: false, error: message }
    }

    const { error: giftsError } = await supabase.from('gifts').delete().neq('id', '__none__')
    if (giftsError) {
      const message = describeError(giftsError)
      reportSaveError('No se pudieron restablecer los regalos.', message)
      void refresh()
      return { ok: false, error: message }
    }

    const { error: promosError } = await supabase.from('promos').delete().neq('id', '__none__')
    if (promosError) {
      const message = describeError(promosError)
      reportSaveError('No se pudieron restablecer las promociones.', message)
      void refresh()
      return { ok: false, error: message }
    }

    const [g, p] = await Promise.all([
      supabase.from('gifts').insert(giftsSeed.map(giftToRow)),
      supabase.from('promos').insert(promosSeed.map(promoToRow)),
    ])
    if (g.error || p.error) {
      const message = describeError(g.error ?? p.error)
      reportSaveError('No se pudieron restablecer los datos originales.', message)
      void refresh()
      return { ok: false, error: message }
    }

    await refresh()
    return { ok: true }
  }, [refresh])

  const upsertGift = useCallback((gift: Gift) => {
    setGifts((prev) => {
      const exists = prev.some((g) => g.id === gift.id)
      return exists ? prev.map((g) => (g.id === gift.id ? gift : g)) : [...prev, gift]
    })
    void supabase
      .from('gifts')
      .upsert(giftToRow(gift))
      .then(({ error }) => {
        if (!error) return
        reportSaveError('No se pudo guardar el regalo.', describeError(error))
        void refresh()
      })
  }, [refresh])

  const addGift = useCallback((): string => {
    const id = uid('gift')
    setGifts((prev) => {
      const order = prev.reduce((m, g) => Math.max(m, g.order ?? 0), 0) + 1
      const gift: Gift = { id, name: 'Nuevo regalo', description: '', enabled: true, order }
      void supabase
        .from('gifts')
        .insert(giftToRow(gift))
        .then(({ error }) => {
          if (!error) return
          reportSaveError('No se pudo crear el regalo.', describeError(error))
          void refresh()
        })
      return [...prev, gift]
    })
    return id
  }, [refresh])

  const toggleGift = useCallback((id: string) => {
    setGifts((prev) => {
      const target = prev.find((g) => g.id === id)
      if (target) {
        void supabase
          .from('gifts')
          .update({ enabled: !target.enabled })
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return
            reportSaveError('No se pudo cambiar el estado del regalo.', describeError(error))
            void refresh()
          })
      }
      return prev.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g))
    })
  }, [refresh])

  const removeGift = useCallback((id: string) => {
    setGifts((prev) => prev.filter((g) => g.id !== id))
    void supabase
      .from('gifts')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (!error) return
        reportSaveError('No se pudo eliminar el regalo.', describeError(error))
        void refresh()
      })
  }, [refresh])

  const upsertPromo = useCallback((promo: Promo) => {
    setPromos((prev) => {
      const exists = prev.some((p) => p.id === promo.id)
      return exists ? prev.map((p) => (p.id === promo.id ? promo : p)) : [...prev, promo]
    })
    void supabase
      .from('promos')
      .upsert(promoToRow(promo))
      .then(({ error }) => {
        if (!error) return
        reportSaveError('No se pudo guardar la promoción.', describeError(error))
        void refresh()
      })
  }, [refresh])

  const togglePromo = useCallback((id: string) => {
    setPromos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) {
        void supabase
          .from('promos')
          .update({ enabled: !target.enabled })
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return
            reportSaveError('No se pudo cambiar el estado de la promoción.', describeError(error))
            void refresh()
          })
      }
      return prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    })
  }, [refresh])

  const sortedGifts = useMemo(() => sortByOrder(gifts), [gifts])
  const activeGifts = useMemo(() => sortedGifts.filter((g) => g.enabled), [sortedGifts])
  const sortedPromos = useMemo(() => sortByOrder(promos), [promos])
  const activePromos = useMemo(() => sortedPromos.filter((p) => p.enabled), [sortedPromos])

  const value: SettingsContextValue = {
    site,
    loading,
    gifts: sortedGifts,
    activeGifts,
    promos: sortedPromos,
    activePromos,
    updateSite,
    resetSite,
    upsertGift,
    addGift,
    toggleGift,
    removeGift,
    upsertPromo,
    togglePromo,
    isCustomized: true,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>')
  return ctx
}

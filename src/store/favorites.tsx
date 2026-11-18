import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'pm-favorites-v1'
const MAX_FAVORITES = 200

function readFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return Array.from(
      new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    ).slice(0, MAX_FAVORITES)
  } catch {
    return []
  }
}

function writeFavorites(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Almacenamiento lleno o bloqueado: la sesión sigue funcionando en memoria.
  }
}

interface FavoritesContextValue {
  /** Slugs de producto guardados, del más reciente al más antiguo. */
  ids: string[]
  count: number
  isFavorite: (slug: string) => boolean
  toggle: (slug: string) => void
  remove: (slug: string) => void
  clear: () => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

/**
 * Lista de deseos local (sin cuenta): persiste en el dispositivo y se sincroniza
 * entre pestañas. No requiere Supabase, así funciona incluso sin sesión.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(readFavorites)

  useEffect(() => {
    writeFavorites(ids)
  }, [ids])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(readFavorites())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids])

  const toggle = useCallback((id: string) => {
    if (!id) return
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      return [id, ...prev.filter((item) => item !== id)].slice(0, MAX_FAVORITES)
    })
  }, [])

  const remove = useCallback((id: string) => {
    setIds((prev) => prev.filter((item) => item !== id))
  }, [])

  const clear = useCallback(() => setIds([]), [])

  const value: FavoritesContextValue = useMemo(
    () => ({ ids, count: ids.length, isFavorite, toggle, remove, clear }),
    [ids, isFavorite, toggle, remove, clear],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>')
  return ctx
}

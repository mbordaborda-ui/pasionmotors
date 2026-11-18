import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Spot, SpotComment } from '@/types'
import { supabase } from '@/lib/supabase'
import { describeError, reportSaveError } from '@/lib/save'
import { withTimeout } from '@/lib/timeout'
import {
  rowToSpot,
  rowToSpotComment,
  type SpotCommentRow,
  type SpotRow,
} from '@/lib/db'
import { removeImageByUrl, uploadImage } from '@/lib/storage'

/** Límite de referencia mostrado en la interfaz. */
export const MAX_SPOTS = 120

export type NewSpot = Pick<Spot, 'image' | 'car' | 'location' | 'author'>

interface GalleryData {
  spots: Spot[]
  socialReady: boolean
}

async function fetchGallery(): Promise<GalleryData> {
  const [spotsResult, likesResult, commentsResult, authResult] = await Promise.all([
    supabase.from('spots').select('*').order('created_at', { ascending: false }),
    supabase.from('spot_likes').select('spot_id, user_id'),
    supabase.from('spot_comments').select('*').order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  if (spotsResult.error) throw spotsResult.error

  const socialReady = !likesResult.error && !commentsResult.error
  const userId = authResult.data.user?.id ?? null

  const likeCounts = new Map<string, number>()
  const likedByMe = new Set<string>()
  for (const row of (likesResult.data ?? []) as { spot_id: string; user_id: string }[]) {
    likeCounts.set(row.spot_id, (likeCounts.get(row.spot_id) ?? 0) + 1)
    if (userId && row.user_id === userId) likedByMe.add(row.spot_id)
  }

  const commentsBySpot = new Map<string, SpotComment[]>()
  for (const row of (commentsResult.data ?? []) as SpotCommentRow[]) {
    const comment = rowToSpotComment(row)
    const list = commentsBySpot.get(comment.spotId) ?? []
    list.push(comment)
    commentsBySpot.set(comment.spotId, list)
  }

  const spots = ((spotsResult.data ?? []) as SpotRow[]).map((row) => {
    const spot = rowToSpot(row)
    return {
      ...spot,
      likeCount: likeCounts.get(spot.id) ?? 0,
      likedByMe: likedByMe.has(spot.id),
      comments: commentsBySpot.get(spot.id) ?? [],
    }
  })

  return { spots, socialReady }
}

interface GalleryContextValue {
  spots: Spot[]
  loading: boolean
  /** `false` si aún no se ejecutó supabase/spots-social.sql. */
  socialReady: boolean
  /** Carga la galería solo cuando una pantalla realmente la usa. */
  ensureLoaded: () => void
  /** Agrega una foto. Devuelve el motivo si falló. */
  addSpot: (data: NewSpot) => Promise<{ ok: boolean; error?: string }>
  removeSpot: (id: string) => Promise<void>
  clearSpots: () => Promise<void>
  toggleLike: (spotId: string) => Promise<{ ok: boolean; error?: string }>
  addComment: (spotId: string, body: string) => Promise<{ ok: boolean; error?: string }>
  deleteComment: (commentId: string) => Promise<{ ok: boolean; error?: string }>
}

const GalleryContext = createContext<GalleryContextValue | null>(null)

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [socialReady, setSocialReady] = useState(true)
  const [started, setStarted] = useState(false)
  const startedRef = useRef(false)
  const inflight = useRef<Promise<void> | null>(null)

  const refresh = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current
    const run = (async () => {
      try {
        const data = await withTimeout(
          fetchGallery(),
          12_000,
          'Las fotos tardaron demasiado en cargar.',
        )
        setSpots(data.spots)
        setSocialReady(data.socialReady)
      } catch (err) {
        console.error('[gallery.refresh]', err)
        reportSaveError('No se pudieron cargar las fotos.', describeError(err))
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

  /** Se llama desde el inicio, /spotting y el panel; las demás rutas no cargan fotos. */
  const ensureLoaded = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setStarted(true)
    void refresh()
  }, [refresh])

  // Al iniciar o cerrar sesión cambian los «me gusta» propios.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      if (startedRef.current) void refresh()
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  useEffect(() => {
    if (!started) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 350)
    }
    const channel = supabase
      .channel('spots-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_likes' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_comments' }, schedule)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [refresh, started])

  const addSpot = useCallback(
    async (data: NewSpot): Promise<{ ok: boolean; error?: string }> => {
      if (spots.length >= MAX_SPOTS) {
        return { ok: false, error: `La galería llegó al máximo de ${MAX_SPOTS} fotos.` }
      }

      let image = data.image
      if (image.startsWith('data:')) {
        try {
          const blob = await (await fetch(image)).blob()
          image = await uploadImage('spots', blob, 'spots/')
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'No se pudo subir la foto al almacenamiento.'
          console.error('[spots.upload]', err)
          reportSaveError('No se pudo subir la foto.', message)
          return { ok: false, error: message }
        }
      }

      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('spots').insert({
        image,
        car: data.car?.trim() || null,
        location: data.location?.trim() || null,
        author: data.author?.trim() || null,
        user_id: auth.user?.id ?? null,
      })

      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo publicar la foto.', message)
        return { ok: false, error: message }
      }

      await refresh()
      return { ok: true }
    },
    [refresh, spots.length],
  )

  const removeSpot = useCallback(
    async (id: string): Promise<void> => {
      const target = spots.find((spot) => spot.id === id)
      setSpots((prev) => prev.filter((spot) => spot.id !== id))
      const { error } = await supabase.from('spots').delete().eq('id', id)
      if (error) {
        reportSaveError('No se pudo eliminar la foto.', describeError(error))
        await refresh()
        return
      }
      if (target?.image) await removeImageByUrl('spots', target.image)
    },
    [refresh, spots],
  )

  const clearSpots = useCallback(async (): Promise<void> => {
    const images = spots.map((spot) => spot.image)
    setSpots([])
    const { error } = await supabase
      .from('spots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      reportSaveError('No se pudieron vaciar las fotos.', describeError(error))
      await refresh()
      return
    }
    await Promise.all(images.map((image) => removeImageByUrl('spots', image)))
  }, [refresh, spots])

  const toggleLike = useCallback(
    async (spotId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!socialReady) {
        return {
          ok: false,
          error: 'Los «me gusta» todavía no están activos. Falta ejecutar supabase/spots-social.sql.',
        }
      }

      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) return { ok: false, error: 'auth_required' }

      const current = spots.find((spot) => spot.id === spotId)
      if (!current) return { ok: false, error: 'No encontramos esa foto.' }

      const wasLiked = current.likedByMe
      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId
            ? {
                ...spot,
                likedByMe: !wasLiked,
                likeCount: Math.max(0, spot.likeCount + (wasLiked ? -1 : 1)),
              }
            : spot,
        ),
      )

      const { error } = wasLiked
        ? await supabase
            .from('spot_likes')
            .delete()
            .eq('spot_id', spotId)
            .eq('user_id', userId)
        : await supabase.from('spot_likes').insert({ spot_id: spotId, user_id: userId })

      if (error) {
        setSpots((prev) =>
          prev.map((spot) =>
            spot.id === spotId
              ? {
                  ...spot,
                  likedByMe: wasLiked,
                  likeCount: Math.max(0, spot.likeCount + (wasLiked ? 1 : -1)),
                }
              : spot,
          ),
        )
        const message = describeError(error)
        reportSaveError('No se pudo guardar tu «me gusta».', message)
        return { ok: false, error: message }
      }

      return { ok: true }
    },
    [socialReady, spots],
  )

  const addComment = useCallback(
    async (spotId: string, body: string): Promise<{ ok: boolean; error?: string }> => {
      if (!socialReady) {
        return {
          ok: false,
          error: 'Los comentarios todavía no están activos. Falta ejecutar supabase/spots-social.sql.',
        }
      }

      const clean = body.trim()
      if (!clean) return { ok: false, error: 'Escribe un comentario.' }
      if (clean.length > 500) return { ok: false, error: 'El comentario admite máximo 500 caracteres.' }

      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) return { ok: false, error: 'auth_required' }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .maybeSingle()
      const author =
        (profile?.name as string | null)?.trim() ||
        (auth.user?.user_metadata?.name as string | undefined)?.trim() ||
        auth.user?.email?.split('@')[0] ||
        'Comunidad'

      const { data, error } = await supabase
        .from('spot_comments')
        .insert({ spot_id: spotId, user_id: userId, author, body: clean })
        .select('*')
        .single()

      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo publicar el comentario.', message)
        return { ok: false, error: message }
      }

      const comment = rowToSpotComment(data as SpotCommentRow)
      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId ? { ...spot, comments: [...spot.comments, comment] } : spot,
        ),
      )
      return { ok: true }
    },
    [socialReady],
  )

  const deleteComment = useCallback(
    async (commentId: string): Promise<{ ok: boolean; error?: string }> => {
      const { error } = await supabase.from('spot_comments').delete().eq('id', commentId)
      if (error) {
        const message = describeError(error)
        reportSaveError('No se pudo eliminar el comentario.', message)
        return { ok: false, error: message }
      }
      setSpots((prev) =>
        prev.map((spot) => ({
          ...spot,
          comments: spot.comments.filter((comment) => comment.id !== commentId),
        })),
      )
      return { ok: true }
    },
    [],
  )

  const value: GalleryContextValue = {
    spots,
    loading,
    socialReady,
    ensureLoaded,
    addSpot,
    removeSpot,
    clearSpots,
    toggleLike,
    addComment,
    deleteComment,
  }

  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
}

export function useGallery(): GalleryContextValue {
  const ctx = useContext(GalleryContext)
  if (!ctx) throw new Error('useGallery debe usarse dentro de <GalleryProvider>')
  return ctx
}

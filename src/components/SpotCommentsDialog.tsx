import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import type { Spot } from '@/types'
import { useAuth } from '@/store/auth'
import { useGallery } from '@/store/gallery'
import { cn } from '@/lib/utils'

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function SpotCommentsDialog({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  const { user, isAdmin } = useAuth()
  const { addComment, deleteComment } = useGallery()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const result = await addComment(spot.id, body)
    setBusy(false)
    if (!result.ok) {
      setError(result.error === 'auth_required' ? 'Inicia sesión para comentar.' : result.error ?? '')
      return
    }
    setBody('')
  }

  const remove = async (commentId: string) => {
    if (!window.confirm('¿Eliminar este comentario?')) return
    setDeleting(commentId)
    const result = await deleteComment(commentId)
    setDeleting(null)
    if (!result.ok) setError(result.error ?? 'No se pudo eliminar el comentario.')
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex min-h-full items-end justify-center bg-ink-950/85 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={spot.car ? `Comentarios de ${spot.car}` : 'Comentarios de la foto'}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl sm:max-h-[85vh] sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
          <img
            src={spot.image}
            alt={spot.car || 'Car spotting'}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg uppercase leading-tight text-white">
              {spot.car || 'Car spotting'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
              {spot.location && <span>{spot.location}</span>}
              {spot.author && <span>por {spot.author}</span>}
              <span className="inline-flex items-center gap-1 text-brand-300">
                <Heart className="h-3 w-3" /> {spot.likeCount}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar comentarios"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
            <MessageCircle className="h-3.5 w-3.5 text-brand" />
            {spot.comments.length}{' '}
            {spot.comments.length === 1 ? 'comentario' : 'comentarios'}
          </p>

          {spot.comments.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/45">
              Todavía no hay comentarios. Sé el primero en opinar.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {spot.comments.map((comment) => {
                const canDelete = isAdmin || (user && comment.userId === user.id)
                return (
                  <li key={comment.id} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand-300">
                      {initials(comment.author) || 'PM'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-white">{comment.author}</p>
                        <span className="shrink-0 text-[10px] text-white/35">
                          {formatDateTime(comment.createdAt)}
                        </span>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => remove(comment.id)}
                            disabled={deleting === comment.id}
                            className="ml-auto shrink-0 text-white/30 transition hover:text-brand disabled:opacity-40"
                            aria-label="Eliminar comentario"
                            title="Eliminar comentario"
                          >
                            {deleting === comment.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 p-4 sm:p-5">
          {error && (
            <p className="mb-3 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand-300">
              {error}
            </p>
          )}

          {user ? (
            <form onSubmit={submit} className="space-y-2">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Escribe un comentario…"
                className="field resize-none !py-3 text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-wider text-white/30">
                  {body.length}/500
                </span>
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="btn-primary !px-5 !py-2.5 !text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {busy ? 'Enviando…' : 'Comentar'}
                </button>
              </div>
            </form>
          ) : (
            <Link
              to="/login?next=/spotting"
              className={cn(
                'btn-primary w-full !py-3 text-center text-[12px] uppercase tracking-wider',
              )}
            >
              Inicia sesión para comentar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** `compact` se usa dentro del contenido de una ruta; el global ocupa la pantalla. */
  compact?: boolean
  title?: string
  description?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Evita la pantalla blanca si falla un componente o la descarga de un chunk.
 * El botón de reintento recarga la app para volver a pedir los archivos.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary]', error, info.componentStack)
  }

  private retry = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const {
      compact = false,
      title = 'No pudimos mostrar esta sección',
      description = 'Ocurrió un problema inesperado. Reintenta; si sigue pasando, vuelve al inicio.',
    } = this.props

    if (compact) {
      return (
        <div role="alert" className="container-pm py-16">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-white/10 bg-ink-800/50 p-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl uppercase tracking-tight text-white">{title}</h1>
            <p className="max-w-sm text-sm leading-relaxed text-white/55">{description}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={this.retry} className="btn-primary">
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
              <a href="/" className="btn-ghost">
                <Home className="h-4 w-4" /> Ir al inicio
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-16 text-center"
      >
        <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border border-white/10 bg-ink-800/60 p-8 shadow-2xl sm:p-10">
          <img src="/icons/icon-192.png" alt="PASION MOTORS" width="72" height="72" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-white">
            {title}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-white/55">{description}</p>
          <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={this.retry} className="btn-primary">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <a href="/" className="btn-ghost">
              <Home className="h-4 w-4" /> Ir al inicio
            </a>
          </div>
        </div>
      </div>
    )
  }
}

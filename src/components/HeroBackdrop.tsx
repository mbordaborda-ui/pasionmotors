import { cn } from '@/lib/utils'

/**
 * Fondo cinematográfico para el hero: rejilla técnica + estelas de luz
 * (evocación de fotografía automotriz de larga exposición) + brillos de marca.
 * Es totalmente generado con CSS/SVG: no depende de fotos externas.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  const trails = [
    { top: '22%', width: '46%', left: '8%', color: 'from-transparent via-brand/70 to-transparent', delay: '0s', dur: '9s' },
    { top: '30%', width: '62%', left: '30%', color: 'from-transparent via-white/50 to-transparent', delay: '1.2s', dur: '11s' },
    { top: '46%', width: '38%', left: '52%', color: 'from-transparent via-brand/60 to-transparent', delay: '0.6s', dur: '8s' },
    { top: '58%', width: '70%', left: '4%', color: 'from-transparent via-white/35 to-transparent', delay: '2s', dur: '12s' },
    { top: '70%', width: '52%', left: '40%', color: 'from-transparent via-brand/50 to-transparent', delay: '1.6s', dur: '10s' },
    { top: '82%', width: '40%', left: '18%', color: 'from-transparent via-white/25 to-transparent', delay: '0.3s', dur: '13s' },
  ]

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div className="absolute inset-0 bg-ink-950" />
      <div className="absolute inset-0 bg-grid-lines [background-size:52px_52px] opacity-40" />
      <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/25 blur-[140px]" />
      <div className="absolute right-[-10%] top-1/4 h-[420px] w-[420px] rounded-full bg-white/10 blur-[140px]" />
      <div className="absolute bottom-0 left-1/4 h-[360px] w-[520px] rounded-full bg-brand/10 blur-[160px]" />

      {trails.map((t, i) => (
        <div
          key={i}
          className={cn('absolute h-[2px] rounded-full bg-gradient-to-r blur-[1px]', t.color)}
          style={{
            top: t.top,
            left: t.left,
            width: t.width,
            animation: `floaty ${t.dur} ease-in-out ${t.delay} infinite alternate`,
          }}
        />
      ))}

      <svg
        className="absolute bottom-0 left-0 w-full text-white/[0.06]"
        viewBox="0 0 1440 220"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 200 C180 120 320 190 460 150 C600 110 700 40 860 70 C1020 100 1120 180 1260 150 C1360 128 1400 160 1440 140 L1440 220 L0 220 Z"
          fill="currentColor"
        />
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/40 via-ink-950/20 to-ink" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />
    </div>
  )
}

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/motion'

interface TachometerProps {
  /** Revoluciones por minuto (0 – 8000). */
  rpm: number
  /** Tamaño en píxeles (el SVG escala solo). */
  size?: number
  className?: string
  /** Muestra el número digital de RPM. */
  showDigital?: boolean
}

const MAX_RPM = 8000
const START_ANGLE = -125
const END_ANGLE = 125

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number) {
  const start = polar(cx, cy, radius, from)
  const end = polar(cx, cy, radius, to)
  const largeArc = to - from > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Tacómetro analógico de la marca. La aguja y el número digital reaccionan al
 * valor `rpm`; el diseño está inspirado en el cuadro de instrumentos de un
 * deportivo (aro metálico, zona roja y aguja naranja).
 */
export function Tachometer({ rpm, size = 180, className, showDigital = true }: TachometerProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (name: string) => `${name}-${rawId}`
  const reduced = usePrefersReducedMotion()

  const value = clamp(rpm, 0, MAX_RPM)
  const angle = START_ANGLE + (value / MAX_RPM) * (END_ANGLE - START_ANGLE)
  const digital = (value / 1000).toFixed(1)

  const majorTicks = Array.from({ length: 9 }, (_, i) => i)
  const minorTicks = Array.from({ length: 33 }, (_, i) => i).filter((i) => i % 4 !== 0)
  const screws = [40, 140, 220, 320].map((a) => polar(100, 100, 93, a))
  const pivot = polar(100, 100, 61, START_ANGLE)

  return (
    <div
      className={cn('relative select-none', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Tacómetro: ${Math.round(value)} revoluciones por minuto`}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={id('bezel')} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#f4f6f9" />
            <stop offset="0.22" stopColor="#a8aeb8" />
            <stop offset="0.45" stopColor="#4b515b" />
            <stop offset="0.62" stopColor="#2b3037" />
            <stop offset="0.82" stopColor="#9aa1ad" />
            <stop offset="1" stopColor="#d6dae0" />
          </linearGradient>
          <radialGradient id={id('face')} cx="0.5" cy="0.32" r="0.8">
            <stop offset="0" stopColor="#1e222a" />
            <stop offset="0.58" stopColor="#12141a" />
            <stop offset="1" stopColor="#05060a" />
          </radialGradient>
          <radialGradient id={id('vignette')} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.62" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.75" />
          </radialGradient>
          <linearGradient id={id('glass')} x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id('hub')} cx="0.34" cy="0.28" r="0.85">
            <stop offset="0" stopColor="#f7f8fa" />
            <stop offset="0.55" stopColor="#9aa1ad" />
            <stop offset="1" stopColor="#3b4049" />
          </radialGradient>
          <radialGradient id={id('screw')} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#9aa1ad" />
            <stop offset="1" stopColor="#3b4049" />
          </radialGradient>
          <filter id={id('soft')} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id={id('blur2')} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        </defs>

        <circle cx="100" cy="100" r="97" fill={`url(#${id('bezel')})`} />
        <circle cx="100" cy="100" r="91" fill="none" stroke="#000000" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="100" cy="100" r="89" fill="#04050a" />
        <circle cx="100" cy="100" r="86" fill={`url(#${id('face')})`} />
        <circle cx="100" cy="100" r="86" fill={`url(#${id('vignette')})`} />
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="#000000"
          strokeWidth="7"
          opacity="0.75"
          filter={`url(#${id('blur2')})`}
        />

        {screws.map((s, i) => (
          <g key={`s${i}`}>
            <circle cx={s.x} cy={s.y} r="3.2" fill={`url(#${id('screw')})`} />
            <line x1={s.x - 2} y1={s.y + 1.2} x2={s.x + 2} y2={s.y - 1.2} stroke="#2a2e35" strokeWidth="0.9" />
          </g>
        ))}

        {/* Zona roja */}
        <path
          d={arcPath(100, 100, 74, 93.75, 125)}
          fill="none"
          stroke="#e10600"
          strokeWidth="7"
          strokeLinecap="butt"
        />
        <path
          d={arcPath(100, 100, 74, 93.75, 125)}
          fill="none"
          stroke="#ff2e2e"
          strokeWidth="9"
          opacity="0.35"
          filter={`url(#${id('blur2')})`}
        />

        {minorTicks.map((i) => {
          const a = START_ANGLE + (i / 32) * (END_ANGLE - START_ANGLE)
          const inner = polar(100, 100, 72, a)
          const outer = polar(100, 100, 80, a)
          return (
            <line
              key={`m${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#6b7280"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          )
        })}

        {majorTicks.map((i) => {
          const a = START_ANGLE + (i / 8) * (END_ANGLE - START_ANGLE)
          const inner = polar(100, 100, 65, a)
          const outer = polar(100, 100, 80, a)
          const label = polar(100, 100, 52, a)
          const red = i * 1000 >= 7000
          return (
            <g key={`M${i}`}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={red ? '#ff4a3d' : '#e6e9ee'}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <text
                x={label.x}
                y={label.y + 5}
                textAnchor="middle"
                fontSize="14.5"
                fontWeight="600"
                fill={red ? '#ff6a5e' : '#eaedf2'}
                fontFamily="Arial, Helvetica, sans-serif"
              >
                {i}
              </text>
            </g>
          )
        })}

        <text
          x="100"
          y="126"
          textAnchor="middle"
          fontSize="7.5"
          letterSpacing="1.6"
          fill="#8b909a"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          x1000 r/min
        </text>
        <text
          x="100"
          y="176"
          textAnchor="middle"
          fontSize="6"
          letterSpacing="2.4"
          fill="#5c6270"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          PASION MOTORS
        </text>

        {showDigital && (
          <text
            x="100"
            y="152"
            textAnchor="middle"
            fontSize="23"
            fontWeight="700"
            fill="#f5f6f8"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {digital}
          </text>
        )}

        <circle cx={pivot.x} cy={pivot.y} r="3.4" fill={`url(#${id('screw')})`} />
        <circle cx={pivot.x} cy={pivot.y} r="1.4" fill="#1a1d23" />

        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformBox: 'view-box',
            transformOrigin: '100px 100px',
            transition: reduced ? 'none' : 'transform 190ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <g filter={`url(#${id('soft')})`} opacity="0.5" transform="translate(1.6 1.4)">
            <path d="M100 100 L96.4 100 L97.6 30 L100 22 L102.4 30 L103.6 100 Z" fill="#000000" />
            <path d="M100 100 L96.8 100 L98 116 L100 120 L102 116 L103.2 100 Z" fill="#000000" />
          </g>
          <path d="M100 100 L96.8 100 L98 116 L100 120 L102 116 L103.2 100 Z" fill="#c9ccd1" />
          <path d="M100 100 L96.4 100 L97.6 30 L100 22 L102.4 30 L103.6 100 Z" fill="#ff3b1e" />
          <path d="M100 22 L102.4 30 L100 35 L97.6 30 Z" fill="#ffd9d2" opacity="0.85" />
          <path d="M98.4 40 L98.9 96 L100 96 L100 40 Z" fill="#ffffff" opacity="0.22" />
        </g>

        <circle cx="100" cy="100" r="12.5" fill={`url(#${id('hub')})`} />
        <circle cx="100" cy="100" r="12.5" fill="none" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
        <circle cx="100" cy="100" r="5.5" fill="#0a0b0f" />
        <circle cx="97.4" cy="97.2" r="2.6" fill="#ffffff" opacity="0.55" />
        <path
          d={arcPath(100, 100, 80, -111, -9)}
          fill="none"
          stroke={`url(#${id('glass')})`}
          strokeWidth="22"
          strokeLinecap="round"
          opacity="0.85"
        />
        <ellipse cx="68" cy="44" rx="36" ry="15" fill="#ffffff" opacity="0.07" transform="rotate(-26 68 44)" />
        <ellipse cx="134" cy="160" rx="42" ry="14" fill="#ffffff" opacity="0.035" transform="rotate(-14 134 160)" />
      </svg>
    </div>
  )
}

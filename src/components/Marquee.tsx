import { cn } from '@/lib/utils'

interface MarqueeProps {
  items: string[]
  className?: string
}

export function Marquee({ items, className }: MarqueeProps) {
  const loop = [...items, ...items]
  return (
    <div className={cn('relative flex overflow-hidden border-y border-white/10 bg-ink-900 py-4', className)}>
      <div className="mask-fade-r flex min-w-full shrink-0">
        <ul className="flex min-w-full shrink-0 animate-marquee items-center">
          {loop.map((item, i) => (
            <li key={i} className="flex items-center whitespace-nowrap">
              <span className="px-8 text-sm font-bold uppercase tracking-[0.28em] text-white/80">
                {item}
              </span>
              <span className="h-1.5 w-1.5 rotate-45 bg-brand" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

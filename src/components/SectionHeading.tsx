import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/Reveal'

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  action?: ReactNode
  className?: string
  light?: boolean
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
  className,
  light,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
        className,
      )}
    >
      <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && <span className={cn('eyebrow mb-4', light && 'text-brand-600')}>{eyebrow}</span>}
        <h2
          className={cn(
            'display text-3xl sm:text-4xl lg:text-5xl',
            light ? 'text-ink' : 'text-white',
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn('mt-4 text-[15px] leading-relaxed', light ? 'text-ink/60' : 'text-white/60')}>
            {description}
          </p>
        )}
      </Reveal>
      {action && <Reveal delay={120}>{action}</Reveal>}
    </div>
  )
}

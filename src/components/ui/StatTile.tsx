import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type StatTone = 'neutral' | 'good' | 'critical' | 'brand'

const TONES: Record<StatTone, string> = {
  neutral: 'text-ink',
  good: 'text-good',
  critical: 'text-critical',
  brand: 'text-brand',
}

/**
 * A single number with its label. Deliberately not a chart: one value against
 * no scale is a figure, and a figure reads faster than a one-bar bar chart.
 *
 * The value uses the font's proportional figures -- tabular-nums is for columns
 * that must align, and it makes a standalone display number look loose.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  accent,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: StatTone
  /** Small colour chip tying the tile to its series in the charts below. */
  accent?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface px-3 py-3 sm:px-4 sm:py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {accent ? (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
          {label}
        </p>
      </div>
      {/* Rupiah figures run long; step the size down before letting one clip. */}
      <p className={cn('mt-1.5 truncate text-[17px] font-semibold sm:text-xl', TONES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

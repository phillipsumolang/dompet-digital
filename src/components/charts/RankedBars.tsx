import type { Slice } from '../../lib/finance'
import { seriesColor } from '../../lib/palette'
import { useTheme } from '../../store/ui'
import { formatIDR } from '../../lib/money'

/**
 * Magnitude, ranked. Horizontal so long category names have room, and every
 * bar carries its own value -- the comparison is between bar lengths, the
 * exact figure is read off the label.
 */
export function RankedBars({
  slices,
  emptyLabel = 'Nothing to show',
  limit = 5,
}: {
  slices: Slice[]
  emptyLabel?: string
  limit?: number
}) {
  const theme = useTheme()
  const rows = slices.slice(0, limit)
  const max = rows.reduce((m, s) => Math.max(m, s.amount), 0)

  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3 px-4 py-4">
      {rows.map((slice) => (
        <li key={slice.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-ink2">{slice.name}</span>
            <span className="tabular shrink-0 text-[13px] font-medium text-ink">
              {formatIDR(slice.amount)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? (slice.amount / max) * 100 : 0}%`,
                backgroundColor: seriesColor(slice.color, theme),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

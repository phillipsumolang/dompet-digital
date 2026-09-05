import { useMemo } from 'react'
import type { Slice } from '../../lib/finance'
import { seriesColor } from '../../lib/palette'
import { useTheme } from '../../store/ui'
import { formatIDR, formatPercent } from '../../lib/money'

/**
 * Part-to-whole, as one horizontal stacked bar with the values listed beneath.
 *
 * A donut was the obvious choice and the wrong one: slices of similar size are
 * hard to rank by eye, and three of the light-mode hues sit below 3:1 against
 * the surface, so the values have to be visible anyway. The list under the bar
 * is both the direct labelling those hues require and the table view.
 */
export function ShareBar({
  slices,
  total,
  emptyLabel = 'Nothing to show',
}: {
  slices: Slice[]
  total: number
  emptyLabel?: string
}) {
  const theme = useTheme()
  const colors = useMemo(
    () => slices.map((s) => seriesColor(s.color, theme)),
    [slices, theme],
  )

  if (slices.length === 0 || total <= 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-muted">{emptyLabel}</p>
  }

  return (
    <div className="px-4 py-4">
      {/* 2px surface gaps keep adjacent fills from bleeding into one another. */}
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {slices.map((slice, i) => (
          <div
            key={slice.id}
            title={`${slice.name}: ${formatIDR(slice.amount)} (${formatPercent(slice.share)})`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max(slice.share, 0.6)}%`, backgroundColor: colors[i] }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {slices.map((slice, i) => (
          <li key={slice.id} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[i] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink2">{slice.name}</span>
            <span className="tabular shrink-0 text-xs text-muted">
              {formatPercent(slice.share)}
            </span>
            <span className="tabular w-28 shrink-0 text-right font-medium text-ink">
              {formatIDR(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { seriesColor } from '../../lib/palette'
import { useTheme } from '../../store/ui'
import { formatIDR } from '../../lib/money'

export interface DumbbellRow {
  id: string
  name: string
  previous: number
  current: number
}

/**
 * Before and after, one row per category.
 *
 * This replaces the radar chart the shape of this data invites: a radar's area
 * grows with the square of the value and its axis order is arbitrary, so it
 * flatters some categories and buries others. A dumbbell puts both months on
 * one shared scale where the gap between the dots *is* the change.
 */
export function Dumbbell({
  rows,
  previousLabel,
  currentLabel,
  emptyLabel = 'Nothing to compare yet.',
}: {
  rows: DumbbellRow[]
  previousLabel: string
  currentLabel: string
  emptyLabel?: string
}) {
  const theme = useTheme()
  // One hue, two shades: the same measure at two points in time, not two things.
  const previousColor = 'var(--app-line-strong)'
  const currentColor = seriesColor('s1', theme)

  const max = rows.reduce((m, r) => Math.max(m, r.previous, r.current), 0)
  if (rows.length === 0 || max <= 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-muted">{emptyLabel}</p>
  }

  const pct = (value: number) => (value / max) * 100

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center gap-4 text-xs text-ink2">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: previousColor }}
          />
          {previousLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: currentColor }}
          />
          {currentLabel}
        </span>
      </div>

      <ul className="space-y-3.5">
        {rows.map((row) => {
          const delta = row.current - row.previous
          const from = Math.min(pct(row.previous), pct(row.current))
          const to = Math.max(pct(row.previous), pct(row.current))
          return (
            <li key={row.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-ink2">{row.name}</span>
                <span
                  className={`tabular shrink-0 text-xs font-medium ${
                    delta > 0 ? 'text-critical' : delta < 0 ? 'text-good' : 'text-muted'
                  }`}
                  title={`${previousLabel} ${formatIDR(row.previous)} → ${currentLabel} ${formatIDR(row.current)}`}
                >
                  {delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${formatIDR(Math.abs(delta))}`}
                </span>
              </div>

              <div className="relative h-3">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-strong"
                  style={{ left: `${from}%`, width: `${Math.max(to - from, 0)}%` }}
                />
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--app-surface)]"
                  style={{ left: `${pct(row.previous)}%`, backgroundColor: previousColor }}
                  title={`${previousLabel}: ${formatIDR(row.previous)}`}
                />
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--app-surface)]"
                  style={{ left: `${pct(row.current)}%`, backgroundColor: currentColor }}
                  title={`${currentLabel}: ${formatIDR(row.current)}`}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

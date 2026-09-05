import { lazy, Suspense } from 'react'
import type { TrendPoint } from '../../lib/finance'

/**
 * Recharts is by far the heaviest thing the app depends on, and it is used by
 * exactly one chart. Loading it lazily keeps it out of the initial bundle: the
 * tiles and the breakdown paint immediately and the trend fills in behind them.
 */
const TrendChartView = lazy(() =>
  import('./TrendChartView').then((m) => ({ default: m.TrendChartView })),
)

export function TrendChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  return (
    <Suspense
      fallback={
        <div
          className="mx-4 my-4 animate-pulse rounded-lg bg-surface2"
          style={{ height }}
          aria-label="Loading chart"
        />
      }
    >
      <TrendChartView data={data} height={height} />
    </Suspense>
  )
}

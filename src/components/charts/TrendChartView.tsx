import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../../lib/finance'
import { seriesColor } from '../../lib/palette'
import { useTheme } from '../../store/ui'
import { formatCompactIDR, formatIDR } from '../../lib/money'

/**
 * Income against outflow across a year.
 *
 * Two measures, one scale, one axis -- both are Rupiah, so they share it.
 * (A second y-axis would let any two lines be made to cross wherever the chart
 * author wanted.) They are distinct identities rather than good/bad, so they
 * take categorical slots 1 and 2, not the status colours.
 */
export function TrendChartView({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const theme = useTheme()
  const income = seriesColor('s1', theme)
  const outflow = seriesColor('s2', theme)
  const grid = 'var(--app-grid)'
  const axis = 'var(--app-muted)'

  const hasData = data.some((d) => d.income > 0 || d.outflow > 0)
  if (!hasData) {
    return (
      <p className="px-4 py-12 text-center text-[13px] text-muted">
        No activity recorded this year yet.
      </p>
    )
  }

  return (
    <div className="px-2 py-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid stroke={grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: grid }}
            tick={{ fill: axis, fontSize: 11 }}
          />
          <YAxis
            width={58}
            tickLine={false}
            axisLine={false}
            tick={{ fill: axis, fontSize: 11 }}
            tickFormatter={(value: number) => formatCompactIDR(value)}
          />
          <Tooltip
            cursor={{ fill: 'var(--app-surface-2)' }}
            content={<ChartTooltip />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: 'var(--app-ink-2)' }}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill={income}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="outflow"
            name="Outflow"
            fill={outflow}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TooltipPayload {
  name?: string
  value?: number
  color?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      {label ? <p className="mb-1 text-xs font-medium text-ink">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-xs text-ink2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="flex-1">{entry.name}</span>
          <span className="tabular font-medium text-ink">{formatIDR(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  )
}

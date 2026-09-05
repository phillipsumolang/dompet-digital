import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppShell'
import { MonthPicker } from '../components/layout/MonthPicker'
import { Dumbbell, type DumbbellRow } from '../components/charts/Dumbbell'
import { RankedBars } from '../components/charts/RankedBars'
import { ShareBar } from '../components/charts/ShareBar'
import { TrendChart } from '../components/charts/TrendChart'
import { Card, CardHeader } from '../components/ui/Primitives'
import { SegmentedControl } from '../components/ui/Field'
import { StatTile } from '../components/ui/StatTile'
import {
  useCategories,
  useCategoryMap,
  useMonthTransactions,
  usePrevMonthTransactions,
  useSubcategories,
  useYearTransactions,
} from '../hooks/useData'
import {
  capSlices,
  computeTotals,
  monthlyTrend,
  quickStats,
  sumByCategory,
  sumBySubcategory,
} from '../lib/finance'
import { OUTFLOW_KINDS, SPENDING_KINDS } from '../db/schema'
import { formatIDR, formatPercent } from '../lib/money'
import { formatMonthLabel, formatMonthLong, prevMonthKey, yearOf } from '../lib/dates'
import { useUI } from '../store/ui'

type Scope = 'monthly' | 'yearly'

export function Analytics() {
  const month = useUI((s) => s.month)
  const year = yearOf(month)
  const [scope, setScope] = useState<Scope>('monthly')

  const monthTx = useMonthTransactions(month)
  const prevTx = usePrevMonthTransactions(month)
  const yearTx = useYearTransactions(year)
  const categories = useCategories()
  const subcategories = useSubcategories()
  const cats = useCategoryMap()

  const scoped = scope === 'monthly' ? monthTx : yearTx
  const scopeLabel = scope === 'monthly' ? formatMonthLong(month) : String(year)

  const totals = useMemo(() => computeTotals(scoped, cats), [scoped, cats])
  const stats = useMemo(() => quickStats(scoped, cats), [scoped, cats])

  const distribution = useMemo(
    () => capSlices(sumByCategory(scoped, cats, OUTFLOW_KINDS)),
    [scoped, cats],
  )

  const expenseBreakdown = useMemo(
    () => sumBySubcategory(scoped, cats, subcategories, SPENDING_KINDS),
    [scoped, cats, subcategories],
  )

  const trend = useMemo(() => monthlyTrend(yearTx, cats, year), [yearTx, cats, year])

  // Month against month, per category -- the honest form for "what changed".
  const comparison = useMemo<DumbbellRow[]>(() => {
    const current = new Map(
      sumByCategory(monthTx, cats, OUTFLOW_KINDS).map((s) => [s.id, s]),
    )
    const previous = new Map(
      sumByCategory(prevTx, cats, OUTFLOW_KINDS).map((s) => [s.id, s]),
    )
    return categories
      .filter((c) => OUTFLOW_KINDS.includes(c.kind))
      .map((c) => ({
        id: c.id,
        name: c.name,
        previous: previous.get(c.id)?.amount ?? 0,
        current: current.get(c.id)?.amount ?? 0,
      }))
      .filter((row) => row.previous > 0 || row.current > 0)
      .sort((a, b) => b.current - a.current)
  }, [monthTx, prevTx, categories, cats])

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Spending patterns for ${scopeLabel}`}
        actions={
          <>
            <SegmentedControl
              value={scope}
              onChange={setScope}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            <MonthPicker />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Income" value={formatIDR(totals.income)} tone="good" />
        <StatTile label="Outflow" value={formatIDR(totals.outflow)} />
        <StatTile
          label="Savings rate"
          value={formatPercent(totals.savingsRate, 1)}
          hint="Of income, put aside"
        />
        <StatTile
          label="Net"
          value={formatIDR(totals.net)}
          tone={totals.net < 0 ? 'critical' : 'neutral'}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Category distribution"
            subtitle={`How ${formatIDR(totals.outflow)} was split`}
          />
          <ShareBar
            slices={distribution}
            total={totals.outflow}
            emptyLabel={`Nothing went out in ${scopeLabel}.`}
          />
        </Card>

        <Card>
          <CardHeader title="Expense breakdown" subtitle="Bills and expenses, by subcategory" />
          <RankedBars
            slices={expenseBreakdown}
            limit={7}
            emptyLabel={`No spending recorded in ${scopeLabel}.`}
          />
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Monthly comparison ${year}`} subtitle="Income against total outflow" />
          <TrendChart data={trend} height={240} />
        </Card>

        <Card>
          <CardHeader title="Quick stats" subtitle={scopeLabel} />
          <dl className="divide-y divide-line">
            <Stat label="Transactions" value={String(stats.count)} />
            <Stat label="Average transaction" value={formatIDR(stats.average)} />
            <Stat label="Largest expense" value={formatIDR(stats.largestExpense)} />
            <Stat label="Savings rate" value={formatPercent(stats.savingsRate, 1)} />
            <Stat label="Investment rate" value={formatPercent(stats.investmentRate, 1)} />
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="What changed"
          subtitle={`Outflow per category, ${formatMonthLabel(prevMonthKey(month))} against ${formatMonthLabel(month)}`}
        />
        <Dumbbell
          rows={comparison}
          previousLabel={formatMonthLabel(prevMonthKey(month))}
          currentLabel={formatMonthLabel(month)}
          emptyLabel="Nothing to compare yet -- record a second month first."
        />
      </Card>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-[13px] text-ink2">{label}</dt>
      <dd className="tabular text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  )
}

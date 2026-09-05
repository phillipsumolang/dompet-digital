import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Plus, Wallet } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { MonthPicker } from '../components/layout/MonthPicker'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { RankedBars } from '../components/charts/RankedBars'
import { ShareBar } from '../components/charts/ShareBar'
import { TrendChart } from '../components/charts/TrendChart'
import { Avatar } from '../components/ui/ColorPicker'
import { Button, Card, CardHeader, EmptyState } from '../components/ui/Primitives'
import { StatTile } from '../components/ui/StatTile'
import {
  useActiveAccounts,
  useAllTransactions,
  useCategoryMap,
  useMonthTransactions,
  useSubcategories,
} from '../hooks/useData'
import {
  accountBalances,
  capSlices,
  computeTotals,
  monthlyTrend,
  sumByCategory,
  sumBySubcategory,
} from '../lib/finance'
import { OUTFLOW_KINDS, SPENDING_KINDS, ACCOUNT_TYPE_LABELS } from '../db/schema'
import { formatIDR, formatPercent } from '../lib/money'
import { defaultDateFor, formatMonthLong, yearOf } from '../lib/dates'
import { seriesColor } from '../lib/palette'
import { useTheme, useUI } from '../store/ui'
import { cn } from '../lib/cn'

export function Dashboard() {
  const month = useUI((s) => s.month)
  const theme = useTheme()
  const transactions = useMonthTransactions(month)
  const allTransactions = useAllTransactions()
  const accounts = useActiveAccounts()
  const subcategories = useSubcategories()
  const cats = useCategoryMap()
  const [adding, setAdding] = useState(false)

  const totals = useMemo(() => computeTotals(transactions, cats), [transactions, cats])

  const outflowSlices = useMemo(
    () => capSlices(sumByCategory(transactions, cats, OUTFLOW_KINDS)),
    [transactions, cats],
  )

  const topSpending = useMemo(
    () => sumBySubcategory(transactions, cats, subcategories, SPENDING_KINDS),
    [transactions, cats, subcategories],
  )

  const year = yearOf(month)
  const trend = useMemo(
    () => monthlyTrend(allTransactions, cats, year),
    [allTransactions, cats, year],
  )

  const balances = useMemo(
    () => accountBalances(accounts, allTransactions),
    [accounts, allTransactions],
  )

  const defaultDate = defaultDateFor(month)

  const isEmpty = transactions.length === 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={formatMonthLong(month)}
        actions={
          <>
            <MonthPicker />
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              <span className="hidden sm:inline">Add transaction</span>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Income"
          value={formatIDR(totals.income)}
          tone="good"
          accent={seriesColor('s1', theme)}
        />
        <StatTile
          label="Expenses"
          value={formatIDR(totals.expenses)}
          accent={seriesColor('s2', theme)}
          hint={totals.bills > 0 ? `${formatIDR(totals.bills)} of it bills` : undefined}
        />
        <StatTile
          label="Savings"
          value={formatIDR(totals.savings)}
          accent={seriesColor('s4', theme)}
        />
        <StatTile
          label="Investments"
          value={formatIDR(totals.investment)}
          accent={seriesColor('s5', theme)}
        />
        <StatTile
          label="Net balance"
          value={formatIDR(totals.net)}
          tone={totals.net < 0 ? 'critical' : 'neutral'}
          hint={
            totals.income > 0 ? `${formatPercent(totals.savingsRate)} put aside` : 'No income yet'
          }
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {isEmpty ? (
        <Card className="mb-4">
          <EmptyState
            icon={<Wallet size={30} />}
            title={`Nothing recorded in ${formatMonthLong(month)}`}
            description="Add a transaction and every chart on this page fills in from it."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus size={16} />
                Add transaction
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Where the money went"
              subtitle={`${formatIDR(totals.outflow)} out this month`}
            />
            <ShareBar
              slices={outflowSlices}
              total={totals.outflow}
              emptyLabel="No outgoing money this month."
            />
          </Card>

          <Card>
            <CardHeader title="Top spending" subtitle="Bills and expenses, by subcategory" />
            <RankedBars slices={topSpending} emptyLabel="No spending this month." />
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Monthly trend ${year}`} subtitle="Income against total outflow" />
          <TrendChart data={trend} />
        </Card>

        <Card>
          <CardHeader
            title="Account balances"
            action={
              <Link to="/accounts" className="text-xs font-medium text-brand hover:underline">
                Manage
              </Link>
            }
          />
          {accounts.length === 0 ? (
            <EmptyState
              title="No accounts yet"
              description="Add the places your money sits to see balances here."
              action={
                <Link
                  to="/accounts"
                  className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink"
                >
                  Add account
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {accounts.map((account) => {
                const balance = balances.get(account.id) ?? 0
                return (
                  <li key={account.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={account.name} color={account.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{account.name}</p>
                      <p className="text-xs text-muted">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                    </div>
                    <span
                      className={cn(
                        'tabular shrink-0 text-[13px] font-semibold',
                        balance < 0 ? 'text-critical' : 'text-ink',
                      )}
                    >
                      {formatIDR(balance)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <TransactionModal
        open={adding}
        defaultDate={defaultDate}
        onClose={() => setAdding(false)}
      />
    </>
  )
}

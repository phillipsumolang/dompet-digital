import { useMemo } from 'react'
import { CopyMinus, CopyPlus, Info } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { MonthPicker } from '../components/layout/MonthPicker'
import { ColorDot } from '../components/ui/ColorPicker'
import { Badge, Button, Card, CardHeader, Progress } from '../components/ui/Primitives'
import { AmountInput, Switch } from '../components/ui/Field'
import { StatTile } from '../components/ui/StatTile'
import {
  useCategories,
  useCategoryMap,
  useMonthBudgets,
  useMonthTransactions,
  usePrevMonthBudgets,
  usePrevMonthTransactions,
} from '../hooks/useData'
import { buildBudgetRows, summarizeBudget, BUDGETABLE_KINDS } from '../lib/budget'
import { computeTotals, kindOf } from '../lib/finance'
import { formatIDR, formatPercent } from '../lib/money'
import { formatMonthLabel, formatMonthLong, prevMonthKey } from '../lib/dates'
import { replaceBudgets, setBudgetAmount, setBudgetRollover } from '../db/mutations'
import { useUI } from '../store/ui'
import { toast } from '../store/toast'
import type { BudgetStatus } from '../lib/budget'

const STATUS_LABEL: Record<BudgetStatus, string> = {
  good: 'On track',
  warning: 'Close to the limit',
  critical: 'Over budget',
}

/** "Close to the limit" reads wrong at exactly 100% -- it is spent, not close. */
function statusLabel(status: BudgetStatus, percent: number): string {
  if (status === 'warning' && percent >= 100) return 'Fully used'
  return STATUS_LABEL[status]
}

export function Budget() {
  const month = useUI((s) => s.month)
  const categories = useCategories()
  const cats = useCategoryMap()
  const budgets = useMonthBudgets(month)
  const transactions = useMonthTransactions(month)
  const prevBudgets = usePrevMonthBudgets(month)
  const prevTransactions = usePrevMonthTransactions(month)

  const rows = useMemo(
    () =>
      buildBudgetRows({
        categories,
        budgets,
        txs: transactions,
        prevBudgets,
        prevTxs: prevTransactions,
      }),
    [categories, budgets, transactions, prevBudgets, prevTransactions],
  )

  const totals = useMemo(() => computeTotals(transactions, cats), [transactions, cats])
  const summary = useMemo(() => summarizeBudget(rows, totals.income), [rows, totals.income])
  const rolloverOn = budgets.length > 0 && budgets.every((b) => b.rollover)
  const previousLabel = formatMonthLabel(prevMonthKey(month))

  async function copyLastMonthActuals() {
    const spent = new Map<string, number>()
    for (const tx of prevTransactions) {
      const kind = kindOf(tx, cats)
      if (!kind || !BUDGETABLE_KINDS.includes(kind)) continue
      spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.amount)
    }
    if (spent.size === 0) {
      toast.error(`Nothing was spent in ${previousLabel} to copy.`)
      return
    }
    await replaceBudgets(month, spent, rolloverOn)
    toast.success(`Budgets set from what you actually spent in ${previousLabel}.`)
  }

  async function copyLastMonthBudget() {
    if (prevBudgets.length === 0) {
      toast.error(`No budget was set in ${previousLabel}.`)
      return
    }
    await replaceBudgets(
      month,
      new Map(prevBudgets.map((b) => [b.categoryId, b.amount])),
      rolloverOn,
    )
    toast.success(`Copied the ${previousLabel} budget.`)
  }

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle={`Monthly spending limits for ${formatMonthLong(month)}`}
        actions={<MonthPicker />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Income" value={formatIDR(totals.income)} tone="good" />
        <StatTile label="Total budget" value={formatIDR(summary.totalBudget)} />
        <StatTile label="Total spent" value={formatIDR(summary.totalSpent)} />
        <StatTile
          label="Unallocated"
          value={formatIDR(summary.unallocated)}
          tone={summary.unallocated < 0 ? 'critical' : 'neutral'}
          hint={
            summary.unallocated < 0
              ? 'Budgeted more than you earned'
              : 'Income not yet given a job'
          }
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Total budget usage"
          subtitle={`${formatIDR(summary.totalSpent)} of ${formatIDR(summary.totalBudget)}`}
          action={
            <span className="tabular text-lg font-semibold text-ink">
              {formatPercent(summary.percent)}
            </span>
          }
        />
        <div className="px-4 py-4">
          <Progress
            value={summary.percent}
            tone={summary.percent > 100 ? 'critical' : summary.percent >= 80 ? 'warning' : 'brand'}
          />
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink2">
          <Switch
            checked={rolloverOn}
            label="Carry unspent budget into this month"
            onChange={async (checked) => {
              await setBudgetRollover(month, checked)
              toast.success(checked ? 'Rollover on.' : 'Rollover off.')
            }}
          />
          Rollover
          <span
            title={`When on, whatever you did not spend in ${previousLabel} is added to this month's limit.`}
            className="text-muted"
          >
            <Info size={13} />
          </span>
        </label>

        <Button size="sm" onClick={copyLastMonthActuals}>
          <CopyMinus size={14} />
          Use {previousLabel} actuals
        </Button>
        <Button size="sm" onClick={copyLastMonthBudget}>
          <CopyPlus size={14} />
          Copy {previousLabel} budget
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.categoryId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ColorDot color={row.color} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{row.name}</p>
                  <p className="tabular text-xs text-muted">
                    {formatIDR(row.spent)} spent
                    {row.effective > 0 ? ` of ${formatIDR(row.effective)}` : ''}
                  </p>
                </div>
              </div>

              <div className="w-40 shrink-0">
                <AmountInput
                  aria-label={`Budget for ${row.name}`}
                  value={row.budget}
                  onValueChange={(amount) => {
                    void setBudgetAmount(month, row.categoryId, amount)
                  }}
                  className="h-9"
                />
              </div>
            </div>

            {row.effective > 0 ? (
              <div className="mt-3.5">
                <Progress
                  value={row.percent}
                  tone={
                    row.status === 'critical'
                      ? 'critical'
                      : row.status === 'warning'
                        ? 'warning'
                        : 'good'
                  }
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Badge
                      tone={
                        row.status === 'critical'
                          ? 'critical'
                          : row.status === 'warning'
                            ? 'warning'
                            : 'good'
                      }
                    >
                      {statusLabel(row.status, row.percent)}
                    </Badge>
                    {row.carryOver > 0 ? (
                      <span className="text-muted">+{formatIDR(row.carryOver)} rolled over</span>
                    ) : null}
                  </span>
                  <span
                    className={`tabular font-medium ${
                      row.remaining < 0 ? 'text-critical' : 'text-ink2'
                    }`}
                  >
                    {row.remaining < 0
                      ? `${formatIDR(-row.remaining)} over`
                      : `${formatIDR(row.remaining)} left`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-3.5 text-xs text-muted">
                No limit set. Type an amount to start tracking this category.
              </p>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}

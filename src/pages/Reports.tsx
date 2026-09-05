import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader } from '../components/layout/AppShell'
import { MonthPicker } from '../components/layout/MonthPicker'
import { Avatar } from '../components/ui/ColorPicker'
import { Button, Card, CardHeader } from '../components/ui/Primitives'
import { Field, Input, SegmentedControl } from '../components/ui/Field'
import { StatTile } from '../components/ui/StatTile'
import {
  useAccounts,
  useAllTransactions,
  useCategories,
  useCategoryMap,
  useMonthBudgets,
  usePrevMonthBudgets,
  usePrevMonthTransactions,
  useSubcategories,
  useTransactionsBetween,
} from '../hooks/useData'
import { accountUsage, computeTotals, sumByCategory } from '../lib/finance'
import { ACCOUNT_TYPE_LABELS, CATEGORY_KIND_LABELS, OUTFLOW_KINDS } from '../db/schema'
import type { CategoryKind } from '../db/schema'
import { formatIDR, formatPercent } from '../lib/money'
import { addMonthsKey, formatMonthLong, monthKeyToDate, yearOf } from '../lib/dates'
import { exportExcel } from '../export/excel'
import { useUI } from '../store/ui'
import { toast } from '../store/toast'
import { cn } from '../lib/cn'

type Mode = 'monthly' | 'yearly' | 'range'

const SUMMARY_KINDS: CategoryKind[] = ['income', 'bills', 'expense', 'savings', 'investment']

export function Reports() {
  const month = useUI((s) => s.month)
  const year = yearOf(month)
  const [mode, setMode] = useState<Mode>('monthly')
  const [from, setFrom] = useState(() => format(monthKeyToDate(month), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() =>
    format(monthKeyToDate(addMonthsKey(month, 1)), 'yyyy-MM-dd'),
  )

  // One query covers all three modes; only the bounds differ.
  const bounds = useMemo(() => {
    if (mode === 'monthly') {
      return {
        from: `${month}-01`,
        to: `${month}-31`,
        label: formatMonthLong(month),
      }
    }
    if (mode === 'yearly') {
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) }
    }
    return { from, to, label: `${from} to ${to}` }
  }, [mode, month, year, from, to])

  const transactions = useTransactionsBetween(bounds.from, bounds.to)
  const allTransactions = useAllTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  const subcategories = useSubcategories()
  const cats = useCategoryMap()
  const budgets = useMonthBudgets(month)
  const prevBudgets = usePrevMonthBudgets(month)
  const prevTransactions = usePrevMonthTransactions(month)

  const totals = useMemo(() => computeTotals(transactions, cats), [transactions, cats])
  const usage = useMemo(
    () => accountUsage(accounts, transactions),
    [accounts, transactions],
  )
  const byKind = useMemo(() => {
    const slices = sumByCategory(transactions, cats, SUMMARY_KINDS)
    const grouped = new Map<CategoryKind, typeof slices>()
    for (const slice of slices) {
      const kind = cats.get(slice.id)?.kind
      if (!kind) continue
      const list = grouped.get(kind)
      if (list) list.push(slice)
      else grouped.set(kind, [slice])
    }
    return grouped
  }, [transactions, cats])

  const outflowSlices = useMemo(
    () => sumByCategory(transactions, cats, OUTFLOW_KINDS),
    [transactions, cats],
  )

  async function handleExport() {
    try {
      const name = await exportExcel({
        periodLabel: bounds.label,
        accounts,
        categories,
        subcategories,
        transactions,
        allTransactions,
        budgets,
        prevBudgets,
        prevTransactions,
      })
      toast.success(`Exported ${name}.`)
    } catch {
      toast.error('Could not build the spreadsheet.')
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Financial summary for ${bounds.label}`}
        actions={
          <>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'range', label: 'Range' },
              ]}
            />
            {mode === 'range' ? null : <MonthPicker />}
            <Button variant="primary" onClick={handleExport}>
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </>
        }
      />

      {mode === 'range' ? (
        <Card className="mb-4 flex flex-wrap items-end gap-4 px-4 py-3">
          <Field label="From" className="w-44">
            {(id) => (
              <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            )}
          </Field>
          <Field label="To" className="w-44">
            {(id) => (
              <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            )}
          </Field>
          <p className="pb-2.5 text-xs text-muted">
            {transactions.length} transaction{transactions.length === 1 ? '' : 's'} in range
          </p>
        </Card>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Income" value={formatIDR(totals.income)} tone="good" />
        <StatTile label="Outflow" value={formatIDR(totals.outflow)} />
        <StatTile
          label="Net result"
          value={formatIDR(totals.net)}
          tone={totals.net < 0 ? 'critical' : 'neutral'}
        />
        <StatTile label="Savings rate" value={formatPercent(totals.savingsRate, 1)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Financial summary" subtitle={bounds.label} />
          <div className="divide-y divide-line">
            {SUMMARY_KINDS.map((kind) => {
              const slices = byKind.get(kind) ?? []
              const total = slices.reduce((a, b) => a + b.amount, 0)
              return (
                <div key={kind} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      {CATEGORY_KIND_LABELS[kind]}
                    </h3>
                    <span
                      className={cn(
                        'tabular text-[13px] font-semibold',
                        kind === 'income' ? 'text-good' : 'text-ink',
                      )}
                    >
                      {formatIDR(total)}
                    </span>
                  </div>
                  {slices.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      No {CATEGORY_KIND_LABELS[kind].toLowerCase()} recorded
                    </p>
                  ) : slices.length === 1 ? null : (
                    <ul className="mt-1.5 space-y-1">
                      {slices.map((slice) => (
                        <li
                          key={slice.id}
                          className="flex items-baseline justify-between gap-3 text-xs"
                        >
                          <span className="min-w-0 truncate text-ink2">{slice.name}</span>
                          <span className="tabular shrink-0 text-muted">
                            {formatIDR(slice.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}

            <div className="flex items-baseline justify-between gap-3 bg-surface2/60 px-4 py-3">
              <span className="text-[13px] font-semibold text-ink">Net result</span>
              <span
                className={cn(
                  'tabular text-base font-semibold',
                  totals.net < 0 ? 'text-critical' : 'text-ink',
                )}
              >
                {formatIDR(totals.net)}
              </span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Account usage" subtitle={bounds.label} />
            {accounts.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                No accounts to report on.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {usage.map((row) => {
                  const account = accounts.find((a) => a.id === row.accountId)!
                  return (
                    <li key={row.accountId} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar name={account.name} color={account.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {account.name}
                        </p>
                        <p className="text-xs text-muted">
                          {ACCOUNT_TYPE_LABELS[account.type]} · {row.count} transaction
                          {row.count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-[13px] font-medium text-good">
                          +{formatIDR(row.inflow)}
                        </p>
                        <p className="tabular text-xs text-muted">−{formatIDR(row.outflow)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Outflow by category" subtitle="Every category, largest first" />
            {outflowSlices.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                Nothing went out in this period.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="px-4 py-2 text-left font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Share</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {outflowSlices.map((slice) => (
                    <tr key={slice.id}>
                      <td className="px-4 py-2 text-ink2">{slice.name}</td>
                      <td className="tabular px-4 py-2 text-right text-muted">
                        {formatPercent(slice.share)}
                      </td>
                      <td className="tabular px-4 py-2 text-right font-medium text-ink">
                        {formatIDR(slice.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

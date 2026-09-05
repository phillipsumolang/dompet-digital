import { useMemo } from 'react'
import { ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import type { Account, Category, Subcategory, Transaction } from '../../db/schema'
import { formatDateLabel } from '../../lib/dates'
import { formatIDR } from '../../lib/money'
import { ColorDot } from '../ui/ColorPicker'
import { cn } from '../../lib/cn'

export interface TransactionListProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  subcategories: Subcategory[]
  onSelect: (tx: Transaction) => void
}

/**
 * Grouped by day, newest first. The sign lives in the colour and the leading
 * +/- rather than in the stored amount, which is always positive.
 */
export function TransactionList({
  transactions,
  accounts,
  categories,
  subcategories,
  onSelect,
}: TransactionListProps) {
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const subById = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories])

  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const list = groups.get(tx.date)
      if (list) list.push(tx)
      else groups.set(tx.date, [tx])
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
  }, [transactions])

  return (
    <div className="divide-y divide-line">
      {days.map(({ date, items }) => {
        // Transfers move money between your own accounts, so they net to zero
        // for the day just as they do for the month.
        const dayNet = items.reduce(
          (sum, tx) =>
            tx.type === 'transfer' ? sum : sum + (tx.type === 'income' ? tx.amount : -tx.amount),
          0,
        )
        return (
          <section key={date}>
            <div className="flex items-baseline justify-between bg-surface2/60 px-4 py-1.5">
              <h3 className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {formatDateLabel(date)}
              </h3>
              <span className="tabular text-[11px] text-muted">{formatIDR(dayNet)}</span>
            </div>

            <ul className="divide-y divide-line">
              {items.map((tx) => {
                const category = categoryById.get(tx.categoryId)
                const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined
                const account = accountById.get(tx.accountId)
                const toAccount = tx.toAccountId ? accountById.get(tx.toAccountId) : undefined
                const isIncome = tx.type === 'income'
                const isTransfer = tx.type === 'transfer'

                return (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(tx)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface2"
                    >
                      <ColorDot color={category?.color ?? 's1'} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {tx.note || sub?.name || category?.name || 'Transaction'}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted">
                          <span>{category?.name ?? 'Uncategorized'}</span>
                          {sub ? <span>· {sub.name}</span> : null}
                          <span className="text-line-strong">|</span>
                          <span className="inline-flex items-center gap-0.5">
                            {account?.name ?? '—'}
                            {toAccount ? (
                              <>
                                {isTransfer ? (
                                  <ArrowLeftRight size={10} className="mx-0.5" />
                                ) : (
                                  <ArrowUpRight size={10} className="mx-0.5" />
                                )}
                                {toAccount.name}
                              </>
                            ) : null}
                          </span>
                        </p>
                      </div>

                      <span
                        className={cn(
                          'tabular shrink-0 text-[13px] font-semibold',
                          isTransfer ? 'text-muted' : isIncome ? 'text-good' : 'text-ink',
                        )}
                      >
                        {isTransfer ? '' : isIncome ? '+' : '−'}
                        {formatIDR(tx.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

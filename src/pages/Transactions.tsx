import { useMemo, useState } from 'react'
import { Plus, Receipt, Search, X } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { MonthPicker } from '../components/layout/MonthPicker'
import { TransactionList } from '../components/transactions/TransactionList'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { Button, Card, EmptyState } from '../components/ui/Primitives'
import { Select } from '../components/ui/Field'
import { StatTile } from '../components/ui/StatTile'
import {
  useAccounts,
  useCategories,
  useCategoryMap,
  useMonthTransactions,
  useSubcategories,
} from '../hooks/useData'
import { computeTotals } from '../lib/finance'
import { formatIDR } from '../lib/money'
import { defaultDateFor } from '../lib/dates'
import type { Transaction } from '../db/schema'
import { useUI } from '../store/ui'

export function Transactions() {
  const month = useUI((s) => s.month)
  const transactions = useMonthTransactions(month)
  const accounts = useAccounts()
  const categories = useCategories()
  const subcategories = useSubcategories()
  const cats = useCategoryMap()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [adding, setAdding] = useState(false)

  const totals = useMemo(() => computeTotals(transactions, cats), [transactions, cats])

  const subById = useMemo(
    () => new Map(subcategories.map((s) => [s.id, s.name.toLowerCase()])),
    [subcategories],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (categoryId && tx.categoryId !== categoryId) return false
      if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) return false
      if (!query) return true
      const sub = tx.subcategoryId ? (subById.get(tx.subcategoryId) ?? '') : ''
      return tx.note.toLowerCase().includes(query) || sub.includes(query)
    })
  }, [transactions, search, categoryId, accountId, subById])

  const hasFilters = Boolean(search || categoryId || accountId)

  const defaultDate = defaultDateFor(month)

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every rupiah in and out"
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

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile label="Income" value={formatIDR(totals.income)} tone="good" />
        <StatTile label="Outflow" value={formatIDR(totals.outflow)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes and subcategories..."
            aria-label="Search transactions"
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:border-brand"
          />
        </div>

        <div className="w-[152px]">
          <Select
            aria-label="Filter by category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[142px]">
          <Select
            aria-label="Filter by account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-9"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        {hasFilters ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('')
              setCategoryId('')
              setAccountId('')
            }}
          >
            <X size={14} />
            Clear
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title={hasFilters ? 'Nothing matches those filters' : 'No transactions this month'}
            description={
              hasFilters
                ? 'Try widening the search, or clear the filters.'
                : 'Add the first one and the dashboard fills in behind it.'
            }
            action={
              hasFilters ? (
                <Button
                  onClick={() => {
                    setSearch('')
                    setCategoryId('')
                    setAccountId('')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <Plus size={16} />
                  Add transaction
                </Button>
              )
            }
          />
        ) : (
          <>
            <TransactionList
              transactions={filtered}
              accounts={accounts}
              categories={categories}
              subcategories={subcategories}
              onSelect={setEditing}
            />
            <p className="border-t border-line px-4 py-2 text-xs text-muted">
              {filtered.length} of {transactions.length} transaction
              {transactions.length === 1 ? '' : 's'} this month
            </p>
          </>
        )}
      </Card>

      <TransactionModal
        open={adding || editing !== null}
        editing={editing}
        defaultDate={defaultDate}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
      />
    </>
  )
}

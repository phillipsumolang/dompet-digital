/**
 * Every number the app displays is derived here. Pages read from these
 * functions and never re-implement an aggregate, so "what counts as an
 * expense" has exactly one answer.
 *
 * Two rules run through all of it:
 *  - Transfers never touch a total. They relocate money, they do not spend it.
 *  - Savings and Investments are outflows but not spending. They leave the
 *    wallet without making the user poorer, which is why they get their own
 *    tiles and stay out of "Expenses".
 */
import type {
  Account,
  Category,
  CategoryKind,
  Subcategory,
  Transaction,
} from '../db/schema'
import { MAX_SERIES, OTHER_SLOT } from './palette'
import { formatMonthShort, monthsOfYear } from './dates'
import { percentOf } from './money'

export type CategoryMap = Map<string, Category>

export function categoryMap(categories: Category[]): CategoryMap {
  return new Map(categories.map((c) => [c.id, c]))
}

export function kindOf(tx: Transaction, cats: CategoryMap): CategoryKind | undefined {
  return cats.get(tx.categoryId)?.kind
}

export interface Totals {
  income: number
  bills: number
  expense: number
  savings: number
  investment: number
  /** bills + expense -- what the user actually consumed. */
  expenses: number
  /** everything that left the wallet this month. */
  outflow: number
  /** income - outflow: unallocated money at month end. */
  net: number
  /** (savings + investment) / income, as 0-100. */
  savingsRate: number
  investmentRate: number
}

export const EMPTY_TOTALS: Totals = {
  income: 0,
  bills: 0,
  expense: 0,
  savings: 0,
  investment: 0,
  expenses: 0,
  outflow: 0,
  net: 0,
  savingsRate: 0,
  investmentRate: 0,
}

export function computeTotals(txs: Transaction[], cats: CategoryMap): Totals {
  let income = 0
  let bills = 0
  let expense = 0
  let savings = 0
  let investment = 0

  for (const tx of txs) {
    switch (kindOf(tx, cats)) {
      case 'income':
        income += tx.amount
        break
      case 'bills':
        bills += tx.amount
        break
      case 'expense':
        expense += tx.amount
        break
      case 'savings':
        savings += tx.amount
        break
      case 'investment':
        investment += tx.amount
        break
      default:
        break // transfer, or a category that no longer exists
    }
  }

  const expenses = bills + expense
  const outflow = expenses + savings + investment

  return {
    income,
    bills,
    expense,
    savings,
    investment,
    expenses,
    outflow,
    net: income - outflow,
    savingsRate: percentOf(savings + investment, income),
    investmentRate: percentOf(investment, income),
  }
}

/**
 * Balances are derived, never stored -- a stored balance drifts out of sync the
 * first time a transaction is edited or deleted.
 *
 * A transaction credits `toAccountId` whenever it is set, which is what makes a
 * savings or investment entry grow the receiving account instead of making the
 * money disappear.
 */
export function accountBalances(
  accounts: Account[],
  txs: Transaction[],
): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalance]))
  const add = (id: string | undefined, delta: number) => {
    if (!id || !balances.has(id)) return
    balances.set(id, (balances.get(id) ?? 0) + delta)
  }

  for (const tx of txs) {
    if (tx.type === 'income') {
      add(tx.accountId, tx.amount)
    } else {
      add(tx.accountId, -tx.amount)
      add(tx.toAccountId, tx.amount)
    }
  }

  return balances
}

export interface Slice {
  id: string
  name: string
  color: string
  amount: number
  /** Share of the slice set, 0-100. */
  share: number
}

function toSlices(
  buckets: Map<string, { name: string; color: string; amount: number }>,
): Slice[] {
  const total = [...buckets.values()].reduce((a, b) => a + b.amount, 0)
  return [...buckets.entries()]
    .map(([id, b]) => ({ id, ...b, share: percentOf(b.amount, total) }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function sumByCategory(
  txs: Transaction[],
  cats: CategoryMap,
  kinds: CategoryKind[],
): Slice[] {
  const allowed = new Set(kinds)
  const buckets = new Map<string, { name: string; color: string; amount: number }>()

  for (const tx of txs) {
    const cat = cats.get(tx.categoryId)
    if (!cat || !allowed.has(cat.kind)) continue
    const bucket = buckets.get(cat.id) ?? { name: cat.name, color: cat.color, amount: 0 }
    bucket.amount += tx.amount
    buckets.set(cat.id, bucket)
  }

  return toSlices(buckets)
}

export function sumBySubcategory(
  txs: Transaction[],
  cats: CategoryMap,
  subs: Subcategory[],
  kinds: CategoryKind[],
): Slice[] {
  const allowed = new Set(kinds)
  const subById = new Map(subs.map((s) => [s.id, s]))
  const buckets = new Map<string, { name: string; color: string; amount: number }>()

  for (const tx of txs) {
    const cat = cats.get(tx.categoryId)
    if (!cat || !allowed.has(cat.kind)) continue
    const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined
    const id = sub?.id ?? `${cat.id}:uncategorized`
    const name = sub ? `${sub.name}` : `${cat.name} (uncategorized)`
    const bucket = buckets.get(id) ?? { name, color: cat.color, amount: 0 }
    bucket.amount += tx.amount
    buckets.set(id, bucket)
  }

  return toSlices(buckets)
}

/**
 * Cap the identity count. An eighth-and-beyond series is never a generated hue;
 * the tail folds into a single "Other" slice.
 */
export function capSlices(slices: Slice[], max = MAX_SERIES): Slice[] {
  if (slices.length <= max) return slices
  const head = slices.slice(0, max)
  const tail = slices.slice(max)
  const amount = tail.reduce((a, b) => a + b.amount, 0)
  return [
    ...head,
    {
      id: '__other__',
      name: 'Other',
      color: OTHER_SLOT,
      amount,
      share: tail.reduce((a, b) => a + b.share, 0),
    },
  ]
}

export interface TrendPoint {
  month: string
  label: string
  income: number
  outflow: number
  net: number
}

export function monthlyTrend(
  txs: Transaction[],
  cats: CategoryMap,
  year: number,
): TrendPoint[] {
  const byMonth = new Map<string, Transaction[]>()
  for (const tx of txs) {
    if (!tx.month.startsWith(String(year))) continue
    const list = byMonth.get(tx.month)
    if (list) list.push(tx)
    else byMonth.set(tx.month, [tx])
  }

  return monthsOfYear(year).map((month) => {
    const totals = computeTotals(byMonth.get(month) ?? [], cats)
    return {
      month,
      label: formatMonthShort(month),
      income: totals.income,
      outflow: totals.outflow,
      net: totals.net,
    }
  })
}

export interface AccountUsage {
  accountId: string
  count: number
  inflow: number
  outflow: number
}

export function accountUsage(accounts: Account[], txs: Transaction[]): AccountUsage[] {
  const usage = new Map<string, AccountUsage>(
    accounts.map((a) => [a.id, { accountId: a.id, count: 0, inflow: 0, outflow: 0 }]),
  )

  for (const tx of txs) {
    const from = usage.get(tx.accountId)
    if (from) {
      from.count += 1
      if (tx.type === 'income') from.inflow += tx.amount
      else from.outflow += tx.amount
    }
    if (tx.type !== 'income' && tx.toAccountId) {
      const to = usage.get(tx.toAccountId)
      // Only count the destination separately -- a self-transfer is one event.
      if (to && to.accountId !== tx.accountId) {
        to.count += 1
        to.inflow += tx.amount
      }
    }
  }

  return accounts.map((a) => usage.get(a.id)!)
}

export interface QuickStats {
  count: number
  average: number
  largestExpense: number
  savingsRate: number
  investmentRate: number
}

export function quickStats(txs: Transaction[], cats: CategoryMap): QuickStats {
  const counted = txs.filter((tx) => kindOf(tx, cats) !== 'transfer')
  const totals = computeTotals(txs, cats)
  const spending = counted.filter((tx) => {
    const k = kindOf(tx, cats)
    return k === 'bills' || k === 'expense'
  })

  return {
    count: counted.length,
    average: counted.length
      ? Math.round(counted.reduce((a, b) => a + b.amount, 0) / counted.length)
      : 0,
    largestExpense: spending.reduce((max, tx) => Math.max(max, tx.amount), 0),
    savingsRate: totals.savingsRate,
    investmentRate: totals.investmentRate,
  }
}

/**
 * Live reads from IndexedDB.
 *
 * Every query filters `notDeleted`: deletes are tombstones so they can reach
 * other devices, and the app must never see one.
 * `useLiveQuery` re-runs on every write to the
 * tables it touched, so a transaction saved in a modal updates the dashboard
 * behind it with no store, no cache and no invalidation to get wrong.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, notDeleted } from '../db/db'
import type {
  Account,
  Budget,
  Category,
  Settings,
  SplitBill,
  Subcategory,
  Transaction,
} from '../db/schema'
import { categoryMap } from '../lib/finance'
import { prevMonthKey } from '../lib/dates'

const EMPTY: never[] = []

export function useAccounts(): Account[] {
  return useLiveQuery(() => db.accounts.orderBy('order').filter(notDeleted).toArray(), [], EMPTY) as Account[]
}

export function useActiveAccounts(): Account[] {
  const accounts = useAccounts()
  return useMemo(() => accounts.filter((a) => !a.archived), [accounts])
}

export function useCategories(): Category[] {
  return useLiveQuery(
    () => db.categories.orderBy('order').filter(notDeleted).toArray(),
    [],
    EMPTY,
  ) as Category[]
}

export function useSubcategories(): Subcategory[] {
  return useLiveQuery(() => db.subcategories.filter(notDeleted).toArray(), [], EMPTY) as Subcategory[]
}

export function useCategoryMap() {
  const categories = useCategories()
  return useMemo(() => categoryMap(categories), [categories])
}

export function useMonthTransactions(month: string): Transaction[] {
  return useLiveQuery(
    () => db.transactions.where('month').equals(month).filter(notDeleted).toArray(),
    [month],
    EMPTY,
  ) as Transaction[]
}

export function usePrevMonthTransactions(month: string): Transaction[] {
  return useMonthTransactions(prevMonthKey(month))
}

/** Every transaction of a calendar year -- the trend and yearly views need it. */
export function useYearTransactions(year: number): Transaction[] {
  return useLiveQuery(
    () =>
      db.transactions
        .where('month')
        .between(`${year}-01`, `${year}-12`, true, true)
        .filter(notDeleted)
        .toArray(),
    [year],
    EMPTY,
  ) as Transaction[]
}

export function useTransactionsBetween(from: string, to: string): Transaction[] {
  return useLiveQuery(
    () => db.transactions.where('date').between(from, to, true, true).filter(notDeleted).toArray(),
    [from, to],
    EMPTY,
  ) as Transaction[]
}

/** All transactions, for balances that must account for the entire history. */
export function useAllTransactions(): Transaction[] {
  return useLiveQuery(() => db.transactions.filter(notDeleted).toArray(), [], EMPTY) as Transaction[]
}

export function useMonthBudgets(month: string): Budget[] {
  return useLiveQuery(
    () => db.budgets.where('month').equals(month).filter(notDeleted).toArray(),
    [month],
    EMPTY,
  ) as Budget[]
}

export function usePrevMonthBudgets(month: string): Budget[] {
  return useMonthBudgets(prevMonthKey(month))
}

export function useSplitBills(): SplitBill[] {
  return useLiveQuery(
    () => db.splitBills.orderBy('date').reverse().filter(notDeleted).toArray(),
    [],
    EMPTY,
  ) as SplitBill[]
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app'), [], undefined)
}

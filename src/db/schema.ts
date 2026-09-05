/**
 * Domain types for the whole app.
 *
 * Money rule: every amount is a plain integer of whole Rupiah and is always
 * positive. Direction comes from `Transaction.type`, never from the sign.
 * Floats are never used for money -- they drift, and the drift is invisible.
 */

export const SCHEMA_VERSION = 1

export type AccountType =
  | 'salary'
  | 'spending'
  | 'savings'
  | 'insurance_emoney'
  | 'investment'

export type CategoryKind =
  | 'income'
  | 'bills'
  | 'expense'
  | 'savings'
  | 'investment'
  | 'transfer'

export type TransactionType = 'income' | 'expense' | 'transfer'

export type ThemeMode = 'light' | 'dark'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Balance before the first tracked transaction. */
  initialBalance: number
  color: string
  /** 0/1 rather than boolean: IndexedDB cannot index booleans. */
  archived: 0 | 1
  order: number
  createdAt: string
}

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  isBuiltIn: boolean
  color: string
  order: number
}

export interface Subcategory {
  id: string
  categoryId: string
  name: string
  isBuiltIn: boolean
  order: number
}

export interface Transaction {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** YYYY-MM, denormalized from `date` so month filters hit an index. */
  month: string
  type: TransactionType
  amount: number
  /** Account the money leaves (expense/transfer) or lands in (income). */
  accountId: string
  /**
   * Destination account. Set for transfers, and optionally for savings or
   * investment outflows so the receiving account's balance actually grows.
   */
  toAccountId?: string
  categoryId: string
  subcategoryId?: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Budget {
  /** `${month}:${categoryId}` -- one budget per category per month. */
  id: string
  month: string
  categoryId: string
  amount: number
  rollover: boolean
}

export interface SplitPerson {
  id: string
  name: string
}

export interface SplitItem {
  id: string
  name: string
  /** Unit price in whole Rupiah. */
  amount: number
  qty: number
  /** People sharing this item. Empty means "everyone". */
  personIds: string[]
}

export interface SplitBill {
  id: string
  title: string
  date: string
  people: SplitPerson[]
  items: SplitItem[]
  taxPercent: number
  servicePercent: number
  discount: number
  payerId: string
  linkedTransactionId?: string
  createdAt: string
}

export interface Settings {
  id: 'app'
  userName: string
  theme: ThemeMode
  onboarded: boolean
  tourDone: boolean
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  salary: 'Salary',
  spending: 'Spending',
  savings: 'Savings',
  insurance_emoney: 'Insurance & E-Money',
  investment: 'Investment',
}

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Income',
  bills: 'Bills',
  expense: 'Expense',
  savings: 'Savings',
  investment: 'Investment',
  transfer: 'Transfer',
}

/** Which transaction type a category of this kind produces. */
export const KIND_TO_TX_TYPE: Record<CategoryKind, TransactionType> = {
  income: 'income',
  bills: 'expense',
  expense: 'expense',
  savings: 'expense',
  investment: 'expense',
  transfer: 'transfer',
}

/** Kinds that consume money in the month they occur. */
export const OUTFLOW_KINDS: CategoryKind[] = ['bills', 'expense', 'savings', 'investment']

/** Kinds that count as "spending" rather than reallocation of own money. */
export const SPENDING_KINDS: CategoryKind[] = ['bills', 'expense']

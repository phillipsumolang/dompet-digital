import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Budget,
  Category,
  Settings,
  SplitBill,
  Subcategory,
  Transaction,
} from './schema'

export class DompetDB extends Dexie {
  transactions!: Table<Transaction, string>
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  subcategories!: Table<Subcategory, string>
  budgets!: Table<Budget, string>
  splitBills!: Table<SplitBill, string>
  settings!: Table<Settings, string>

  constructor() {
    super('dompet-digital')
    this.version(1).stores({
      // `month` is denormalized onto every transaction so the app's most common
      // query -- "everything in this month" -- is a single index lookup.
      transactions:
        'id, month, date, accountId, categoryId, type, [month+type], [month+categoryId]',
      accounts: 'id, order, archived',
      categories: 'id, kind, order',
      subcategories: 'id, categoryId',
      budgets: 'id, month, [month+categoryId]',
      splitBills: 'id, date',
      settings: 'id',
    })
  }
}

export const db = new DompetDB()

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const nowISO = (): string => new Date().toISOString()

/** Every table, in the order a backup writes and a restore replays them. */
export const TABLE_NAMES = [
  'accounts',
  'categories',
  'subcategories',
  'transactions',
  'budgets',
  'splitBills',
  'settings',
] as const

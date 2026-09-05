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

    // v2 prepares for syncing: `updatedAt` on every table is what a
    // last-write-wins merge compares, and it is indexed so "everything changed
    // since the last sync" stays a range query rather than a full scan.
    this.version(2)
      .stores({
        transactions:
          'id, month, date, accountId, categoryId, type, updatedAt, [month+type], [month+categoryId]',
        accounts: 'id, order, archived, updatedAt',
        categories: 'id, kind, order, updatedAt',
        subcategories: 'id, categoryId, updatedAt',
        budgets: 'id, month, updatedAt, [month+categoryId]',
        splitBills: 'id, date, updatedAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Existing rows have never been synced, so their age is unknown. Dating
        // them from `createdAt` where there is one keeps the ordering sensible;
        // the rest take the migration time.
        const migratedAt = new Date().toISOString()
        for (const table of ['accounts', 'categories', 'subcategories', 'budgets', 'splitBills']) {
          await tx
            .table(table)
            .toCollection()
            .modify((row: { updatedAt?: string; createdAt?: string }) => {
              row.updatedAt = row.updatedAt ?? row.createdAt ?? migratedAt
            })
        }
      })
  }
}

export const db = new DompetDB()

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const nowISO = (): string => new Date().toISOString()

/** Live rows only -- tombstones are still in the table until they are swept. */
export const notDeleted = (row: { deletedAt?: string }): boolean => !row.deletedAt

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

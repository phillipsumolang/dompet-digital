/**
 * Every write goes through here. Keeping them together is what makes
 * referential integrity enforceable: nothing else may delete an account or a
 * category, so nothing else can orphan a transaction.
 */
import type { Table, UpdateSpec } from 'dexie'
import { db, nowISO, notDeleted, uid } from './db'
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryKind,
  Settings,
  SplitBill,
  Subcategory,
  SyncableRow,
  Transaction,
  TransactionType,
} from './schema'
import { toMonthKey } from '../lib/dates'
import { nextSlot } from '../lib/palette'

/**
 * Deleting writes a tombstone instead of removing the row. A row that simply
 * vanished cannot tell another device it was deleted, and that device would
 * dutifully sync it back on the next merge.
 *
 * Reads go through `notDeleted`, so tombstones are invisible to the app.
 */
async function tombstone<T extends SyncableRow>(
  table: Table<T, string>,
  ids: string[],
): Promise<void> {
  const deletedAt = nowISO()
  await Promise.all(
    ids.map((id) => table.update(id, { updatedAt: deletedAt, deletedAt } as unknown as UpdateSpec<T>)),
  )
}

/**
 * Tombstones are not needed forever, only long enough to reach every device.
 * Until syncing exists there is nothing to reach, so this simply keeps deleted
 * rows from accumulating; once sync lands it must only sweep what has been
 * pushed, or a delete could be undone by a device that never heard about it.
 */
export async function sweepTombstones(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString()
  const tables = [db.accounts, db.categories, db.subcategories, db.transactions, db.budgets, db.splitBills]
  const counts = await Promise.all(
    tables.map((table) =>
      (table as Table<SyncableRow, string>)
        .filter((row) => Boolean(row.deletedAt) && row.deletedAt! < cutoff)
        .delete(),
    ),
  )
  return counts.reduce((a, b) => a + b, 0)
}

/** Thrown when a delete would leave transactions pointing at nothing. */
export class InUseError extends Error {
  readonly count: number

  constructor(count: number, message: string) {
    super(message)
    this.count = count
  }
}

// --- Accounts ---------------------------------------------------------------

export interface AccountInput {
  name: string
  type: AccountType
  initialBalance: number
  color: string
}

export async function createAccount(input: AccountInput): Promise<string> {
  const id = uid()
  const order = await db.accounts.count()
  const now = nowISO()
  await db.accounts.add({ ...input, id, archived: 0, order, createdAt: now, updatedAt: now })
  return id
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<void> {
  await db.accounts.update(id, { ...patch, updatedAt: nowISO() })
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await db.accounts.update(id, { archived: archived ? 1 : 0, updatedAt: nowISO() })
}

export async function countAccountTransactions(id: string): Promise<number> {
  // Tombstoned transactions must not keep an account from being deleted.
  const [from, to] = await Promise.all([
    db.transactions.where('accountId').equals(id).filter(notDeleted).count(),
    db.transactions.filter((t) => notDeleted(t) && t.toAccountId === id).count(),
  ])
  return from + to
}

/**
 * Refuses rather than cascading. Deleting an account silently would rewrite
 * history the user cannot see; archiving keeps the past intact.
 */
export async function deleteAccount(id: string): Promise<void> {
  const count = await countAccountTransactions(id)
  if (count > 0) {
    throw new InUseError(
      count,
      `This account is used by ${count} transaction${count === 1 ? '' : 's'}. Archive it instead to keep your history.`,
    )
  }
  await tombstone(db.accounts, [id])
}

export async function reorderAccounts(ids: string[]): Promise<void> {
  const updatedAt = nowISO()
  await db.transaction('rw', db.accounts, async () => {
    await Promise.all(ids.map((id, order) => db.accounts.update(id, { order, updatedAt })))
  })
}

// --- Categories -------------------------------------------------------------

export async function createCategory(input: {
  name: string
  kind: CategoryKind
  color?: string
}): Promise<string> {
  const existing = (await db.categories.toArray()).filter(notDeleted)
  const id = uid()
  await db.categories.add({
    id,
    name: input.name,
    kind: input.kind,
    isBuiltIn: false,
    color: input.color ?? nextSlot(existing.map((c) => c.color)),
    order: existing.length,
    updatedAt: nowISO(),
  })
  return id
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color'>>,
): Promise<void> {
  await db.categories.update(id, { ...patch, updatedAt: nowISO() })
}

export async function countCategoryTransactions(id: string): Promise<number> {
  return db.transactions.where('categoryId').equals(id).filter(notDeleted).count()
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await db.categories.get(id)
  if (!category || category.deletedAt) return
  if (category.isBuiltIn) {
    throw new InUseError(0, 'Built-in categories cannot be deleted. Rename it instead.')
  }
  const count = await countCategoryTransactions(id)
  if (count > 0) {
    throw new InUseError(
      count,
      `This category is used by ${count} transaction${count === 1 ? '' : 's'}. Move them somewhere else first.`,
    )
  }
  await db.transaction('rw', [db.categories, db.subcategories, db.budgets], async () => {
    const [subs, budgets] = await Promise.all([
      db.subcategories.where('categoryId').equals(id).filter(notDeleted).primaryKeys(),
      db.budgets.filter((b) => notDeleted(b) && b.categoryId === id).primaryKeys(),
    ])
    await tombstone(db.subcategories, subs)
    await tombstone(db.budgets, budgets)
    await tombstone(db.categories, [id])
  })
}

export async function createSubcategory(categoryId: string, name: string): Promise<string> {
  const id = uid()
  const order = await db.subcategories.where('categoryId').equals(categoryId).filter(notDeleted).count()
  await db.subcategories.add({ id, categoryId, name, isBuiltIn: false, order, updatedAt: nowISO() })
  return id
}

export async function updateSubcategory(id: string, name: string): Promise<void> {
  await db.subcategories.update(id, { name, updatedAt: nowISO() })
}

/**
 * Subcategories are a label, not a bucket, so removing one detaches it from its
 * transactions rather than blocking. The money stays in the parent category.
 */
export async function deleteSubcategory(id: string): Promise<number> {
  return db.transaction('rw', [db.subcategories, db.transactions], async () => {
    const affected = await db.transactions.filter((t) => notDeleted(t) && t.subcategoryId === id).toArray()
    const updatedAt = nowISO()
    await Promise.all(
      affected.map((t) => db.transactions.update(t.id, { subcategoryId: undefined, updatedAt })),
    )
    await tombstone(db.subcategories, [id])
    return affected.length
  })
}

// --- Transactions -----------------------------------------------------------

export interface TransactionInput {
  date: string
  type: TransactionType
  amount: number
  accountId: string
  toAccountId?: string
  categoryId: string
  subcategoryId?: string
  note: string
}

function normalize(input: TransactionInput) {
  return {
    ...input,
    month: toMonthKey(input.date),
    // An income never has a destination, and a self-transfer is a no-op.
    toAccountId:
      input.type === 'income' || input.toAccountId === input.accountId
        ? undefined
        : input.toAccountId || undefined,
    subcategoryId: input.subcategoryId || undefined,
    note: input.note.trim(),
    amount: Math.max(0, Math.round(input.amount)),
  }
}

export async function createTransaction(input: TransactionInput): Promise<string> {
  const id = uid()
  const timestamp = nowISO()
  await db.transactions.add({
    ...normalize(input),
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<void> {
  await db.transactions.update(id, { ...normalize(input), updatedAt: nowISO() })
}

export async function deleteTransaction(id: string): Promise<void> {
  await tombstone(db.transactions, [id])
}

// --- Budgets ----------------------------------------------------------------

const budgetId = (month: string, categoryId: string) => `${month}:${categoryId}`

export async function setBudgetAmount(
  month: string,
  categoryId: string,
  amount: number,
): Promise<void> {
  const id = budgetId(month, categoryId)
  const stored = await db.budgets.get(id)
  // A tombstoned budget is gone as far as the app is concerned; setting an
  // amount revives it rather than inheriting the dead row's rollover flag.
  const existing = stored && !stored.deletedAt ? stored : undefined

  if (amount <= 0 && !existing?.rollover) {
    if (existing) await tombstone(db.budgets, [id])
    return
  }

  await db.budgets.put({
    id,
    month,
    categoryId,
    amount: Math.max(0, Math.round(amount)),
    rollover: existing?.rollover ?? false,
    updatedAt: nowISO(),
  })
}

export async function setBudgetRollover(month: string, rollover: boolean): Promise<void> {
  const rows = (await db.budgets.where('month').equals(month).toArray()).filter(notDeleted)
  const updatedAt = nowISO()
  await db.budgets.bulkPut(rows.map((b) => ({ ...b, rollover, updatedAt })))
}

/** Replace this month's limits with a set of amounts, dropping the rest. */
export async function replaceBudgets(
  month: string,
  amounts: Map<string, number>,
  rollover: boolean,
): Promise<void> {
  await db.transaction('rw', db.budgets, async () => {
    const updatedAt = nowISO()
    const replacements = new Map(
      [...amounts.entries()].filter(([, amount]) => amount > 0),
    )

    // Clear the month first, then put the replacements. Tombstoning what is
    // being replaced would race the put on the same key, so only the budgets
    // that are actually going away get one.
    const existing = (await db.budgets.where('month').equals(month).toArray()).filter(notDeleted)
    await tombstone(
      db.budgets,
      existing.filter((b) => !replacements.has(b.categoryId)).map((b) => b.id),
    )

    const rows: Budget[] = [...replacements.entries()].map(([categoryId, amount]) => ({
      id: budgetId(month, categoryId),
      month,
      categoryId,
      amount: Math.round(amount),
      rollover,
      updatedAt,
    }))
    if (rows.length) await db.budgets.bulkPut(rows)
  })
}

// --- Split bills ------------------------------------------------------------

export type SplitBillInput = Omit<SplitBill, 'createdAt' | 'updatedAt' | 'deletedAt'>

export async function saveSplitBill(bill: SplitBillInput): Promise<void> {
  const existing = await db.splitBills.get(bill.id)
  const now = nowISO()
  await db.splitBills.put({
    ...bill,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: undefined,
  })
}

export async function deleteSplitBill(id: string): Promise<void> {
  await tombstone(db.splitBills, [id])
}

// --- Settings ---------------------------------------------------------------

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update('app', patch)
}

export type { Account, Category, Subcategory, Transaction, Budget }

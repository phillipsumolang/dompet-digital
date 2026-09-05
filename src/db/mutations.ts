/**
 * Every write goes through here. Keeping them together is what makes
 * referential integrity enforceable: nothing else may delete an account or a
 * category, so nothing else can orphan a transaction.
 */
import { db, nowISO, uid } from './db'
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryKind,
  Settings,
  SplitBill,
  Subcategory,
  Transaction,
  TransactionType,
} from './schema'
import { toMonthKey } from '../lib/dates'
import { nextSlot } from '../lib/palette'

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
  await db.accounts.add({ ...input, id, archived: 0, order, createdAt: nowISO() })
  return id
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<void> {
  await db.accounts.update(id, patch)
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await db.accounts.update(id, { archived: archived ? 1 : 0 })
}

export async function countAccountTransactions(id: string): Promise<number> {
  const [from, to] = await Promise.all([
    db.transactions.where('accountId').equals(id).count(),
    db.transactions.filter((t) => t.toAccountId === id).count(),
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
  await db.accounts.delete(id)
}

export async function reorderAccounts(ids: string[]): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    await Promise.all(ids.map((id, order) => db.accounts.update(id, { order })))
  })
}

// --- Categories -------------------------------------------------------------

export async function createCategory(input: {
  name: string
  kind: CategoryKind
  color?: string
}): Promise<string> {
  const existing = await db.categories.toArray()
  const id = uid()
  await db.categories.add({
    id,
    name: input.name,
    kind: input.kind,
    isBuiltIn: false,
    color: input.color ?? nextSlot(existing.map((c) => c.color)),
    order: existing.length,
  })
  return id
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color'>>,
): Promise<void> {
  await db.categories.update(id, patch)
}

export async function countCategoryTransactions(id: string): Promise<number> {
  return db.transactions.where('categoryId').equals(id).count()
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) return
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
    await db.subcategories.where('categoryId').equals(id).delete()
    await db.budgets.filter((b) => b.categoryId === id).delete()
    await db.categories.delete(id)
  })
}

export async function createSubcategory(categoryId: string, name: string): Promise<string> {
  const id = uid()
  const order = await db.subcategories.where('categoryId').equals(categoryId).count()
  await db.subcategories.add({ id, categoryId, name, isBuiltIn: false, order })
  return id
}

export async function updateSubcategory(id: string, name: string): Promise<void> {
  await db.subcategories.update(id, { name })
}

/**
 * Subcategories are a label, not a bucket, so removing one detaches it from its
 * transactions rather than blocking. The money stays in the parent category.
 */
export async function deleteSubcategory(id: string): Promise<number> {
  return db.transaction('rw', [db.subcategories, db.transactions], async () => {
    const affected = await db.transactions.filter((t) => t.subcategoryId === id).toArray()
    await Promise.all(
      affected.map((t) => db.transactions.update(t.id, { subcategoryId: undefined })),
    )
    await db.subcategories.delete(id)
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
  await db.transactions.delete(id)
}

// --- Budgets ----------------------------------------------------------------

const budgetId = (month: string, categoryId: string) => `${month}:${categoryId}`

export async function setBudgetAmount(
  month: string,
  categoryId: string,
  amount: number,
): Promise<void> {
  const id = budgetId(month, categoryId)
  const existing = await db.budgets.get(id)
  if (amount <= 0 && !existing?.rollover) {
    await db.budgets.delete(id)
    return
  }
  await db.budgets.put({
    id,
    month,
    categoryId,
    amount: Math.max(0, Math.round(amount)),
    rollover: existing?.rollover ?? false,
  })
}

export async function setBudgetRollover(month: string, rollover: boolean): Promise<void> {
  const rows = await db.budgets.where('month').equals(month).toArray()
  await db.budgets.bulkPut(rows.map((b) => ({ ...b, rollover })))
}

/** Replace this month's limits with a set of amounts, dropping the rest. */
export async function replaceBudgets(
  month: string,
  amounts: Map<string, number>,
  rollover: boolean,
): Promise<void> {
  await db.transaction('rw', db.budgets, async () => {
    await db.budgets.where('month').equals(month).delete()
    const rows: Budget[] = [...amounts.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([categoryId, amount]) => ({
        id: budgetId(month, categoryId),
        month,
        categoryId,
        amount: Math.round(amount),
        rollover,
      }))
    if (rows.length) await db.budgets.bulkAdd(rows)
  })
}

// --- Split bills ------------------------------------------------------------

export async function saveSplitBill(bill: Omit<SplitBill, 'createdAt'>): Promise<void> {
  const existing = await db.splitBills.get(bill.id)
  await db.splitBills.put({ ...bill, createdAt: existing?.createdAt ?? nowISO() })
}

export async function deleteSplitBill(id: string): Promise<void> {
  await db.splitBills.delete(id)
}

// --- Settings ---------------------------------------------------------------

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update('app', patch)
}

export type { Account, Category, Subcategory, Transaction, Budget }

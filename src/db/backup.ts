/**
 * Backup and restore. With no server, this file *is* the user's safety net --
 * it is the only way their data survives a cleared browser or moves to another
 * machine, so the restore path validates before it touches anything.
 */
import { db, TABLE_NAMES } from './db'
import { downloadBlob } from '../lib/download'
import { SCHEMA_VERSION } from './schema'

export type { BackupFile } from './backupSchema'
import type { BackupFile } from './backupSchema'

export interface RestoreCounts {
  accounts: number
  categories: number
  subcategories: number
  transactions: number
  budgets: number
  splitBills: number
}

export async function buildBackup(): Promise<BackupFile> {
  const [accounts, categories, subcategories, transactions, budgets, splitBills, settings] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.subcategories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.splitBills.toArray(),
      db.settings.toArray(),
    ])

  return {
    app: 'dompet-digital',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, categories, subcategories, transactions, budgets, splitBills, settings },
  }
}

export async function exportBackup(): Promise<string> {
  const backup = await buildBackup()
  const filename = `dompet-backup-${backup.exportedAt.slice(0, 10)}.json`
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    filename,
  )
  return filename
}

export class RestoreError extends Error {}

/**
 * Replaces everything. Parsing happens before the transaction opens, and the
 * whole replay runs inside one Dexie transaction, so a malformed or truncated
 * file can never leave the database half-written.
 */
export async function restoreBackup(text: string): Promise<RestoreCounts> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new RestoreError('That file is not valid JSON.')
  }

  const { backupSchema } = await import('./backupSchema')
  const result = backupSchema.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.join('.') || 'file'
    throw new RestoreError(
      `This does not look like a Dompet backup (${where}: ${issue?.message ?? 'unexpected shape'}).`,
    )
  }

  const { data, schemaVersion } = result.data
  if (schemaVersion > SCHEMA_VERSION) {
    throw new RestoreError(
      `This backup was made by a newer version of Dompet (v${schemaVersion}). Update the app first.`,
    )
  }

  await db.transaction('rw', TABLE_NAMES.map((name) => db[name]), async () => {
    await Promise.all(TABLE_NAMES.map((name) => db[name].clear()))
    await db.accounts.bulkAdd(data.accounts)
    await db.categories.bulkAdd(data.categories)
    await db.subcategories.bulkAdd(data.subcategories)
    await db.transactions.bulkAdd(data.transactions)
    await db.budgets.bulkAdd(data.budgets)
    await db.splitBills.bulkAdd(data.splitBills)
    await db.settings.bulkAdd(data.settings)
  })

  return {
    accounts: data.accounts.length,
    categories: data.categories.length,
    subcategories: data.subcategories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    splitBills: data.splitBills.length,
  }
}

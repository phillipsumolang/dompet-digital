import { expect, test } from '@playwright/test'

/**
 * The v1 -> v2 upgrade runs against data people already have. If it drops rows
 * or leaves `updatedAt` unset, a first sync would either lose transactions or
 * resurrect deleted ones -- and nothing in the UI would say so.
 *
 * This builds a genuine v1 database with raw IndexedDB *before* the app's
 * scripts run, then lets Dexie upgrade it and checks what survived.
 */

/** Dexie stores its version number multiplied by ten. */
const DEXIE_V1 = 10

const seedV1 = `
  await new Promise((resolve, reject) => {
    indexedDB.deleteDatabase('dompet-digital').onsuccess = resolve
    setTimeout(resolve, 1000)
  })

  await new Promise((resolve, reject) => {
    const open = indexedDB.open('dompet-digital', ${DEXIE_V1})

    open.onupgradeneeded = () => {
      const db = open.result
      const store = (name, indexes) => {
        const s = db.createObjectStore(name, { keyPath: 'id' })
        for (const [index, keyPath] of indexes) s.createIndex(index, keyPath, { unique: false })
        return s
      }
      store('transactions', [
        ['month', 'month'], ['date', 'date'], ['accountId', 'accountId'],
        ['categoryId', 'categoryId'], ['type', 'type'],
        ['[month+type]', ['month', 'type']], ['[month+categoryId]', ['month', 'categoryId']],
      ])
      store('accounts', [['order', 'order'], ['archived', 'archived']])
      store('categories', [['kind', 'kind'], ['order', 'order']])
      store('subcategories', [['categoryId', 'categoryId']])
      store('budgets', [['month', 'month'], ['[month+categoryId]', ['month', 'categoryId']]])
      store('splitBills', [['date', 'date']])
      store('settings', [])
    }

    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(
        ['accounts', 'categories', 'subcategories', 'transactions', 'budgets', 'splitBills', 'settings'],
        'readwrite',
      )
      // Deliberately no updatedAt anywhere: that is what v1 wrote.
      tx.objectStore('accounts').put({ id: 'a1', name: 'Bank', type: 'salary', initialBalance: 5000000, color: 's1', archived: 0, order: 0, createdAt: '2026-06-01T00:00:00.000Z' })
      tx.objectStore('accounts').put({ id: 'a2', name: 'Cash', type: 'spending', initialBalance: 250000, color: 's3', archived: 0, order: 1, createdAt: '2026-06-01T00:00:00.000Z' })
      tx.objectStore('categories').put({ id: 'cat-income', name: 'Income', kind: 'income', isBuiltIn: true, color: 's1', order: 0 })
      tx.objectStore('categories').put({ id: 'cat-expenses', name: 'Expenses', kind: 'expense', isBuiltIn: true, color: 's3', order: 2 })
      tx.objectStore('subcategories').put({ id: 'sub-gro', categoryId: 'cat-expenses', name: 'Groceries', isBuiltIn: true, order: 0 })
      tx.objectStore('transactions').put({ id: 't1', date: '2026-09-01', month: '2026-09', type: 'income', amount: 18500000, accountId: 'a1', categoryId: 'cat-income', note: 'Salary', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
      tx.objectStore('transactions').put({ id: 't2', date: '2026-09-03', month: '2026-09', type: 'expense', amount: 250000, accountId: 'a2', categoryId: 'cat-expenses', subcategoryId: 'sub-gro', note: 'Belanja', createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' })
      tx.objectStore('budgets').put({ id: '2026-09:cat-expenses', month: '2026-09', categoryId: 'cat-expenses', amount: 3000000, rollover: false })
      tx.objectStore('splitBills').put({ id: 'b1', title: 'Dinner', date: '2026-09-02', people: [], items: [], taxPercent: 11, servicePercent: 0, discount: 0, payerId: 'p1', createdAt: '2026-09-02T00:00:00.000Z' })
      tx.objectStore('settings').put({ id: 'app', userName: 'Philip', theme: 'light', onboarded: true, tourDone: false })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
    open.onerror = () => reject(open.error)
  })
`

test('upgrading a v1 database keeps every row and gives it a timestamp', async ({ page }) => {
  await page.addInitScript(`(async () => { ${seedV1} })()`)
  await page.goto('/')

  // The seeded database says onboarded, so no welcome dialog should appear.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const after = await page.evaluate(async () => {
    const read = (store: string) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('dompet-digital')
        open.onsuccess = () => {
          const db = open.result
          const req = db.transaction(store, 'readonly').objectStore(store).getAll()
          req.onsuccess = () => {
            resolve(req.result)
            db.close()
          }
          req.onerror = () => reject(req.error)
        }
        open.onerror = () => reject(open.error)
      })

    const names = ['accounts', 'categories', 'subcategories', 'transactions', 'budgets', 'splitBills']
    const tables: Record<string, { count: number; missingUpdatedAt: number }> = {}
    for (const name of names) {
      const rows = await read(name)
      tables[name] = {
        count: rows.length,
        missingUpdatedAt: rows.filter((r) => !r.updatedAt).length,
      }
    }
    const accounts = await read('accounts')
    return {
      tables,
      // Rows that carried a createdAt should be dated from it, not from now.
      bankUpdatedAt: accounts.find((a) => a.id === 'a1')?.updatedAt,
    }
  })

  // Nothing seeded on top, nothing dropped.
  expect(after.tables.accounts.count).toBe(2)
  expect(after.tables.categories.count).toBe(2)
  expect(after.tables.subcategories.count).toBe(1)
  expect(after.tables.transactions.count).toBe(2)
  expect(after.tables.budgets.count).toBe(1)
  expect(after.tables.splitBills.count).toBe(1)

  for (const [name, table] of Object.entries(after.tables)) {
    expect(table.missingUpdatedAt, `${name} has rows with no updatedAt`).toBe(0)
  }

  expect(after.bankUpdatedAt).toBe('2026-06-01T00:00:00.000Z')

  // And the migrated data is what the app actually shows.
  await expect(page.getByText('Rp 18.500.000')).toBeVisible()
})

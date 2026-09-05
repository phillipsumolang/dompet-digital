import { describe, expect, it } from 'vitest'
import type { Account, Budget, Category, Subcategory, Transaction } from '../db/schema'
import { buildWorkbook, workbookFilename, type Row } from './excel'

const categories: Category[] = [
  { id: 'inc', name: 'Income', kind: 'income', isBuiltIn: true, color: 's1', order: 0 },
  { id: 'bil', name: 'Bills', kind: 'bills', isBuiltIn: true, color: 's2', order: 1 },
  { id: 'exp', name: 'Expenses', kind: 'expense', isBuiltIn: true, color: 's3', order: 2 },
  { id: 'trf', name: 'Transfer', kind: 'transfer', isBuiltIn: true, color: 's6', order: 5 },
]

const subcategories: Subcategory[] = [
  { id: 'rent', categoryId: 'bil', name: 'Rent', isBuiltIn: true, order: 0 },
]

const accounts: Account[] = [
  { id: 'a1', name: 'Bank', type: 'salary', initialBalance: 1_000_000, color: 's1', archived: 0, order: 0, createdAt: '' },
  { id: 'a2', name: 'Cash', type: 'spending', initialBalance: 0, color: 's3', archived: 0, order: 1, createdAt: '' },
]

let seq = 0
function tx(part: Partial<Transaction> & Pick<Transaction, 'amount' | 'categoryId'>): Transaction {
  seq += 1
  const date = part.date ?? '2026-09-10'
  return {
    id: `t${seq}`,
    date,
    month: date.slice(0, 7),
    type: 'expense',
    accountId: 'a1',
    note: '',
    createdAt: date,
    updatedAt: date,
    ...part,
  }
}

const transactions: Transaction[] = [
  tx({ amount: 10_000_000, categoryId: 'inc', type: 'income', note: 'Salary' }),
  tx({ amount: 3_000_000, categoryId: 'bil', subcategoryId: 'rent', note: 'Kos' }),
  tx({ amount: 1_500_000, categoryId: 'exp', accountId: 'a2', note: 'Groceries' }),
  tx({ amount: 500_000, categoryId: 'trf', type: 'transfer', toAccountId: 'a2', note: 'Top up' }),
]

const budgets: Budget[] = [
  { id: '2026-09:bil', month: '2026-09', categoryId: 'bil', amount: 3_500_000, rollover: false },
]

const input = {
  periodLabel: 'September 2026',
  accounts,
  categories,
  subcategories,
  transactions,
  allTransactions: transactions,
  budgets,
  prevBudgets: [],
  prevTransactions: [],
}

/** Cells are objects with a `value`; this reads one out of the grid. */
function cell(rows: Row[], row: number, col: number): unknown {
  const c = rows[row]?.[col]
  return c && typeof c === 'object' ? (c as { value?: unknown }).value : c
}

function findRow(rows: Row[], label: string): Row | undefined {
  return rows.find((r) => cell([r], 0, 0) === label)
}

describe('buildWorkbook', () => {
  const sheets = buildWorkbook(input)
  const byName = new Map(sheets.map((s) => [s.sheet, s]))

  it('produces the four sheets, each with a column width per column', () => {
    expect(sheets.map((s) => s.sheet)).toEqual([
      'Summary',
      'Transactions',
      'Budget',
      'Accounts',
    ])
    for (const sheet of sheets) {
      const widest = Math.max(...sheet.data.map((r) => r.length))
      expect(sheet.columns.length).toBeGreaterThanOrEqual(widest)
    }
  })

  it('writes the same totals the app shows, with transfers excluded', () => {
    const rows = byName.get('Summary')!.data
    expect(cell([findRow(rows, 'Income')!], 0, 1)).toBe(10_000_000)
    expect(cell([findRow(rows, 'Bills')!], 0, 1)).toBe(3_000_000)
    expect(cell([findRow(rows, 'Expenses')!], 0, 1)).toBe(1_500_000)
    expect(cell([findRow(rows, 'Total outflow')!], 0, 1)).toBe(4_500_000)
    expect(cell([findRow(rows, 'Net balance')!], 0, 1)).toBe(5_500_000)
  })

  it('formats money cells as numbers so the spreadsheet can sum them', () => {
    const rows = byName.get('Summary')!.data
    const income = findRow(rows, 'Income')![1] as Record<string, unknown>
    expect(income.type).toBe(Number)
    expect(income.format).toBe('"Rp" #,##0')
  })

  it('lists every transaction, oldest first, with names resolved', () => {
    const rows = byName.get('Transactions')!.data
    expect(rows).toHaveLength(transactions.length + 1) // + header
    expect(cell(rows, 0, 0)).toBe('Date')
    const kos = rows.find((r) => cell([r], 0, 6) === 'Kos')!
    expect(cell([kos], 0, 2)).toBe('Bills') // category name, not id
    expect(cell([kos], 0, 3)).toBe('Rent') // subcategory name
    expect(cell([kos], 0, 4)).toBe('Bank') // account name
    expect(cell([kos], 0, 7)).toBe(3_000_000)
  })

  it('names the destination account on a transfer', () => {
    const rows = byName.get('Transactions')!.data
    const transfer = rows.find((r) => cell([r], 0, 6) === 'Top up')!
    expect(cell([transfer], 0, 5)).toBe('Cash')
  })

  it('reports budget usage against what was spent', () => {
    const rows = byName.get('Budget')!.data
    const bills = findRow(rows, 'Bills')!
    expect(cell([bills], 0, 1)).toBe(3_500_000) // budget
    expect(cell([bills], 0, 4)).toBe(3_000_000) // spent
    expect(cell([bills], 0, 5)).toBe(500_000) // remaining
  })

  it('reports closing balances, not just period movement', () => {
    const rows = byName.get('Accounts')!.data
    const bank = findRow(rows, 'Bank')!
    // 1.000.000 opening + 10.000.000 in - 3.000.000 bills - 500.000 transfer out
    expect(cell([bank], 0, 6)).toBe(7_500_000)
    const cash = findRow(rows, 'Cash')!
    expect(cell([cash], 0, 6)).toBe(-1_000_000)
  })
})

describe('workbookFilename', () => {
  it('slugs the period into a safe filename', () => {
    expect(workbookFilename('September 2026')).toBe('dompet-september-2026.xlsx')
    expect(workbookFilename('2026-01-01 to 2026-03-31')).toBe(
      'dompet-2026-01-01-to-2026-03-31.xlsx',
    )
  })
})

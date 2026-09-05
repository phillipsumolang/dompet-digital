import { describe, expect, it } from 'vitest'
import type { Budget, Category, Transaction } from '../db/schema'
import { buildBudgetRows, summarizeBudget } from './budget'

const categories: Category[] = [
  { id: 'inc', name: 'Income', kind: 'income', isBuiltIn: true, color: 's1', order: 0, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bil', name: 'Bills', kind: 'bills', isBuiltIn: true, color: 's2', order: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'exp', name: 'Expenses', kind: 'expense', isBuiltIn: true, color: 's3', order: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'trf', name: 'Transfer', kind: 'transfer', isBuiltIn: true, color: 's6', order: 5, updatedAt: '2026-01-01T00:00:00.000Z' },
]

let seq = 0
function tx(categoryId: string, amount: number, month = '2026-09'): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    date: `${month}-05`,
    month,
    type: 'expense',
    amount,
    accountId: 'a1',
    categoryId,
    note: '',
    createdAt: '',
    updatedAt: '',
  }
}

function budget(categoryId: string, amount: number, rollover = false, month = '2026-09'): Budget {
  return { id: `${month}:${categoryId}`, month, categoryId, amount, rollover, updatedAt: '2026-01-01T00:00:00.000Z' }
}

describe('buildBudgetRows', () => {
  it('budgets only what you spend -- never income or transfers', () => {
    const rows = buildBudgetRows({ categories, budgets: [], txs: [] })
    expect(rows.map((r) => r.categoryId)).toEqual(['bil', 'exp'])
  })

  it('tracks spend against the limit', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('bil', 2_000_000)],
      txs: [tx('bil', 1_600_000)],
    })
    expect(rows[0]).toMatchObject({
      budget: 2_000_000,
      spent: 1_600_000,
      remaining: 400_000,
      status: 'warning', // 80% is where it starts to matter
    })
    expect(rows[0].percent).toBeCloseTo(80)
  })

  it('flags going over', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('exp', 1_000_000)],
      txs: [tx('exp', 1_250_000)],
    })
    expect(rows[1]).toMatchObject({ status: 'critical', remaining: -250_000 })
  })

  it('stays good while a category has no limit set', () => {
    const rows = buildBudgetRows({ categories, budgets: [], txs: [tx('exp', 500_000)] })
    expect(rows[1]).toMatchObject({ effective: 0, spent: 500_000, status: 'good' })
  })

  it('carries last month unspent remainder forward when rollover is on', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('exp', 1_000_000, true)],
      txs: [],
      prevBudgets: [budget('exp', 1_000_000, true, '2026-08')],
      prevTxs: [tx('exp', 400_000, '2026-08')],
    })
    expect(rows[1]).toMatchObject({ carryOver: 600_000, effective: 1_600_000 })
  })

  it('never carries an overspend forward as a negative allowance', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('exp', 1_000_000, true)],
      txs: [],
      prevBudgets: [budget('exp', 1_000_000, true, '2026-08')],
      prevTxs: [tx('exp', 1_800_000, '2026-08')],
    })
    expect(rows[1].carryOver).toBe(0)
  })

  it('ignores last month entirely when rollover is off', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('exp', 1_000_000, false)],
      txs: [],
      prevBudgets: [budget('exp', 1_000_000, false, '2026-08')],
      prevTxs: [],
    })
    expect(rows[1].carryOver).toBe(0)
  })
})

describe('summarizeBudget', () => {
  it('reports what is still unallocated against income', () => {
    const rows = buildBudgetRows({
      categories,
      budgets: [budget('bil', 2_000_000), budget('exp', 3_000_000)],
      txs: [tx('bil', 1_000_000)],
    })
    expect(summarizeBudget(rows, 10_000_000)).toMatchObject({
      totalBudget: 5_000_000,
      totalSpent: 1_000_000,
      unallocated: 5_000_000,
    })
  })

  it('goes negative when more is budgeted than earned', () => {
    const rows = buildBudgetRows({ categories, budgets: [budget('exp', 12_000_000)], txs: [] })
    expect(summarizeBudget(rows, 10_000_000).unallocated).toBe(-2_000_000)
  })
})

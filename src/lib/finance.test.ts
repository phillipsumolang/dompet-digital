import { describe, expect, it } from 'vitest'
import type { Account, Category, Transaction } from '../db/schema'
import {
  accountBalances,
  accountUsage,
  capSlices,
  categoryMap,
  computeTotals,
  monthlyTrend,
  quickStats,
  sumByCategory,
} from './finance'

const cats: Category[] = [
  { id: 'inc', name: 'Income', kind: 'income', isBuiltIn: true, color: 's1', order: 0, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bil', name: 'Bills', kind: 'bills', isBuiltIn: true, color: 's2', order: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'exp', name: 'Expenses', kind: 'expense', isBuiltIn: true, color: 's3', order: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'sav', name: 'Savings', kind: 'savings', isBuiltIn: true, color: 's4', order: 3, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'inv', name: 'Investments', kind: 'investment', isBuiltIn: true, color: 's5', order: 4, updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'trf', name: 'Transfer', kind: 'transfer', isBuiltIn: true, color: 's6', order: 5, updatedAt: '2026-01-01T00:00:00.000Z' },
]
const map = categoryMap(cats)

let seq = 0
function tx(part: Partial<Transaction> & Pick<Transaction, 'amount' | 'categoryId'>): Transaction {
  seq += 1
  const date = part.date ?? '2026-09-10'
  return {
    id: `t${seq}`,
    date,
    month: date.slice(0, 7),
    type: part.type ?? 'expense',
    accountId: 'a1',
    note: '',
    createdAt: date,
    updatedAt: date,
    ...part,
  }
}

// One hand-computed month used by several assertions below.
//   income 10.000.000 | bills 2.000.000 | expense 3.000.000
//   savings 1.500.000 | investments 500.000 | a 4.000.000 transfer
const month: Transaction[] = [
  tx({ amount: 10_000_000, categoryId: 'inc', type: 'income' }),
  tx({ amount: 2_000_000, categoryId: 'bil' }),
  tx({ amount: 3_000_000, categoryId: 'exp' }),
  tx({ amount: 1_500_000, categoryId: 'sav', toAccountId: 'a2' }),
  tx({ amount: 500_000, categoryId: 'inv', toAccountId: 'a3' }),
  tx({ amount: 4_000_000, categoryId: 'trf', type: 'transfer', toAccountId: 'a2' }),
]

describe('computeTotals', () => {
  const totals = computeTotals(month, map)

  it('separates spending from reallocation of the user own money', () => {
    expect(totals.income).toBe(10_000_000)
    expect(totals.expenses).toBe(5_000_000) // bills + expense, nothing else
    expect(totals.savings).toBe(1_500_000)
    expect(totals.investment).toBe(500_000)
  })

  it('computes outflow and net from the hand-checked fixture', () => {
    expect(totals.outflow).toBe(7_000_000)
    expect(totals.net).toBe(3_000_000)
  })

  it('rates savings and investments against income', () => {
    expect(totals.savingsRate).toBeCloseTo(20)
    expect(totals.investmentRate).toBeCloseTo(5)
  })

  it('excludes transfers from every total', () => {
    const withoutTransfer = computeTotals(
      month.filter((t) => t.categoryId !== 'trf'),
      map,
    )
    expect(withoutTransfer).toEqual(totals)
  })

  it('reports a zero savings rate instead of NaN when there is no income', () => {
    expect(computeTotals([tx({ amount: 100, categoryId: 'sav' })], map).savingsRate).toBe(0)
  })

  it('ignores transactions whose category was deleted', () => {
    expect(computeTotals([tx({ amount: 999, categoryId: 'gone' })], map).outflow).toBe(0)
  })
})

describe('accountBalances', () => {
  const accounts: Account[] = [
    { id: 'a1', name: 'Bank', type: 'salary', initialBalance: 1_000_000, color: 's1', archived: 0, order: 0, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'a2', name: 'Savings', type: 'savings', initialBalance: 0, color: 's4', archived: 0, order: 1, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'a3', name: 'Broker', type: 'investment', initialBalance: 0, color: 's5', archived: 0, order: 2, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
  ]

  it('is initial + inflow - outflow', () => {
    const balances = accountBalances(accounts, month)
    // 1.000.000 + 10.000.000 - (2+3+1,5+0,5+4)m
    expect(balances.get('a1')).toBe(0)
  })

  it('credits the destination so savings grow instead of vanishing', () => {
    const balances = accountBalances(accounts, month)
    expect(balances.get('a2')).toBe(5_500_000) // 1,5m savings + 4m transfer
    expect(balances.get('a3')).toBe(500_000)
  })

  it('conserves money across a transfer', () => {
    const before = accountBalances(accounts, [])
    const after = accountBalances(accounts, [
      tx({ amount: 250_000, categoryId: 'trf', type: 'transfer', toAccountId: 'a2' }),
    ])
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
    expect(sum(after)).toBe(sum(before))
  })

  it('ignores a destination account that no longer exists', () => {
    const balances = accountBalances(accounts, [
      tx({ amount: 100, categoryId: 'trf', type: 'transfer', toAccountId: 'deleted' }),
    ])
    expect(balances.get('a1')).toBe(1_000_000 - 100)
  })
})

describe('sumByCategory', () => {
  it('keeps only the requested kinds and sorts by size', () => {
    const slices = sumByCategory(month, map, ['bills', 'expense'])
    expect(slices.map((s) => s.name)).toEqual(['Expenses', 'Bills'])
    expect(slices[0].share).toBeCloseTo(60)
  })
})

describe('capSlices', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    name: `c${i}`,
    color: 's1',
    amount: 10 - i,
    share: 10,
  }))

  it('folds the tail into a single Other slice rather than inventing hues', () => {
    const capped = capSlices(many, 7)
    expect(capped).toHaveLength(8)
    expect(capped[7].name).toBe('Other')
    expect(capped[7].amount).toBe(3 + 2 + 1)
  })

  it('leaves a short list untouched', () => {
    expect(capSlices(many.slice(0, 3), 7)).toHaveLength(3)
  })
})

describe('monthlyTrend', () => {
  it('returns all twelve months, zero-filled', () => {
    const points = monthlyTrend(month, map, 2026)
    expect(points).toHaveLength(12)
    expect(points[8].label).toBe('Sep')
    expect(points[8].income).toBe(10_000_000)
    expect(points[0].income).toBe(0)
  })

  it('ignores other years', () => {
    expect(monthlyTrend(month, map, 2025).every((p) => p.income === 0)).toBe(true)
  })
})

describe('accountUsage', () => {
  const accounts: Account[] = [
    { id: 'a1', name: 'Bank', type: 'salary', initialBalance: 0, color: 's1', archived: 0, order: 0, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'a2', name: 'Savings', type: 'savings', initialBalance: 0, color: 's4', archived: 0, order: 1, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
  ]

  it('counts both ends of a transfer', () => {
    const usage = accountUsage(accounts, [
      tx({ amount: 300_000, categoryId: 'trf', type: 'transfer', toAccountId: 'a2' }),
    ])
    expect(usage[0]).toMatchObject({ count: 1, outflow: 300_000, inflow: 0 })
    expect(usage[1]).toMatchObject({ count: 1, inflow: 300_000, outflow: 0 })
  })

  it('counts a self-transfer once', () => {
    const usage = accountUsage(accounts, [
      tx({ amount: 100, categoryId: 'trf', type: 'transfer', toAccountId: 'a1' }),
    ])
    expect(usage[0].count).toBe(1)
  })
})

describe('quickStats', () => {
  it('excludes transfers from the count and reports the largest spend', () => {
    const stats = quickStats(month, map)
    expect(stats.count).toBe(5)
    expect(stats.largestExpense).toBe(3_000_000) // not the 4m transfer
  })

  it('is all zeroes on an empty month', () => {
    expect(quickStats([], map)).toMatchObject({ count: 0, average: 0, largestExpense: 0 })
  })
})

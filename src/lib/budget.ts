/**
 * Budget maths. Kept apart from `finance.ts` because rollover introduces a
 * dependency on the previous month that the plain aggregates do not have.
 */
import type { Budget, Category, CategoryKind, Transaction } from '../db/schema'
import { categoryMap, kindOf } from './finance'
import { percentOf } from './money'

/** Income and transfers are not budgeted -- you budget what you spend. */
export const BUDGETABLE_KINDS: CategoryKind[] = ['bills', 'expense', 'savings', 'investment']

export type BudgetStatus = 'good' | 'warning' | 'critical'

export interface BudgetRow {
  categoryId: string
  name: string
  color: string
  kind: CategoryKind
  /** The limit the user typed for this month. */
  budget: number
  rollover: boolean
  /** Unspent remainder carried in from last month; 0 when rollover is off. */
  carryOver: number
  /** budget + carryOver -- what is actually available. */
  effective: number
  spent: number
  /** effective - spent; negative means over budget. */
  remaining: number
  percent: number
  status: BudgetStatus
}

export interface BudgetSummary {
  income: number
  totalBudget: number
  totalSpent: number
  /** income - totalBudget: money not yet given a job. */
  unallocated: number
  percent: number
}

function spentByCategory(txs: Transaction[], cats: ReturnType<typeof categoryMap>) {
  const spent = new Map<string, number>()
  for (const tx of txs) {
    const kind = kindOf(tx, cats)
    if (!kind || !BUDGETABLE_KINDS.includes(kind)) continue
    spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.amount)
  }
  return spent
}

function statusFor(percent: number, effective: number): BudgetStatus {
  if (effective <= 0) return 'good'
  if (percent > 100) return 'critical'
  if (percent >= 80) return 'warning'
  return 'good'
}

export interface BuildBudgetArgs {
  categories: Category[]
  budgets: Budget[]
  txs: Transaction[]
  /** Previous month, needed only to resolve rollover. */
  prevBudgets?: Budget[]
  prevTxs?: Transaction[]
}

/**
 * Rollover looks back exactly one month. Chaining it further would make every
 * month's number depend on the entire history, which is both slow and
 * surprising to read; one month is what "I underspent last month" means.
 */
export function buildBudgetRows({
  categories,
  budgets,
  txs,
  prevBudgets = [],
  prevTxs = [],
}: BuildBudgetArgs): BudgetRow[] {
  const cats = categoryMap(categories)
  const spent = spentByCategory(txs, cats)
  const prevSpent = spentByCategory(prevTxs, cats)
  const byCategory = new Map(budgets.map((b) => [b.categoryId, b]))
  const prevByCategory = new Map(prevBudgets.map((b) => [b.categoryId, b]))

  return categories
    .filter((c) => BUDGETABLE_KINDS.includes(c.kind))
    .sort((a, b) => a.order - b.order)
    .map((category) => {
      const record = byCategory.get(category.id)
      const budget = record?.amount ?? 0
      const rollover = record?.rollover ?? false

      let carryOver = 0
      if (rollover) {
        const prevBudget = prevByCategory.get(category.id)?.amount ?? 0
        carryOver = Math.max(0, prevBudget - (prevSpent.get(category.id) ?? 0))
      }

      const effective = budget + carryOver
      const used = spent.get(category.id) ?? 0
      const percent = percentOf(used, effective)

      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        kind: category.kind,
        budget,
        rollover,
        carryOver,
        effective,
        spent: used,
        remaining: effective - used,
        percent,
        status: statusFor(percent, effective),
      }
    })
}

export function summarizeBudget(rows: BudgetRow[], income: number): BudgetSummary {
  const totalBudget = rows.reduce((a, r) => a + r.effective, 0)
  const totalSpent = rows.reduce((a, r) => a + r.spent, 0)
  return {
    income,
    totalBudget,
    totalSpent,
    unallocated: income - totalBudget,
    percent: percentOf(totalSpent, totalBudget),
  }
}

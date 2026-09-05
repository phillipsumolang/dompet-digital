/**
 * Excel export.
 *
 * The writer is pulled in with a dynamic import so its code only downloads
 * when someone actually exports -- it has no business in the initial bundle of
 * a dashboard.
 */
import type { Account, Budget, Category, Subcategory, Transaction } from '../db/schema'
import { ACCOUNT_TYPE_LABELS, CATEGORY_KIND_LABELS, OUTFLOW_KINDS } from '../db/schema'
import { downloadBlob } from '../lib/download'
import { accountBalances, accountUsage, categoryMap, computeTotals, sumByCategory } from '../lib/finance'
import { buildBudgetRows, summarizeBudget } from '../lib/budget'
import { formatDateLabel } from '../lib/dates'

const MONEY = '"Rp" #,##0'
const PERCENT = '0.0"%"'

export interface ExcelExportInput {
  /** Human label for the exported period, e.g. "September 2026". */
  periodLabel: string
  accounts: Account[]
  categories: Category[]
  subcategories: Subcategory[]
  /** Transactions inside the exported period. */
  transactions: Transaction[]
  /** Every transaction ever -- balances are cumulative, not per-period. */
  allTransactions: Transaction[]
  budgets: Budget[]
  prevBudgets: Budget[]
  prevTransactions: Transaction[]
}

export type Cell = Record<string, unknown> | string | number | null
export type Row = Cell[]

const heading = (text: string): Row => [{ value: text, fontWeight: 'bold', fontSize: 13 }]
const header = (labels: string[]): Row =>
  labels.map((value) => ({ value, fontWeight: 'bold', backgroundColor: '#F0EFEC' }))
const money = (value: number) => ({ type: Number, value, format: MONEY })
const percent = (value: number) => ({ type: Number, value, format: PERCENT })
const text = (value: string) => ({ type: String, value })

export interface WorkbookSheet {
  sheet: string
  data: Row[]
  columns: Array<{ width: number }>
  stickyRowsCount?: number
}

/**
 * Pure: turns the period's data into the four sheets. Split out from the
 * writing so the numbers can be asserted without a zip writer or a DOM.
 */
export function buildWorkbook(input: ExcelExportInput): WorkbookSheet[] {
  const cats = categoryMap(input.categories)
  const totals = computeTotals(input.transactions, cats)
  const subById = new Map(input.subcategories.map((s) => [s.id, s.name]))
  const accountById = new Map(input.accounts.map((a) => [a.id, a.name]))

  // --- Summary ------------------------------------------------------------
  const breakdown = sumByCategory(input.transactions, cats, OUTFLOW_KINDS)
  const summary: Row[] = [
    heading(`Dompet - ${input.periodLabel}`),
    [text('Generated'), text(formatDateLabel(new Date().toISOString().slice(0, 10)))],
    [],
    header(['Metric', 'Amount']),
    [text('Income'), money(totals.income)],
    [text('Bills'), money(totals.bills)],
    [text('Expenses'), money(totals.expense)],
    [text('Savings'), money(totals.savings)],
    [text('Investments'), money(totals.investment)],
    [text('Total outflow'), money(totals.outflow)],
    [{ value: 'Net balance', fontWeight: 'bold' }, { ...money(totals.net), fontWeight: 'bold' }],
    [text('Savings rate'), percent(totals.savingsRate)],
    [],
    heading('Outflow by category'),
    header(['Category', 'Amount', 'Share']),
    ...breakdown.map((slice) => [text(slice.name), money(slice.amount), percent(slice.share)]),
  ]

  // --- Transactions -------------------------------------------------------
  const transactions: Row[] = [
    header(['Date', 'Type', 'Category', 'Subcategory', 'Account', 'To account', 'Note', 'Amount']),
    ...[...input.transactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((tx) => {
        const cat = cats.get(tx.categoryId)
        return [
          text(tx.date),
          text(cat ? CATEGORY_KIND_LABELS[cat.kind] : tx.type),
          text(cat?.name ?? '(deleted)'),
          text(tx.subcategoryId ? (subById.get(tx.subcategoryId) ?? '') : ''),
          text(accountById.get(tx.accountId) ?? ''),
          text(tx.toAccountId ? (accountById.get(tx.toAccountId) ?? '') : ''),
          text(tx.note),
          money(tx.amount),
        ]
      }),
  ]

  // --- Budget -------------------------------------------------------------
  const rows = buildBudgetRows({
    categories: input.categories,
    budgets: input.budgets,
    txs: input.transactions,
    prevBudgets: input.prevBudgets,
    prevTxs: input.prevTransactions,
  })
  const budgetSummary = summarizeBudget(rows, totals.income)
  const budget: Row[] = [
    header(['Category', 'Budget', 'Rollover in', 'Available', 'Spent', 'Remaining', 'Used']),
    ...rows.map((row) => [
      text(row.name),
      money(row.budget),
      money(row.carryOver),
      money(row.effective),
      money(row.spent),
      money(row.remaining),
      percent(row.percent),
    ]),
    [],
    [{ value: 'Total', fontWeight: 'bold' }, money(budgetSummary.totalBudget), null, null, money(budgetSummary.totalSpent)],
    [text('Unallocated income'), money(budgetSummary.unallocated)],
  ]

  // --- Accounts -----------------------------------------------------------
  const balances = accountBalances(input.accounts, input.allTransactions)
  const usage = accountUsage(input.accounts, input.transactions)
  const usageById = new Map(usage.map((u) => [u.accountId, u]))
  const accounts: Row[] = [
    header(['Account', 'Type', 'Opening balance', 'In (period)', 'Out (period)', 'Transactions', 'Current balance']),
    ...input.accounts.map((account) => {
      const u = usageById.get(account.id)
      return [
        text(account.name),
        text(ACCOUNT_TYPE_LABELS[account.type]),
        money(account.initialBalance),
        money(u?.inflow ?? 0),
        money(u?.outflow ?? 0),
        { type: Number, value: u?.count ?? 0 },
        money(balances.get(account.id) ?? 0),
      ]
    }),
  ]

  return [
    {
      sheet: 'Summary',
      data: summary,
      columns: [{ width: 26 }, { width: 18 }, { width: 12 }],
    },
    {
      sheet: 'Transactions',
      data: transactions,
      columns: [
        { width: 12 }, { width: 12 }, { width: 16 }, { width: 18 },
        { width: 16 }, { width: 16 }, { width: 30 }, { width: 16 },
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: 'Budget',
      data: budget,
      columns: [
        { width: 20 }, { width: 15 }, { width: 14 }, { width: 15 },
        { width: 15 }, { width: 15 }, { width: 10 },
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: 'Accounts',
      data: accounts,
      columns: [
        { width: 20 }, { width: 20 }, { width: 17 }, { width: 15 },
        { width: 15 }, { width: 14 }, { width: 18 },
      ],
      stickyRowsCount: 1,
    },
  ]
}

export function workbookFilename(periodLabel: string): string {
  return `dompet-${periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`
}

/**
 * The writer is pulled in dynamically so its code only downloads when someone
 * actually exports -- it has no business in the initial bundle of a dashboard.
 */
export async function exportExcel(input: ExcelExportInput): Promise<string> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sheets = buildWorkbook(input)
  const blob = await writeXlsxFile(sheets as never, {
    fontFamily: 'Calibri',
    fontSize: 11,
  }).toBlob()

  const filename = workbookFilename(input.periodLabel)
  downloadBlob(blob, filename)
  return filename
}

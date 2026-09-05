/**
 * First-run data. Built-in categories cover ordinary Indonesian personal
 * finance; accounts are deliberately generic -- the user names their own banks
 * on the Accounts page rather than inheriting someone else's list.
 */
import { db, nowISO, uid } from './db'
import type { Account, Category, CategoryKind, Settings, Subcategory } from './schema'

interface SeedCategory {
  id: string
  name: string
  kind: CategoryKind
  color: string
  subs: string[]
}

/** Colors are assigned in fixed slot order, never cycled. */
export const BUILTIN_CATEGORIES: SeedCategory[] = [
  {
    id: 'cat-income',
    name: 'Income',
    kind: 'income',
    color: 's1',
    subs: ['Paycheck', 'Freelance', 'Bonus', 'Dividends', 'Other'],
  },
  {
    id: 'cat-bills',
    name: 'Bills',
    kind: 'bills',
    color: 's2',
    subs: ['Rent', 'Utilities', 'Insurance', 'Subscriptions', 'Phone & Internet', 'Other'],
  },
  {
    id: 'cat-expenses',
    name: 'Expenses',
    kind: 'expense',
    color: 's3',
    subs: [
      'Groceries',
      'Transportation',
      'Dining Out',
      'Shopping',
      'Self Care',
      'Health',
      'Entertainment',
      'Other',
    ],
  },
  {
    id: 'cat-savings',
    name: 'Savings',
    kind: 'savings',
    color: 's4',
    subs: ['Emergency Fund', 'Goal Savings', 'General Savings', 'Other'],
  },
  {
    id: 'cat-investments',
    name: 'Investments',
    kind: 'investment',
    color: 's5',
    subs: ['Mutual Funds', 'Stocks', 'Crypto', 'Gold', 'Other'],
  },
  {
    id: 'cat-transfer',
    name: 'Transfer',
    kind: 'transfer',
    color: 's6',
    subs: ['Account Transfer'],
  },
]

export const TRANSFER_CATEGORY_ID = 'cat-transfer'

const STARTER_ACCOUNTS: Array<Pick<Account, 'name' | 'type' | 'color'>> = [
  { name: 'Cash', type: 'spending', color: 's3' },
  { name: 'Bank', type: 'salary', color: 's1' },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  userName: '',
  theme: 'light',
  onboarded: false,
  tourDone: false,
}

function buildCategories(): { categories: Category[]; subcategories: Subcategory[] } {
  const categories: Category[] = []
  const subcategories: Subcategory[] = []
  const seededAt = nowISO()

  BUILTIN_CATEGORIES.forEach((seed, order) => {
    categories.push({
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      isBuiltIn: true,
      color: seed.color,
      order,
      updatedAt: seededAt,
    })
    seed.subs.forEach((name, subOrder) => {
      subcategories.push({
        id: `${seed.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        categoryId: seed.id,
        name,
        isBuiltIn: true,
        order: subOrder,
        updatedAt: seededAt,
      })
    })
  })

  return { categories, subcategories }
}

/**
 * Idempotent: safe to call on every boot. Categories are topped up
 * independently of accounts so a user who deletes every account does not get
 * duplicate categories back.
 */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction(
    'rw',
    [db.categories, db.subcategories, db.accounts, db.settings],
    async () => {
      if ((await db.categories.count()) === 0) {
        const { categories, subcategories } = buildCategories()
        await db.categories.bulkAdd(categories)
        await db.subcategories.bulkAdd(subcategories)
      }

      if ((await db.accounts.count()) === 0) {
        const createdAt = nowISO()
        await db.accounts.bulkAdd(
          STARTER_ACCOUNTS.map((a, order) => ({
            id: uid(),
            name: a.name,
            type: a.type,
            initialBalance: 0,
            color: a.color,
            archived: 0 as const,
            order,
            createdAt,
            updatedAt: createdAt,
          })),
        )
      }

      if (!(await db.settings.get('app'))) {
        await db.settings.add(DEFAULT_SETTINGS)
      }
    },
  )
}

/**
 * Validation for restored backups.
 *
 * Kept in its own module and imported dynamically by `restoreBackup`: Zod is
 * only needed on the rare occasion someone restores a file, so it has no place
 * in the bundle everyone downloads.
 */
import { z } from 'zod'

/**
 * Sync fields are optional here on purpose: backups written before syncing
 * existed have neither, and they must still restore. `restoreBackup` fills
 * them in rather than rejecting the file.
 */
const syncFields = {
  updatedAt: z.string().optional(),
  deletedAt: z.string().optional(),
}

const themeSchema = z.enum(['light', 'dark'])

const accountSchema = z.object({
  ...syncFields,
  id: z.string(),
  name: z.string(),
  type: z.enum(['salary', 'spending', 'savings', 'insurance_emoney', 'investment']),
  initialBalance: z.number(),
  color: z.string(),
  archived: z
    .union([z.literal(0), z.literal(1), z.boolean()])
    .transform((v) => (v ? 1 : 0) as 0 | 1),
  order: z.number(),
  createdAt: z.string(),
})

const categorySchema = z.object({
  ...syncFields,
  id: z.string(),
  name: z.string(),
  kind: z.enum(['income', 'bills', 'expense', 'savings', 'investment', 'transfer']),
  isBuiltIn: z.boolean(),
  color: z.string(),
  order: z.number(),
})

const subcategorySchema = z.object({
  ...syncFields,
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  isBuiltIn: z.boolean(),
  order: z.number(),
})

const transactionSchema = z.object({
  ...syncFields,
  id: z.string(),
  date: z.string(),
  month: z.string(),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number(),
  accountId: z.string(),
  toAccountId: z.string().optional(),
  categoryId: z.string(),
  subcategoryId: z.string().optional(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const budgetSchema = z.object({
  ...syncFields,
  id: z.string(),
  month: z.string(),
  categoryId: z.string(),
  amount: z.number(),
  rollover: z.boolean(),
})

const splitBillSchema = z.object({
  ...syncFields,
  id: z.string(),
  title: z.string(),
  date: z.string(),
  people: z.array(z.object({ id: z.string(), name: z.string() })),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      amount: z.number(),
      qty: z.number(),
      personIds: z.array(z.string()),
    }),
  ),
  taxPercent: z.number(),
  servicePercent: z.number(),
  discount: z.number(),
  payerId: z.string(),
  linkedTransactionId: z.string().optional(),
  createdAt: z.string(),
})

const settingsSchema = z.object({
  id: z.literal('app'),
  userName: z.string(),
  theme: themeSchema,
  onboarded: z.boolean(),
  tourDone: z.boolean(),
})

export const backupSchema = z.object({
  app: z.literal('dompet-digital'),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    accounts: z.array(accountSchema),
    categories: z.array(categorySchema),
    subcategories: z.array(subcategorySchema),
    transactions: z.array(transactionSchema),
    budgets: z.array(budgetSchema),
    splitBills: z.array(splitBillSchema),
    settings: z.array(settingsSchema),
  }),
})

export type BackupFile = z.infer<typeof backupSchema>

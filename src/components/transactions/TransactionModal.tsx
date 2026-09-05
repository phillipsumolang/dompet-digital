import { useMemo, useState } from 'react'
import { ArrowLeftRight, Minus, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Primitives'
import { AmountInput, Field, Input, SegmentedControl, Select, Textarea } from '../ui/Field'
import { useActiveAccounts, useCategories, useSubcategories } from '../../hooks/useData'
import { TRANSFER_CATEGORY_ID } from '../../db/seed'
import type { CategoryKind, Transaction, TransactionType } from '../../db/schema'
import { createTransaction, deleteTransaction, updateTransaction } from '../../db/mutations'
import { todayISO } from '../../lib/dates'
import { toast } from '../../store/toast'

/** Which category kinds a transaction of each type may use. */
const KINDS_FOR_TYPE: Record<TransactionType, CategoryKind[]> = {
  income: ['income'],
  expense: ['bills', 'expense', 'savings', 'investment'],
  transfer: ['transfer'],
}

/** Kinds where the money lands in another of your own accounts. */
const DESTINATION_KINDS: CategoryKind[] = ['savings', 'investment']

interface Draft {
  date: string
  type: TransactionType
  amount: number
  accountId: string
  toAccountId: string
  categoryId: string
  subcategoryId: string
  note: string
}

function draftFrom(tx: Transaction | null, defaultAccountId: string): Draft {
  if (tx) {
    return {
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? '',
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId ?? '',
      note: tx.note,
    }
  }
  return {
    date: todayISO(),
    type: 'expense',
    amount: 0,
    accountId: defaultAccountId,
    toAccountId: '',
    categoryId: '',
    subcategoryId: '',
    note: '',
  }
}

interface TransactionModalProps {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
  /** Pre-fills the date when adding from a month other than the current one. */
  defaultDate?: string
}

/**
 * The form is a separate, keyed component so opening the modal remounts it
 * with a fresh draft. Resetting state from an effect would work, but it costs
 * an extra render and gets the ordering subtly wrong when props change while
 * the modal is already open.
 */
export function TransactionModal(props: TransactionModalProps) {
  const key = props.open ? (props.editing?.id ?? `new:${props.defaultDate ?? ''}`) : 'closed'
  return <TransactionForm key={key} {...props} />
}

function TransactionForm({
  open,
  onClose,
  editing = null,
  defaultDate,
}: TransactionModalProps) {
  const accounts = useActiveAccounts()
  const categories = useCategories()
  const subcategories = useSubcategories()
  const [draft, setDraft] = useState<Draft>(() => {
    const initial = draftFrom(editing, '')
    if (!editing && defaultDate) initial.date = defaultDate
    return initial
  })

  // The account list arrives from a live query, so the first render can have
  // none; fall back to the first account rather than an empty selection.
  const accountId = draft.accountId || accounts[0]?.id || ''

  const allowedKinds = KINDS_FOR_TYPE[draft.type]
  const availableCategories = useMemo(
    () => categories.filter((c) => allowedKinds.includes(c.kind)),
    [categories, allowedKinds],
  )

  const selectedCategory = categories.find((c) => c.id === draft.categoryId)
  const availableSubcategories = useMemo(
    () =>
      subcategories
        .filter((s) => s.categoryId === draft.categoryId)
        .sort((a, b) => a.order - b.order),
    [subcategories, draft.categoryId],
  )

  const isTransfer = draft.type === 'transfer'
  const showDestination =
    isTransfer || (selectedCategory ? DESTINATION_KINDS.includes(selectedCategory.kind) : false)

  function changeType(type: TransactionType) {
    setDraft((d) => ({
      ...d,
      type,
      categoryId: type === 'transfer' ? TRANSFER_CATEGORY_ID : '',
      subcategoryId: '',
      toAccountId: type === 'income' ? '' : d.toAccountId,
    }))
  }

  function changeCategory(categoryId: string) {
    setDraft((d) => ({ ...d, categoryId, subcategoryId: '' }))
  }

  async function save() {
    if (draft.amount <= 0) {
      toast.error('Enter an amount greater than zero.')
      return
    }
    if (!accountId) {
      toast.error('Choose an account.')
      return
    }
    if (!draft.categoryId) {
      toast.error('Choose a category.')
      return
    }
    if (isTransfer && !draft.toAccountId) {
      toast.error('Choose where the money is going.')
      return
    }
    if (isTransfer && draft.toAccountId === accountId) {
      toast.error('A transfer needs two different accounts.')
      return
    }

    const payload = {
      date: draft.date,
      type: draft.type,
      amount: draft.amount,
      accountId,
      toAccountId: showDestination ? draft.toAccountId || undefined : undefined,
      categoryId: draft.categoryId,
      subcategoryId: draft.subcategoryId || undefined,
      note: draft.note,
    }

    if (editing) await updateTransaction(editing.id, payload)
    else await createTransaction(payload)

    onClose()
    toast.success(editing ? 'Transaction updated.' : 'Transaction added.')
  }

  async function remove() {
    if (!editing) return
    await deleteTransaction(editing.id)
    onClose()
    toast.success('Transaction deleted.')
  }

  const accountLabel = isTransfer ? 'From account' : draft.type === 'income' ? 'Into account' : 'Paid from'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'New transaction'}
      footer={
        <>
          {editing ? (
            <Button variant="danger" onClick={remove} className="mr-auto">
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-ink2">
          Add an account first -- a transaction has to come from somewhere.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <SegmentedControl
            value={draft.type}
            onChange={changeType}
            className="w-full [&>button]:flex-1"
            options={[
              {
                value: 'expense',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Minus size={13} /> Expense
                  </span>
                ),
              },
              {
                value: 'income',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Plus size={13} /> Income
                  </span>
                ),
              },
              {
                value: 'transfer',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowLeftRight size={13} /> Transfer
                  </span>
                ),
              },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount">
              {(id) => (
                <AmountInput
                  id={id}
                  autoFocus
                  value={draft.amount}
                  onValueChange={(amount) => setDraft({ ...draft, amount })}
                />
              )}
            </Field>

            <Field label="Date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              )}
            </Field>
          </div>

          {!isTransfer ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                {(id) => (
                  <Select
                    id={id}
                    value={draft.categoryId}
                    onChange={(e) => changeCategory(e.target.value)}
                  >
                    <option value="">Choose...</option>
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Subcategory" hint={draft.categoryId ? undefined : 'Pick a category first.'}>
                {(id) => (
                  <Select
                    id={id}
                    value={draft.subcategoryId}
                    disabled={availableSubcategories.length === 0}
                    onChange={(e) => setDraft({ ...draft, subcategoryId: e.target.value })}
                  >
                    <option value="">None</option>
                    {availableSubcategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={accountLabel}>
              {(id) => (
                <Select
                  id={id}
                  value={accountId}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {showDestination ? (
              <Field
                label="To account"
                hint={
                  isTransfer
                    ? undefined
                    : 'Optional. Set it so the receiving account balance grows.'
                }
              >
                {(id) => (
                  <Select
                    id={id}
                    value={draft.toAccountId}
                    onChange={(e) => setDraft({ ...draft, toAccountId: e.target.value })}
                  >
                    <option value="">{isTransfer ? 'Choose...' : 'Not tracked'}</option>
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            ) : null}
          </div>

          <Field label="Note">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={draft.note}
                placeholder="What was it for?"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            )}
          </Field>
        </div>
      )}
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import { Plus, Receipt, Save, Trash2, UserPlus, Wallet } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, IconButton } from '../components/ui/Primitives'
import { AmountInput, Field, Input, Select } from '../components/ui/Field'
import { StatTile } from '../components/ui/StatTile'
import { ConfirmDialog } from '../components/ui/Modal'
import { useActiveAccounts, useCategories, useSplitBills, useSubcategories } from '../hooks/useData'
import { computeSplit, itemTotal } from '../lib/split'
import { formatIDR, parseAmount } from '../lib/money'
import { formatDateLabel, todayISO } from '../lib/dates'
import { uid } from '../db/db'
import { createTransaction, deleteSplitBill, saveSplitBill } from '../db/mutations'
import type { SplitBill as SplitBillRecord, SplitItem, SplitPerson } from '../db/schema'
import { toast } from '../store/toast'
import { cn } from '../lib/cn'

interface Draft {
  id: string
  title: string
  date: string
  people: SplitPerson[]
  items: SplitItem[]
  taxPercent: number
  servicePercent: number
  discount: number
  payerId: string
}

function blankDraft(): Draft {
  const me: SplitPerson = { id: uid(), name: 'Me' }
  return {
    id: uid(),
    title: '',
    date: todayISO(),
    people: [me],
    items: [],
    taxPercent: 0,
    servicePercent: 0,
    discount: 0,
    payerId: me.id,
  }
}

export function SplitBill() {
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [newPerson, setNewPerson] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SplitBillRecord | null>(null)
  const saved = useSplitBills()
  const accounts = useActiveAccounts()
  const categories = useCategories()
  const subcategories = useSubcategories()

  const result = useMemo(() => computeSplit(draft), [draft])
  const payerShare = result.shares.find((s) => s.personId === draft.payerId)

  function patch(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }))
  }

  /**
   * Takes the value rather than reading state: a fast Enter can fire from a
   * render whose `newPerson` has not caught up yet, and the name is then lost.
   */
  function addPerson(value: string = newPerson) {
    const name = value.trim()
    if (!name) return
    setDraft((d) => ({ ...d, people: [...d.people, { id: uid(), name }] }))
    setNewPerson('')
  }

  function removePerson(id: string) {
    setDraft((d) => {
      const people = d.people.filter((p) => p.id !== id)
      return {
        ...d,
        people,
        // Drop the person from every item, and hand the payer role on if needed.
        items: d.items.map((item) => ({
          ...item,
          personIds: item.personIds.filter((pid) => pid !== id),
        })),
        payerId: d.payerId === id ? (people[0]?.id ?? '') : d.payerId,
      }
    })
  }

  function addItem() {
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: uid(), name: '', amount: 0, qty: 1, personIds: [] }],
    }))
  }

  function patchItem(id: string, next: Partial<SplitItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) => (item.id === id ? { ...item, ...next } : item)),
    }))
  }

  function toggleAssignment(itemId: string, personId: string) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              personIds: item.personIds.includes(personId)
                ? item.personIds.filter((id) => id !== personId)
                : [...item.personIds, personId],
            }
          : item,
      ),
    }))
  }

  async function save() {
    if (result.billTotal <= 0) {
      toast.error('Add at least one item before saving.')
      return
    }
    await saveSplitBill({
      ...draft,
      title: draft.title.trim() || 'Untitled bill',
    })
    toast.success('Bill saved.')
  }

  async function recordMyShare() {
    if (!payerShare || payerShare.total <= 0) {
      toast.error('Nothing is assigned to the payer yet.')
      return
    }
    const account = accounts[0]
    if (!account) {
      toast.error('Add an account first.')
      return
    }
    const category = categories.find((c) => c.kind === 'expense')
    if (!category) {
      toast.error('No expense category available.')
      return
    }
    const sub = subcategories.find(
      (s) => s.categoryId === category.id && s.name === 'Dining Out',
    )
    await createTransaction({
      date: draft.date,
      type: 'expense',
      amount: payerShare.total,
      accountId: account.id,
      categoryId: category.id,
      subcategoryId: sub?.id,
      note: draft.title.trim() || 'Split bill',
    })
    toast.success(`Recorded ${formatIDR(payerShare.total)} as an expense.`)
  }

  return (
    <>
      <PageHeader
        title="Split Bill"
        subtitle="Work out who owes what, down to the last rupiah"
        actions={
          <>
            <Button onClick={() => setDraft(blankDraft())}>New bill</Button>
            <Button variant="primary" onClick={save}>
              <Save size={16} />
              <span className="hidden sm:inline">Save bill</span>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What was it for?">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.title}
                    placeholder="Dinner at Sate Khas"
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Date">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title={`People (${draft.people.length})`} />
            <div className="flex flex-wrap items-center gap-2 px-4 py-4">
              {draft.people.map((person) => (
                <span
                  key={person.id}
                  className={cn(
                    'group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]',
                    person.id === draft.payerId
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-surface text-ink2',
                  )}
                >
                  {person.name}
                  {person.id === draft.payerId ? (
                    <span className="text-[10px] font-medium tracking-wide uppercase">paid</span>
                  ) : null}
                  {draft.people.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${person.name}`}
                      onClick={() => removePerson(person.id)}
                      className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-critical"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </span>
              ))}

              {/* A real form, so Enter submits the way the browser already
                  knows how to -- no key handling of our own to get wrong. */}
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  addPerson(new FormData(e.currentTarget).get('person')?.toString() ?? '')
                }}
              >
                <input
                  name="person"
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  placeholder="Add someone..."
                  aria-label="New person name"
                  className="h-8 w-32 rounded-lg border border-dashed border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-muted focus:border-brand"
                />
                <IconButton label="Add person" type="submit">
                  <UserPlus size={15} />
                </IconButton>
              </form>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={`Items (${draft.items.length})`}
              subtitle="Leave nobody selected and the item is shared by everyone"
              action={
                <Button size="sm" onClick={addItem}>
                  <Plus size={14} />
                  Add item
                </Button>
              }
            />

            {draft.items.length === 0 ? (
              <EmptyState
                icon={<Receipt size={26} />}
                title="No items yet"
                description="Add each line from the receipt, then tick who shared it."
                action={
                  <Button onClick={addItem}>
                    <Plus size={14} />
                    Add item
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {draft.items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[140px] flex-1">
                        <Input
                          aria-label="Item name"
                          value={item.name}
                          placeholder="Item"
                          onChange={(e) => patchItem(item.id, { name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="w-32">
                        <AmountInput
                          aria-label="Unit price"
                          value={item.amount}
                          onValueChange={(amount) => patchItem(item.id, { amount })}
                          className="h-9"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          aria-label="Quantity"
                          inputMode="numeric"
                          value={item.qty}
                          onChange={(e) =>
                            patchItem(item.id, { qty: Math.max(1, parseAmount(e.target.value)) })
                          }
                          className="tabular h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand"
                        />
                      </div>
                      <span className="tabular w-28 pb-2 text-right text-[13px] font-medium text-ink">
                        {formatIDR(itemTotal(item))}
                      </span>
                      <IconButton
                        label="Remove item"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            items: d.items.filter((i) => i.id !== item.id),
                          }))
                        }
                        className="mb-0.5"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {draft.people.map((person) => {
                        const on = item.personIds.includes(person.id)
                        return (
                          <button
                            key={person.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleAssignment(item.id, person.id)}
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-xs transition-colors',
                              on
                                ? 'border-brand bg-brand-soft text-brand'
                                : 'border-line text-muted hover:text-ink2',
                            )}
                          >
                            {person.name}
                          </button>
                        )
                      })}
                      {item.personIds.length === 0 ? (
                        <span className="py-0.5 text-xs text-muted">Shared by everyone</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Tax %">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    value={draft.taxPercent || ''}
                    placeholder="11"
                    onChange={(e) => patch({ taxPercent: Number(e.target.value) || 0 })}
                    className="tabular text-right"
                  />
                )}
              </Field>
              <Field label="Service %">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    value={draft.servicePercent || ''}
                    placeholder="5"
                    onChange={(e) => patch({ servicePercent: Number(e.target.value) || 0 })}
                    className="tabular text-right"
                  />
                )}
              </Field>
              <Field label="Discount">
                {(id) => (
                  <AmountInput
                    id={id}
                    value={draft.discount}
                    onValueChange={(discount) => patch({ discount })}
                  />
                )}
              </Field>
              <Field label="Paid by">
                {(id) => (
                  <Select
                    id={id}
                    value={draft.payerId}
                    onChange={(e) => patch({ payerId: e.target.value })}
                  >
                    {draft.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Bill total" value={formatIDR(result.billTotal)} />
            <StatTile
              label="Your share"
              value={formatIDR(payerShare?.total ?? 0)}
              tone="brand"
            />
          </div>

          <Card>
            <CardHeader
              title="Who owes what"
              subtitle="Tax, service and discount split in proportion to each share"
            />
            {result.shares.length === 0 || result.billTotal === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                Add items to see the split.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {result.shares.map((share) => (
                  <li key={share.personId} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                        {share.name}
                        {share.personId === draft.payerId ? <Badge tone="brand">Paid</Badge> : null}
                      </span>
                      <span className="tabular text-[13px] font-semibold text-ink">
                        {formatIDR(share.total)}
                      </span>
                    </div>
                    <p className="tabular mt-0.5 text-xs text-muted">
                      {formatIDR(share.subtotal)} items
                      {share.tax > 0 ? ` + ${formatIDR(share.tax)} tax` : ''}
                      {share.service > 0 ? ` + ${formatIDR(share.service)} service` : ''}
                      {share.discount > 0 ? ` − ${formatIDR(share.discount)} discount` : ''}
                    </p>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 bg-surface2/60 px-4 py-3">
                  <span className="text-[13px] font-semibold text-ink">Total</span>
                  <span className="tabular text-base font-semibold text-ink">
                    {formatIDR(result.billTotal)}
                  </span>
                </li>
              </ul>
            )}

            {payerShare && payerShare.total > 0 ? (
              <div className="border-t border-line px-4 py-3">
                <Button onClick={recordMyShare} className="w-full">
                  <Wallet size={15} />
                  Record {formatIDR(payerShare.total)} as an expense
                </Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Saved bills" />
            {saved.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                Nothing saved yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {saved.map((bill) => {
                  const total = computeSplit(bill).billTotal
                  return (
                    <li key={bill.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setDraft({ ...bill })}
                          className="block w-full truncate text-left text-[13px] font-medium text-ink hover:text-brand"
                        >
                          {bill.title}
                        </button>
                        <p className="text-xs text-muted">
                          {formatDateLabel(bill.date)} · {bill.people.length} people
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-[13px] text-ink2">
                        {formatIDR(total)}
                      </span>
                      <IconButton
                        label={`Delete ${bill.title}`}
                        onClick={() => setPendingDelete(bill)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.title ?? ''}?`}
        confirmLabel="Delete"
        message="The saved split is removed. Any expense you already recorded from it stays."
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteSplitBill(pendingDelete.id)
          setPendingDelete(null)
          toast.success('Bill deleted.')
        }}
      />
    </>
  )
}

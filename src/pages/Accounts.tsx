import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { Avatar, ColorPicker } from '../components/ui/ColorPicker'
import { Button, Card, EmptyState, IconButton } from '../components/ui/Primitives'
import { AmountInput, Field, Input, Select } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { useAccounts, useAllTransactions } from '../hooks/useData'
import { accountBalances, accountUsage } from '../lib/finance'
import { formatIDR } from '../lib/money'
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from '../db/schema'
import {
  createAccount,
  deleteAccount,
  InUseError,
  setAccountArchived,
  updateAccount,
} from '../db/mutations'
import { toast } from '../store/toast'
import { cn } from '../lib/cn'

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

interface Draft {
  id?: string
  name: string
  type: AccountType
  initialBalance: number
  color: string
}

const blank = (): Draft => ({ name: '', type: 'spending', initialBalance: 0, color: 's1' })

export function Accounts() {
  const accounts = useAccounts()
  const transactions = useAllTransactions()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)

  const balances = useMemo(
    () => accountBalances(accounts, transactions),
    [accounts, transactions],
  )
  const usage = useMemo(
    () => new Map(accountUsage(accounts, transactions).map((u) => [u.accountId, u])),
    [accounts, transactions],
  )

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const totalBalance = active.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)

  async function save() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      toast.error('Give the account a name.')
      return
    }
    const payload = {
      name,
      type: draft.type,
      initialBalance: draft.initialBalance,
      color: draft.color,
    }
    if (draft.id) await updateAccount(draft.id, payload)
    else await createAccount(payload)
    setDraft(null)
    toast.success(draft.id ? 'Account updated.' : `Added ${name}.`)
  }

  async function remove(account: Account) {
    try {
      await deleteAccount(account.id)
      toast.success(`Deleted ${account.name}.`)
    } catch (error) {
      toast.error(error instanceof InUseError ? error.message : 'Could not delete that account.')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Your banks, wallets and brokerages"
        actions={
          <Button variant="primary" onClick={() => setDraft(blank())}>
            <Plus size={16} />
            Add account
          </Button>
        }
      />

      {active.length > 0 ? (
        <Card className="mb-4 flex items-baseline justify-between px-4 py-3">
          <span className="text-[13px] text-muted">Total across {active.length} accounts</span>
          <span className={cn('text-lg font-semibold', totalBalance < 0 && 'text-critical')}>
            {formatIDR(totalBalance)}
          </span>
        </Card>
      ) : null}

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark size={28} />}
            title="No accounts yet"
            description="Add the places your money actually sits, so balances and transfers add up."
            action={
              <Button variant="primary" onClick={() => setDraft(blank())}>
                <Plus size={16} />
                Add account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...active, ...archived].map((account) => {
            const balance = balances.get(account.id) ?? 0
            const count = usage.get(account.id)?.count ?? 0
            return (
              <Card
                key={account.id}
                className={cn('p-4', account.archived && 'opacity-60')}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={account.name} color={account.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{account.name}</p>
                    <p className="text-xs text-muted">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                      {account.archived ? ' · Archived' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <IconButton
                      label={`Edit ${account.name}`}
                      onClick={() =>
                        setDraft({
                          id: account.id,
                          name: account.name,
                          type: account.type,
                          initialBalance: account.initialBalance,
                          color: account.color,
                        })
                      }
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label={account.archived ? `Restore ${account.name}` : `Archive ${account.name}`}
                      onClick={() => setAccountArchived(account.id, !account.archived)}
                    >
                      {account.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </IconButton>
                    <IconButton
                      label={`Delete ${account.name}`}
                      onClick={() => setPendingDelete(account)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] tracking-wide text-muted uppercase">Balance</p>
                    <p
                      className={cn(
                        'text-lg font-semibold',
                        balance < 0 ? 'text-critical' : 'text-ink',
                      )}
                    >
                      {formatIDR(balance)}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {count} transaction{count === 1 ? '' : 's'}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit account' : 'New account'}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              {draft?.id ? 'Save changes' : 'Add account'}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              {(id) => (
                <Input
                  id={id}
                  autoFocus
                  value={draft.name}
                  placeholder="BCA, Cash, Jenius..."
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              )}
            </Field>

            <Field label="Type" hint="Used to group accounts in reports.">
              {(id) => (
                <Select
                  id={id}
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as AccountType })}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Opening balance"
              hint="What is in this account before you start tracking."
            >
              {(id) => (
                <AmountInput
                  id={id}
                  value={draft.initialBalance}
                  onValueChange={(initialBalance) => setDraft({ ...draft, initialBalance })}
                />
              )}
            </Field>

            <Field label="Colour">
              {() => (
                <ColorPicker
                  value={draft.color}
                  onChange={(color) => setDraft({ ...draft, color })}
                />
              )}
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        confirmLabel="Delete"
        message="Accounts with transactions cannot be deleted -- archive them instead so your history stays intact."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </>
  )
}

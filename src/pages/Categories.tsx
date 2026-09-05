import { useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { ColorDot, ColorPicker } from '../components/ui/ColorPicker'
import { Badge, Button, Card, EmptyState, IconButton } from '../components/ui/Primitives'
import { Field, Input, Select } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { useCategories, useSubcategories } from '../hooks/useData'
import {
  CATEGORY_KIND_LABELS,
  type Category,
  type CategoryKind,
  type Subcategory,
} from '../db/schema'
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  InUseError,
  updateCategory,
  updateSubcategory,
} from '../db/mutations'
import { toast } from '../store/toast'
import { cn } from '../lib/cn'

/** Transfer is structural -- users never need to invent another one. */
const CREATABLE_KINDS: CategoryKind[] = ['income', 'bills', 'expense', 'savings', 'investment']

interface CategoryDraft {
  id?: string
  name: string
  kind: CategoryKind
  color: string
  isBuiltIn: boolean
}

export function Categories() {
  const categories = useCategories()
  const subcategories = useSubcategories()
  const [draft, setDraft] = useState<CategoryDraft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const subsByCategory = useMemo(() => {
    const map = new Map<string, Subcategory[]>()
    for (const sub of subcategories) {
      const list = map.get(sub.categoryId)
      if (list) list.push(sub)
      else map.set(sub.categoryId, [sub])
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [subcategories])

  const builtIn = categories.filter((c) => c.isBuiltIn)
  const custom = categories.filter((c) => !c.isBuiltIn)

  async function save() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      toast.error('Give the category a name.')
      return
    }
    if (draft.id) {
      await updateCategory(draft.id, { name, color: draft.color })
    } else {
      await createCategory({ name, kind: draft.kind, color: draft.color })
    }
    setDraft(null)
    toast.success(draft.id ? 'Category updated.' : `Added ${name}.`)
  }

  async function remove(category: Category) {
    try {
      await deleteCategory(category.id)
      toast.success(`Deleted ${category.name}.`)
    } catch (error) {
      toast.error(
        error instanceof InUseError ? error.message : 'Could not delete that category.',
      )
    } finally {
      setPendingDelete(null)
    }
  }

  function renderCategory(category: Category) {
    const subs = subsByCategory.get(category.id) ?? []
    const isOpen = !collapsed[category.id]

    return (
      <Card key={category.id} className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <ColorDot color={category.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{category.name}</p>
            <p className="text-xs text-muted">{CATEGORY_KIND_LABELS[category.kind]}</p>
          </div>
          {category.isBuiltIn ? <Badge>Built-in</Badge> : null}
          <div className="flex shrink-0 gap-0.5">
            <IconButton
              label={`Edit ${category.name}`}
              onClick={() =>
                setDraft({
                  id: category.id,
                  name: category.name,
                  kind: category.kind,
                  color: category.color,
                  isBuiltIn: category.isBuiltIn,
                })
              }
            >
              <Pencil size={14} />
            </IconButton>
            {!category.isBuiltIn ? (
              <IconButton
                label={`Delete ${category.name}`}
                onClick={() => setPendingDelete(category)}
              >
                <Trash2 size={14} />
              </IconButton>
            ) : null}
            <IconButton
              label={isOpen ? 'Hide subcategories' : 'Show subcategories'}
              onClick={() =>
                setCollapsed((c) => ({ ...c, [category.id]: !collapsed[category.id] }))
              }
            >
              <ChevronDown
                size={16}
                className={cn('transition-transform', !isOpen && '-rotate-90')}
              />
            </IconButton>
          </div>
        </div>

        {isOpen ? (
          <div className="border-t border-line bg-surface2/50 px-4 py-3">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
              Subcategories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {subs.map((sub) => (
                <SubcategoryChip key={sub.id} sub={sub} />
              ))}
              <AddSubcategory categoryId={category.id} />
            </div>
          </div>
        ) : null}
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="How your money is labelled"
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setDraft({ name: '', kind: 'expense', color: 's1', isBuiltIn: false })
            }
          >
            <Plus size={16} />
            Add category
          </Button>
        }
      />

      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
          Built-in categories
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">{builtIn.map(renderCategory)}</div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
          Custom categories
        </h2>
        {custom.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Tags size={26} />}
              title="No custom categories"
              description="The built-in set covers most spending. Add your own when you want to track something specific."
              action={
                <Button
                  onClick={() =>
                    setDraft({ name: '', kind: 'expense', color: 's1', isBuiltIn: false })
                  }
                >
                  <Plus size={16} />
                  Create custom category
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{custom.map(renderCategory)}</div>
        )}
      </section>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              {draft?.id ? 'Save changes' : 'Add category'}
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
                  placeholder="Pets, Travel, Side project..."
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="Kind"
              hint={
                draft.id
                  ? 'The kind is fixed once transactions may already use it.'
                  : 'Decides which totals it feeds: spending, savings or income.'
              }
            >
              {(id) => (
                <Select
                  id={id}
                  value={draft.kind}
                  disabled={Boolean(draft.id)}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as CategoryKind })}
                >
                  {CREATABLE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {CATEGORY_KIND_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Colour" hint="Used for this category everywhere in the charts.">
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
        message="Its subcategories and budgets go with it. Categories still used by transactions cannot be deleted."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </>
  )
}

function SubcategoryChip({ sub }: { sub: Subcategory }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sub.name)

  // Reads the live input value: a fast Enter can outrun the state update.
  async function commit(value: string = name) {
    const trimmed = value.trim()
    setEditing(false)
    if (!trimmed || trimmed === sub.name) {
      setName(sub.name)
      return
    }
    setName(trimmed)
    await updateSubcategory(sub.id, trimmed)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit(e.currentTarget.value)
          if (e.key === 'Escape') {
            setName(sub.name)
            setEditing(false)
          }
        }}
        className="h-7 w-32 rounded-md border border-brand bg-surface px-2 text-xs text-ink"
      />
    )
  }

  return (
    <span className="group inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface pr-1 pl-2 text-xs text-ink2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hover:text-ink"
        title={`Rename ${sub.name}`}
      >
        {sub.name}
      </button>
      <button
        type="button"
        aria-label={`Delete ${sub.name}`}
        title={`Delete ${sub.name}`}
        onClick={async () => {
          const detached = await deleteSubcategory(sub.id)
          toast.success(
            detached > 0
              ? `Removed ${sub.name}; ${detached} transaction${detached === 1 ? '' : 's'} kept in the parent category.`
              : `Removed ${sub.name}.`,
          )
        }}
        className="rounded p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-critical"
      >
        <X size={12} />
      </button>
    </span>
  )
}

function AddSubcategory({ categoryId }: { categoryId: string }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function commit(value: string = name) {
    const trimmed = value.trim()
    setAdding(false)
    setName('')
    if (trimmed) await createSubcategory(categoryId, trimmed)
  }

  if (adding) {
    return (
      <input
        autoFocus
        value={name}
        placeholder="Name..."
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit(e.currentTarget.value)
          if (e.key === 'Escape') {
            setName('')
            setAdding(false)
          }
        }}
        className="h-7 w-32 rounded-md border border-brand bg-surface px-2 text-xs text-ink"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line-strong px-2 text-xs text-muted hover:border-brand hover:text-brand"
    >
      <Plus size={12} />
      Add
    </button>
  )
}

import { useRef, useState } from 'react'
import { Database, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { exportBackup, RestoreError, restoreBackup } from '../../db/backup'
import { exportExcel } from '../../export/excel'
import {
  useAccounts,
  useAllTransactions,
  useCategories,
  useMonthBudgets,
  useMonthTransactions,
  usePrevMonthBudgets,
  usePrevMonthTransactions,
  useSubcategories,
} from '../../hooks/useData'
import { formatMonthLong } from '../../lib/dates'
import { useUI } from '../../store/ui'
import { toast } from '../../store/toast'
import { Button } from '../ui/Primitives'
import { ConfirmDialog } from '../ui/Modal'
import { cn } from '../../lib/cn'

/**
 * Backup, restore and export. With no server behind the app this menu is the
 * user's only route out of the browser, so it stays one click from every page.
 */
export function DataMenu() {
  const month = useUI((s) => s.month)
  const [open, setOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const accounts = useAccounts()
  const categories = useCategories()
  const subcategories = useSubcategories()
  const transactions = useMonthTransactions(month)
  const allTransactions = useAllTransactions()
  const budgets = useMonthBudgets(month)
  const prevBudgets = usePrevMonthBudgets(month)
  const prevTransactions = usePrevMonthTransactions(month)

  async function handleBackup() {
    setOpen(false)
    try {
      const name = await exportBackup()
      toast.success(`Saved ${name}. Keep it somewhere safe.`)
    } catch {
      toast.error('Could not create the backup file.')
    }
  }

  async function handleExcel() {
    setOpen(false)
    try {
      const name = await exportExcel({
        periodLabel: formatMonthLong(month),
        accounts,
        categories,
        subcategories,
        transactions,
        allTransactions,
        budgets,
        prevBudgets,
        prevTransactions,
      })
      toast.success(`Exported ${name}.`)
    } catch {
      toast.error('Could not build the spreadsheet.')
    }
  }

  async function handleRestore(file: File) {
    try {
      const counts = await restoreBackup(await file.text())
      toast.success(`Restored ${counts.transactions} transactions and ${counts.accounts} accounts.`)
    } catch (error) {
      toast.error(
        error instanceof RestoreError ? error.message : 'Could not read that backup file.',
      )
    } finally {
      setPendingFile(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink2 hover:bg-surface2 hover:text-ink'

  return (
    <>
      <div className="relative">
        <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <Database size={14} />
          <span className="hidden sm:inline">Data</span>
        </Button>

        {open ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className={cn('absolute right-0 z-20 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg')}>
              <button type="button" className={itemClass} onClick={handleBackup}>
                <Download size={15} />
                <span>
                  Back up to JSON
                  <span className="block text-[11px] text-muted">Everything, in one file</span>
                </span>
              </button>
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setOpen(false)
                  fileInput.current?.click()
                }}
              >
                <Upload size={15} />
                <span>
                  Restore from backup
                  <span className="block text-[11px] text-muted">Replaces current data</span>
                </span>
              </button>
              <div className="my-1 border-t border-line" />
              <button type="button" className={itemClass} onClick={handleExcel}>
                <FileSpreadsheet size={15} />
                <span>
                  Export Excel
                  <span className="block text-[11px] text-muted">{formatMonthLong(month)}</span>
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPendingFile(file)
        }}
      />

      <ConfirmDialog
        open={pendingFile !== null}
        title="Restore this backup?"
        confirmLabel="Replace my data"
        message={
          <>
            <p>
              Restoring <span className="font-medium text-ink">{pendingFile?.name}</span> deletes
              every account, transaction and budget currently in this browser and replaces them
              with the contents of the file.
            </p>
            <p className="mt-2 text-muted">This cannot be undone. Back up first if in doubt.</p>
          </>
        }
        onCancel={() => {
          setPendingFile(null)
          if (fileInput.current) fileInput.current.value = ''
        }}
        onConfirm={() => {
          if (pendingFile) void handleRestore(pendingFile)
        }}
      />
    </>
  )
}

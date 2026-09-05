import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './Primitives'

/**
 * Built on <dialog>, which brings the focus trap, the inert background and
 * Escape-to-close from the platform rather than from hand-rolled key handling.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Clicking the backdrop -- the dialog element itself -- dismisses.
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-0 text-ink',
        'shadow-xl backdrop:bg-black/45 open:flex open:flex-col',
        // Capped against the *small* viewport: a mobile browser's toolbar
        // sliding back in must never clip the footer buttons.
        'max-h-[calc(100svh-2rem)]',
        widths[size],
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-1">
          <X size={16} />
        </IconButton>
      </div>

      {/* Sized by its content, not by `flex-1`. A `flex: 1 1 0%` basis of zero
          leaves the dialog's fit-content height with nothing to measure in
          WebKit, which collapses the body to a single row. Default
          `flex: 0 1 auto` plus `min-h-0` grows to the content and shrinks into
          a scroll area only once the cap above bites. */}
      <div className="scrollbar-thin min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
        {children}
      </div>

      {footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  )
}

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-lg bg-critical px-3 text-sm font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-ink2">{message}</div>
    </Modal>
  )
}

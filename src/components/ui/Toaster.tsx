import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToasts } from '../../store/toast'
import { cn } from '../../lib/cn'

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle }
const TONES = {
  info: 'text-brand',
  success: 'text-good',
  error: 'text-critical',
}

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-lg"
          >
            <Icon size={16} className={cn('mt-0.5 shrink-0', TONES[t.tone])} />
            <p className="flex-1 text-[13px] text-ink">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-mr-1 shrink-0 rounded p-0.5 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

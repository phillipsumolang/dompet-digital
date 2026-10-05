import { AlertTriangle } from 'lucide-react'
import { useStorageStatus } from '../../store/storage'
import { cn } from '../../lib/cn'

/**
 * Not dismissible, on purpose. If the browser is refusing to store anything,
 * every screen behind this banner is lying -- balances look right, entries
 * appear to save, and none of it survives the tab closing.
 */
export function StorageBanner() {
  const status = useStorageStatus((s) => s.status)
  if (status.state === 'ok') return null

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 border-b px-4 py-2.5 text-[13px]',
        status.state === 'blocked'
          ? 'border-warning/40 bg-warning/10 text-ink'
          : 'border-critical/40 bg-critical/10 text-ink',
      )}
    >
      <AlertTriangle
        size={16}
        className={cn('mt-0.5 shrink-0', status.state === 'blocked' ? 'text-warning' : 'text-critical')}
      />
      <p className="leading-relaxed">
        <span className="font-medium">
          {status.state === 'blocked' ? 'Dompet cannot open your data. ' : 'Nothing is being saved. '}
        </span>
        {status.detail}
      </p>
    </div>
  )
}

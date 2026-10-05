import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Download, RotateCcw } from 'lucide-react'
import { exportBackup } from '../db/backup'
import { Button } from './ui/Primitives'
import { cn } from '../lib/cn'

interface Props {
  children: ReactNode
  /** 'app' replaces the whole page; 'page' keeps the navigation usable. */
  variant?: 'app' | 'page'
}

interface State {
  error: Error | null
}

/**
 * A crash here used to show a blank white page, and the obvious thing to try
 * when a site shows nothing is to clear its data -- which, for an app that
 * keeps everything in this browser, destroys the user's entire financial
 * history to fix a rendering bug.
 *
 * So this screen exists mainly to offer the backup. The data is almost
 * certainly intact: it is React that fell over, not IndexedDB.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dompet crashed while rendering:', error, info.componentStack)
  }

  retry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <CrashScreen
        error={error}
        variant={this.props.variant ?? 'page'}
        onRetry={this.retry}
      />
    )
  }
}

function CrashScreen({
  error,
  variant,
  onRetry,
}: {
  error: Error
  variant: 'app' | 'page'
  onRetry: () => void
}) {
  const [saved, setSaved] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  async function saveBackup() {
    try {
      setSaved(await exportBackup())
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center px-4',
        variant === 'app' ? 'min-h-dvh bg-bg' : 'py-16',
      )}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <AlertTriangle size={20} className="shrink-0 text-warning" />
          <h1 className="text-base font-semibold text-ink">Something broke on this screen</h1>
        </div>

        <p className="text-[13px] leading-relaxed text-ink2">
          Your data has not been touched — this is a bug in the page, not in your records.
          Save a copy before doing anything else, then try again.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={saveBackup}>
            <Download size={15} />
            Save a backup
          </Button>
          <Button onClick={onRetry}>
            <RotateCcw size={15} />
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>

        {saved ? (
          <p className="mt-3 text-xs text-good">Saved {saved}.</p>
        ) : saveFailed ? (
          <p className="mt-3 text-xs text-critical">
            The backup could not be written. Try Reload first, then back up from the Data menu.
          </p>
        ) : null}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Please do not clear this site's data to fix this. Everything Dompet knows lives in
          this browser, and clearing it cannot be undone.
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink2">
            Technical detail
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-surface2 p-2.5 text-[11px] text-ink2">
            {error.name}: {error.message}
          </pre>
        </details>
      </div>
    </div>
  )
}

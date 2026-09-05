import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover border-transparent',
  secondary: 'bg-surface text-ink border-line hover:bg-surface2',
  ghost: 'bg-transparent text-ink2 border-transparent hover:bg-surface2 hover:text-ink',
  danger: 'bg-transparent text-critical border-line hover:bg-critical hover:text-white',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-colors disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only controls still need an accessible name. */
  label: string
}

export function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent',
        'text-ink2 transition-colors hover:bg-surface2 hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-line bg-surface', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'brand'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface2 text-ink2 border-line',
    good: 'bg-transparent text-good border-good/40',
    warning: 'bg-transparent text-warning border-warning/50',
    critical: 'bg-transparent text-critical border-critical/40',
    brand: 'bg-brand-soft text-brand border-transparent',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A meter, not a chart: one value against a known maximum. The unfilled track
 * is a light step of the fill's own hue so the state reads across the whole
 * bar, and the colour never travels alone -- callers put the number beside it.
 */
export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  /** 0-100; anything above is clamped but still reads as over. */
  value: number
  tone?: 'brand' | 'good' | 'warning' | 'critical'
  className?: string
}) {
  const fills: Record<string, string> = {
    brand: 'var(--app-brand)',
    good: 'var(--app-good)',
    warning: 'var(--app-warning)',
    critical: 'var(--app-critical)',
  }
  const fill = fills[tone]
  const width = Math.min(100, Math.max(0, value))

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full', className)}
      style={{ backgroundColor: `color-mix(in oklab, ${fill} 16%, var(--app-surface))` }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${width}%`, backgroundColor: fill }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-1 text-muted">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand',
        className,
      )}
    />
  )
}

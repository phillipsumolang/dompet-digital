import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatNumber, parseAmount } from '../../lib/money'

const CONTROL =
  'w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-muted transition-colors focus:border-brand disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string
  hint?: string
  error?: string
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-ink2">
          {label}
        </label>
      ) : null}
      {children(id)}
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'h-10', className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'h-10 appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'py-2', className)} {...props} />
}

/**
 * Money input. The value handed up is always a plain integer of Rupiah; the
 * grouped display exists only so a seven-digit number stays readable while
 * typing.
 */
export function AmountInput({
  value,
  onValueChange,
  id,
  className,
  ...props
}: {
  value: number
  onValueChange: (value: number) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
        Rp
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className={cn(CONTROL, 'tabular h-10 pl-9 text-right', className)}
        value={value === 0 ? '' : formatNumber(value)}
        placeholder="0"
        onChange={(e) => onValueChange(parseAmount(e.target.value))}
        {...props}
      />
    </div>
  )
}

/** Segmented control -- a small, always-visible set of exclusive options. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface2 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink2',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        checked ? 'border-transparent bg-brand' : 'border-line bg-surface2',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-[left] shadow-sm',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

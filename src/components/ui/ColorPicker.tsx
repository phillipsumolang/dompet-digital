import { Check } from 'lucide-react'
import { SERIES_SLOTS, seriesColor } from '../../lib/palette'
import { useTheme } from '../../store/ui'
import { cn } from '../../lib/cn'

/**
 * Colours are chosen from the validated slot set rather than a free picker:
 * an arbitrary hex would break the contrast and colour-blind separation the
 * charts depend on.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (slot: string) => void
}) {
  const theme = useTheme()
  return (
    <div className="flex flex-wrap gap-1.5">
      {SERIES_SLOTS.map((slot) => {
        const hex = seriesColor(slot, theme)
        const active = slot === value
        return (
          <button
            key={slot}
            type="button"
            aria-label={`Colour ${slot.slice(1)}`}
            aria-pressed={active}
            onClick={() => onChange(slot)}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-lg transition-transform',
              active ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-105',
            )}
            style={{ backgroundColor: hex }}
          >
            {active ? <Check size={14} className="text-white drop-shadow" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Small filled dot tying a row to its colour in the charts. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  const theme = useTheme()
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: seriesColor(color, theme) }}
    />
  )
}

/** Rounded square with the entity's initial -- used for accounts. */
export function Avatar({ name, color }: { name: string; color: string }) {
  const theme = useTheme()
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white"
      style={{ backgroundColor: seriesColor(color, theme) }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

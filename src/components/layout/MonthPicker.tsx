import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useUI } from '../../store/ui'
import { currentMonthKey, formatMonthLabel, monthsOfYear, yearOf } from '../../lib/dates'
import { IconButton } from '../ui/Primitives'
import { cn } from '../../lib/cn'
import { useState } from 'react'

/** Scopes every page to one month. Shared state, so it survives navigation. */
export function MonthPicker() {
  const { month, shiftMonth, setMonth, resetMonth } = useUI()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => yearOf(month))
  const isCurrent = month === currentMonthKey()

  return (
    <div className="relative flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      <IconButton label="Previous month" onClick={() => shiftMonth(-1)}>
        <ChevronLeft size={16} />
      </IconButton>

      <button
        type="button"
        onClick={() => {
          setYear(yearOf(month))
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        className="min-w-[92px] rounded-md px-2 py-1 text-[13px] font-semibold text-ink hover:bg-surface2"
      >
        {formatMonthLabel(month)}
      </button>

      <IconButton label="Next month" onClick={() => shiftMonth(1)}>
        <ChevronRight size={16} />
      </IconButton>

      {!isCurrent ? (
        <IconButton label="Back to this month" onClick={resetMonth}>
          <RotateCcw size={14} />
        </IconButton>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close month picker"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <IconButton label="Previous year" onClick={() => setYear((y) => y - 1)}>
                <ChevronLeft size={16} />
              </IconButton>
              <span className="text-sm font-semibold">{year}</span>
              <IconButton label="Next year" onClick={() => setYear((y) => y + 1)}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {monthsOfYear(year).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMonth(key)
                    setOpen(false)
                  }}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    key === month
                      ? 'bg-brand text-brand-ink'
                      : 'text-ink2 hover:bg-surface2',
                    key === currentMonthKey() && key !== month
                      ? 'ring-1 ring-brand/40 ring-inset'
                      : '',
                  )}
                >
                  {formatMonthLabel(key).slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

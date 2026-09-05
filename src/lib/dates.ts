/**
 * Month keys are the app's primary time axis: 'YYYY-MM' strings that sort
 * lexicographically, index cleanly in IndexedDB, and never carry a timezone.
 */
import { addMonths, format, parse } from 'date-fns'

export type MonthKey = string

export function toMonthKey(value: Date | string): MonthKey {
  if (typeof value === 'string') return value.slice(0, 7)
  return format(value, 'yyyy-MM')
}

export function monthKeyToDate(key: MonthKey): Date {
  return parse(`${key}-01`, 'yyyy-MM-dd', new Date())
}

export function currentMonthKey(): MonthKey {
  return format(new Date(), 'yyyy-MM')
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function addMonthsKey(key: MonthKey, delta: number): MonthKey {
  return toMonthKey(addMonths(monthKeyToDate(key), delta))
}

export function prevMonthKey(key: MonthKey): MonthKey {
  return addMonthsKey(key, -1)
}

/** "Sep 2026" */
export function formatMonthLabel(key: MonthKey): string {
  return format(monthKeyToDate(key), 'MMM yyyy')
}

/** "September 2026" */
export function formatMonthLong(key: MonthKey): string {
  return format(monthKeyToDate(key), 'MMMM yyyy')
}

/** "Sep" -- for chart axes. */
export function formatMonthShort(key: MonthKey): string {
  return format(monthKeyToDate(key), 'MMM')
}

export function yearOf(key: MonthKey): number {
  return Number(key.slice(0, 4))
}

/** The twelve month keys of a year, in order. */
export function monthsOfYear(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

/** "Wed, 3 Sep 2026" */
export function formatDateLabel(iso: string): string {
  return format(parse(iso, 'yyyy-MM-dd', new Date()), 'EEE, d MMM yyyy')
}

/** "3 Sep" -- compact form for dense lists. */
export function formatDateShort(iso: string): string {
  return format(parse(iso, 'yyyy-MM-dd', new Date()), 'd MMM')
}

/** Inclusive ISO date range covering a whole month. */
export function monthRange(key: MonthKey): { from: string; to: string } {
  const start = monthKeyToDate(key)
  const end = addMonths(start, 1)
  return {
    from: format(start, 'yyyy-MM-dd'),
    to: format(addMonths(end, 0), 'yyyy-MM-dd'),
  }
}

/**
 * The date a new transaction should default to while a given month is in view:
 * today when that is the current month, otherwise the first of the month being
 * looked at -- so adding to a past month does not silently land in this one.
 */
export function defaultDateFor(key: MonthKey): string {
  const today = todayISO()
  return toMonthKey(today) === key ? today : `${key}-01`
}

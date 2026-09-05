import { describe, expect, it } from 'vitest'
import {
  addMonthsKey,
  formatMonthLabel,
  formatMonthLong,
  monthsOfYear,
  prevMonthKey,
  toMonthKey,
  yearOf,
} from './dates'

describe('month keys', () => {
  it('derives a month key from an ISO date without shifting timezone', () => {
    expect(toMonthKey('2026-01-01')).toBe('2026-01')
    expect(toMonthKey('2026-12-31')).toBe('2026-12')
  })

  it('crosses year boundaries in both directions', () => {
    expect(addMonthsKey('2026-12', 1)).toBe('2027-01')
    expect(prevMonthKey('2026-01')).toBe('2025-12')
    expect(addMonthsKey('2026-03', -5)).toBe('2025-10')
  })

  it('sorts lexicographically in chronological order', () => {
    const keys = ['2026-10', '2026-02', '2025-12']
    expect([...keys].sort()).toEqual(['2025-12', '2026-02', '2026-10'])
  })

  it('lists a padded, ordered year', () => {
    const months = monthsOfYear(2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01')
    expect(months[11]).toBe('2026-12')
  })

  it('labels months for headers and axes', () => {
    expect(formatMonthLabel('2026-09')).toBe('Sep 2026')
    expect(formatMonthLong('2026-09')).toBe('September 2026')
    expect(yearOf('2026-09')).toBe(2026)
  })
})

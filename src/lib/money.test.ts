import { describe, expect, it } from 'vitest'
import { apportion, formatCompactIDR, formatIDR, parseAmount, percentOf } from './money'

describe('formatIDR', () => {
  it('groups thousands the Indonesian way', () => {
    expect(formatIDR(0)).toBe('Rp 0')
    expect(formatIDR(1234567)).toBe('Rp 1.234.567')
  })

  it('keeps the sign outside the currency symbol', () => {
    expect(formatIDR(-2500)).toBe('-Rp 2.500')
  })
})

describe('parseAmount', () => {
  it('round-trips a formatted value back to the same integer', () => {
    for (const n of [0, 7, 1000, 1234567, 999999999]) {
      expect(parseAmount(formatIDR(n))).toBe(n)
    }
  })

  it('ignores anything that is not a digit', () => {
    expect(parseAmount('Rp 1.500,00')).toBe(150000)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('formatCompactIDR', () => {
  it('steps through K / M / B', () => {
    expect(formatCompactIDR(750)).toBe('Rp 750')
    expect(formatCompactIDR(45_000)).toBe('Rp 45K')
    expect(formatCompactIDR(1_500_000)).toBe('Rp 1,5M')
    expect(formatCompactIDR(2_000_000_000)).toBe('Rp 2B')
  })
})

describe('percentOf', () => {
  it('returns 0 rather than NaN when the whole is zero', () => {
    expect(percentOf(500, 0)).toBe(0)
  })
})

describe('apportion', () => {
  it('always sums to exactly the total', () => {
    const cases: Array<[number, number[]]> = [
      [100, [1, 1, 1]],
      [10_000, [3, 3, 3, 1]],
      [1, [1, 1]],
      [7, [5, 5, 5, 5, 5, 5, 5]],
      [999_983, [17, 41, 3, 89, 2]],
    ]
    for (const [total, weights] of cases) {
      const parts = apportion(total, weights)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(parts.every(Number.isInteger)).toBe(true)
    }
  })

  it('gives the whole amount to the fallback when every weight is zero', () => {
    expect(apportion(500, [0, 0, 0], 1)).toEqual([0, 500, 0])
  })

  it('hands leftover rupiah to the largest remainders first', () => {
    // 100 split three ways is 33.33 each; the extra rupiah goes to one person.
    const parts = apportion(100, [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100)
    expect(parts.sort((a, b) => b - a)).toEqual([34, 33, 33])
  })

  it('handles an empty set', () => {
    expect(apportion(100, [])).toEqual([])
  })
})

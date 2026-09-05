import { describe, expect, it } from 'vitest'
import type { SplitItem, SplitPerson } from '../db/schema'
import { computeSplit, type SplitInput } from './split'

const people: SplitPerson[] = [
  { id: 'p1', name: 'Me' },
  { id: 'p2', name: 'Andi' },
  { id: 'p3', name: 'Budi' },
]

function item(part: Partial<SplitItem> & Pick<SplitItem, 'id' | 'amount'>): SplitItem {
  return { name: part.name ?? part.id, qty: 1, personIds: [], ...part }
}

function bill(over: Partial<SplitInput> = {}): SplitInput {
  return {
    people,
    items: [],
    taxPercent: 0,
    servicePercent: 0,
    discount: 0,
    payerId: 'p1',
    ...over,
  }
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

describe('computeSplit', () => {
  it('splits an unassigned item across everyone', () => {
    const result = computeSplit(bill({ items: [item({ id: 'i1', amount: 90_000 })] }))
    expect(result.shares.map((s) => s.total)).toEqual([30_000, 30_000, 30_000])
  })

  it('charges an assigned item only to the people who shared it', () => {
    const result = computeSplit(
      bill({ items: [item({ id: 'i1', amount: 50_000, personIds: ['p2', 'p3'] })] }),
    )
    expect(result.shares.map((s) => s.total)).toEqual([0, 25_000, 25_000])
  })

  it('multiplies by quantity', () => {
    const result = computeSplit(
      bill({ items: [item({ id: 'i1', amount: 15_000, qty: 4, personIds: ['p2'] })] }),
    )
    expect(result.itemsTotal).toBe(60_000)
    expect(result.shares[1].total).toBe(60_000)
  })

  it('spreads tax and service in proportion to what each person ate', () => {
    const result = computeSplit(
      bill({
        items: [
          item({ id: 'i1', amount: 100_000, personIds: ['p2'] }),
          item({ id: 'i2', amount: 300_000, personIds: ['p3'] }),
        ],
        taxPercent: 10,
        servicePercent: 5,
      }),
    )
    expect(result.tax).toBe(40_000)
    expect(result.service).toBe(20_000)
    expect(result.shares[1]).toMatchObject({ subtotal: 100_000, tax: 10_000, service: 5_000 })
    expect(result.shares[2]).toMatchObject({ subtotal: 300_000, tax: 30_000, service: 15_000 })
  })

  it('never loses or invents a rupiah, however awkward the numbers', () => {
    const cases: SplitInput[] = [
      bill({ items: [item({ id: 'a', amount: 100_000 })], taxPercent: 11, servicePercent: 7 }),
      bill({ items: [item({ id: 'a', amount: 33_333 })], taxPercent: 10 }),
      bill({
        items: [item({ id: 'a', amount: 1 })],
        taxPercent: 11,
        servicePercent: 5.5,
      }),
      bill({
        items: [
          item({ id: 'a', amount: 77_777, personIds: ['p1', 'p2'] }),
          item({ id: 'b', amount: 12_345, qty: 3 }),
          item({ id: 'c', amount: 999, personIds: ['p3'] }),
        ],
        taxPercent: 11,
        servicePercent: 7.5,
        discount: 13_579,
      }),
      bill({ items: [item({ id: 'a', amount: 999_999 })], taxPercent: 11, discount: 1 }),
    ]

    for (const input of cases) {
      const result = computeSplit(input)
      expect(sum(result.shares.map((s) => s.total))).toBe(result.billTotal)
      expect(sum(result.shares.map((s) => s.subtotal))).toBe(result.itemsTotal)
      expect(sum(result.shares.map((s) => s.tax))).toBe(result.tax)
      expect(sum(result.shares.map((s) => s.service))).toBe(result.service)
      expect(sum(result.shares.map((s) => s.discount))).toBe(result.discount)
      expect(result.shares.every((s) => Number.isInteger(s.total))).toBe(true)
    }
  })

  it('clamps a discount larger than the bill so the total never goes negative', () => {
    const result = computeSplit(
      bill({ items: [item({ id: 'a', amount: 50_000 })], discount: 999_999 }),
    )
    expect(result.discount).toBe(50_000)
    expect(result.billTotal).toBe(0)
    expect(sum(result.shares.map((s) => s.total))).toBe(0)
  })

  it('puts the whole bill on the payer when no item has an owner and there are no items', () => {
    const result = computeSplit(bill({ items: [], taxPercent: 10 }))
    expect(result.billTotal).toBe(0)
    expect(result.shares.every((s) => s.total === 0)).toBe(true)
  })

  it('returns no shares when nobody is on the bill', () => {
    const result = computeSplit(bill({ people: [], items: [item({ id: 'a', amount: 10_000 })] }))
    expect(result.shares).toEqual([])
    expect(result.billTotal).toBe(10_000)
  })

  it('ignores assignments to people who were removed from the bill', () => {
    const result = computeSplit(
      bill({ items: [item({ id: 'a', amount: 60_000, personIds: ['ghost'] })] }),
    )
    // Falls back to "everyone" rather than dropping the money.
    expect(sum(result.shares.map((s) => s.total))).toBe(60_000)
  })
})

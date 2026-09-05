/**
 * Bill splitting.
 *
 * The one property that must hold: the parts always sum to exactly the bill
 * total, in whole Rupiah, with no cent lost or invented. Each component
 * (subtotal, tax, service, discount) is apportioned independently by the
 * largest-remainder method, so each sums exactly and therefore so does the
 * total. Any final rounding Rupiah lands on the payer.
 */
import type { SplitBill, SplitItem, SplitPerson } from '../db/schema'
import { apportion } from './money'

export interface SplitShare {
  personId: string
  name: string
  subtotal: number
  tax: number
  service: number
  discount: number
  total: number
}

export interface SplitResult {
  itemsTotal: number
  tax: number
  service: number
  /** Clamped so a bill can never go negative. */
  discount: number
  billTotal: number
  shares: SplitShare[]
}

export type SplitInput = Pick<
  SplitBill,
  'people' | 'items' | 'taxPercent' | 'servicePercent' | 'discount' | 'payerId'
>

export function itemTotal(item: SplitItem): number {
  return Math.round(item.amount * Math.max(0, item.qty))
}

/** An item with nobody assigned is shared by everyone. */
function participants(item: SplitItem, people: SplitPerson[]): string[] {
  const assigned = item.personIds.filter((id) => people.some((p) => p.id === id))
  return assigned.length > 0 ? assigned : people.map((p) => p.id)
}

export function computeSplit(bill: SplitInput): SplitResult {
  const { people, items, taxPercent, servicePercent, payerId } = bill

  const itemsTotal = items.reduce((a, item) => a + itemTotal(item), 0)
  const tax = Math.round((itemsTotal * taxPercent) / 100)
  const service = Math.round((itemsTotal * servicePercent) / 100)
  const discount = Math.max(0, Math.min(bill.discount, itemsTotal + tax + service))
  const billTotal = itemsTotal + tax + service - discount

  if (people.length === 0) {
    return { itemsTotal, tax, service, discount, billTotal, shares: [] }
  }

  // Raw weights sum to itemsTotal exactly (as reals), so every apportioned
  // component is distributed in proportion to what each person actually ate.
  const index = new Map(people.map((p, i) => [p.id, i]))
  const weights = new Array<number>(people.length).fill(0)
  for (const item of items) {
    const sharers = participants(item, people)
    if (sharers.length === 0) continue
    const each = itemTotal(item) / sharers.length
    for (const id of sharers) {
      const i = index.get(id)
      if (i !== undefined) weights[i] += each
    }
  }

  const payerIndex = index.get(payerId) ?? 0
  const subtotals = apportion(itemsTotal, weights, payerIndex)
  const taxes = apportion(tax, weights, payerIndex)
  const services = apportion(service, weights, payerIndex)
  const discounts = apportion(discount, weights, payerIndex)

  const shares = people.map((person, i) => ({
    personId: person.id,
    name: person.name,
    subtotal: subtotals[i],
    tax: taxes[i],
    service: services[i],
    discount: discounts[i],
    total: subtotals[i] + taxes[i] + services[i] - discounts[i],
  }))

  return { itemsTotal, tax, service, discount, billTotal, shares }
}

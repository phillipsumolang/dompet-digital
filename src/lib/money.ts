/**
 * Money helpers. Values are integers of whole Rupiah everywhere in the app;
 * these functions are the only place a number turns into something readable.
 */

const GROUPED = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** 1234567 -> "1.234.567" */
export function formatNumber(value: number): string {
  return GROUPED.format(Math.round(value))
}

/** 1234567 -> "Rp 1.234.567"; negatives render as "-Rp 1.234.567". */
export function formatIDR(value: number): string {
  const n = Math.round(value)
  return n < 0 ? `-Rp ${GROUPED.format(-n)}` : `Rp ${GROUPED.format(n)}`
}

/** Axis- and tile-friendly short form: "Rp 1,2M", "Rp 450rb". */
export function formatCompactIDR(value: number): string {
  const n = Math.round(value)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${sign}Rp ${trim(abs / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${sign}Rp ${trim(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}Rp ${trim(abs / 1_000)}K`
  return `${sign}Rp ${abs}`
}

function trim(n: number): string {
  // One decimal, but never a trailing ".0" -- "1,5M" reads better than "1,5M" vs "2,0M".
  const s = n < 10 ? n.toFixed(1) : Math.round(n).toString()
  return s.replace(/\.0$/, '').replace('.', ',')
}

/** Read a user-typed amount ("Rp 1.234.567", "1234567") as an integer. */
export function parseAmount(input: string): number {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

/** Re-render a raw input string as grouped digits for a controlled input. */
export function formatAmountInput(input: string): string {
  const n = parseAmount(input)
  return n === 0 && !/\d/.test(input) ? '' : formatNumber(n)
}

/** Share of `whole` taken by `part`, as 0-100. Guards divide-by-zero. */
export function percentOf(part: number, whole: number): number {
  if (!whole) return 0
  return (part / whole) * 100
}

/** "62%" -- percentages are display-only, so rounding here is safe. */
export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

/**
 * Split `total` across `weights` so the parts are whole Rupiah and sum to
 * exactly `total` (largest-remainder method). Any leftover after the fair
 * pass goes to `fallbackIndex`, which is also who gets everything when all
 * weights are zero.
 */
export function apportion(total: number, weights: number[], fallbackIndex = 0): number[] {
  const n = weights.length
  if (n === 0) return []

  const target = Math.round(total)
  const sum = weights.reduce((a, b) => a + b, 0)

  if (sum <= 0) {
    const out = new Array<number>(n).fill(0)
    out[clamp(fallbackIndex, n)] = target
    return out
  }

  const exact = weights.map((w) => (w / sum) * target)
  const out = exact.map((v) => Math.floor(v))
  let remainder = target - out.reduce((a, b) => a + b, 0)

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)

  let k = 0
  while (remainder > 0 && k < order.length) {
    out[order[k].i] += 1
    remainder -= 1
    k += 1
  }
  // Negative totals (or float edge cases) can overshoot; claw back the same way.
  k = 0
  while (remainder < 0 && k < order.length) {
    out[order[order.length - 1 - k].i] -= 1
    remainder += 1
    k += 1
  }
  if (remainder !== 0) out[clamp(fallbackIndex, n)] += remainder

  return out
}

function clamp(i: number, n: number): number {
  return Math.min(Math.max(i, 0), n - 1)
}

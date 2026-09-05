/**
 * Chart + category colors.
 *
 * These are the validated reference categorical slots. Both modes are selected
 * (the dark column is the same eight hues re-stepped for the dark surface, not
 * an automatic flip), and both pass the lightness, chroma, CVD-separation and
 * normal-vision gates on the adjacent pairlist.
 *
 * Light mode leaves aqua, yellow and magenta below 3:1 against the surface, so
 * the relief rule applies: any chart using them ships visible direct labels or
 * a legend carrying the value. Never color alone.
 *
 * Entities store a *slot token* ('s1'..'s8'), never a hex, so the same category
 * gets its correct step in each mode. Colour follows the entity, never its rank.
 */
import type { ThemeMode } from '../db/schema'

export type SeriesSlot = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8'

export const SERIES_SLOTS: SeriesSlot[] = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']

const LIGHT: Record<SeriesSlot, string> = {
  s1: '#2a78d6', // blue
  s2: '#eb6834', // orange
  s3: '#1baf7a', // aqua
  s4: '#eda100', // yellow
  s5: '#e87ba4', // magenta
  s6: '#008300', // green
  s7: '#4a3aa7', // violet
  s8: '#e34948', // red
}

const DARK: Record<SeriesSlot, string> = {
  s1: '#3987e5',
  s2: '#d95926',
  s3: '#199e70',
  s4: '#c98500',
  s5: '#d55181',
  s6: '#008300',
  s7: '#9085e9',
  s8: '#e66767',
}

/** Status colors are reserved -- never reused as a series hue. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

export type StatusRole = keyof typeof STATUS

/** Chart surfaces the palette was validated against. */
export const SURFACE = { light: '#fcfcfb', dark: '#1a1a19' } as const

function isSlot(token: string): token is SeriesSlot {
  return (SERIES_SLOTS as string[]).includes(token)
}

/** Resolve a stored color token (or a raw hex fallback) for the active mode. */
export function seriesColor(token: string, mode: ThemeMode): string {
  if (isSlot(token)) return mode === 'dark' ? DARK[token] : LIGHT[token]
  return token
}

/** Next slot in fixed order -- used when creating a custom category. */
export function nextSlot(used: string[]): SeriesSlot {
  const free = SERIES_SLOTS.find((s) => !used.includes(s))
  return free ?? SERIES_SLOTS[used.length % SERIES_SLOTS.length]
}

/**
 * Charts cap at seven identities plus "Other" -- an eighth-and-beyond series is
 * never a generated hue.
 */
export const MAX_SERIES = 7
export const OTHER_SLOT: SeriesSlot = 's8'

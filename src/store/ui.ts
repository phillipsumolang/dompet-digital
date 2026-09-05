/**
 * Shared UI state. Domain data lives in Dexie and is read through live
 * queries -- only the two things every page needs in common are kept here.
 */
import { create } from 'zustand'
import type { ThemeMode } from '../db/schema'
import { addMonthsKey, currentMonthKey } from '../lib/dates'

const THEME_KEY = 'dompet-theme'

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* private mode: the class still applies for this session */
  }
}

interface UIState {
  theme: ThemeMode
  /** The month every page is scoped to. Not persisted: reopening the app in a
   *  new month should land on that month, not the last one you looked at. */
  month: string
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
  setMonth: (month: string) => void
  shiftMonth: (delta: number) => void
  resetMonth: () => void
}

export const useUI = create<UIState>((set, get) => ({
  theme: readStoredTheme(),
  month: currentMonthKey(),
  setTheme: (mode) => {
    applyTheme(mode)
    set({ theme: mode })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setMonth: (month) => set({ month }),
  shiftMonth: (delta) => set({ month: addMonthsKey(get().month, delta) }),
  resetMonth: () => set({ month: currentMonthKey() }),
}))

/** Keep the DOM in step with whatever the store restored on boot. */
applyTheme(useUI.getState().theme)

export const useTheme = () => useUI((s) => s.theme)
export const useMonth = () => useUI((s) => s.month)

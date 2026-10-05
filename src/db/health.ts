/**
 * Is the browser actually willing to store anything?
 *
 * The app keeps everything in IndexedDB, so a browser that refuses it does not
 * produce an error -- it produces an app that looks exactly like one whose data
 * has been wiped. That is the worst possible lie to tell someone about their
 * own finances, so the failure is detected and said out loud.
 */
import Dexie from 'dexie'
import { db } from './db'

export type StorageState = 'ok' | 'blocked' | 'unavailable'

export interface StorageStatus {
  state: StorageState
  /** Said to the user as-is, so it explains rather than names an error. */
  detail: string
}

export const STORAGE_OK: StorageStatus = { state: 'ok', detail: '' }

/**
 * Errors that mean "this write did not reach the disk". Anything else is a
 * bug in the app, which the error boundary handles instead.
 */
const STORAGE_ERROR_NAMES = new Set([
  'QuotaExceededError',
  'DatabaseClosedError',
  'InvalidStateError',
  'VersionError',
  'AbortError',
  'UnknownError',
  'NotFoundError',
  'DexieError',
])

export function isStorageError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false
  const name = (reason as { name?: string }).name ?? ''
  return STORAGE_ERROR_NAMES.has(name) || name.startsWith('Dexie')
}

export function describeStorageError(reason: unknown): StorageStatus {
  const name = (reason as { name?: string } | null)?.name ?? ''

  if (name === 'VersionError') {
    return {
      state: 'blocked',
      detail:
        'This tab is running an older version of Dompet than the one that last used your data. Reload the page.',
    }
  }
  if (name === 'QuotaExceededError') {
    return {
      state: 'unavailable',
      detail:
        'This browser has run out of space for Dompet, so new changes are not being saved. Free up space, then reload.',
    }
  }
  return {
    state: 'unavailable',
    detail:
      'This browser is not letting Dompet store anything -- private browsing and blocked site data are the usual causes. Nothing you enter here will be kept.',
  }
}

/**
 * Opens the database and proves a read goes through. A handle that opens can
 * still be unusable, so the round trip is the test rather than the open.
 */
export async function probeStorage(): Promise<StorageStatus> {
  if (typeof indexedDB === 'undefined') {
    return {
      state: 'unavailable',
      detail: 'This browser does not support the storage Dompet needs. Nothing you enter will be kept.',
    }
  }

  try {
    await db.open()
    await db.settings.get('app')
    return STORAGE_OK
  } catch (error) {
    if (error instanceof Dexie.VersionError) return describeStorageError(error)
    return describeStorageError(error)
  }
}

/**
 * Another tab is holding the database open at an older version, so the upgrade
 * cannot run. Nothing is broken -- the other tab just has to go.
 */
export const BLOCKED_BY_OTHER_TAB: StorageStatus = {
  state: 'blocked',
  detail:
    'Dompet is open in another tab running a different version, which is holding your data open. Close the other tabs, then reload.',
}

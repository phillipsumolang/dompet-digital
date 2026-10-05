import { create } from 'zustand'
import { STORAGE_OK, type StorageStatus } from '../db/health'

interface StorageState {
  status: StorageStatus
  /** Only ever moves away from ok: a later success does not clear a real failure. */
  report: (status: StorageStatus) => void
}

export const useStorageStatus = create<StorageState>((set, get) => ({
  status: STORAGE_OK,
  report: (status) => {
    if (status.state === 'ok' && get().status.state !== 'ok') return
    set({ status })
  },
}))

export const reportStorageStatus = (status: StorageStatus) =>
  useStorageStatus.getState().report(status)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { db } from './db/db'
import {
  BLOCKED_BY_OTHER_TAB,
  describeStorageError,
  isStorageError,
  probeStorage,
} from './db/health'
import { sweepTombstones } from './db/mutations'
import { seedIfEmpty } from './db/seed'
import { reportStorageStatus } from './store/storage'
import './index.css'

// An upgrade cannot run while another tab holds the old version open. Nothing
// is broken, but nothing will load either, so say which it is.
db.on('blocked', () => reportStorageStatus(BLOCKED_BY_OTHER_TAB))

/**
 * Most writes are fired without awaiting a result, so a storage failure
 * surfaces as an unhandled rejection and nowhere else. Catching those is what
 * stops the app quietly accepting entries it is not keeping.
 */
window.addEventListener('unhandledrejection', (event) => {
  if (isStorageError(event.reason)) {
    reportStorageStatus(describeStorageError(event.reason))
  }
})

async function boot() {
  const status = await probeStorage()
  reportStorageStatus(status)
  // No point seeding into storage that will not hold it.
  if (status.state !== 'ok') return

  await seedIfEmpty()
  // Deleted rows linger as tombstones so the deletion can reach other devices.
  // Nothing syncs yet, so this just stops them accumulating forever.
  await sweepTombstones()
}

void boot().catch((error: unknown) => {
  reportStorageStatus(describeStorageError(error))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

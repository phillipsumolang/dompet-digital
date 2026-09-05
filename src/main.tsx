import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { seedIfEmpty } from './db/seed'
import './index.css'

// Categories and starter accounts must exist before the first render reads
// them; seeding is idempotent, so this is safe on every boot.
void seedIfEmpty().catch(() => {
  /* a blocked IndexedDB shows as empty state rather than a crash */
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

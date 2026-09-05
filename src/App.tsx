import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { Toaster } from './components/ui/Toaster'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Analytics } from './pages/Analytics'
import { Budget } from './pages/Budget'
import { Reports } from './pages/Reports'
import { Accounts } from './pages/Accounts'
import { Categories } from './pages/Categories'
import { SplitBill } from './pages/SplitBill'
import { NotFound } from './pages/NotFound'
import { Welcome } from './components/layout/Welcome'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="budget" element={<Budget />} />
          <Route path="reports" element={<Reports />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="categories" element={<Categories />} />
          <Route path="split-bill" element={<SplitBill />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Welcome />
      <Toaster />
    </BrowserRouter>
  )
}

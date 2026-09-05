import { NavLink, Outlet } from 'react-router'
import { Moon, Sun } from 'lucide-react'
import { NAV_ITEMS } from './nav'
import { cn } from '../../lib/cn'
import { useUI } from '../../store/ui'
import { IconButton } from '../ui/Primitives'
import { DataMenu } from './DataMenu'
import { useSettings } from '../../hooks/useData'

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-ink">
        <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
          <path
            d="M7 11.5A2.5 2.5 0 0 1 9.5 9h13A2.5 2.5 0 0 1 25 11.5V13h-4.5a3.5 3.5 0 0 0 0 7H25v1.5A2.5 2.5 0 0 1 22.5 24h-13A2.5 2.5 0 0 1 7 21.5z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Dompet</span>
    </div>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
    isActive ? 'bg-brand-soft text-brand' : 'text-ink2 hover:bg-surface2 hover:text-ink',
  )

export function AppShell() {
  const { theme, toggleTheme } = useUI()
  const settings = useSettings()

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-3">
          {settings?.userName ? (
            <p className="mb-1 truncate text-xs font-medium text-ink2">
              {settings.userName}
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-muted">
            Your data never leaves this browser. Back it up from the top bar.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex-1" />
          <DataMenu />
          <IconButton
            label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </header>

        <main className="min-w-0 flex-1 px-3 pt-4 pb-24 sm:px-5 lg:pb-8">
          <Outlet />
        </main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden"
        >
          {NAV_ITEMS.filter((i) => i.primary).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  isActive ? 'text-brand' : 'text-muted',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

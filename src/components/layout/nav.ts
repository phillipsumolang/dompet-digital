import {
  ChartPie,
  FileText,
  LayoutDashboard,
  Landmark,
  Receipt,
  Tags,
  Target,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number | string; className?: string }>
  /** Shown in the mobile bottom bar, which has room for five. */
  primary?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/transactions', label: 'Transactions', icon: Receipt, primary: true },
  { to: '/analytics', label: 'Analytics', icon: ChartPie, primary: true },
  { to: '/budget', label: 'Budget', icon: Target, primary: true },
  { to: '/reports', label: 'Reports', icon: FileText, primary: true },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/split-bill', label: 'Split Bill', icon: Users },
]

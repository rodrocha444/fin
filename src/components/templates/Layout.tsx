// src/components/templates/Layout.tsx — Template principal de Layout da aplicação
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutGrid,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  HandCoins,
  BarChart3,
  Settings,
} from 'lucide-react'
import Logo from '@/components/atoms/Logo'

const NAV = [
  { to: '/budget', label: 'Orçamento', icon: LayoutGrid },
  { to: '/accounts', label: 'Contas', icon: Wallet },
  { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { to: '/debts', label: 'Cobranças', icon: HandCoins },
  { to: '/scheduled', label: 'Agenda', icon: CalendarClock },
  { to: '/reports', label: 'Relatórios', icon: BarChart3 },
  { to: '/settings', label: 'Config.', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex h-full">

      {/* ── Sidebar (apenas desktop, lg+) ─────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col bg-slate-900 border-r border-slate-800 print:hidden">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800/80">
          <Logo size="sm" />
        </div>

        {/* Nav desktop */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-xs text-slate-600">FinPlan v1.0</p>
        </div>
      </aside>

      {/* ── Conteúdo ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto bg-slate-950 pb-safe-bottom print:p-0 print:m-0 print:overflow-visible print:h-auto print:bg-white print:block" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
          <div className="lg:pb-0 h-full print:h-auto print:p-0 print:m-0">
            <Outlet />
          </div>
        </main>

        {/* ── Bottom Nav mobile (sm/md) ─────────────────── */}
        <nav className="lg:hidden flex items-center bg-slate-900 border-t border-slate-800 flex-shrink-0 print:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${isActive
                  ? 'text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

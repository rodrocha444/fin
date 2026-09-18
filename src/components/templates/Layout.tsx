// src/components/templates/Layout.tsx — Template principal de Layout da aplicação com Quick Add e PWA
import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Wallet,
  ArrowLeftRight,
  BarChart3,
  Settings,
  LogOut,
  User,
  Plus,
} from 'lucide-react'
import Logo from '@/components/atoms/Logo'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import { useAuth } from '@/context/AuthContext'
import { useFinancialData } from '@/context/FinancialDataContext'
import { useConfirm } from '@/context/ConfirmContext'
import TransactionForm from '@/components/organisms/TransactionForm'
import PwaInstallPrompt from '@/components/organisms/PwaInstallPrompt'
import OnboardingWizardModal from '@/components/organisms/OnboardingWizardModal'
import { APP_VERSION } from '@/version'

const NAV_DESKTOP = [
  { to: '/budget', label: 'Orçamento', icon: LayoutGrid },
  { to: '/accounts', label: 'Contas', icon: Wallet },
  { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { to: '/reports', label: 'Relatórios', icon: BarChart3 },
  { to: '/settings', label: 'Config.', icon: Settings },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { accounts, isLoading } = useFinancialData()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [showQuickAddModal, setShowQuickAddModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Verifica se é primeiro acesso de novo usuário (sem contas cadastradas)
  useEffect(() => {
    if (isLoading || !user) return
    const completed =
      localStorage.getItem(`finplan_onboarding_completed_${user.id}`) ||
      localStorage.getItem('finplan_onboarding_completed')

    if (!completed && accounts && accounts.length === 0) {
      // Dispara o wizard com pequeno delay para fluidez de renderização
      const timer = setTimeout(() => {
        setShowOnboarding(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, user, accounts])

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sair da Conta',
      message: 'Deseja realmente encerrar sua sessão no FinPlan?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (confirmed) {
      await signOut()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-full">

      {/* ── Sidebar (apenas desktop, lg+) ─────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col bg-slate-900 border-r border-slate-800 print:hidden">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800/80">
          <Logo size="sm" />
        </div>

        {/* Botão de Ação Rápida no Desktop */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setShowQuickAddModal(true)}
            className="btn-primary w-full py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Transação</span>
          </button>
        </div>

        {/* Nav desktop */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {NAV_DESKTOP.map(({ to, label, icon: Icon }) => (
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

        {/* Rodapé da Sidebar: Usuário, Status e Versão */}
        <div className="p-3 border-t border-slate-800 space-y-3">
          {user && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] text-slate-300 truncate font-medium" title={user.email ?? ''}>
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Encerrar sessão"
                className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-950/30 transition-colors flex-shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <SyncStatusBadge className="w-full justify-between" />
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-600">
            <span>FinPlan v{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto bg-slate-950 print:p-0 print:m-0 print:overflow-visible print:h-auto print:bg-white print:block">
          <div className="h-full print:h-auto print:p-0 print:m-0">
            <Outlet />
          </div>
        </main>

        {/* ── Bottom Nav mobile (sm/md) com Quick Add Central e Safe Area ─────────────────── */}
        <nav
          className="lg:hidden flex items-center justify-around bg-slate-900 border-t border-slate-800 flex-shrink-0 print:hidden relative z-30 px-1 pt-1.5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
        >
          {/* 1. Orçamento */}
          <NavLink
            to="/budget"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutGrid className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                <span>Orçamento</span>
              </>
            )}
          </NavLink>

          {/* 2. Contas */}
          <NavLink
            to="/accounts"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Wallet className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                <span>Contas</span>
              </>
            )}
          </NavLink>

          {/* 3. BOTÃO CENTRAL DESTACADO QUICK ADD (+) */}
          <div className="flex-shrink-0 px-1 -mt-4">
            <button
              type="button"
              onClick={() => setShowQuickAddModal(true)}
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-950/60 border-2 border-slate-900 active:scale-95 transition-transform"
              aria-label="Registrar Nova Transação"
              title="Registrar Nova Transação"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* 4. Transações */}
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <ArrowLeftRight className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                <span>Extrato</span>
              </>
            )}
          </NavLink>

          {/* 5. Configurações / Mais */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                <span>Ajustes</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>

      {/* Modal de Transação Rápida Global */}
      {showQuickAddModal && (
        <TransactionForm
          onClose={() => setShowQuickAddModal(false)}
        />
      )}

      {/* Banner de Instalação PWA */}
      <PwaInstallPrompt />

      {/* Onboarding Guiado para Novos Usuários */}
      <OnboardingWizardModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  )
}

// src/App.tsx — Aplicação Principal com Code-Splitting e TanStack Query
import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/templates/Layout'
import ProtectedRoute from '@/components/organisms/ProtectedRoute'
import { AuthProvider } from '@/context/AuthContext'
import { FinancialDataProvider } from '@/context/FinancialDataContext'
import { ConfirmProvider } from '@/context/ConfirmContext'
import { SubscriptionProvider } from '@/context/SubscriptionContext'

// Code-splitting das páginas para redução do bundle inicial
const LoginPage = lazy(() => import('@/components/pages/LoginPage'))
const BudgetPage = lazy(() => import('@/components/pages/BudgetPage'))
const AccountsPage = lazy(() => import('@/components/pages/AccountsPage'))
const AccountDetailPage = lazy(() => import('@/components/pages/AccountDetailPage'))
const AccountInvoicePage = lazy(() => import('@/components/pages/AccountInvoicePage'))
const TransactionsPage = lazy(() => import('@/components/pages/TransactionsPage'))
const DebtAccountPage = lazy(() => import('@/components/pages/DebtAccountPage'))
const ReportsPage = lazy(() => import('@/components/pages/ReportsPage'))
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage'))

import PasswordRecoveryModal from '@/components/organisms/PasswordRecoveryModal'
import PaywallModal from '@/components/organisms/PaywallModal'

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium tracking-wide">Carregando...</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <FinancialDataProvider>
          <ConfirmProvider>
            <PasswordRecoveryModal />
            <PaywallModal />
            <HashRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Rota pública de Autenticação */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rotas protegidas (exigem sessão ativa) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/budget" replace />} />
                    <Route path="budget" element={<BudgetPage />} />
                    <Route path="accounts" element={<AccountsPage />} />
                    <Route path="accounts/:id" element={<AccountDetailPage />} />
                    <Route path="accounts/:id/invoice" element={<AccountInvoicePage />} />
                    <Route path="accounts/debt/:id" element={<DebtAccountPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="debts" element={<Navigate to="/accounts" replace />} />
                    <Route path="debts/:id" element={<DebtAccountPage />} />
                    <Route path="scheduled" element={<Navigate to="/budget" replace />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                {/* Fallback de rotas desconhecidas */}
                <Route path="*" element={<Navigate to="/budget" replace />} />
              </Routes>
            </Suspense>
          </HashRouter>
        </ConfirmProvider>
      </FinancialDataProvider>
    </SubscriptionProvider>
  </AuthProvider>
)
}

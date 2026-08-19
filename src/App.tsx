// src/App.tsx
import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/templates/Layout'
import BudgetPage from '@/components/pages/BudgetPage'
import AccountsPage from '@/components/pages/AccountsPage'
import AccountDetailPage from '@/components/pages/AccountDetailPage'
import AccountInvoicePage from '@/components/pages/AccountInvoicePage'
import TransactionsPage from '@/components/pages/TransactionsPage'
import ScheduledPage from '@/components/pages/ScheduledPage'
import DebtAccountPage from '@/components/pages/DebtAccountPage'
import ReportsPage from '@/components/pages/ReportsPage'
import SettingsPage from '@/components/pages/SettingsPage'
import { processScheduledTransactions } from '@/db/repositories/scheduled'
import { clearDefaultIncomeCategories } from '@/db/repositories/categories'
import { initSyncEngine } from '@/services/syncEngine'

export default function App() {
  useEffect(() => {
    // Limpar categorias default de renda e processar transações agendadas
    clearDefaultIncomeCategories().catch(console.error)
    processScheduledTransactions().catch(console.error)
    initSyncEngine().catch(console.error)
  }, [])

  return (
    <HashRouter>
      <Routes>
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
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

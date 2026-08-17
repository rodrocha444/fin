// src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/templates/Layout'
import BudgetPage from '@/components/pages/BudgetPage'
import AccountsPage from '@/components/pages/AccountsPage'
import AccountDetailPage from '@/components/pages/AccountDetailPage'
import AccountInvoicePage from '@/components/pages/AccountInvoicePage'
import TransactionsPage from '@/components/pages/TransactionsPage'
import ScheduledPage from '@/components/pages/ScheduledPage'
import DebtsPage from '@/components/pages/DebtsPage'
import ReportsPage from '@/components/pages/ReportsPage'
import SettingsPage from '@/components/pages/SettingsPage'
import { processScheduledTransactions } from '@/db/repositories/scheduled'
import { clearDefaultIncomeCategories } from '@/db/repositories/categories'

export default function App() {
  useEffect(() => {
    // Limpar categorias default de renda e processar transações agendadas
    clearDefaultIncomeCategories().catch(console.error)
    processScheduledTransactions().catch(console.error)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/budget" replace />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="accounts/:id/invoice" element={<AccountInvoicePage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

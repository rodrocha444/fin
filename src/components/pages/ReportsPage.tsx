import { useState } from 'react'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useBudgetRows } from '@/hooks/useBudget'
import { useMonthSummary } from '@/hooks/useTransactions'
import { useAllBalances, useAccounts } from '@/hooks/useAccounts'
import { formatCurrency, currentMonth } from '@/utils/format'
import NetWorthChartCard from '@/components/organisms/NetWorthChartCard'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'

function ProgressBar({ value, max, overBudget }: { value: number; max: number; overBudget: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-rose-500' : 'bg-indigo-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function ReportsPage() {
  const [month] = useState(currentMonth)
  const rows = useBudgetRows(month)
  const monthSummary = useMonthSummary(month)
  const accounts = useAccounts() ?? []
  const balances = useAllBalances()

  const netWorth = balances
    ? Array.from(balances.values()).reduce((s, v) => s + v, 0)
    : 0

  return (
    <div className="fade-in">

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <h1 className="text-lg sm:text-xl font-semibold text-slate-100">Relatórios</h1>
        <div className="lg:hidden">
          <SyncStatusBadge compact={true} />
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-4">

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="card !p-3 sm:!p-4">
            <TrendingUp className="w-4 h-4 text-emerald-400 mb-1.5" />
            <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Renda</p>
            <p className="text-sm sm:text-xl font-bold text-emerald-400 tabular-nums">
              {formatCurrency(monthSummary?.income ?? 0)}
            </p>
          </div>
          <div className="card !p-3 sm:!p-4">
            <TrendingDown className="w-4 h-4 text-rose-400 mb-1.5" />
            <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Despesas</p>
            <p className="text-sm sm:text-xl font-bold text-rose-400 tabular-nums">
              {formatCurrency(monthSummary?.expense ?? 0)}
            </p>
          </div>
          <div className="card !p-3 sm:!p-4">
            <BarChart3 className="w-4 h-4 text-indigo-400 mb-1.5" />
            <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Patrimônio</p>
            <p className={`text-sm sm:text-xl font-bold tabular-nums ${netWorth >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
              {formatCurrency(netWorth)}
            </p>
          </div>
        </div>

        {/* Medidor e Gráfico de Patrimônio Líquido */}
        <NetWorthChartCard />

        {/* Gastos por categoria */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Gastos por categoria</h2>
          {!rows || rows.every(r => r.totalActivity === 0) ? (
            <p className="text-slate-600 text-sm text-center py-4">Sem despesas neste mês</p>
          ) : (
            <div className="space-y-4">
              {rows
                .filter(r => r.totalActivity > 0)
                .sort((a, b) => b.totalActivity - a.totalActivity)
                .map(row => (
                  <div key={row.group.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 truncate flex-1">{row.group.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-slate-600 hidden sm:inline">
                          / {formatCurrency(row.totalBudgeted)}
                        </span>
                        <span className="text-xs font-semibold text-rose-400 tabular-nums">
                          {formatCurrency(row.totalActivity)}
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={row.totalActivity}
                      max={row.totalBudgeted}
                      overBudget={row.totalActivity > row.totalBudgeted && row.totalBudgeted > 0}
                    />
                    <div className="mt-2 space-y-1.5 pl-3">
                      {row.categories
                        .filter(c => c.activity > 0)
                        .sort((a, b) => b.activity - a.activity)
                        .map(c => (
                          <div key={c.category.id}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] sm:text-xs text-slate-500 truncate flex-1">
                                {c.category.name}
                              </span>
                              <span className="text-[10px] sm:text-xs text-slate-400 tabular-nums ml-2 flex-shrink-0">
                                {formatCurrency(c.activity)}
                                {c.budgeted > 0 && (
                                  <span className="text-slate-600"> / {formatCurrency(c.budgeted)}</span>
                                )}
                              </span>
                            </div>
                            <ProgressBar
                              value={c.activity}
                              max={c.budgeted}
                              overBudget={c.available < 0 && c.budgeted > 0}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Saldos por conta */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Saldos por conta</h2>
          <div className="space-y-2.5">
            {accounts.map(acc => {
              const bal = balances?.get(acc.id!) ?? 0
              return (
                <div key={acc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm text-slate-300 truncate">{acc.name}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-2 ${bal >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                    {formatCurrency(bal)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

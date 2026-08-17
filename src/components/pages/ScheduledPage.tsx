// src/pages/ScheduledPage.tsx — versão mobile
import { useState } from 'react'
import { Plus, CalendarClock, Pencil, Trash2, PlayCircle, ChevronRight } from 'lucide-react'
import { useScheduledTransactions } from '@/hooks/useScheduled'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { deleteScheduled, processScheduledTransactions } from '@/db/repositories/scheduled'
import { formatCurrency, formatDate, frequencyLabel } from '@/utils/format'
import ScheduledForm from '@/components/organisms/ScheduledForm'
import type { ScheduledTransaction } from '@/types'

export default function ScheduledPage() {
  const scheduled = useScheduledTransactions()
  const accounts = useAccounts() ?? []
  const { categories } = useCategoriesWithGroups() ?? {}
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ScheduledTransaction | undefined>()
  const [processing, setProcessing] = useState(false)

  const accountMap = new Map(accounts.map(a => [a.id!, a]))
  const categoryMap = new Map(categories?.map(c => [c.id!, c]) ?? [])

  const handleDelete = async (s: ScheduledTransaction) => {
    if (!s.id || !confirm(`Excluir agendamento "${s.payee}"?`)) return
    await deleteScheduled(s.id)
  }

  const handleProcessNow = async () => {
    setProcessing(true)
    try {
      const count = await processScheduledTransactions()
      alert(`${count} transação(ões) processada(s).`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fade-in">

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-100">Agendamentos</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 hidden sm:block">Transações recorrentes e programadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleProcessNow}
            disabled={processing}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm"
          >
            <PlayCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Processar</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-1.5 py-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Novo</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="p-3 sm:p-6 space-y-2">
        {!scheduled ? (
          <p className="text-slate-600 text-sm">Carregando…</p>
        ) : scheduled.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 gap-3">
            <CalendarClock className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">Nenhum agendamento ativo</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-xs">Criar agendamento</button>
          </div>
        ) : (
          scheduled.map(s => {
            const acc = accountMap.get(s.accountId)
            const cat = s.categoryId ? categoryMap.get(s.categoryId) : undefined
            const typeColor = s.type === 'income' ? 'text-emerald-400' : s.type === 'transfer' ? 'text-sky-400' : 'text-rose-400'
            const prefix = s.type === 'income' ? '+' : '-'

            return (
              <div key={s.id} className="card">
                <div className="flex items-center gap-3">
                  {/* Ícone */}
                  <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-5 h-5 text-slate-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{s.payee}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="badge bg-slate-700/60 text-slate-400 text-[10px]">
                        {frequencyLabel(s.frequency)}
                      </span>
                      {acc && <span className="text-[10px] text-slate-500">{acc.name}</span>}
                      {cat && <span className="text-[10px] text-slate-500 hidden sm:inline">· {cat.name}</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">próx. {formatDate(s.nextDate)}</p>
                  </div>

                  {/* Valor + ações */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${typeColor}`}>
                        {prefix}{formatCurrency(s.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditing(s); setShowForm(true) }}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 active:bg-rose-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showForm && (
        <ScheduledForm
          scheduled={editing}
          onClose={() => { setShowForm(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}

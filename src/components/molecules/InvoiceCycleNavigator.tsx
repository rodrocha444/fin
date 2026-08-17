// src/components/molecules/InvoiceCycleNavigator.tsx — Navegador de ciclo da fatura
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, shiftMonth } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { InvoiceCycle } from '@/utils/invoices'

interface InvoiceCycleNavigatorProps {
  cycle: InvoiceCycle
  activeMonth: string
  onChangeMonth: (month: string) => void
}

export default function InvoiceCycleNavigator({
  cycle,
  activeMonth,
  onChangeMonth,
}: InvoiceCycleNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-2.5">
      <button
        onClick={() => onChangeMonth(shiftMonth(activeMonth, -1))}
        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
        title="Fatura anterior"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm sm:text-base font-bold text-slate-100 capitalize">
            Fatura {cycle.label}
          </span>
          {cycle.status === 'open' ? (
            <Badge variant="success" className="animate-pulse">
              Aberta
            </Badge>
          ) : cycle.status === 'closed' ? (
            <Badge variant="warning">
              Fechada
            </Badge>
          ) : (
            <Badge variant="violet">
              Futura
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Ciclo: {formatDate(cycle.startDate)} até {formatDate(cycle.closingDate)}
        </p>
      </div>

      <button
        onClick={() => onChangeMonth(shiftMonth(activeMonth, 1))}
        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
        title="Próxima fatura"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}

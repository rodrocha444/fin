// src/components/molecules/InvoiceCycleNavigator.tsx — Navegador de ciclo da fatura
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, shiftMonth, formatCurrency } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { InvoiceCycle, InvoiceData } from '@/utils/invoices'

interface InvoiceCycleNavigatorProps {
  cycle: InvoiceCycle
  activeMonth: string
  onChangeMonth: (month: string) => void
  invoicesList?: InvoiceData[]
}

export default function InvoiceCycleNavigator({
  cycle,
  activeMonth,
  onChangeMonth,
  invoicesList,
}: InvoiceCycleNavigatorProps) {
  return (
    <div className="space-y-2.5">
      {/* Navegador principal */}
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

      {/* Barra de atalhos rápidos das faturas (com valores) */}
      {invoicesList && invoicesList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 px-0.5 scrollbar-none select-none">
          {invoicesList.map(inv => {
            const isSelected = inv.cycle.monthKey === activeMonth
            const hasCharges = inv.totalAmount > 0

            return (
              <button
                key={inv.cycle.monthKey}
                type="button"
                onClick={() => onChangeMonth(inv.cycle.monthKey)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-sm shadow-indigo-950/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    inv.cycle.status === 'open'
                      ? 'bg-emerald-400'
                      : inv.cycle.status === 'future'
                      ? 'bg-violet-400'
                      : 'bg-amber-400'
                  }`} />
                  <span className={`text-[11px] font-semibold capitalize ${
                    isSelected ? 'text-slate-100' : 'text-slate-300'
                  }`}>
                    {inv.cycle.label}
                  </span>
                </div>
                <p className={`text-xs font-bold tabular-nums mt-0.5 ${
                  hasCharges
                    ? isSelected ? 'text-indigo-300' : 'text-slate-200'
                    : 'text-slate-500 font-normal'
                }`}>
                  {hasCharges ? formatCurrency(inv.totalAmount) : 'R$ 0,00'}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

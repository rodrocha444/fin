// src/components/atoms/MonthNavigator.tsx — Navegador de meses (< Mês >)
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthLabel, shiftMonth } from '@/utils/format'

interface MonthNavigatorProps {
  month: string // 'YYYY-MM'
  onChangeMonth: (month: string) => void
}

export default function MonthNavigator({
  month,
  onChangeMonth,
}: MonthNavigatorProps) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-800/60 rounded-lg p-0.5 flex-shrink-0">
      <button
        onClick={() => onChangeMonth(shiftMonth(month, -1))}
        className="p-2 rounded text-slate-400 hover:text-slate-200 active:bg-slate-700 transition-colors"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2 text-xs sm:text-sm font-medium text-slate-200 min-w-[72px] sm:min-w-[90px] text-center capitalize select-none">
        {formatMonthLabel(month)}
      </span>
      <button
        onClick={() => onChangeMonth(shiftMonth(month, 1))}
        className="p-2 rounded text-slate-400 hover:text-slate-200 active:bg-slate-700 transition-colors"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

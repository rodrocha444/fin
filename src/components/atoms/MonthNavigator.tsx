// src/components/atoms/MonthNavigator.tsx — Navegador de meses (< Mês >)
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthLabel, shiftMonth } from '@/utils/format'

interface MonthNavigatorProps {
  month: string // 'YYYY-MM'
  onChangeMonth: (month: string) => void
  minMonth?: string | null
  maxMonth?: string | null
}

export default function MonthNavigator({
  month,
  onChangeMonth,
  minMonth,
  maxMonth,
}: MonthNavigatorProps) {
  const isPrevDisabled = Boolean(minMonth && month <= minMonth)
  const isNextDisabled = Boolean(maxMonth && month >= maxMonth)

  return (
    <div className="flex items-center gap-0.5 bg-slate-800/60 rounded-lg p-0.5 flex-shrink-0">
      <button
        onClick={() => !isPrevDisabled && onChangeMonth(shiftMonth(month, -1))}
        disabled={isPrevDisabled}
        className={`p-2 rounded transition-colors ${
          isPrevDisabled
            ? 'text-slate-600 cursor-not-allowed opacity-40'
            : 'text-slate-400 hover:text-slate-200 active:bg-slate-700'
        }`}
        title={isPrevDisabled ? 'Início do período contábil atingido' : 'Mês anterior'}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2 text-xs sm:text-sm font-medium text-slate-200 min-w-[72px] sm:min-w-[90px] text-center capitalize select-none">
        {formatMonthLabel(month)}
      </span>
      <button
        onClick={() => !isNextDisabled && onChangeMonth(shiftMonth(month, 1))}
        disabled={isNextDisabled}
        className={`p-2 rounded transition-colors ${
          isNextDisabled
            ? 'text-slate-600 cursor-not-allowed opacity-40'
            : 'text-slate-400 hover:text-slate-200 active:bg-slate-700'
        }`}
        title={isNextDisabled ? 'Limite de período atingido' : 'Próximo mês'}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}


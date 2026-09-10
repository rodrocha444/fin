// src/components/atoms/BudgetRegimeSelector.tsx — Seletor personalizado de modelo orçamentário (Caixa vs Competência)
import { useState, useRef, useEffect } from 'react'
import { Receipt, CalendarDays, ChevronDown, Check } from 'lucide-react'
import type { AccountingRegime } from '@/utils/accountingRegime'

interface BudgetRegimeSelectorProps {
  regime: AccountingRegime
  onChangeRegime: (regime: AccountingRegime) => void
}

const REGIME_OPTIONS = [
  {
    id: 'cash' as const,
    label: 'Por Caixa',
    badge: 'Faturas',
    description: 'Parcelas lançadas no mês de vencimento de cada fatura',
    icon: Receipt,
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-950/80 border-sky-800/60 text-sky-400',
  },
  {
    id: 'accrual' as const,
    label: 'Por Competência',
    badge: 'Compra Total',
    description: 'Valor total integral na data da compra (mês atual e passados)',
    icon: CalendarDays,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-950/80 border-indigo-800/60 text-indigo-400',
  },
]

export default function BudgetRegimeSelector({
  regime,
  onChangeRegime,
}: BudgetRegimeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeOption = REGIME_OPTIONS.find(o => o.id === regime) || REGIME_OPTIONS[0]
  const ActiveIcon = activeOption.icon

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botão Gatilho Personalizado */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 shadow-sm ${
          isOpen
            ? 'bg-slate-800 border-indigo-500/80 text-slate-100 ring-1 ring-indigo-500/30'
            : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-600'
        }`}
        title={`Modelo atual: ${activeOption.label} (${activeOption.badge}). Clique para alternar.`}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
          regime === 'accrual' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-sky-500/20 text-sky-300'
        }`}>
          <ActiveIcon className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-1.5 text-left min-w-0">
          <span className="hidden sm:inline font-semibold">{activeOption.label}</span>
          <span className="sm:hidden font-semibold truncate">{activeOption.label.replace('Por ', '')}</span>
          <span className={`hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
            regime === 'accrual'
              ? 'bg-indigo-950/90 text-indigo-300 border border-indigo-800/60'
              : 'bg-sky-950/90 text-sky-300 border border-sky-800/60'
          }`}>
            {activeOption.badge}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Menu Popover Customizado */}
      {isOpen && (
        <>
          {/* Backdrop em mobile para fechamento suave */}
          <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setIsOpen(false)} />

          <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-[270px] sm:w-[300px] bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl z-40 p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Modelo de Orçamento
              </p>
              <p className="text-[11px] text-slate-500">
                Alterne como as compras parceladas impactam o orçamento
              </p>
            </div>

            <div className="space-y-1">
              {REGIME_OPTIONS.map(opt => {
                const isSelected = opt.id === regime
                const Icon = opt.icon

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeRegime(opt.id)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all duration-150 group ${
                      isSelected
                        ? 'bg-slate-800/90 border border-indigo-500/40 text-slate-100 shadow-sm'
                        : 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? opt.id === 'accrual'
                            ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                            : 'bg-sky-950 border-sky-700 text-sky-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {opt.label}
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wide ${
                              opt.id === 'accrual'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                                : 'bg-sky-950 text-sky-300 border border-sky-800/50'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// src/components/atoms/BarChart.tsx — Gráfico de Barras Responsivo com Interatividade e Tooltips
import React, { useState, useMemo } from 'react'
import { formatCurrency } from '@/utils/format'
import { TrendingDown, TrendingUp, Sparkles } from 'lucide-react'

export interface BarChartItem {
  id: string
  label: string
  sublabel?: string
  fullLabel?: string
  value: number
  secondaryValue?: number
  color?: string
  secondaryColor?: string
  badge?: string
  badgeVariant?: 'success' | 'danger' | 'neutral' | 'info'
  count?: number
  isActive?: boolean
}

interface BarChartProps {
  items: BarChartItem[]
  height?: number
  orientation?: 'vertical' | 'horizontal'
  type?: 'expense' | 'income' | 'comparative' | 'generic'
  emptyMessage?: string
  onBarClick?: (item: BarChartItem) => void
  formatValue?: (val: number) => string
  showAverageLine?: boolean
  activeId?: string
}

export default function BarChart({
  items,
  height = 200,
  orientation = 'vertical',
  type = 'generic',
  emptyMessage = 'Nenhum dado disponível',
  onBarClick,
  formatValue = formatCurrency,
  showAverageLine = false,
  activeId,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Cores padrão refinadas com gradientes sutis
  const defaultBarColor = useMemo(() => {
    if (type === 'expense') return '#f43f5e' // rose-500
    if (type === 'income') return '#10b981' // emerald-500
    return '#6366f1' // indigo-500
  }, [type])

  const maxValue = useMemo(() => {
    if (items.length === 0) return 0
    let max = 0
    for (const it of items) {
      const v = Math.max(it.value, it.secondaryValue ?? 0)
      if (v > max) max = v
    }
    return max > 0 ? max * 1.15 : 1 // 15% de folga no topo
  }, [items])

  const averageValue = useMemo(() => {
    if (items.length === 0) return 0
    const sum = items.reduce((acc, it) => acc + it.value, 0)
    return sum / items.length
  }, [items])

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl bg-slate-950/30 border border-dashed border-slate-800 p-6 text-center text-slate-500 text-xs"
        style={{ height }}
      >
        <p className="font-medium text-slate-400">{emptyMessage}</p>
      </div>
    )
  }

  // ── 1. Modo Horizontal (Ranking de Categorias / Barras Horizontais) ─────────
  if (orientation === 'horizontal') {
    const totalSum = items.reduce((s, it) => s + it.value, 0)

    return (
      <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
        {items.map((item, index) => {
          const pct = totalSum > 0 ? ((item.value / totalSum) * 100).toFixed(1) : '0'
          const barWidthPct = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 3) : 0
          const barColor = item.color || defaultBarColor
          const isSelected = activeId === item.id || item.isActive

          return (
            <div
              key={item.id}
              onClick={() => onBarClick?.(item)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`group p-2 sm:p-2.5 rounded-xl border transition-all ${
                onBarClick ? 'cursor-pointer hover:scale-[1.01]' : ''
              } ${
                isSelected
                  ? 'bg-slate-800/80 border-indigo-500/50 shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-950/40 hover:bg-slate-800/40 border-slate-800/70'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="font-medium text-slate-200 truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                      ({item.sublabel})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-right">
                  <span className="font-bold tabular-nums text-slate-100">
                    {formatValue(item.value)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium w-9 tabular-nums">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 rounded-full bg-slate-950/80 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${barWidthPct}%`,
                    backgroundColor: barColor,
                    boxShadow: `0 0 10px ${barColor}44`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── 2. Modo Vertical (Evolução Temporal / Mensal) ───────────────────────────
  const hoveredItem = hoveredIndex !== null ? items[hoveredIndex] : null

  return (
    <div className="relative select-none flex flex-col justify-between w-full" style={{ minHeight: height }}>
      {/* Tooltip Flutuante / Header Informativo */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/60 text-xs">
        <div className="min-w-0">
          {hoveredItem ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-100">
              <span className="font-semibold text-slate-200">
                {hoveredItem.fullLabel || hoveredItem.label}
              </span>
              {hoveredItem.count !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                  {hoveredItem.count} {hoveredItem.count === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Passe o mouse para detalhes · Clique para ver lançamentos</span>
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          {hoveredItem ? (
            <div className="flex items-center gap-1.5">
              {hoveredItem.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                    hoveredItem.badgeVariant === 'success'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                      : hoveredItem.badgeVariant === 'danger'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {hoveredItem.badgeVariant === 'success' && <TrendingDown className="w-3 h-3" />}
                  {hoveredItem.badgeVariant === 'danger' && <TrendingUp className="w-3 h-3" />}
                  {hoveredItem.badge}
                </span>
              )}
              <span className="text-xs sm:text-sm font-extrabold text-slate-100 tabular-nums">
                {formatValue(hoveredItem.value)}
              </span>
            </div>
          ) : (
            showAverageLine && averageValue > 0 && (
              <span className="text-[10px] text-slate-500 tabular-nums">
                Média: <strong className="text-slate-300">{formatValue(averageValue)}</strong>
              </span>
            )
          )}
        </div>
      </div>

      {/* Área das Barras Verticais */}
      <div
        className="relative flex items-end justify-between gap-1.5 sm:gap-2.5 pt-4 pb-1 w-full"
        style={{ height: height - 60 }}
      >
        {/* Linha de Média (opcional) */}
        {showAverageLine && averageValue > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-slate-700/60 pointer-events-none z-0"
            style={{
              bottom: `${(averageValue / maxValue) * 100}%`,
            }}
          >
            <span className="absolute -top-3.5 right-1 text-[9px] font-semibold text-slate-500">
              Média
            </span>
          </div>
        )}

        {items.map((item, index) => {
          const barHeightPct = maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 4 : 0) : 0
          const secondaryHeightPct =
            item.secondaryValue && maxValue > 0
              ? Math.max((item.secondaryValue / maxValue) * 100, item.secondaryValue > 0 ? 4 : 0)
              : 0
          const isHovered = hoveredIndex === index
          const isSelected = activeId === item.id || item.isActive
          const barColor = item.color || defaultBarColor

          return (
            <div
              key={item.id}
              onClick={() => onBarClick?.(item)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onTouchStart={() => setHoveredIndex(index)}
              className={`flex-1 flex flex-col items-center justify-end h-full relative group transition-all ${
                onBarClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* Badge de Variação ou Valor no topo da barra no hover */}
              {isHovered && (
                <div className="absolute -top-7 z-20 px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200 tabular-nums shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  {formatValue(item.value)}
                </div>
              )}

              {/* Indicador de Variação fixo (se não estiver em hover) */}
              {!isHovered && item.badge && (
                <div className="absolute -top-5 z-10 hidden sm:block text-[9px] font-semibold text-slate-500 tabular-nums">
                  {item.badge}
                </div>
              )}

              {/* Estrutura da Barra */}
              <div className="w-full flex items-end justify-center gap-1 h-full px-0.5 sm:px-1">
                {/* Barra Principal */}
                <div
                  className={`w-full max-w-[36px] rounded-t-lg transition-all duration-200 relative ${
                    isSelected
                      ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-md shadow-indigo-500/30'
                      : ''
                  }`}
                  style={{
                    height: `${barHeightPct}%`,
                    backgroundColor: barColor,
                    opacity: hoveredIndex === null ? 0.9 : isHovered ? 1 : 0.45,
                    filter: isHovered ? `drop-shadow(0 0 10px ${barColor}77)` : 'none',
                    transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                    transformOrigin: 'bottom',
                  }}
                >
                  {/* Gradiente interno sutil para visual premium */}
                  <div className="absolute inset-0 rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                </div>

                {/* Barra Secundária (para Comparativo se existir) */}
                {item.secondaryValue !== undefined && (
                  <div
                    className="w-full max-w-[36px] rounded-t-lg transition-all duration-200 relative"
                    style={{
                      height: `${secondaryHeightPct}%`,
                      backgroundColor: item.secondaryColor || '#10b981',
                      opacity: hoveredIndex === null ? 0.9 : isHovered ? 1 : 0.45,
                      filter: isHovered ? `drop-shadow(0 0 10px #10b98177)` : 'none',
                      transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  >
                    <div className="absolute inset-0 rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Rótulo do Eixo X (Mês) */}
              <div className="mt-2 text-center w-full">
                <span
                  className={`text-[10px] sm:text-xs block truncate transition-colors ${
                    isSelected
                      ? 'font-bold text-indigo-400'
                      : isHovered
                      ? 'font-semibold text-slate-200'
                      : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="text-[9px] text-slate-600 block truncate leading-none">
                    {item.sublabel}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

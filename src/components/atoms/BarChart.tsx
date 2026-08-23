// src/components/atoms/BarChart.tsx — Gráfico de Barras Responsivo com Suporte a Barras Empilhadas por Categoria e Scroll Horizontal Automático
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { formatCurrency } from '@/utils/format'
import { TrendingDown, TrendingUp, Sparkles } from 'lucide-react'

export interface BarChartSegment {
  id: string
  label: string
  sublabel?: string
  value: number
  color: string
  count?: number
}

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
  segments?: BarChartSegment[]
  secondarySegments?: BarChartSegment[]
}

interface BarChartProps {
  items: BarChartItem[]
  height?: number
  orientation?: 'vertical' | 'horizontal'
  type?: 'expense' | 'income' | 'comparative' | 'generic'
  emptyMessage?: string
  onBarClick?: (item: BarChartItem) => void
  onSegmentClick?: (item: BarChartItem, segment: BarChartSegment) => void
  formatValue?: (val: number) => string
  showAverageLine?: boolean
  activeId?: string
  isStacked?: boolean
}

export default function BarChart({
  items,
  height = 340,
  orientation = 'vertical',
  type = 'generic',
  emptyMessage = 'Nenhum dado disponível',
  onBarClick,
  onSegmentClick,
  formatValue = formatCurrency,
  showAverageLine = false,
  activeId,
  isStacked = true,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredSegment, setHoveredSegment] = useState<{
    itemIndex: number
    segmentId: string
    isSecondary?: boolean
  } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Cores padrão refinadas
  const defaultBarColor = useMemo(() => {
    if (type === 'expense') return '#f43f5e'
    if (type === 'income') return '#10b981'
    return '#6366f1'
  }, [type])

  const maxValue = useMemo(() => {
    if (items.length === 0) return 0
    let max = 0
    for (const it of items) {
      const v = Math.max(it.value, it.secondaryValue ?? 0)
      if (v > max) max = v
    }
    return max > 0 ? max * 1.15 : 1
  }, [items])

  const averageValue = useMemo(() => {
    if (items.length === 0) return 0
    const sum = items.reduce((acc, it) => acc + it.value, 0)
    return sum / items.length
  }, [items])

  const hoveredItem =
    hoveredIndex !== null && hoveredIndex < items.length ? items[hoveredIndex] : null

  const currentSegment = useMemo(() => {
    if (!hoveredSegment || hoveredIndex === null || !hoveredItem) return null
    const segs = hoveredSegment.isSecondary ? hoveredItem.secondarySegments : hoveredItem.segments
    return segs?.find(s => s.id === hoveredSegment.segmentId) ?? null
  }, [hoveredSegment, hoveredIndex, hoveredItem])

  // Rola automaticamente para o mês mais recente se houver muitos meses
  useEffect(() => {
    if (scrollContainerRef.current && items.length > 12) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
    }
  }, [items.length])

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
      <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1 select-none">
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

  // ── 2. Modo Vertical (Evolução Temporal com Barras Altas & Empilhadas) ─────
  const isScrollable = items.length > 12

  return (
    <div
      className="relative select-none flex flex-col justify-between w-full"
      style={{ height }}
    >
      {/* ── Header / Tooltip Flutuante com Detalhes da Categoria ou Mês ─────── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-slate-800/80 text-xs min-h-[38px] flex-shrink-0">
        <div className="min-w-0 flex-1">
          {currentSegment && hoveredItem ? (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-100">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: currentSegment.color }}
              />
              <span className="font-bold text-slate-100">{currentSegment.label}</span>
              {currentSegment.sublabel && (
                <span className="text-[10px] text-slate-400 font-normal">
                  ({currentSegment.sublabel})
                </span>
              )}
              <span className="text-slate-500">em</span>
              <span className="text-indigo-300 font-semibold">{hoveredItem.label}</span>
              {currentSegment.count !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                  {currentSegment.count} {currentSegment.count === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              )}
            </div>
          ) : hoveredItem ? (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-100">
              <span className="font-bold text-slate-100">
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
              <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />
              <span>
                {isScrollable
                  ? 'Deslize para ver todos os meses · Passe o mouse nas fatias'
                  : 'Passe o mouse nas fatias para ver as categorias · Clique para abrir transações'}
              </span>
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0 ml-2">
          {currentSegment && hoveredItem ? (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-100 tabular-nums">
                {formatValue(currentSegment.value)}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 tabular-nums">
                {hoveredItem.value > 0
                  ? `${((currentSegment.value / hoveredItem.value) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
          ) : hoveredItem ? (
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

      {/* ── Área de Desenho das Barras Verticais Altas (com suporte a Scroll) ── */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-x-auto overflow-y-hidden pt-8 pb-1 w-full min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative flex items-end justify-between gap-1.5 sm:gap-3 h-full min-w-full"
          style={{
            width: isScrollable ? `${Math.max(items.length * 56, 700)}px` : '100%',
          }}
        >
          {/* Linha de Média (opcional) */}
          {showAverageLine && averageValue > 0 && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-slate-700/60 pointer-events-none z-0"
              style={{
                bottom: `${(averageValue / maxValue) * 100}%`,
              }}
            >
              <span className="absolute -top-4 right-1 text-[9px] font-semibold text-slate-400 bg-slate-900/90 px-1 rounded border border-slate-800">
                Média: {formatValue(averageValue)}
              </span>
            </div>
          )}

          {items.map((item, index) => {
            const barHeightPct =
              maxValue > 0 ? (item.value / maxValue) * 100 : 0
            const displayHeightPct =
              item.value > 0 ? Math.max(barHeightPct, 4) : 0

            const secondaryHeightPct =
              item.secondaryValue !== undefined && maxValue > 0
                ? (item.secondaryValue / maxValue) * 100
                : 0
            const displaySecondaryHeightPct =
              item.secondaryValue !== undefined && item.secondaryValue > 0
                ? Math.max(secondaryHeightPct, 4)
                : 0

            const isHovered = hoveredIndex === index
            const isSelected = activeId === item.id || item.isActive
            const barColor = item.color || defaultBarColor

            const hasSegments = isStacked && item.segments && item.segments.length > 0
            const hasSecondarySegments =
              isStacked && item.secondarySegments && item.secondarySegments.length > 0

            return (
              <div
                key={item.id}
                onClick={() => onBarClick?.(item)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => {
                  setHoveredIndex(null)
                  setHoveredSegment(null)
                }}
                onTouchStart={() => setHoveredIndex(index)}
                className={`flex-1 flex flex-col items-center h-full min-w-0 relative group transition-all ${
                  isScrollable ? 'min-w-[48px] sm:min-w-[54px]' : ''
                } ${onBarClick || onSegmentClick ? 'cursor-pointer' : ''}`}
              >
                {/* Badge com Valor Total no topo da barra no hover */}
                {isHovered && !hoveredSegment && (
                  <div className="absolute -top-8 z-30 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-100 tabular-nums shadow-2xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    {formatValue(item.value)}
                  </div>
                )}

                {/* Indicador de Variação fixo (se não estiver em hover) */}
                {!isHovered && item.badge && (
                  <div className="absolute -top-6 z-10 hidden sm:block text-[9px] font-bold text-slate-400 tabular-nums">
                    {item.badge}
                  </div>
                )}

                {/* ── Container da Barra (ocupa todo o espaço vertical disponível) ── */}
                <div className="w-full flex-1 min-h-0 flex items-end justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1">
                  {/* ── 1. Barra Principal (Despesas ou Receitas) ──────────────── */}
                  <div
                    className={`w-full max-w-[46px] sm:max-w-[56px] rounded-t-xl transition-all duration-200 relative flex flex-col-reverse justify-start overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-xl shadow-indigo-500/30'
                        : ''
                    }`}
                    style={{
                      height: `${displayHeightPct}%`,
                      backgroundColor: hasSegments ? 'transparent' : barColor,
                      opacity: hoveredIndex === null ? 0.95 : isHovered ? 1 : 0.45,
                      boxShadow: isHovered && !hasSegments ? `0 0 16px ${barColor}66` : 'none',
                    }}
                  >
                    {/* Segmentos de Categorias Empilhados */}
                    {hasSegments ? (
                      item.segments!.map(seg => {
                        const segHeightPct =
                          item.value > 0 ? (seg.value / item.value) * 100 : 0
                        const isSegHovered =
                          hoveredSegment?.itemIndex === index &&
                          hoveredSegment?.segmentId === seg.id &&
                          !hoveredSegment.isSecondary

                        return (
                          <div
                            key={seg.id}
                            onClick={e => {
                              if (onSegmentClick) {
                                e.stopPropagation()
                                onSegmentClick(item, seg)
                              }
                            }}
                            onMouseEnter={e => {
                              e.stopPropagation()
                              setHoveredIndex(index)
                              setHoveredSegment({ itemIndex: index, segmentId: seg.id })
                            }}
                            onMouseLeave={() => setHoveredSegment(null)}
                            className="w-full transition-all duration-150 relative border-b border-slate-900/30 last:border-b-0 cursor-pointer"
                            style={{
                              height: `${segHeightPct}%`,
                              backgroundColor: seg.color,
                              opacity:
                                hoveredSegment === null
                                  ? 1
                                  : isSegHovered
                                  ? 1
                                  : hoveredSegment.itemIndex === index
                                  ? 0.4
                                  : 0.65,
                              boxShadow: isSegHovered
                                ? `inset 0 0 0 2px #ffffff, 0 0 14px ${seg.color}`
                                : 'none',
                            }}
                            title={`${seg.label}: ${formatValue(seg.value)}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                          </div>
                        )
                      })
                    ) : (
                      <div className="absolute inset-0 rounded-t-xl bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                    )}
                  </div>

                  {/* ── 2. Barra Secundária (Comparativo - Receitas) ──────────── */}
                  {item.secondaryValue !== undefined && (
                    <div
                      className="w-full max-w-[46px] sm:max-w-[56px] rounded-t-xl transition-all duration-200 relative flex flex-col-reverse justify-start overflow-hidden"
                      style={{
                        height: `${displaySecondaryHeightPct}%`,
                        backgroundColor: hasSecondarySegments
                          ? 'transparent'
                          : item.secondaryColor || '#10b981',
                        opacity: hoveredIndex === null ? 0.95 : isHovered ? 1 : 0.45,
                        boxShadow:
                          isHovered && !hasSecondarySegments
                            ? `0 0 16px #10b98166`
                            : 'none',
                      }}
                    >
                      {hasSecondarySegments ? (
                        item.secondarySegments!.map(seg => {
                          const segHeightPct =
                            item.secondaryValue! > 0
                              ? (seg.value / item.secondaryValue!) * 100
                              : 0
                          const isSegHovered =
                            hoveredSegment?.itemIndex === index &&
                            hoveredSegment?.segmentId === seg.id &&
                            hoveredSegment.isSecondary

                          return (
                            <div
                              key={seg.id}
                              onClick={e => {
                                if (onSegmentClick) {
                                  e.stopPropagation()
                                  onSegmentClick(item, seg)
                                }
                              }}
                              onMouseEnter={e => {
                                e.stopPropagation()
                                setHoveredIndex(index)
                                setHoveredSegment({
                                  itemIndex: index,
                                  segmentId: seg.id,
                                  isSecondary: true,
                                })
                              }}
                              onMouseLeave={() => setHoveredSegment(null)}
                              className="w-full transition-all duration-150 relative border-b border-slate-900/30 last:border-b-0 cursor-pointer"
                              style={{
                                height: `${segHeightPct}%`,
                                backgroundColor: seg.color,
                                opacity:
                                  hoveredSegment === null
                                    ? 1
                                    : isSegHovered
                                    ? 1
                                    : hoveredSegment.itemIndex === index
                                    ? 0.4
                                    : 0.65,
                                boxShadow: isSegHovered
                                  ? `inset 0 0 0 2px #ffffff, 0 0 14px ${seg.color}`
                                  : 'none',
                              }}
                              title={`${seg.label}: ${formatValue(seg.value)}`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            </div>
                          )
                        })
                      ) : (
                        <div className="absolute inset-0 rounded-t-xl bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                      )}
                    </div>
                  )}
                </div>

                {/* ── Rótulo do Eixo X (Mês) ──────────────────────────────────── */}
                <div className="mt-2.5 text-center w-full flex-shrink-0">
                  <span
                    className={`text-xs block font-semibold truncate transition-colors ${
                      isSelected
                        ? 'text-indigo-400 font-bold'
                        : isHovered
                        ? 'text-slate-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[9px] text-slate-600 block truncate mt-0.5">
                      {item.sublabel}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

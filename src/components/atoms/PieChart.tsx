// src/components/atoms/PieChart.tsx — Gráfico Donut/Pizza em SVG puro de alta precisão com hover e tooltips
import React, { useState, useMemo } from 'react'
import { formatCurrency } from '@/utils/format'

export interface PieSlice {
  id: string
  label: string
  value: number
  color: string
  formattedValue?: string
}

interface PieChartProps {
  data: PieSlice[]
  size?: number
  innerRadiusRatio?: number // 0 = pizza cheia, 0.65 = donut elegante
  centerLabel?: string
  centerValue?: string | number
  centerSublabel?: string
  emptyMessage?: string
}

export default function PieChart({
  data,
  size = 220,
  innerRadiusRatio = 0.65,
  centerLabel,
  centerValue,
  centerSublabel,
  emptyMessage = 'Sem dados para exibir',
}: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0)
  }, [data])

  const validSlices = useMemo(() => {
    return data.filter(d => d.value > 0)
  }, [data])

  const center = size / 2
  const outerRadius = (size / 2) * 0.92
  const innerRadius = outerRadius * innerRadiusRatio

  const paths = useMemo(() => {
    if (total <= 0 || validSlices.length === 0) return []

    let currentAngle = -Math.PI / 2 // Começa no topo (12h)

    return validSlices.map((slice, index) => {
      const angle = (slice.value / total) * 2 * Math.PI
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      const percentage = ((slice.value / total) * 100).toFixed(1)

      // Se for fatia quase completa (360 graus)
      if (validSlices.length === 1 || angle >= 2 * Math.PI - 0.001) {
        const midAngle = startAngle + Math.PI
        const x1 = center + outerRadius * Math.cos(startAngle)
        const y1 = center + outerRadius * Math.sin(startAngle)
        const x2 = center + outerRadius * Math.cos(midAngle)
        const y2 = center + outerRadius * Math.sin(midAngle)
        const x3 = center + innerRadius * Math.cos(midAngle)
        const y3 = center + innerRadius * Math.sin(midAngle)
        const x4 = center + innerRadius * Math.cos(startAngle)
        const y4 = center + innerRadius * Math.sin(startAngle)

        const d1 = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`
        const d2 = `M ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x1} ${y1} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x3} ${y3} Z`

        return {
          id: slice.id,
          label: slice.label,
          value: slice.value,
          color: slice.color,
          percentage,
          paths: [d1, d2],
          index,
        }
      }

      const x1 = center + outerRadius * Math.cos(startAngle)
      const y1 = center + outerRadius * Math.sin(startAngle)
      const x2 = center + outerRadius * Math.cos(endAngle)
      const y2 = center + outerRadius * Math.sin(endAngle)

      const x3 = center + innerRadius * Math.cos(endAngle)
      const y3 = center + innerRadius * Math.sin(endAngle)
      const x4 = center + innerRadius * Math.cos(startAngle)
      const y4 = center + innerRadius * Math.sin(startAngle)

      const largeArc = angle > Math.PI ? 1 : 0

      const d = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`

      return {
        id: slice.id,
        label: slice.label,
        value: slice.value,
        color: slice.color,
        percentage,
        paths: [d],
        index,
      }
    })
  }, [validSlices, total, center, outerRadius, innerRadius])

  const activeSlice = hoveredIndex !== null ? validSlices[hoveredIndex] : null
  const activePercentage =
    hoveredIndex !== null && total > 0 && activeSlice
      ? ((activeSlice.value / total) * 100).toFixed(1)
      : null

  if (total <= 0 || validSlices.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl bg-slate-950/30 border border-dashed border-slate-800/80 p-6 text-center"
        style={{ width: size, height: size }}
      >
        <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-dashed flex items-center justify-center mb-2 text-slate-600 font-bold text-xs">
          0%
        </div>
        <p className="text-xs text-slate-500 font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none drop-shadow-md"
      >
        <g>
          {paths.map((slice) => {
            const isHovered = hoveredIndex === slice.index
            return (
              <g
                key={slice.id}
                className="transition-transform duration-200 ease-out cursor-pointer"
                style={{
                  transformOrigin: `${center}px ${center}px`,
                  transform: isHovered ? 'scale(1.045)' : 'scale(1)',
                }}
                onMouseEnter={() => setHoveredIndex(slice.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onTouchStart={() => setHoveredIndex(slice.index)}
              >
                {slice.paths.map((d, pIdx) => (
                  <path
                    key={pIdx}
                    d={d}
                    fill={slice.color}
                    className="transition-all duration-200"
                    style={{
                      opacity: hoveredIndex === null ? 0.92 : isHovered ? 1 : 0.45,
                      filter: isHovered ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' : 'none',
                    }}
                  />
                ))}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Conteúdo Central do Donut */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4"
        style={{
          width: innerRadius * 1.9,
          height: innerRadius * 1.9,
          margin: 'auto',
        }}
      >
        {activeSlice ? (
          <div className="animate-in fade-in zoom-in-95 duration-150 space-y-0.5 max-w-full">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate block max-w-[120px]">
              {activeSlice.label}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-100 tabular-nums block truncate">
              {formatCurrency(activeSlice.value)}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/90 text-indigo-300 border border-slate-700/60 inline-block">
              {activePercentage}%
            </span>
          </div>
        ) : (
          <div className="space-y-0.5 max-w-full">
            {centerLabel && (
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block truncate">
                {centerLabel}
              </span>
            )}
            <span className="text-sm sm:text-base font-extrabold text-slate-100 tabular-nums block truncate">
              {typeof centerValue === 'number'
                ? formatCurrency(centerValue)
                : centerValue || formatCurrency(total)}
            </span>
            {centerSublabel && (
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {centerSublabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

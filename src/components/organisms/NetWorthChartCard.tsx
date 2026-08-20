import { useState, useMemo } from 'react'
import { subMonths, addMonths, format } from 'date-fns'
import { TrendingUp, Sparkles } from 'lucide-react'
import { useNetWorthHistory } from '@/hooks/useNetWorthHistory'
import type { Granularity, NetWorthPoint } from '@/hooks/useNetWorthHistory'
import { formatCurrency, formatDate } from '@/utils/format'

type RangePreset =
  | 'past_90d'
  | 'past_365d'
  | 'span_6m'
  | 'future_90d'
  | 'future_180d'
  | 'future_365d'
  | 'custom'

export default function NetWorthChartCard() {
  const [preset, setPreset] = useState<RangePreset>('span_6m')
  const [granularity, setGranularity] = useState<Granularity>('weekly')

  const today = useMemo(() => new Date(), [])

  // Presets de datas
  const [customStart, setCustomStart] = useState(() => format(subMonths(today, 3), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(addMonths(today, 3), 'yyyy-MM-dd'))

  const { startDate, endDate } = useMemo(() => {
    if (preset === 'past_90d') return { startDate: subMonths(today, 3), endDate: today }
    if (preset === 'past_365d') return { startDate: subMonths(today, 12), endDate: today }
    if (preset === 'span_6m') return { startDate: subMonths(today, 3), endDate: addMonths(today, 3) }
    if (preset === 'future_90d') return { startDate: today, endDate: addMonths(today, 3) }
    if (preset === 'future_180d') return { startDate: today, endDate: addMonths(today, 6) }
    if (preset === 'future_365d') return { startDate: today, endDate: addMonths(today, 12) }
    return {
      startDate: new Date(customStart + 'T00:00:00'),
      endDate: new Date(customEnd + 'T23:59:59'),
    }
  }, [preset, customStart, customEnd, today])

  const rawPoints = useNetWorthHistory(startDate, endDate, granularity)
  const points = useMemo(() => rawPoints ?? [], [rawPoints])

  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)

  // Estatísticas do período
  const stats = useMemo(() => {
    if (points.length === 0) return { first: 0, last: 0, diff: 0, pct: 0, min: 0, max: 0 }
    const first = points[0].netWorth
    const last = points[points.length - 1].netWorth
    const diff = last - first
    const pct = first !== 0 ? (diff / Math.abs(first)) * 100 : 0
    const values = points.map(p => p.netWorth)
    const min = Math.min(...values)
    const max = Math.max(...values)
    return { first, last, diff, pct, min, max }
  }, [points])

  const activePoint: NetWorthPoint | null =
    activePointIndex !== null && points[activePointIndex]
      ? points[activePointIndex]
      : points.length > 0
      ? points[points.length - 1]
      : null

  // Cálculo das coordenadas SVG
  const svgWidth = 600
  const svgHeight = 220
  const padTop = 20
  const padBottom = 35
  const padLeft = 12
  const padRight = 12

  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom

  const { pathD, areaD, pointCoords, todayCoord } = useMemo(() => {
    if (points.length < 2) {
      return { minVal: 0, maxVal: 0, pathD: '', areaD: '', pointCoords: [], todayCoord: null }
    }

    const values = points.map(p => p.netWorth)
    let min = Math.min(...values)
    let max = Math.max(...values)

    if (min === max) {
      min = min - 100
      max = max + 100
    }

    const range = max - min

    const coords = points.map((p, i) => {
      const x = padLeft + (i / (points.length - 1)) * chartW
      const y = padTop + chartH - ((p.netWorth - min) / range) * chartH
      return { x, y, point: p, index: i }
    })

    const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')

    const firstX = coords[0].x
    const lastX = coords[coords.length - 1].x
    const bottomY = padTop + chartH

    const areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`

    // Encontrar coordenada do ponto mais próximo de hoje se houver pontos futuros e passados
    let todayPt = null
    const hasPast = points.some(p => !p.isFuture)
    const hasFuture = points.some(p => p.isFuture)
    if (hasPast && hasFuture) {
      const lastPastIndex = coords.findLastIndex(c => !c.point.isFuture)
      if (lastPastIndex >= 0) todayPt = coords[lastPastIndex]
    }

    return { minVal: min, maxVal: max, pathD, areaD, pointCoords: coords, todayCoord: todayPt }
  }, [points, chartW, chartH])

  const PRESETS: Array<{ key: RangePreset; label: string; defaultGranularity: Granularity; isProjection?: boolean }> = [
    { key: 'span_6m', label: '±3 meses (Histórico + Projeção)', defaultGranularity: 'weekly' },
    { key: 'future_90d', label: '+3 meses (Projeção)', defaultGranularity: 'weekly', isProjection: true },
    { key: 'future_180d', label: '+6 meses (Projeção)', defaultGranularity: 'monthly', isProjection: true },
    { key: 'future_365d', label: '+1 ano (Projeção)', defaultGranularity: 'monthly', isProjection: true },
    { key: 'past_90d', label: '-3 meses (Histórico)', defaultGranularity: 'weekly' },
    { key: 'past_365d', label: '-1 ano (Histórico)', defaultGranularity: 'monthly' },
    { key: 'custom', label: 'Personalizado', defaultGranularity: 'daily' },
  ]

  return (
    <div className="card space-y-4">

      {/* Título e Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Evolução e Projeção de Patrimônio Líquido
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Histórico realizado e projeção com parcelas e agendamentos futuros</p>
        </div>

        {/* Seletor de Resolução / Granularidade */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 self-start sm:self-auto">
          {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                granularity === g
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {g === 'daily' ? 'Diário' : g === 'weekly' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>
      </div>

      {/* Intervalo de Datas / Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 rounded-xl p-2 border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0 w-full sm:w-auto">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key)
                if (p.key !== 'custom') setGranularity(p.defaultGranularity)
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                preset === p.key
                  ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.isProjection && <Sparkles className="w-3 h-3 text-cyan-400" />}
              {p.label}
            </button>
          ))}
        </div>

        {/* Inputs de Data Personalizada */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">De:</span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Até:</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI de Patrimônio & Variação */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div>
          <p className="text-[10px] text-slate-500">{activePoint?.isFuture ? 'Patrimônio Projetado' : 'Patrimônio Período'}</p>
          <p className="text-base sm:text-lg font-bold text-slate-100 tabular-nums">
            {formatCurrency(stats.last)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Variação Período</p>
          <div className="flex items-center gap-1">
            <span className={`text-xs sm:text-sm font-semibold tabular-nums ${stats.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.diff >= 0 ? '+' : ''}{formatCurrency(stats.diff)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              stats.diff >= 0 ? 'bg-emerald-950/80 text-emerald-400' : 'bg-rose-950/80 text-rose-400'
            }`}>
              {stats.diff >= 0 ? '+' : ''}{stats.pct.toFixed(1)}%
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Valor Máximo</p>
          <p className="text-xs sm:text-sm font-medium text-slate-300 tabular-nums">
            {formatCurrency(stats.max)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Valor Mínimo</p>
          <p className="text-xs sm:text-sm font-medium text-slate-300 tabular-nums">
            {formatCurrency(stats.min)}
          </p>
        </div>
      </div>

      {/* Detalhes do ponto selecionado no gráfico */}
      {activePoint && (
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="text-indigo-300 font-medium">{activePoint.dateLabel} ({formatDate(activePoint.date)})</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
              activePoint.isFuture
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/50'
                : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
            }`}>
              {activePoint.isFuture ? 'Projetado' : 'Realizado'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Patrimônio: <strong className="text-emerald-400 font-semibold tabular-nums">{formatCurrency(activePoint.netWorth)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Gráfico SVG de Patrimônio */}
      <div className="relative w-full overflow-hidden pt-2">
        {points.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-600 text-xs">
            Nenhum dado encontrado para o período selecionado.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas guia horizontais */}
            <line x1={padLeft} y1={padTop} x2={svgWidth - padRight} y2={padTop} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
            <line x1={padLeft} y1={padTop + chartH / 2} x2={svgWidth - padRight} y2={padTop + chartH / 2} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
            <line x1={padLeft} y1={padTop + chartH} x2={svgWidth - padRight} y2={padTop + chartH} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />

            {/* Marcador vertical de "Hoje" se o intervalo englobar passado e futuro */}
            {todayCoord && (
              <g>
                <line
                  x1={todayCoord.x}
                  y1={padTop}
                  x2={todayCoord.x}
                  y2={padTop + chartH}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
                <text
                  x={todayCoord.x}
                  y={padTop - 5}
                  textAnchor="middle"
                  className="text-[9px] fill-cyan-400 font-mono font-semibold"
                >
                  Hoje
                </text>
              </g>
            )}

            {/* Gradiente sob a linha */}
            {areaD && <path d={areaD} fill="url(#netWorthGrad)" />}

            {/* Linha do gráfico */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Pontos clicáveis / com hover */}
            {pointCoords.map((pt, i) => {
              const isSelected = activePointIndex === i || (activePointIndex === null && i === pointCoords.length - 1)
              const isFut = pt.point.isFuture

              return (
                <g key={i} className="cursor-pointer" onClick={() => setActivePointIndex(i)}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 4}
                    className={`transition-all duration-150 ${
                      isSelected
                        ? isFut
                          ? 'fill-cyan-400 stroke-slate-950 stroke-2'
                          : 'fill-indigo-400 stroke-slate-950 stroke-2'
                        : isFut
                        ? 'fill-cyan-500 hover:fill-cyan-300'
                        : 'fill-indigo-600 hover:fill-indigo-400'
                    }`}
                  />
                  {/* Rótulos no eixo X para pontos chave */}
                  {(i === 0 || i === pointCoords.length - 1 || i === Math.floor(pointCoords.length / 2)) && (
                    <text
                      x={pt.x}
                      y={svgHeight - 8}
                      textAnchor={i === 0 ? 'start' : i === pointCoords.length - 1 ? 'end' : 'middle'}
                      className={`text-[10px] font-sans ${isFut ? 'fill-cyan-400/80 font-medium' : 'fill-slate-500'}`}
                    >
                      {pt.point.dateLabel}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

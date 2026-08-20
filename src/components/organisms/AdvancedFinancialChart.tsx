// src/components/organisms/AdvancedFinancialChart.tsx — Gráfico Financeiro Avançado Estilo Plataforma de Corretora
import { useState, useMemo, useRef } from 'react'
import {
  subMonths,
  subDays,
  startOfYear,
  format,
  isBefore,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart2,
  LineChart,
} from 'lucide-react'
import { useNetWorthHistory, type Granularity, type NetWorthPoint } from '@/hooks/useNetWorthHistory'
import { useTransactionsQuery } from '@/hooks/queries'
import { isDateBeforeAccountingStart, getAccountingStartDate } from '@/utils/accountingPeriod'
import { formatCurrency, formatDate } from '@/utils/format'

type RangePreset = '1m' | '3m' | '6m' | '1y' | 'ytd' | 'all' | 'custom'
type ViewMode = 'area' | 'assets_liabilities' | 'monthly_flow'

export default function AdvancedFinancialChart() {
  const [preset, setPreset] = useState<RangePreset>('6m')
  const [granularity, setGranularity] = useState<Granularity>('weekly')
  const [viewMode, setViewMode] = useState<ViewMode>('area')
  const [showSMA, setShowSMA] = useState(true)
  const [showExtremes, setShowExtremes] = useState(true)
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])

  // Presets de datas
  const [customStart, setCustomStart] = useState(() => format(subMonths(today, 6), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(today, 'yyyy-MM-dd'))
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const { startDate, endDate } = useMemo(() => {
    if (preset === '1m') return { startDate: subDays(today, 30), endDate: today }
    if (preset === '3m') return { startDate: subMonths(today, 3), endDate: today }
    if (preset === '6m') return { startDate: subMonths(today, 6), endDate: today }
    if (preset === '1y') return { startDate: subMonths(today, 12), endDate: today }
    if (preset === 'ytd') return { startDate: startOfYear(today), endDate: today }
    if (preset === 'all') {
      const accStart = getAccountingStartDate()
      const start = accStart ? new Date(accStart) : subMonths(today, 36)
      return { startDate: start, endDate: today }
    }
    return {
      startDate: new Date(customStart + 'T00:00:00'),
      endDate: new Date(customEnd + 'T23:59:59'),
    }
  }, [preset, customStart, customEnd, today])

  // Dados de histórico patrimonial
  const rawPoints = useNetWorthHistory(startDate, endDate, granularity)
  const points = useMemo(() => rawPoints ?? [], [rawPoints])

  // Transações brutas para cálculo de fluxo (Inflow vs Outflow)
  const { data: allTransactions = [] } = useTransactionsQuery()

  // Fluxo mensal agregado
  const monthlyFlowData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; net: number; date: Date }>()

    for (const tx of allTransactions) {
      if (isDateBeforeAccountingStart(tx.date)) continue
      const txDate = new Date(tx.date)
      if (isBefore(txDate, startDate) || isBefore(endDate, txDate)) continue

      const mKey = format(txDate, 'yyyy-MM')
      const current = map.get(mKey) || { income: 0, expense: 0, net: 0, date: txDate }

      if (tx.type === 'income') current.income += tx.amount
      else if (tx.type === 'expense') current.expense += tx.amount

      current.net = current.income - current.expense
      map.set(mKey, current)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mKey, val]) => ({
        monthKey: mKey,
        label: format(new Date(mKey + '-01T12:00:00'), 'MMM/yy', { locale: ptBR }),
        ...val,
      }))
  }, [allTransactions, startDate, endDate])

  // Cálculo da Média Móvel Simples (SMA)
  const smaPoints = useMemo(() => {
    if (points.length === 0) return []
    const period = granularity === 'daily' ? 7 : granularity === 'weekly' ? 4 : 3
    const sma: number[] = []

    for (let i = 0; i < points.length; i++) {
      if (i < period - 1) {
        const sub = points.slice(0, i + 1)
        const avg = sub.reduce((s, p) => s + p.netWorth, 0) / sub.length
        sma.push(avg)
      } else {
        const sub = points.slice(i - period + 1, i + 1)
        const avg = sub.reduce((s, p) => s + p.netWorth, 0) / period
        sma.push(avg)
      }
    }
    return sma
  }, [points, granularity])

  // Estatísticas principais da faixa selecionada
  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        current: 0,
        start: 0,
        diff: 0,
        pct: 0,
        min: 0,
        max: 0,
        avg: 0,
        currentSMA: 0,
      }
    }
    const start = points[0].netWorth
    const current = points[points.length - 1].netWorth
    const diff = current - start
    const pct = start !== 0 ? (diff / Math.abs(start)) * 100 : 0
    const values = points.map(p => p.netWorth)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    const currentSMA = smaPoints.length > 0 ? smaPoints[smaPoints.length - 1] : current

    return { current, start, diff, pct, min, max, avg, currentSMA }
  }, [points, smaPoints])

  // Ponto ativo sob inspeção (ou último ponto por padrão)
  const activePoint: NetWorthPoint | null =
    activePointIndex !== null && points[activePointIndex]
      ? points[activePointIndex]
      : points.length > 0
      ? points[points.length - 1]
      : null

  const activeSMA =
    activePointIndex !== null && smaPoints[activePointIndex] !== undefined
      ? smaPoints[activePointIndex]
      : stats.currentSMA

  // ── Geometria e Escalas SVG ────────────────────────────────────────────────
  const svgWidth = 800
  const svgHeight = 280
  const padTop = 25
  const padBottom = 35
  const padLeft = 60
  const padRight = 20

  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom

  const chartScale = useMemo(() => {
    if (points.length < 2) {
      return {
        minVal: 0,
        maxVal: 0,
        range: 1,
        pointCoords: [],
        assetCoords: [],
        liabilityCoords: [],
        smaCoords: [],
        pathD: '',
        areaD: '',
        assetsAreaD: '',
        liabilitiesAreaD: '',
        smaPathD: '',
        yTicks: [],
        zeroY: 0,
      }
    }

    const netValues = points.map(p => p.netWorth)
    const assetValues = points.map(p => p.assets)
    const liabilityValues = points.map(p => p.liabilities)

    let minVal = Math.min(...netValues, ...liabilityValues.map(v => -v))
    let maxVal = Math.max(...netValues, ...assetValues)

    if (minVal === maxVal) {
      minVal -= 1000
      maxVal += 1000
    }

    // Adiciona margem de respiro de 8% no topo e base
    const rawRange = maxVal - minVal
    minVal -= rawRange * 0.08
    maxVal += rawRange * 0.08
    const range = maxVal - minVal

    const getY = (val: number) => padTop + chartH - ((val - minVal) / range) * chartH
    const getX = (index: number) => padLeft + (index / (points.length - 1)) * chartW

    const pointCoords = points.map((p, i) => ({
      x: getX(i),
      y: getY(p.netWorth),
      point: p,
      index: i,
    }))

    const assetCoords = points.map((p, i) => ({
      x: getX(i),
      y: getY(p.assets),
    }))

    const liabilityCoords = points.map((p, i) => ({
      x: getX(i),
      y: getY(p.liabilities),
    }))

    const smaCoords = smaPoints.map((val, i) => ({
      x: getX(i),
      y: getY(val),
    }))

    // Path de Área do Patrimônio Líquido
    const pathD = pointCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    const zeroY = getY(0)
    const clampedZeroY = Math.max(padTop, Math.min(padTop + chartH, zeroY))
    const firstX = pointCoords[0].x
    const lastX = pointCoords[pointCoords.length - 1].x
    const areaD = `${pathD} L ${lastX} ${clampedZeroY} L ${firstX} ${clampedZeroY} Z`

    // Paths para modo Ativos vs Passivos
    const assetsPathD = assetCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    const assetsAreaD = `${assetsPathD} L ${lastX} ${clampedZeroY} L ${firstX} ${clampedZeroY} Z`

    const liabilitiesPathD = liabilityCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    const liabilitiesAreaD = `${liabilitiesPathD} L ${lastX} ${clampedZeroY} L ${firstX} ${clampedZeroY} Z`

    // Path da Média Móvel
    const smaPathD = smaCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')

    // Ticks do eixo Y (4 linhas)
    const yTicks = [0, 0.33, 0.66, 1].map(ratio => {
      const val = minVal + ratio * range
      const y = getY(val)
      return { val, y }
    })

    return {
      minVal,
      maxVal,
      range,
      pointCoords,
      assetCoords,
      liabilityCoords,
      smaCoords,
      pathD,
      areaD,
      assetsAreaD,
      liabilitiesAreaD,
      smaPathD,
      yTicks,
      zeroY,
    }
  }, [points, smaPoints, chartW, chartH, padTop, padLeft])

  // Manipulador de movimento do mouse para o Crosshair HUD
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || chartScale.pointCoords.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth

    // Encontra o ponto mais próximo
    let closestIdx = 0
    let minDiff = Infinity

    chartScale.pointCoords.forEach((pt, i) => {
      const diff = Math.abs(pt.x - mouseX)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = i
      }
    })

    setActivePointIndex(closestIdx)
  }

  const handleMouseLeave = () => {
    setActivePointIndex(null)
  }

  const isPositive = stats.diff >= 0

  return (
    <div className="card p-4 sm:p-6 bg-slate-900 border border-slate-800 space-y-4">
      
      {/* ── 1. Ticker Bar Superior (Estilo Terminal / Corretora) ─────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        
        {/* Bloco Principal de Cotação / Patrimônio */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Patrimônio Líquido
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              LIVE
            </span>
            {activePoint && (
              <span className="text-[11px] font-mono text-slate-500">
                · {formatDate(activePoint.date)}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tabular-nums tracking-tight">
              {formatCurrency(activePoint ? activePoint.netWorth : stats.current)}
            </h2>

            <div
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border tabular-nums ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {isPositive ? '+' : ''}
                {formatCurrency(stats.diff)} ({isPositive ? '+' : ''}{stats.pct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Métricas Rápidas (ATH, ATL, SMA, Médias) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left sm:text-right bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="px-2">
            <p className="text-[10px] uppercase font-semibold text-slate-500">Máxima (ATH)</p>
            <p className="text-xs font-bold text-emerald-400 tabular-nums">{formatCurrency(stats.max)}</p>
          </div>
          <div className="px-2">
            <p className="text-[10px] uppercase font-semibold text-slate-500">Mínima (ATL)</p>
            <p className="text-xs font-bold text-rose-400 tabular-nums">{formatCurrency(stats.min)}</p>
          </div>
          <div className="px-2">
            <p className="text-[10px] uppercase font-semibold text-slate-500">Média Móvel</p>
            <p className="text-xs font-bold text-amber-400 tabular-nums">{formatCurrency(activeSMA)}</p>
          </div>
          <div className="px-2">
            <p className="text-[10px] uppercase font-semibold text-slate-500">Média Geral</p>
            <p className="text-xs font-bold text-slate-300 tabular-nums">{formatCurrency(stats.avg)}</p>
          </div>
        </div>
      </div>

      {/* ── 2. Toolbar: Modos de Exibição, Timeframes e Overlays ────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        
        {/* Modos de Visão (Área, Ativos/Passivos, Fluxo) */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('area')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'area'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Patrimônio Líquido Contínuo"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Patrimônio</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('assets_liabilities')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'assets_liabilities'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ativos vs Passivos"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ativos / Dívidas</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('monthly_flow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'monthly_flow'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fluxo de Caixa Mensal (Receitas vs Despesas)"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Fluxo Mensal</span>
          </button>
        </div>

        {/* Controles de Timeframe e Indicadores */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Toggles de Indicadores */}
          {viewMode !== 'monthly_flow' && (
            <div className="flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => setShowSMA(!showSMA)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  showSMA
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950/40 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
                title="Média Móvel Simples"
              >
                SMA
              </button>

              <button
                type="button"
                onClick={() => setShowExtremes(!showExtremes)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  showExtremes
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                    : 'bg-slate-950/40 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
                title="Linhas de Máxima e Mínima"
              >
                MÁX/MÍN
              </button>
            </div>
          )}

          {/* Presets Rápidos de Período (1M, 3M, 6M, 1A, YTD, MAX, Custom) */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
            {(['1m', '3m', '6m', '1y', 'ytd', 'all', 'custom'] as RangePreset[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPreset(p)
                  if (p === 'custom') setShowCustomPicker(true)
                  else setShowCustomPicker(false)
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                  preset === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === '1m'
                  ? '1M'
                  : p === '3m'
                  ? '3M'
                  : p === '6m'
                  ? '6M'
                  : p === '1y'
                  ? '1A'
                  : p === 'ytd'
                  ? 'YTD'
                  : p === 'all'
                  ? 'Tudo'
                  : 'Data'}
              </button>
            ))}
          </div>

          {/* Granularidade (Diário/Semanal/Mensal) */}
          {viewMode !== 'monthly_flow' && (
            <select
              value={granularity}
              onChange={e => setGranularity(e.target.value as Granularity)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          )}
        </div>
      </div>

      {/* Seletor de Datas Personalizadas quando preset 'custom' está ativo */}
      {preset === 'custom' && showCustomPicker && (
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">De:</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Até:</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      )}

      {/* ── 3. Canvas SVG Interativo com Crosshair HUD ──────────────────────── */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        
        {viewMode === 'monthly_flow' ? (
          /* Modo Fluxo Mensal: Barras Comparativas Inflow vs Outflow */
          <div className="space-y-4 pt-2">
            {monthlyFlowData.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
                <BarChart2 className="w-10 h-10 text-slate-700 mb-2" />
                <p>Nenhuma movimentação registrada no período selecionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthlyFlowData.map(item => {
                  const maxVal = Math.max(
                    ...monthlyFlowData.map(d => Math.max(d.income, d.expense))
                  )
                  const incPct = maxVal > 0 ? (item.income / maxVal) * 100 : 0
                  const expPct = maxVal > 0 ? (item.expense / maxVal) * 100 : 0

                  return (
                    <div key={item.monthKey} className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 capitalize">{item.label}</span>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="text-emerald-400 font-semibold">+{formatCurrency(item.income)}</span>
                          <span className="text-rose-400 font-semibold">-{formatCurrency(item.expense)}</span>
                          <span
                            className={`font-bold ${
                              item.net >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            Líquido: {formatCurrency(item.net)}
                          </span>
                        </div>
                      </div>

                      {/* Barras duplas comparativas */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden flex justify-end">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${incPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-rose-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${expPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Modo Área / Linha com SVG de Alta Precisão */
          <div className="relative">
            {points.length < 2 ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Activity className="w-10 h-10 text-slate-700 mb-2 animate-pulse" />
                <p>Carregando dados históricos do período...</p>
              </div>
            ) : (
              <div className="relative">
                
                {/* HUD de Ponto Flutuante Ativo */}
                {activePoint && (
                  <div className="absolute top-2 left-16 z-10 flex items-center gap-3 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs shadow-xl animate-in fade-in duration-100">
                    <span className="font-bold text-slate-300">{formatDate(activePoint.date)}</span>
                    <span className="text-slate-600">|</span>
                    <span className="font-extrabold text-indigo-400 tabular-nums">
                      {formatCurrency(activePoint.netWorth)}
                    </span>
                    {viewMode === 'assets_liabilities' && (
                      <>
                        <span className="text-emerald-400 font-semibold tabular-nums">
                          Ativos: {formatCurrency(activePoint.assets)}
                        </span>
                        <span className="text-rose-400 font-semibold tabular-nums">
                          Dívidas: {formatCurrency(activePoint.liabilities)}
                        </span>
                      </>
                    )}
                    {showSMA && activeSMA && (
                      <span className="text-amber-400 font-semibold tabular-nums">
                        SMA: {formatCurrency(activeSMA)}
                      </span>
                    )}
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto overflow-visible cursor-crosshair"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <defs>
                    {/* Gradiente do Patrimônio Líquido */}
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                      <stop offset="60%" stopColor="#6366f1" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>

                    {/* Gradiente de Ativos */}
                    <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>

                    {/* Gradiente de Passivos */}
                    <linearGradient id="liabilitiesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines Horizontais e Eixo Y */}
                  {chartScale.yTicks.map((tick, idx) => (
                    <g key={idx}>
                      <line
                        x1={padLeft}
                        y1={tick.y}
                        x2={svgWidth - padRight}
                        y2={tick.y}
                        stroke="rgba(255, 255, 255, 0.06)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padLeft - 8}
                        y={tick.y + 3}
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                        className="font-mono"
                      >
                        {formatCurrency(tick.val)}
                      </text>
                    </g>
                  ))}

                  {/* Linha Zero (se estiver dentro do range) */}
                  {chartScale.zeroY >= padTop && chartScale.zeroY <= padTop + chartH && (
                    <line
                      x1={padLeft}
                      y1={chartScale.zeroY}
                      x2={svgWidth - padRight}
                      y2={chartScale.zeroY}
                      stroke="#475569"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Renderização do Modo de Visualização */}
                  {viewMode === 'area' ? (
                    <>
                      {/* Área Preenchida com Gradiente */}
                      <path d={chartScale.areaD} fill="url(#netWorthGrad)" />

                      {/* Curva Principal de Patrimônio Líquido */}
                      <path
                        d={chartScale.pathD}
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="filter drop-shadow-[0_4px_12px_rgba(99,102,241,0.5)]"
                      />
                    </>
                  ) : (
                    <>
                      {/* Ativos (Verde) */}
                      <path d={chartScale.assetsAreaD} fill="url(#assetsGrad)" />
                      <path
                        d={chartScale.assetsAreaD}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Dívidas / Passivos (Vermelho) */}
                      <path d={chartScale.liabilitiesAreaD} fill="url(#liabilitiesGrad)" />
                      <path
                        d={chartScale.liabilitiesAreaD}
                        fill="none"
                        stroke="#fb7185"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* Overlay da Média Móvel (SMA) */}
                  {showSMA && chartScale.smaPathD && (
                    <path
                      d={chartScale.smaPathD}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.75"
                      strokeDasharray="4 3"
                      opacity="0.85"
                    />
                  )}

                  {/* Overlays de Linhas de Máxima e Mínima */}
                  {showExtremes && points.length > 0 && (
                    <>
                      {/* Linha de ATH (Máxima) */}
                      <g>
                        {(() => {
                          const maxCoord = chartScale.pointCoords.find(pt => pt.point.netWorth === stats.max)
                          if (!maxCoord) return null
                          return (
                            <>
                              <line
                                x1={padLeft}
                                y1={maxCoord.y}
                                x2={svgWidth - padRight}
                                y2={maxCoord.y}
                                stroke="#10b981"
                                strokeWidth="1"
                                strokeDasharray="2 4"
                                opacity="0.6"
                              />
                              <text
                                x={svgWidth - padRight}
                                y={maxCoord.y - 4}
                                fill="#34d399"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="end"
                              >
                                MÁX {formatCurrency(stats.max)}
                              </text>
                            </>
                          )
                        })()}
                      </g>

                      {/* Linha de ATL (Mínima) */}
                      <g>
                        {(() => {
                          const minCoord = chartScale.pointCoords.find(pt => pt.point.netWorth === stats.min)
                          if (!minCoord) return null
                          return (
                            <>
                              <line
                                x1={padLeft}
                                y1={minCoord.y}
                                x2={svgWidth - padRight}
                                y2={minCoord.y}
                                stroke="#f43f5e"
                                strokeWidth="1"
                                strokeDasharray="2 4"
                                opacity="0.6"
                              />
                              <text
                                x={svgWidth - padRight}
                                y={minCoord.y + 11}
                                fill="#fb7185"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="end"
                              >
                                MÍN {formatCurrency(stats.min)}
                              </text>
                            </>
                          )
                        })()}
                      </g>
                    </>
                  )}

                  {/* Eixo X com Labels de Datas */}
                  {chartScale.pointCoords
                    .filter((_, idx) => {
                      const total = chartScale.pointCoords.length
                      if (total <= 6) return true
                      const step = Math.ceil(total / 6)
                      return idx % step === 0 || idx === total - 1
                    })
                    .map((pt, i) => (
                      <text
                        key={i}
                        x={pt.x}
                        y={svgHeight - 12}
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                        className="font-mono"
                      >
                        {pt.point.dateLabel}
                      </text>
                    ))}

                  {/* Crosshair (Mira) Interativo */}
                  {activePointIndex !== null && chartScale.pointCoords[activePointIndex] && (
                    <g className="transition-all duration-75">
                      {/* Linha Vertical da Mira */}
                      <line
                        x1={chartScale.pointCoords[activePointIndex].x}
                        y1={padTop}
                        x2={chartScale.pointCoords[activePointIndex].x}
                        y2={padTop + chartH}
                        stroke="#a5b4fc"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />

                      {/* Linha Horizontal da Mira */}
                      <line
                        x1={padLeft}
                        y1={chartScale.pointCoords[activePointIndex].y}
                        x2={svgWidth - padRight}
                        y2={chartScale.pointCoords[activePointIndex].y}
                        stroke="#a5b4fc"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        opacity="0.5"
                      />

                      {/* Ponto de Destaque Pulsante */}
                      <circle
                        cx={chartScale.pointCoords[activePointIndex].x}
                        cy={chartScale.pointCoords[activePointIndex].y}
                        r="6"
                        fill="#6366f1"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="animate-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                      />
                    </g>
                  )}
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

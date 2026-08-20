// src/components/organisms/AdvancedFinancialChart.tsx — Gráfico Financeiro Avançado com Otimização Mobile de Alta Precisão
import { useState, useMemo, useRef, useCallback } from 'react'
import {
  subMonths,
  subDays,
  addMonths,
  startOfYear,
  endOfYear,
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
  Filter,
  Sparkles,
} from 'lucide-react'
import { useNetWorthHistory, type Granularity, type NetWorthPoint } from '@/hooks/useNetWorthHistory'
import { useTransactionsQuery, useAccountsQuery, useDebtAccountsQuery, useDebtItemsQuery } from '@/hooks/queries'
import { getAccountingStartDate } from '@/utils/accountingPeriod'
import { formatCurrency, formatDate } from '@/utils/format'

type RangePreset =
  | '1m'
  | '3m'
  | '6m'
  | '1y'
  | 'proj_3m'
  | 'proj_6m'
  | 'ytd'
  | 'all'
  | 'custom'

type ViewMode = 'area' | 'assets_liabilities' | 'monthly_flow'

export type ChartScopeType =
  | 'all'
  | 'macro_on_budget'
  | 'macro_off_budget'
  | 'type_checking'
  | 'type_credit_card'
  | 'type_debt_receivable'
  | 'type_debt_payable'
  | 'account'

/** Formata valores do Eixo Y de forma compacta para não espremer telas mobile */
function formatCompactValue(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (Math.abs(val) >= 10_000) {
    return `R$ ${(val / 1_000).toFixed(0)}k`
  }
  if (Math.abs(val) >= 1_000) {
    return `R$ ${(val / 1_000).toFixed(1).replace('.0', '').replace('.', ',')}k`
  }
  return formatCurrency(val)
}

export default function AdvancedFinancialChart() {
  const [preset, setPreset] = useState<RangePreset>('6m')
  const [granularity, setGranularity] = useState<Granularity>('weekly')
  const [viewMode, setViewMode] = useState<ViewMode>('area')
  const [showSMA, setShowSMA] = useState(true)
  const [showExtremes, setShowExtremes] = useState(true)
  const [includeFuture, setIncludeFuture] = useState(false)
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)

  // Escopo de visualização (Geral, Macros, Tipos ou Conta Específica)
  const [scopeType, setScopeType] = useState<ChartScopeType>('all')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  const containerRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])

  // Transações e dados do banco
  const { data: allTransactions = [] } = useTransactionsQuery()
  const { data: accounts = [] } = useAccountsQuery()
  const { data: debtAccounts = [] } = useDebtAccountsQuery()
  const { data: debtItems = [] } = useDebtItemsQuery()

  const activeAccounts = useMemo(() => accounts.filter(a => a.isActive !== false), [accounts])
  const activeDebtAccounts = useMemo(() => debtAccounts.filter(d => d.isActive !== false), [debtAccounts])

  // Data máxima futura encontrada nas parcelas/transações cadastradas
  const maxFutureDate = useMemo(() => {
    let max = addMonths(today, 6)
    for (const tx of allTransactions) {
      const d = new Date(tx.date)
      if (d > max) max = d
    }
    for (const item of debtItems) {
      if (item.dueDate) {
        const d = new Date(item.dueDate)
        if (d > max) max = d
      }
    }
    return max
  }, [allTransactions, debtItems, today])

  // Presets de datas
  const [customStart, setCustomStart] = useState(() => format(subMonths(today, 6), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(addMonths(today, 6), 'yyyy-MM-dd'))
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const { startDate, endDate } = useMemo(() => {
    // Projeções puramente futuras
    if (preset === 'proj_3m') return { startDate: today, endDate: addMonths(today, 3) }
    if (preset === 'proj_6m') return { startDate: today, endDate: addMonths(today, 6) }

    // Presets históricos (com ou sem extensão futura ativada)
    const futureExtension = includeFuture ? addMonths(today, 6) : today

    if (preset === '1m') return { startDate: subDays(today, 30), endDate: futureExtension }
    if (preset === '3m') return { startDate: subMonths(today, 3), endDate: futureExtension }
    if (preset === '6m') return { startDate: subMonths(today, 6), endDate: futureExtension }
    if (preset === '1y') return { startDate: subMonths(today, 12), endDate: futureExtension }
    if (preset === 'ytd') return { startDate: startOfYear(today), endDate: includeFuture ? endOfYear(today) : today }
    if (preset === 'all') {
      const accStart = getAccountingStartDate()
      const start = accStart ? new Date(accStart) : subMonths(today, 36)
      return { startDate: start, endDate: maxFutureDate }
    }
    return {
      startDate: new Date(customStart + 'T00:00:00'),
      endDate: new Date(customEnd + 'T23:59:59'),
    }
  }, [preset, customStart, customEnd, today, includeFuture, maxFutureDate])

  // Dados de histórico patrimonial multi-conta
  const rawPoints = useNetWorthHistory(startDate, endDate, granularity)
  const points = useMemo(() => rawPoints ?? [], [rawPoints])

  // Informações da conta selecionada (caso scopeType === 'account')
  const selectedAccount = useMemo(() => {
    if (scopeType !== 'account' || !selectedAccountId) return null
    const regular = activeAccounts.find(a => a.id === selectedAccountId)
    if (regular) return { id: regular.id!, name: regular.name, color: regular.color || '#6366f1', type: regular.type }
    const debt = activeDebtAccounts.find(d => d.id === selectedAccountId)
    if (debt) return { id: debt.id!, name: debt.name, color: debt.color || '#10b981', type: 'debt' }
    return null
  }, [scopeType, selectedAccountId, activeAccounts, activeDebtAccounts])

  // Configurações de exibição e cores do escopo atual
  const scopeConfig = useMemo(() => {
    if (scopeType === 'account' && selectedAccount) {
      return {
        label: selectedAccount.name,
        badge: selectedAccount.type === 'credit_card' ? 'Cartão' : selectedAccount.type === 'checking' ? 'Corrente' : selectedAccount.type === 'debt' ? 'Cobrança' : 'Conta',
        color: selectedAccount.color,
      }
    }
    if (scopeType === 'macro_on_budget') {
      return { label: 'Dentro do Orçamento', badge: 'Macro', color: '#6366f1' }
    }
    if (scopeType === 'macro_off_budget') {
      return { label: 'Fora do Orçamento', badge: 'Macro', color: '#06b6d4' }
    }
    if (scopeType === 'type_checking') {
      return { label: 'Contas Correntes', badge: 'Tipo', color: '#3b82f6' }
    }
    if (scopeType === 'type_credit_card') {
      return { label: 'Faturas de Cartão', badge: 'Tipo', color: '#f43f5e' }
    }
    if (scopeType === 'type_debt_receivable') {
      return { label: 'Contas a Receber', badge: 'Tipo', color: '#10b981' }
    }
    if (scopeType === 'type_debt_payable') {
      return { label: 'Contas a Pagar', badge: 'Tipo', color: '#f59e0b' }
    }
    return { label: 'Patrimônio Líquido', badge: 'Geral', color: '#818cf8' }
  }, [scopeType, selectedAccount])

  // Função para extrair o valor contábil de cada ponto conforme o escopo selecionado
  const getPointValue = useCallback((p: NetWorthPoint): number => {
    if (scopeType === 'macro_on_budget') return p.onBudgetTotal
    if (scopeType === 'macro_off_budget') return p.offBudgetTotal
    if (scopeType === 'type_checking') return p.checkingTotal
    if (scopeType === 'type_credit_card') return p.creditCardTotal
    if (scopeType === 'type_debt_receivable') return p.debtReceivableTotal
    if (scopeType === 'type_debt_payable') return -p.debtPayableTotal
    if (scopeType === 'account' && selectedAccountId) {
      return p.accounts[selectedAccountId] ?? 0
    }
    return p.netWorth
  }, [scopeType, selectedAccountId])

  // Fluxo mensal agregado filtrado pelo escopo
  const monthlyFlowData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; net: number; date: Date }>()

    for (const tx of allTransactions) {
      const txDate = new Date(tx.date)
      if (isBefore(txDate, startDate) || isBefore(endDate, txDate)) continue

      // Se filtrou por conta específica
      if (scopeType === 'account' && selectedAccountId && tx.accountId !== selectedAccountId && tx.transferAccountId !== selectedAccountId) {
        continue
      }

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
  }, [allTransactions, startDate, endDate, scopeType, selectedAccountId])

  // Cálculo da Média Móvel Simples (SMA) no escopo ativo
  const smaPoints = useMemo(() => {
    if (points.length === 0) return []
    const period = granularity === 'daily' ? 7 : granularity === 'weekly' ? 4 : 3
    const sma: number[] = []

    for (let i = 0; i < points.length; i++) {
      if (i < period - 1) {
        const sub = points.slice(0, i + 1)
        const avg = sub.reduce((s, p) => s + getPointValue(p), 0) / sub.length
        sma.push(avg)
      } else {
        const sub = points.slice(i - period + 1, i + 1)
        const avg = sub.reduce((s, p) => s + getPointValue(p), 0) / period
        sma.push(avg)
      }
    }
    return sma
  }, [points, granularity, getPointValue])

  // Estatísticas principais no escopo ativo
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
    const start = getPointValue(points[0])
    const current = getPointValue(points[points.length - 1])
    const diff = current - start
    const pct = start !== 0 ? (diff / Math.abs(start)) * 100 : 0
    const values = points.map(p => getPointValue(p))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    const currentSMA = smaPoints.length > 0 ? smaPoints[smaPoints.length - 1] : current

    return { current, start, diff, pct, min, max, avg, currentSMA }
  }, [points, smaPoints, getPointValue])

  // Ponto ativo sob inspeção
  const activePoint: NetWorthPoint | null =
    activePointIndex !== null && points[activePointIndex]
      ? points[activePointIndex]
      : points.length > 0
      ? points[points.length - 1]
      : null

  const activePointVal = activePoint ? getPointValue(activePoint) : stats.current

  const activeSMA =
    activePointIndex !== null && smaPoints[activePointIndex] !== undefined
      ? smaPoints[activePointIndex]
      : stats.currentSMA

  // ── Geometria e Escalas SVG Adaptativas ─────────────────────────────────────
  const svgWidth = 800
  const svgHeight = 310
  const padTop = 30
  const padBottom = 35
  const padLeft = 52
  const padRight = 16

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
        todayIndex: -1,
      }
    }

    const currentScopeValues = points.map(p => getPointValue(p))
    const assetValues = points.map(p => p.assets)
    const liabilityValues = points.map(p => p.liabilities)

    let minVal = viewMode === 'assets_liabilities'
      ? Math.min(...currentScopeValues, ...liabilityValues.map(v => -v))
      : Math.min(...currentScopeValues)

    let maxVal = viewMode === 'assets_liabilities'
      ? Math.max(...currentScopeValues, ...assetValues)
      : Math.max(...currentScopeValues)

    if (minVal === maxVal) {
      minVal -= 1000
      maxVal += 1000
    }

    // Margem de respiro de 8% no topo e base
    const rawRange = maxVal - minVal
    minVal -= rawRange * 0.08
    maxVal += rawRange * 0.08
    const range = maxVal - minVal

    const getY = (val: number) => padTop + chartH - ((val - minVal) / range) * chartH
    const getX = (index: number) => padLeft + (index / (points.length - 1)) * chartW

    const pointCoords = points.map((p, i) => ({
      x: getX(i),
      y: getY(getPointValue(p)),
      value: getPointValue(p),
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

    // Índice do ponto mais próximo de hoje (para linha divisória HOJE)
    const todayIndex = points.findIndex(p => p.isFuture)

    // Path de Área do Patrimônio Líquido / Escopo
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
      todayIndex,
    }
  }, [points, smaPoints, chartW, chartH, padTop, padLeft, viewMode, getPointValue])

  // Manipulador de movimento do mouse e toque para o Crosshair HUD
  const handleInspectCoord = useCallback((clientX: number, target: SVGSVGElement) => {
    if (chartScale.pointCoords.length === 0) return
    const rect = target.getBoundingClientRect()
    const coordX = ((clientX - rect.left) / rect.width) * svgWidth

    let closestIdx = 0
    let minDiff = Infinity

    chartScale.pointCoords.forEach((pt, i) => {
      const diff = Math.abs(pt.x - coordX)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = i
      }
    })

    setActivePointIndex(closestIdx)
  }, [chartScale.pointCoords, svgWidth])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    handleInspectCoord(e.clientX, e.currentTarget)
  }

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      handleInspectCoord(e.touches[0].clientX, e.currentTarget)
    }
  }

  const handleMouseLeave = () => {
    setActivePointIndex(null)
  }

  const isPositive = stats.diff >= 0

  return (
    <div className="card !p-3 sm:!p-6 bg-slate-900 border border-slate-800 space-y-3 sm:space-y-4 overflow-hidden">
      
      {/* ── 1. Ticker Bar Superior (Responsivo Mobile-First) ───────────────── */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-800">
        
        {/* Bloco Principal de Cotação */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: scopeConfig.color, boxShadow: `0 0 8px ${scopeConfig.color}66` }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate max-w-[170px] sm:max-w-none">
                {scopeConfig.label}
              </span>
              <span
                className="px-1.5 py-0.2 text-[10px] font-bold rounded-md border"
                style={{
                  backgroundColor: `${scopeConfig.color}20`,
                  borderColor: `${scopeConfig.color}40`,
                  color: scopeConfig.color,
                }}
              >
                {scopeConfig.badge}
              </span>
              {activePoint && (
                <span className="text-[11px] font-mono text-slate-400">
                  · {formatDate(activePoint.date)}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tabular-nums tracking-tight">
                {formatCurrency(activePointVal)}
              </h2>

              <div
                className={`flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg border tabular-nums ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>
                  {isPositive ? '+' : ''}
                  {formatCurrency(stats.diff)} ({isPositive ? '+' : ''}{stats.pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Rápidas (Scroll Horizontal no Mobile para economizar altura) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
          <div className="px-1.5 py-0.5">
            <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500">Máxima</p>
            <p className="text-xs font-bold text-emerald-400 tabular-nums truncate">{formatCurrency(stats.max)}</p>
          </div>
          <div className="px-1.5 py-0.5">
            <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500">Mínima</p>
            <p className="text-xs font-bold text-rose-400 tabular-nums truncate">{formatCurrency(stats.min)}</p>
          </div>
          <div className="px-1.5 py-0.5">
            <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500">Média Móvel</p>
            <p className="text-xs font-bold text-amber-400 tabular-nums truncate">{formatCurrency(activeSMA)}</p>
          </div>
          <div className="px-1.5 py-0.5">
            <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500">Média Geral</p>
            <p className="text-xs font-bold text-slate-300 tabular-nums truncate">{formatCurrency(stats.avg)}</p>
          </div>
        </div>
      </div>

      {/* ── 2. Seletor de Escopo / Conta e Segmentos ────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 sm:p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
        
        {/* Pílulas de Escopo com Scroll Suave no Mobile */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 select-none scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setScopeType('all')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌐 Geral
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('macro_on_budget')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'macro_on_budget'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🏦 No Orçamento
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('macro_off_budget')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'macro_off_budget'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💼 Fora Orçamento
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('type_checking')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'type_checking'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💰 Corrente
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('type_credit_card')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'type_credit_card'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💳 Cartões
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('type_debt_receivable')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'type_debt_receivable'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📥 A Receber
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeType('type_debt_payable')
              setSelectedAccountId('')
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              scopeType === 'type_debt_payable'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📤 A Pagar
          </button>
        </div>

        {/* Dropdown de Conta Individual */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 hidden sm:inline" />
          <select
            value={scopeType === 'account' ? selectedAccountId : ''}
            onChange={e => {
              const val = e.target.value
              if (!val) {
                setScopeType('all')
                setSelectedAccountId('')
              } else {
                setScopeType('account')
                setSelectedAccountId(val)
              }
            }}
            className="w-full sm:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="">🎯 Filtrar por conta...</option>
            
            <optgroup label="Contas Bancárias & Cartões">
              {activeAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'credit_card' ? '💳' : acc.type === 'checking' ? '🏦' : '💼'} {acc.name}
                </option>
              ))}
            </optgroup>

            {activeDebtAccounts.length > 0 && (
              <optgroup label="Cobranças & Dívidas">
                {activeDebtAccounts.map(d => (
                  <option key={d.id} value={d.id}>
                    📄 {d.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

      </div>

      {/* ── 3. Toolbar Compacta: Modos, Timeframes e Overlays ───────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-0.5">
        
        {/* Modos de Visão */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('area')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'area'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Evolução Contínua"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Curva</span>
          </button>

          {scopeType === 'all' && (
            <button
              type="button"
              onClick={() => setViewMode('assets_liabilities')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'assets_liabilities'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ativos vs Passivos"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ativos/Dívidas</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewMode('monthly_flow')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'monthly_flow'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fluxo Mensal"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Fluxo</span>
          </button>
        </div>

        {/* Timeframes e Indicadores */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 select-none scrollbar-none">
          
          {/* Toggle de Projeção Futura */}
          <button
            type="button"
            onClick={() => setIncludeFuture(!includeFuture)}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold border transition-all whitespace-nowrap ${
              includeFuture
                ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/50 shadow-sm'
                : 'bg-slate-950/40 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Incluir projeção futura"
          >
            <Sparkles className="w-3 h-3" />
            <span>+Futuro</span>
          </button>

          {/* Toggles de Indicadores */}
          {viewMode !== 'monthly_flow' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSMA(!showSMA)}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  showSMA
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950/40 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
                title="Média Móvel Simples"
              >
                SMA
              </button>

              <button
                type="button"
                onClick={() => setShowExtremes(!showExtremes)}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  showExtremes
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-950/40 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
                title="Máxima e Mínima"
              >
                MÁX
              </button>
            </div>
          )}

          {/* Presets de Período */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
            {([
              { id: '1m', label: '1M' },
              { id: '3m', label: '3M' },
              { id: '6m', label: '6M' },
              { id: '1y', label: '1A' },
              { id: 'proj_3m', label: '+3M' },
              { id: 'proj_6m', label: '+6M' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all', label: 'Tudo' },
              { id: 'custom', label: 'Data' },
            ] as const).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id)
                  if (p.id === 'custom') setShowCustomPicker(true)
                  else setShowCustomPicker(false)
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase transition-all whitespace-nowrap ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : p.id.startsWith('proj_')
                    ? 'text-indigo-400/80 hover:text-indigo-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Granularidade */}
          {viewMode !== 'monthly_flow' && (
            <select
              value={granularity}
              onChange={e => setGranularity(e.target.value as Granularity)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="daily">D</option>
              <option value="weekly">S</option>
              <option value="monthly">M</option>
            </select>
          )}
        </div>
      </div>

      {/* Seletor de Datas Personalizadas quando preset 'custom' está ativo */}
      {preset === 'custom' && showCustomPicker && (
        <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-2 flex-wrap animate-in fade-in duration-150 text-xs">
          <div className="flex items-center gap-1.5">
            <label className="text-slate-400 font-medium">De:</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 font-mono text-[11px]"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-slate-400 font-medium">Até:</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 font-mono text-[11px]"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      )}

      {/* ── 4. Canvas SVG com Touch Tracking Otimizado e Crosshair HUD ─────── */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        
        {viewMode === 'monthly_flow' ? (
          /* Modo Fluxo Mensal */
          <div className="space-y-3 pt-2">
            {monthlyFlowData.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-xs">
                <BarChart2 className="w-8 h-8 text-slate-700 mb-2" />
                <p>Nenhuma movimentação registrada no período</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {monthlyFlowData.map(item => {
                  const maxVal = Math.max(
                    ...monthlyFlowData.map(d => Math.max(d.income, d.expense))
                  )
                  const incPct = maxVal > 0 ? (item.income / maxVal) * 100 : 0
                  const expPct = maxVal > 0 ? (item.expense / maxVal) * 100 : 0

                  return (
                    <div key={item.monthKey} className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] sm:text-xs">
                        <span className="font-bold text-slate-200 capitalize">{item.label}</span>
                        <div className="flex items-center gap-2.5 tabular-nums">
                          <span className="text-emerald-400 font-semibold">+{formatCurrency(item.income)}</span>
                          <span className="text-rose-400 font-semibold">-{formatCurrency(item.expense)}</span>
                          <span
                            className={`font-bold ${
                              item.net >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            Líq: {formatCurrency(item.net)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden flex justify-end">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${incPct}%` }}
                          />
                        </div>
                        <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${expPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Modo Área / Linha SVG com Suporte Touch Total */
          <div className="relative">
            {rawPoints === undefined ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Activity className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                <p>Carregando dados...</p>
              </div>
            ) : points.length < 2 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Activity className="w-8 h-8 text-slate-700 mb-2" />
                <p>Nenhuma movimentação registrada para o período selecionado</p>
              </div>
            ) : (
              <div className="relative">
                
                {/* HUD de Ponto Ativo (Ancorado no Topo de Forma Limpa) */}
                {activePoint && (
                  <div className="flex items-center gap-2 bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] sm:text-xs shadow-xl animate-in fade-in duration-100 flex-wrap justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{formatDate(activePoint.date)}</span>
                      {activePoint.isFuture && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                          PROJEÇÃO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold tabular-nums" style={{ color: scopeConfig.color }}>
                        {formatCurrency(activePointVal)}
                      </span>
                      {viewMode === 'assets_liabilities' && (
                        <>
                          <span className="text-emerald-400 font-semibold tabular-nums hidden sm:inline">
                            Ativos: {formatCurrency(activePoint.assets)}
                          </span>
                          <span className="text-rose-400 font-semibold tabular-nums hidden sm:inline">
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
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto overflow-visible cursor-crosshair touch-none select-none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchMove}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseLeave}
                >
                  <defs>
                    {/* Gradiente Dinâmico baseado no Escopo / Conta */}
                    <linearGradient id="scopeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={scopeConfig.color} stopOpacity="0.45" />
                      <stop offset="60%" stopColor={scopeConfig.color} stopOpacity="0.1" />
                      <stop offset="100%" stopColor={scopeConfig.color} stopOpacity="0.0" />
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

                  {/* Grid Lines Horizontais e Eixo Y com Formatação Compacta */}
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
                        x={padLeft - 6}
                        y={tick.y + 3.5}
                        fill="#64748b"
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="end"
                        className="font-mono"
                      >
                        {formatCompactValue(tick.val)}
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

                  {/* Divisória "HOJE / INÍCIO DA PROJEÇÃO" se houver pontos futuros */}
                  {chartScale.todayIndex > 0 && chartScale.todayIndex < chartScale.pointCoords.length && (
                    <g>
                      <line
                        x1={chartScale.pointCoords[chartScale.todayIndex].x}
                        y1={padTop}
                        x2={chartScale.pointCoords[chartScale.todayIndex].x}
                        y2={padTop + chartH}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        opacity="0.65"
                      />
                      <rect
                        x={chartScale.pointCoords[chartScale.todayIndex].x - 16}
                        y={padTop - 12}
                        width="32"
                        height="12"
                        rx="3"
                        fill="#4f46e5"
                        opacity="0.95"
                      />
                      <text
                        x={chartScale.pointCoords[chartScale.todayIndex].x}
                        y={padTop - 3}
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        HOJE
                      </text>
                    </g>
                  )}

                  {/* Renderização do Modo de Visualização */}
                  {viewMode === 'area' ? (
                    <>
                      {/* Área Preenchida com Gradiente */}
                      <path d={chartScale.areaD} fill="url(#scopeGrad)" />

                      {/* Curva Principal Dinâmica */}
                      <path
                        d={chartScale.pathD}
                        fill="none"
                        stroke={scopeConfig.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          filter: `drop-shadow(0 4px 12px ${scopeConfig.color}66)`,
                        }}
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
                          const maxCoord = chartScale.pointCoords.find(pt => pt.value === stats.max)
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
                                MÁX {formatCompactValue(stats.max)}
                              </text>
                            </>
                          )
                        })()}
                      </g>

                      {/* Linha de ATL (Mínima) */}
                      <g>
                        {(() => {
                          const minCoord = chartScale.pointCoords.find(pt => pt.value === stats.min)
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
                                MÍN {formatCompactValue(stats.min)}
                              </text>
                            </>
                          )
                        })()}
                      </g>
                    </>
                  )}

                  {/* Eixo X com Labels de Datas Adaptativos */}
                  {chartScale.pointCoords
                    .filter((_, idx) => {
                      const total = chartScale.pointCoords.length
                      if (total <= 5) return true
                      const step = Math.ceil(total / 5)
                      return idx % step === 0 || idx === total - 1
                    })
                    .map((pt, i) => (
                      <text
                        key={i}
                        x={pt.x}
                        y={svgHeight - 10}
                        fill={pt.point.isFuture ? '#818cf8' : '#64748b'}
                        fontSize="9.5"
                        fontWeight={pt.point.isFuture ? 'bold' : '600'}
                        textAnchor="middle"
                        className="font-mono"
                      >
                        {pt.point.dateLabel}
                      </text>
                    ))}

                  {/* Crosshair (Mira) Interativo para Mouse e Touch */}
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

                      {/* Ponto de Destaque Pulsante com Cor do Escopo */}
                      <circle
                        cx={chartScale.pointCoords[activePointIndex].x}
                        cy={chartScale.pointCoords[activePointIndex].y}
                        r="6"
                        fill={scopeConfig.color}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="animate-pulse"
                        style={{
                          filter: `drop-shadow(0 0 8px ${scopeConfig.color})`,
                        }}
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

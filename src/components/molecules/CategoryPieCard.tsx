// src/components/molecules/CategoryPieCard.tsx — Card de Pizza com lista de categorias e filtros check/uncheck
import { useState, useMemo, useEffect } from 'react'
import { CheckSquare, Square, Search, PieChart as PieIcon, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import PieChart, { type PieSlice } from '@/components/atoms/PieChart'
import { formatCurrency } from '@/utils/format'

export interface CategoryPieItem {
  id: string
  name: string
  amount: number
  groupName?: string
  color?: string
}

interface CategoryPieCardProps {
  title: string
  type: 'expense' | 'income'
  items: CategoryPieItem[]
  monthLabel?: string
}

// Paletas harmoniosas e contrastantes para despesas e receitas
const EXPENSE_PALETTE = [
  '#f43f5e', // rose
  '#f97316', // orange
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#d946ef', // fuchsia
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#fb7185', // rose-light
  '#a855f7', // violet
]

const INCOME_PALETTE = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#22c55e', // green
  '#6366f1', // indigo
  '#eab308', // yellow
  '#f59e0b', // amber
  '#0ea5e9', // sky
]

export default function CategoryPieCard({
  title,
  type,
  items,
  monthLabel,
}: CategoryPieCardProps) {
  const isExpense = type === 'expense'
  const defaultPalette = isExpense ? EXPENSE_PALETTE : INCOME_PALETTE

  // Ordena por maior valor primeiro
  const sortedItems = useMemo(() => {
    return [...items]
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [items])

  // Atribui cor estável para cada categoria
  const coloredItems = useMemo(() => {
    return sortedItems.map((item, index) => ({
      ...item,
      color: item.color || defaultPalette[index % defaultPalette.length],
    }))
  }, [sortedItems, defaultPalette])

  // Estado de categorias selecionadas (por padrão todas ativas)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(sortedItems.map(i => i.id))
  })

  const [search, setSearch] = useState('')

  // Atualiza a seleção caso a lista de itens mude (ex: troca de mês)
  useEffect(() => {
    setSelectedIds(new Set(sortedItems.map(i => i.id)))
    setSearch('')
  }, [sortedItems])

  const toggleCategory = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(coloredItems.map(i => i.id)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  // Itens ativos de acordo com os checkboxes
  const activeItems = useMemo(() => {
    return coloredItems.filter(item => selectedIds.has(item.id))
  }, [coloredItems, selectedIds])

  // Total ativo calculado
  const activeTotal = useMemo(() => {
    return activeItems.reduce((sum, item) => sum + item.amount, 0)
  }, [activeItems])

  // Total geral sem filtro de checkbox
  const rawTotal = useMemo(() => {
    return coloredItems.reduce((sum, item) => sum + item.amount, 0)
  }, [coloredItems])

  // Dados formatados para o componente PieChart
  const pieData: PieSlice[] = useMemo(() => {
    return activeItems.map(item => ({
      id: item.id,
      label: item.name,
      value: item.amount,
      color: item.color,
    }))
  }, [activeItems])

  // Filtragem para a listagem com busca
  const displayItems = useMemo(() => {
    if (!search.trim()) return coloredItems
    const q = search.toLowerCase()
    return coloredItems.filter(
      i => i.name.toLowerCase().includes(q) || (i.groupName && i.groupName.toLowerCase().includes(q))
    )
  }, [coloredItems, search])

  const allSelected = coloredItems.length > 0 && selectedIds.size === coloredItems.length
  const noneSelected = selectedIds.size === 0

  return (
    <div className="card p-4 sm:p-5 bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between h-full">
      
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border flex-shrink-0 ${
              isExpense
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {isExpense ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
            {monthLabel && <p className="text-[11px] text-slate-500 truncate">{monthLabel}</p>}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
            {noneSelected ? 'Filtrado' : 'Total Filtrado'}
          </span>
          <span
            className={`text-sm sm:text-base font-extrabold tabular-nums ${
              isExpense ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formatCurrency(activeTotal)}
          </span>
        </div>
      </div>

      {coloredItems.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
          <PieIcon className="w-10 h-10 text-slate-700 stroke-[1.5]" />
          <p className="text-xs font-medium text-slate-400">
            Nenhuma {isExpense ? 'despesa' : 'receita'} registrada neste mês
          </p>
          <p className="text-[11px] text-slate-600">
            Lance transações no orçamento ou no extrato para visualizar a distribuição.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Gráfico Donut Central */}
          <div className="flex justify-center py-2">
            <PieChart
              data={pieData}
              size={210}
              innerRadiusRatio={0.64}
              centerLabel={isExpense ? 'Despesas' : 'Receitas'}
              centerValue={activeTotal}
              centerSublabel={`${activeItems.length} de ${coloredItems.length} ativas`}
              emptyMessage="Marque ao menos uma categoria abaixo"
            />
          </div>

          {/* Barra de Ações Rápidas (Marcar/Desmarcar todas) & Busca */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={allSelected}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
                  title="Marcar todas as categorias"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Marcar todas</span>
                </button>

                <span className="text-slate-700">·</span>

                <button
                  type="button"
                  onClick={handleDeselectAll}
                  disabled={noneSelected}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-300 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
                  title="Desmarcar todas as categorias"
                >
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                  <span>Desmarcar todas</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500 tabular-nums">
                {activeItems.length}/{coloredItems.length} ativas
              </span>
            </div>

            {/* Input de filtro/busca se houver mais de 5 categorias */}
            {coloredItems.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar categorias..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Lista com Checkboxes Interativos */}
          <div className="space-y-1.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1 select-none">
            {displayItems.map(item => {
              const isChecked = selectedIds.has(item.id)
              const pct = activeTotal > 0 && isChecked
                ? ((item.amount / activeTotal) * 100).toFixed(1)
                : rawTotal > 0
                ? ((item.amount / rawTotal) * 100).toFixed(1)
                : '0.0'

              return (
                <div
                  key={item.id}
                  onClick={() => toggleCategory(item.id)}
                  className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-slate-950/40 hover:bg-slate-800/40 border-slate-800/80 text-slate-200'
                      : 'bg-slate-950/10 hover:bg-slate-900/30 border-transparent text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Checkbox customizado */}
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isChecked && <CheckSquare className="w-3.5 h-3.5" />}
                    </button>

                    {/* Indicador de cor da fatia */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: isChecked ? `0 0 8px ${item.color}55` : 'none',
                      }}
                    />

                    {/* Nome e Grupo */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate leading-tight">
                        {item.name}
                      </p>
                      {item.groupName && (
                        <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                          {item.groupName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Valor e Porcentagem */}
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className="text-xs font-semibold tabular-nums block text-slate-200">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 tabular-nums block">
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}

// src/components/organisms/ReportHiddenCategoriesModal.tsx — Modal para gerenciar visibilidade de categorias nos relatórios
import { useState, useMemo } from 'react'
import { Eye, EyeOff, Search, RotateCcw, Filter, AlertCircle } from 'lucide-react'
import Modal from '@/components/atoms/Modal'
import { useFinancialData } from '@/context/FinancialDataContext'
import { isInitialSetupCategory } from '@/utils/format'

interface ReportHiddenCategoriesModalProps {
  isOpen: boolean
  hiddenCategoryIds: Set<string>
  onToggleCategory: (categoryId: string) => void
  onHideMultiple: (categoryIds: string[]) => void
  onShowMultiple: (categoryIds: string[]) => void
  onResetAll: () => void
  onClose: () => void
}

export default function ReportHiddenCategoriesModal({
  isOpen,
  hiddenCategoryIds,
  onToggleCategory,
  onHideMultiple,
  onShowMultiple,
  onResetAll,
  onClose,
}: ReportHiddenCategoriesModalProps) {
  const { categories = [], categoryGroups = [] } = useFinancialData()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all')

  const expenseGroups = useMemo(() => {
    return categoryGroups.filter(
      g => g.type !== 'income' && g.name !== 'Faturas Atuais' && g.name !== 'Faturas de Cartão'
    )
  }, [categoryGroups])

  const incomeGroups = useMemo(() => {
    return categoryGroups.filter(g => g.type === 'income')
  }, [categoryGroups])

  // Todas as categorias relevantes com seus respectivos grupos
  const structuredList = useMemo(() => {
    const list: Array<{
      id: string
      name: string
      groupName: string
      type: 'expense' | 'income'
      isHiddenInReports: boolean
    }> = []

    // 1. Despesas estruturadas
    for (const group of expenseGroups) {
      if (isInitialSetupCategory(undefined, group.name)) continue
      const groupCats = categories.filter(
        c => c.groupId === group.id && !isInitialSetupCategory(c.name, group.name)
      )
      for (const cat of groupCats) {
        if (!cat.id) continue
        list.push({
          id: cat.id,
          name: cat.name,
          groupName: group.name,
          type: 'expense',
          isHiddenInReports: hiddenCategoryIds.has(cat.id),
        })
      }
    }

    // 2. Sem Categoria Despesa
    list.push({
      id: 'uncategorized_expense',
      name: 'Sem Categoria (Despesas)',
      groupName: 'Diversos',
      type: 'expense',
      isHiddenInReports: hiddenCategoryIds.has('uncategorized_expense'),
    })

    // 3. Receitas estruturadas
    for (const group of incomeGroups) {
      const groupCats = categories.filter(c => c.groupId === group.id)
      for (const cat of groupCats) {
        if (!cat.id) continue
        list.push({
          id: cat.id,
          name: cat.name,
          groupName: group.name,
          type: 'income',
          isHiddenInReports: hiddenCategoryIds.has(cat.id),
        })
      }
    }

    // 4. Sem Categoria Receita
    list.push({
      id: 'uncategorized_income',
      name: 'Sem Categoria (Receitas)',
      groupName: 'Diversos',
      type: 'income',
      isHiddenInReports: hiddenCategoryIds.has('uncategorized_income'),
    })

    return list
  }, [categories, expenseGroups, incomeGroups, hiddenCategoryIds])

  // Filtragem com busca e abas
  const filteredList = useMemo(() => {
    return structuredList.filter(item => {
      if (activeTab === 'expense' && item.type !== 'expense') return false
      if (activeTab === 'income' && item.type !== 'income') return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return item.name.toLowerCase().includes(q) || item.groupName.toLowerCase().includes(q)
    })
  }, [structuredList, activeTab, search])

  const hiddenCount = useMemo(() => {
    return structuredList.filter(item => item.isHiddenInReports).length
  }, [structuredList])

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-slate-100 text-base sm:text-lg">
            Categorias dos Relatórios
          </span>
          {hiddenCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50">
              {hiddenCount} {hiddenCount === 1 ? 'oculta' : 'ocultas'}
            </span>
          )}
        </div>
      }
      description="Escolha quais categorias devem entrar nos relatórios, gráficos de barras e estatísticas."
    >
      <div className="flex flex-col h-full space-y-4 p-4 sm:p-5">
        {/* Banner Informativo */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
          <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p>
            Categorias marcadas como <strong className="text-rose-300">Ocultas</strong> não serão
            somadas nos totais de receitas/despesas, nos gráficos de barras temporais ou nas pizzas.
          </p>
        </div>

        {/* Barra de Busca e Filtros de Aba */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Todas ({structuredList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('expense')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'expense'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-900/50 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Despesas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('income')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'income'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-900/50 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Receitas
              </button>
            </div>

            {/* Ações Globais */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onShowMultiple(filteredList.map(i => i.id))}
                className="btn-secondary py-1.5 px-2.5 text-[11px] font-semibold flex items-center gap-1"
                title="Exibir todas as categorias filtradas"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exibir Todas</span>
              </button>

              <button
                type="button"
                onClick={() => onHideMultiple(filteredList.map(i => i.id))}
                className="btn-secondary py-1.5 px-2.5 text-[11px] font-semibold flex items-center gap-1"
                title="Ocultar todas as categorias filtradas"
              >
                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Ocultar Todas</span>
              </button>

              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={onResetAll}
                  className="btn-secondary py-1.5 px-2.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  title="Restaurar visibilidade padrão de todas as categorias"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>
              )}
            </div>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar categoria ou grupo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Lista de Categorias com Toggle */}
        <div className="flex-1 overflow-y-auto max-h-80 sm:max-h-96 divide-y divide-slate-800/40 pr-1 space-y-1">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <p>Nenhuma categoria encontrada para o filtro atual.</p>
            </div>
          ) : (
            filteredList.map(item => {
              const isHidden = item.isHiddenInReports

              return (
                <div
                  key={item.id}
                  onClick={() => onToggleCategory(item.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isHidden
                      ? 'bg-rose-950/10 hover:bg-rose-950/20 border-rose-900/30 text-slate-400'
                      : 'bg-slate-950/40 hover:bg-slate-800/40 border-slate-800/70 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`p-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                        isHidden
                          ? 'bg-rose-950/80 border-rose-800/60 text-rose-400'
                          : 'bg-emerald-950/80 border-emerald-800/60 text-emerald-400'
                      }`}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isHidden ? 'line-through text-slate-500' : 'text-slate-100'
                          }`}
                        >
                          {item.name}
                        </p>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                            item.type === 'income'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.groupName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isHidden
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                          : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                      }`}
                    >
                      {isHidden ? 'Oculta' : 'Visível'}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}

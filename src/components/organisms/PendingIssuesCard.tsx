// src/components/organisms/PendingIssuesCard.tsx — Card/Banner de Inconsistências e Pendências
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, Tag, Pencil } from 'lucide-react'
import { usePendingIssues } from '@/hooks/usePendingIssues'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { updateTransaction } from '@/services/api/transactions'
import { formatCurrency } from '@/utils/format'
import type { PendingIssue } from '@/types'

export default function PendingIssuesCard() {
  const navigate = useNavigate()
  const issues = usePendingIssues() ?? []
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const { categories, groups } = useCategoriesWithGroups() ?? { categories: [], groups: [] }

  if (issues.length === 0) return null

  const totalCount = issues.reduce((acc, curr) => acc + curr.count, 0)
  const activeIssue = selectedIssueId
    ? issues.find(i => i.id === selectedIssueId) ?? issues[0]
    : issues[0]

  const handleAssignCategory = async (txId: string, categoryId: string) => {
    if (!categoryId) return
    await updateTransaction(txId, { categoryId })
  }

  const handleItemClick = (issue: PendingIssue, itemId: string) => {
    if (issue.ruleId === 'uncategorized_transactions') {
      navigate(`/transactions?edit=${itemId}`)
    } else if (issue.ruleId === 'overdue_scheduled') {
      navigate('/scheduled')
    } else if (issue.ruleId === 'overspent_categories') {
      navigate('/')
    }
  }

  const groupedCategories = groups?.map(g => ({
    group: g,
    cats: categories?.filter(c => c.groupId === g.id && !c.isHidden) ?? [],
  })).filter(g => g.cats.length > 0) ?? []

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md overflow-hidden transition-all shadow-lg shadow-amber-950/10">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-amber-950/30 active:bg-amber-950/40 transition-colors"
        onClick={() => setIsExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-amber-200 truncate">
                {totalCount} {totalCount === 1 ? 'pendência para resolver' : 'pendências para resolver'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Atenção
              </span>
            </div>
            <p className="text-[11px] text-amber-300/70 truncate hidden sm:block">
              {issues.map(i => i.title).join(' • ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1.5 rounded-lg text-amber-400/80 hover:text-amber-200 hover:bg-amber-900/30 transition-colors flex-shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-amber-500/20 p-4 space-y-4 bg-slate-950/60">
          {/* Tabs por tipo de pendência */}
          {issues.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {issues.map(issue => (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-all ${
                    activeIssue.id === issue.id
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {issue.title}
                </button>
              ))}
            </div>
          )}

          {/* Conteúdo da pendência selecionada */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">{activeIssue.description}</p>

            {/* Lista de itens a corrigir */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeIssue.items?.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(activeIssue, item.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-colors text-xs cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 group-hover:text-amber-200 transition-colors truncate">
                        {item.title}
                      </span>
                      {item.amount !== undefined && (
                        <span className={`font-mono font-medium ${
                          item.type === 'income' ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {formatCurrency(item.amount)}
                        </span>
                      )}
                    </div>
                    {item.subtitle && <span className="text-[11px] text-slate-500">{item.subtitle}</span>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-2 sm:mt-0" onClick={e => e.stopPropagation()}>
                    {/* Resolução rápida para transações sem categoria */}
                    {activeIssue.ruleId === 'uncategorized_transactions' && groupedCategories.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-amber-400/80 flex-shrink-0" />
                        <select
                          onChange={e => handleAssignCategory(item.id, e.target.value)}
                          defaultValue=""
                          style={{ colorScheme: 'dark' }}
                          className="w-full sm:w-48 px-2.5 py-1 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700/80 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm"
                        >
                          <option value="" disabled className="text-slate-400 bg-slate-800">
                            Atribuir categoria…
                          </option>
                          {groupedCategories.map(({ group, cats }) => (
                            <optgroup
                              key={group.id}
                              label={group.name}
                              className="bg-slate-900 text-amber-300 font-semibold text-xs py-1"
                            >
                              {cats.map(c => (
                                <option
                                  key={c.id}
                                  value={c.id}
                                  className="bg-slate-800 text-slate-100 py-1 font-normal"
                                >
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Botão de edição / navegação */}
                    {activeIssue.ruleId === 'uncategorized_transactions' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/transactions?edit=${item.id}`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                        title="Abrir e editar transação"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

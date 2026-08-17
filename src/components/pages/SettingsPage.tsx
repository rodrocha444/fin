import { useState, useRef } from 'react'
import { Plus, Eye, EyeOff, Pencil, Trash2, ChevronDown, ChevronRight, Download, Upload, Database, CheckCircle2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import {
  createGroup, updateGroup, deleteGroup, toggleGroupVisibility,
  createCategory, updateCategory, deleteCategory, toggleCategoryVisibility,
} from '@/db/repositories/categories'
import { downloadDatabaseBackup, importDatabase, type DatabaseBackup } from '@/db/repositories/backup'
import ResetDatabaseModal from '@/components/organisms/ResetDatabaseModal'
import Logo from '@/components/atoms/Logo'

export default function SettingsPage() {
  const groups = useLiveQuery(() => db.categoryGroups.orderBy('sortOrder').toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [])

  const [groupTypeTab, setGroupTypeTab] = useState<'expense' | 'income'>('expense')
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newCatGroupId, setNewCatGroupId] = useState<number | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleGroup = (id: number) =>
    setExpandedGroups(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const count = groups?.length ?? 0
      await createGroup({
        name: newGroupName.trim(),
        type: groupTypeTab,
        sortOrder: count,
        isHidden: false,
        isSystem: false,
      })
      setNewGroupName('')
    } catch (e: any) {
      alert(e.message || 'Erro ao criar grupo.')
    }
  }

  const handleAddCategory = async (groupId: number) => {
    if (!newCatName.trim()) return
    try {
      const count = categories?.filter(c => c.groupId === groupId).length ?? 0
      await createCategory({ groupId, name: newCatName.trim(), sortOrder: count, isHidden: false })
      setNewCatName('')
      setNewCatGroupId(null)
    } catch (e: any) {
      alert(e.message || 'Erro ao criar categoria.')
    }
  }

  const handleDeleteGroup = async (id: number) => {
    try {
      if (!confirm('Excluir grupo?')) return
      await deleteGroup(id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      if (!confirm('Excluir categoria?')) return
      await deleteCategory(id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setBackupStatus(null)
      await downloadDatabaseBackup()
      setBackupStatus({ type: 'success', message: 'Backup exportado com sucesso!' })
    } catch (e: any) {
      setBackupStatus({ type: 'error', message: e?.message || 'Erro ao exportar dados.' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (!confirm('Atenção: A importação irá substituir e restaurar os dados das tabelas correspondentes. Deseja continuar?')) {
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setBackupStatus(null)
      const text = await file.text()
      const backupData = JSON.parse(text) as DatabaseBackup

      const result = await importDatabase(backupData)
      setBackupStatus({
        type: 'success',
        message: `Importação concluída! ${result.totalRecords} registros restaurados em ${result.importedTables.length} tabelas.`,
      })
    } catch (err: any) {
      setBackupStatus({ type: 'error', message: err?.message || 'Falha ao importar backup.' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const filteredGroups = groups?.filter(g =>
    groupTypeTab === 'income' ? g.type === 'income' : g.type !== 'income'
  )

  return (
    <div className="fade-in">

      {/* Header */}
      <div
        className="px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <h1 className="text-lg sm:text-xl font-semibold text-slate-100">Configurações</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Grupos e categorias de orçamento</p>
      </div>

      <div className="p-3 sm:p-6 space-y-4 max-w-2xl">

        {/* Seletor de Tipo (Despesas vs Rendas) */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setGroupTypeTab('expense')}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              groupTypeTab === 'expense'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Categorias de Despesas
          </button>
          <button
            onClick={() => setGroupTypeTab('income')}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              groupTypeTab === 'income'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Categorias de Receitas / Renda
          </button>
        </div>

        {/* Adicionar grupo */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">
            Novo grupo de {groupTypeTab === 'income' ? 'Receitas' : 'Despesas'}
          </h2>
          <div className="flex gap-2">
            <input
              className="input-base flex-1"
              placeholder={`Nome do grupo de ${groupTypeTab === 'income' ? 'receita' : 'despesa'}…`}
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            />
            <button onClick={handleAddGroup} className="btn-primary flex items-center gap-1.5 flex-shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Criar</span>
            </button>
          </div>
        </div>

        {/* Grupos */}
        <div className="space-y-2">
          {filteredGroups?.map(group => {
            const cats = categories?.filter(c => c.groupId === group.id) ?? []
            const isExpanded = expandedGroups.has(group.id!)

            return (
              <div key={group.id} className="card space-y-0 !p-0 overflow-hidden">
                {/* Cabeçalho do grupo */}
                <div className="flex items-center gap-2 p-3 sm:p-4">
                  <button
                    onClick={() => toggleGroup(group.id!)}
                    className="flex-shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {editingGroupId === group.id ? (
                    <input
                      autoFocus
                      className="input-base flex-1 h-8 text-sm py-1"
                      defaultValue={group.name}
                      onBlur={async e => {
                        const val = e.target.value.trim()
                        if (val && group.id && val !== group.name) {
                          try {
                            await updateGroup(group.id, { name: val })
                          } catch (err: any) {
                            alert(err.message || 'Erro ao renomear grupo.')
                          }
                        }
                        setEditingGroupId(null)
                      }}
                      onKeyDown={async e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditingGroupId(null)
                      }}
                    />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-slate-200 truncate">
                      {group.name}
                      {group.isSystem && (
                        <span className="ml-2 badge bg-slate-700 text-slate-500 text-[10px]">sistema</span>
                      )}
                    </span>
                  )}

                  <span className="text-xs text-slate-600 flex-shrink-0">{cats.length}</span>

                  {/* Ações — sempre visíveis no mobile */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => toggleGroupVisibility(group.id!)}
                      className="p-2 rounded-lg text-slate-600 hover:text-slate-300 active:bg-slate-700 transition-colors"
                    >
                      {group.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {!group.isSystem && (
                      <>
                        <button
                          onClick={() => setEditingGroupId(group.id!)}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-300 active:bg-slate-700 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id!)}
                          className="p-2 rounded-lg text-slate-600 hover:text-rose-400 active:bg-rose-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Categorias */}
                {isExpanded && (
                  <div className="border-t border-slate-800/50">
                    {cats.map((cat, idx) => (
                      <div
                        key={cat.id}
                        className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 ${idx < cats.length - 1 ? 'border-b border-slate-800/30' : ''}`}
                      >
                        <div className="w-1 flex-shrink-0" />

                        {editingCategoryId === cat.id ? (
                          <input
                            autoFocus
                            className="input-base flex-1 h-8 text-sm py-1"
                            defaultValue={cat.name}
                            onBlur={async e => {
                              const val = e.target.value.trim()
                              if (val && cat.id && val !== cat.name) {
                                try {
                                  await updateCategory(cat.id, { name: val })
                                } catch (err: any) {
                                  alert(err.message || 'Erro ao renomear categoria.')
                                }
                              }
                              setEditingCategoryId(null)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') setEditingCategoryId(null)
                            }}
                          />
                        ) : (
                          <span className={`flex-1 text-sm truncate ${cat.isHidden ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                            {cat.name}
                          </span>
                        )}

                        <div className="flex gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => toggleCategoryVisibility(cat.id!)}
                            className="p-2 rounded-lg text-slate-600 hover:text-slate-300 active:bg-slate-700 transition-colors"
                          >
                            {cat.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(cat.id!)}
                            className="p-2 rounded-lg text-slate-600 hover:text-slate-300 active:bg-slate-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id!)}
                            className="p-2 rounded-lg text-slate-600 hover:text-rose-400 active:bg-rose-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Adicionar categoria */}
                    <div className="px-3 sm:px-4 py-2">
                      {newCatGroupId === group.id ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            className="input-base flex-1 h-8 text-sm py-1"
                            placeholder="Nome da categoria…"
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddCategory(group.id!)
                              if (e.key === 'Escape') { setNewCatGroupId(null); setNewCatName('') }
                            }}
                          />
                          <button onClick={() => handleAddCategory(group.id!)} className="btn-primary text-xs px-3 py-1">Salvar</button>
                          <button onClick={() => { setNewCatGroupId(null); setNewCatName('') }} className="btn-ghost text-xs">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setNewCatGroupId(group.id!)
                            setNewCatName('')
                            setExpandedGroups(s => new Set([...s, group.id!]))
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-400 active:text-indigo-300 transition-colors py-1 w-full"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar categoria
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Card Gerenciamento de Dados */}
        <div className="card p-5 space-y-4 bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Gerenciamento de Dados</h2>
              <p className="text-xs text-slate-500">Exporte, restaure ou resete todos os dados do banco local com segurança</p>
            </div>
          </div>

          {backupStatus && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              backupStatus.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
            }`}>
              {backupStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <span>{backupStatus.message}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              {isExporting ? 'Exportando…' : 'Exportar Backup (JSON)'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium hover:text-emerald-300 hover:border-emerald-700/50 transition-colors"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              Importar / Restaurar
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-800/60 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              Zerar Banco
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Modal de confirmação para Zerar Banco com countdown de 10s */}
        <ResetDatabaseModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          onSuccess={() => {
            setBackupStatus({
              type: 'success',
              message: 'Banco de dados zerado e redefinido com sucesso.',
            })
          }}
        />

        {/* Card Sobre / Identidade Visual */}
        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-full">
              v1.0.0 PWA
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            FinPlan é um aplicativo moderno de finanças pessoais focado em orçamento por envelope, gestão completa de cartões de crédito, contas bancárias e relatórios de evolução patrimonial.
          </p>
        </div>
      </div>
    </div>
  )
}

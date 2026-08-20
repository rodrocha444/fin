import { useState, useRef } from 'react'
import {
  Plus, Eye, EyeOff, Pencil, Trash2, ChevronDown, ChevronRight,
  Download, Upload, Database, CheckCircle2, Cloud, RefreshCw,
  Copy, Check, ExternalLink, KeyRound, Server, AlertCircle
} from 'lucide-react'
import { useFinancialData } from '@/context/FinancialDataContext'
import {
  createGroup, updateGroup, deleteGroup, toggleGroupVisibility,
  createCategory, updateCategory, deleteCategory, toggleCategoryVisibility,
} from '@/services/api/categories'
import { downloadDatabaseBackup, importDatabase, type DatabaseBackup } from '@/services/api/backup'
import {
  getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig,
  testSupabaseConnection
} from '@/services/supabase'
import { SUPABASE_SCHEMA_SQL } from '@/services/supabaseSchema'
import { useConfirm, useAlert } from '@/context/ConfirmContext'
import ResetDatabaseModal from '@/components/organisms/ResetDatabaseModal'
import Logo from '@/components/atoms/Logo'
import { APP_VERSION, BUILD_DATE } from '@/version'

export default function SettingsPage() {
  const { categoryGroups: groups, categories, isLoading: isSyncing, refetch, isConfigured } = useFinancialData()

  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig()?.url || '')
  const [supabaseKey, setSupabaseKey] = useState(() => getSupabaseConfig()?.anonKey || '')
  const [testResult, setTestResult] = useState<{ success?: boolean; message: string } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [showSqlGuide, setShowSqlGuide] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [copiedTestResult, setCopiedTestResult] = useState(false)
  const [copiedBackupStatus, setCopiedBackupStatus] = useState(false)

  const [groupTypeTab, setGroupTypeTab] = useState<'expense' | 'income'>('expense')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newCatGroupId, setNewCatGroupId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()
  const showAlert = useAlert()

  const handleSaveSupabase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setTestResult({ success: false, message: 'Preencha a URL e a Chave Anon.' })
      return
    }

    setIsTestingConnection(true)
    setTestResult(null)

    const cleanUrl = supabaseUrl.trim().replace(/\/$/, '')
    const cleanKey = supabaseKey.trim()

    const result = await testSupabaseConnection({ url: cleanUrl, anonKey: cleanKey })
    setIsTestingConnection(false)
    setTestResult(result)

    if (result.success) {
      saveSupabaseConfig({ url: cleanUrl, anonKey: cleanKey })
      refetch()
    }
  }

  const handleDisconnectSupabase = async () => {
    const ok = await confirm({
      title: 'Desconectar Supabase?',
      message: 'Deseja desconectar o Supabase? Os dados locais permanecerão salvos no navegador.',
      confirmText: 'Desconectar',
      variant: 'warning',
    })
    if (!ok) return
    clearSupabaseConfig()
    setSupabaseUrl('')
    setSupabaseKey('')
    setTestResult(null)
  }

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2500)
  }

  const toggleGroup = (id: string) =>
    setExpandedGroups(s => {
      const next = new Set(s)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
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
      await showAlert({
        title: 'Erro ao Criar Grupo',
        message: e.message || 'Não foi possível criar o grupo.',
        variant: 'danger',
      })
    }
  }

  const handleAddCategory = async (groupId: string) => {
    if (!newCatName.trim()) return
    try {
      const count = categories?.filter(c => c.groupId === groupId).length ?? 0
      await createCategory({ groupId, name: newCatName.trim(), sortOrder: count, isHidden: false })
      setNewCatName('')
      setNewCatGroupId(null)
    } catch (e: any) {
      await showAlert({
        title: 'Erro ao Criar Categoria',
        message: e.message || 'Não foi possível criar a categoria.',
        variant: 'danger',
      })
    }
  }

  const handleDeleteGroup = async (id: string) => {
    try {
      const ok = await confirm({
        title: 'Excluir grupo?',
        message: 'Deseja realmente excluir este grupo e suas categorias?',
        confirmText: 'Excluir Grupo',
        variant: 'danger',
      })
      if (!ok) return
      await deleteGroup(id)
    } catch (e: any) {
      await showAlert({
        title: 'Erro ao Excluir Grupo',
        message: e.message || 'Não foi possível excluir o grupo.',
        variant: 'danger',
      })
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      const ok = await confirm({
        title: 'Excluir categoria?',
        message: 'Deseja realmente excluir esta categoria?',
        confirmText: 'Excluir Categoria',
        variant: 'danger',
      })
      if (!ok) return
      await deleteCategory(id)
    } catch (e: any) {
      await showAlert({
        title: 'Erro ao Excluir Categoria',
        message: e.message || 'Não foi possível excluir a categoria.',
        variant: 'danger',
      })
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
      const ok = await confirm({
        title: 'Importar Backup?',
        message: 'Atenção: A importação irá substituir os dados no Supabase. Deseja continuar?',
        confirmText: 'Importar e Substituir',
        variant: 'warning',
      })
      if (!ok) {
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setBackupStatus(null)
      const text = await file.text()
      const backupData = JSON.parse(text) as DatabaseBackup

      const result = await importDatabase(backupData)
      await refetch()

      setBackupStatus({
        type: 'success',
        message: `Importação concluída! ${result.totalRecords} registros restaurados em ${result.importedTables.length} tabelas no Supabase.`,
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
                            await showAlert({
                              title: 'Erro ao Renomear Grupo',
                              message: err.message || 'Não foi possível renomear o grupo.',
                              variant: 'danger',
                            })
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
                                  await showAlert({
                                    title: 'Erro ao Renomear Categoria',
                                    message: err.message || 'Não foi possível renomear a categoria.',
                                    variant: 'danger',
                                  })
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

        {/* ── Card Sincronização em Nuvem (Supabase) ─────────── */}
        <div className="card p-5 space-y-4 bg-slate-900 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Banco de Dados em Nuvem (Supabase)</h2>
                <p className="text-xs text-slate-500">Conexão direta e sincronização em tempo real via PostgreSQL</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConfigured
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isConfigured ? 'Conectado em Nuvem' : 'Não Configurado'}
              </span>

              {isConfigured && (
                <button
                  onClick={() => refetch()}
                  disabled={isSyncing}
                  className="btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1.5 hover:text-sky-300"
                  title="Recarregar todos os dados do Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
                  <span>{isSyncing ? 'Atualizando…' : 'Recarregar'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback de Teste / Erro */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs flex items-start justify-between gap-2 ${
              testResult.success
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
            }`}>
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span className="break-words">{testResult.message}</span>
              </div>
              {!testResult.success && (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(testResult.message)
                    setCopiedTestResult(true)
                    setTimeout(() => setCopiedTestResult(false), 2000)
                  }}
                  className="p-1 px-2 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-200 text-[11px] font-medium flex items-center gap-1 flex-shrink-0 transition-colors"
                  title="Copiar erro para a área de transferência"
                >
                  {copiedTestResult ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTestResult ? 'Copiado!' : 'Copiar erro'}</span>
                </button>
              )}
            </div>
          )}

          {/* Formulário de Configuração */}
          <form onSubmit={handleSaveSupabase} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span>Project URL</span>
                </label>
                <input
                  type="url"
                  className="input-base text-xs font-mono"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Anon Public Key</span>
                </label>
                <input
                  type="password"
                  className="input-base text-xs font-mono"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isTestingConnection}
                  className="btn-primary py-2 px-3.5 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  {isTestingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isTestingConnection ? 'Conectando…' : 'Salvar e Conectar'}</span>
                </button>

                {getSupabaseConfig() && (
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="btn-ghost py-2 px-3 text-xs text-slate-400 hover:text-rose-400"
                  >
                    Desconectar
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 py-1"
              >
                <span>{showSqlGuide ? 'Ocultar Script SQL' : 'Ver Script SQL de Criação das Tabelas'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSqlGuide ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </form>

          {/* Guia e Script SQL */}
          {showSqlGuide && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Passo a Passo para Configurar o Supabase</span>
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 text-[11px]"
                  >
                    supabase.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  onClick={handleCopySql}
                  className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 text-indigo-300 hover:text-white"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>Acesse o <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">painel do Supabase</a> e crie um novo projeto gratuito.</li>
                <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong>.</li>
                <li>Clique em <strong>New Query</strong>, cole o script copiado acima e clique no botão verde <strong>Run</strong>.</li>
                <li>Vá em <strong>Project Settings (ícone de engrenagem) &gt; API</strong>.</li>
                <li>Copie a <strong>Project URL</strong> e a <strong>anon public key</strong> e cole nos campos acima.</li>
              </ol>

              <div className="relative">
                <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto border border-slate-800 select-all">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}
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
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
              backupStatus.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
            }`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {backupStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="break-words">{backupStatus.message}</span>
              </div>
              {backupStatus.type === 'error' && (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(backupStatus.message)
                    setCopiedBackupStatus(true)
                    setTimeout(() => setCopiedBackupStatus(false), 2000)
                  }}
                  className="p-1 px-2 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-200 text-[11px] font-medium flex items-center gap-1 flex-shrink-0 transition-colors"
                  title="Copiar erro para a área de transferência"
                >
                  {copiedBackupStatus ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedBackupStatus ? 'Copiado!' : 'Copiar erro'}</span>
                </button>
              )}
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

        {/* Card Sobre / Identidade Visual e Versão */}
        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-full font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            FinPlan é um aplicativo moderno de finanças pessoais focado em orçamento por envelope, gestão completa de cartões de crédito, contas bancárias e relatórios de evolução patrimonial.
          </p>
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
            <span>Versão da aplicação: <strong className="text-slate-400">v{APP_VERSION}</strong></span>
            <span>Atualização: <strong className="text-slate-400">{BUILD_DATE}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}

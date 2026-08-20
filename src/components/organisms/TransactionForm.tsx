// src/components/organisms/TransactionForm.tsx — Formulário de Transação com suporte a Rateio/Divisão de Categorias (Split)
import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Split, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useFinancialData } from '@/context/FinancialDataContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import {
  createTransaction,
  createInstallmentPurchase,
  updateInstallmentPurchase,
  createTransfer,
  updateTransaction,
  createSplitTransaction,
  updateSplitTransaction,
  deleteTransaction,
} from '@/db/repositories/transactions'
import { getOrCreatePayee } from '@/db/repositories/payees'
import PriceInput from '@/components/atoms/PriceInput'
import { formatCurrency } from '@/utils/format'
import type { Transaction } from '@/types'

type TxMode = 'expense' | 'income' | 'transfer'
type ExpensePaymentType = 'single' | 'installment'

interface SplitRow {
  id: string
  categoryId: string
  amount: number
  notes: string
}

const schema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  payee: z.string().optional(),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  accountId: z.string().min(1, 'Conta obrigatória'),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  transferAccountId: z.string().optional(),
  installmentCount: z.coerce.number().int('Quantidade de parcelas deve ser um número inteiro').min(2, 'Mínimo de 2 parcelas').max(120, 'Máximo de 120 parcelas').optional(),
})

type FormData = z.infer<typeof schema>

const MODE_CONFIG: Record<TxMode, { label: string; color: string; activeBg: string }> = {
  expense:     { label: 'Despesa',       color: 'text-rose-300',    activeBg: 'border-rose-600/40 bg-rose-600/20' },
  income:      { label: 'Renda',         color: 'text-emerald-300', activeBg: 'border-emerald-600/40 bg-emerald-600/20' },
  transfer:    { label: 'Transferência', color: 'text-sky-300',     activeBg: 'border-sky-600/40 bg-sky-600/20' },
}

interface TransactionFormProps {
  onClose: () => void
  onSuccess?: () => void
  transaction?: Transaction
  defaultAccountId?: string
  defaultTransferAccountId?: string
  defaultCategoryId?: string
  defaultMode?: TxMode | 'installment'
  defaultAmount?: number
  defaultPayee?: string
}

const LAST_TX_DATE_KEY = 'fin_last_tx_date'

function getLastTxDate(): string {
  try {
    const saved = localStorage.getItem(LAST_TX_DATE_KEY)
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
      return saved
    }
  } catch {
    // ignore
  }
  return format(new Date(), 'yyyy-MM-dd')
}

function saveLastTxDate(dateStr: string) {
  try {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      localStorage.setItem(LAST_TX_DATE_KEY, dateStr)
    }
  } catch {
    // ignore
  }
}

export default function TransactionForm({
  onClose,
  onSuccess,
  transaction,
  defaultAccountId,
  defaultTransferAccountId,
  defaultCategoryId,
  defaultMode = 'expense',
  defaultAmount,
  defaultPayee,
}: TransactionFormProps) {
  const isEdit = !!transaction
  const isExistingInstallment = !!transaction?.installmentGroupId
  const { transactions, installmentGroups } = useFinancialData()

  // Busca os dados consolidados do grupo quando estiver editando uma compra parcelada
  const group = transaction?.installmentGroupId
    ? installmentGroups.find(g => g.id === transaction.installmentGroupId)
    : undefined

  // Busca os registros de rateio existentes quando estiver editando transação dividida
  const splitSiblings = transaction?.splitGroupId
    ? transactions.filter(t => t.splitGroupId === transaction.splitGroupId)
    : []

  const initialMode: TxMode = transaction
    ? (transaction.type === 'transfer' ? 'transfer' : transaction.type === 'income' ? 'income' : 'expense')
    : (defaultMode === 'installment' ? 'expense' : defaultMode)

  const initialExpenseType: ExpensePaymentType = transaction
    ? (transaction.installmentGroupId ? 'installment' : 'single')
    : (defaultMode === 'installment' ? 'installment' : 'single')

  const [mode, setMode] = useState<TxMode>(initialMode)
  const [expensePaymentType, setExpensePaymentType] = useState<ExpensePaymentType>(initialExpenseType)
  const [installmentAmountType, setInstallmentAmountType] = useState<'total' | 'parcel'>('total')
  const [isSplit, setIsSplit] = useState<boolean>(!!transaction?.splitGroupId)
  const [splits, setSplits] = useState<SplitRow[]>(() => {
    if (splitSiblings.length > 0) {
      return splitSiblings.map((s, idx) => ({
        id: s.id || `split-${idx}-${Date.now()}`,
        categoryId: s.categoryId || '',
        amount: s.amount,
        notes: s.notes || '',
      }))
    }
    return [
      { id: '1', categoryId: defaultCategoryId || '', amount: 0, notes: '' },
      { id: '2', categoryId: '', amount: 0, notes: '' },
    ]
  })

  const accounts = useAccounts() ?? []
  const categoryType = mode === 'income' ? 'income' : 'expense'
  const { categories, groups } = useCategoriesWithGroups(categoryType) ?? { categories: [], groups: [] }

  // Se for transferência com conta destino definida e nenhuma conta de origem, sugere a primeira checking
  const initialAccountId = transaction
    ? transaction.accountId
    : (defaultAccountId ?? (
        defaultMode === 'transfer' && defaultTransferAccountId
          ? accounts.find(a => a.type !== 'credit_card' && a.id !== defaultTransferAccountId)?.id ?? accounts[0]?.id
          : undefined
      ))

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const initialTotalAmount = (() => {
    if (splitSiblings.length > 0) {
      return splitSiblings.reduce((sum, s) => sum + s.amount, 0)
    }
    return transaction?.amount ?? defaultAmount
  })()

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: transaction ? format(new Date(transaction.date), 'yyyy-MM-dd') : getLastTxDate(),
      accountId: initialAccountId ?? '',
      transferAccountId: transaction?.transferAccountId ?? defaultTransferAccountId ?? '',
      amount: initialTotalAmount,
      payee: transaction?.payee ?? defaultPayee,
      categoryId: transaction?.categoryId ?? defaultCategoryId ?? '',
      notes: transaction?.notes ? transaction.notes.replace(/\s*\(\d+\/\d+\)$/, '').trim() : undefined,
      installmentCount: transaction?.installmentTotal ?? 2,
    },
  })

  // Popula os dados consolidados da compra parcelada completa (valor total, contagem, data de início)
  useEffect(() => {
    if (group) {
      setValue('amount', group.totalAmount, { shouldValidate: true })
      setValue('installmentCount', group.installmentCount, { shouldValidate: true })
      setValue('date', format(new Date(group.startDate), 'yyyy-MM-dd'), { shouldValidate: true })
      if (group.description) setValue('payee', group.description)
      if (group.categoryId) setValue('categoryId', group.categoryId)
      if (group.accountId) setValue('accountId', group.accountId)
      if (transaction?.notes) {
        setValue('notes', transaction.notes.replace(/\s*\(\d+\/\d+\)$/, '').trim())
      }
    } else if (splitSiblings.length > 0) {
      const sum = splitSiblings.reduce((s, t) => s + t.amount, 0)
      setValue('amount', sum, { shouldValidate: true })
    }
  }, [group, transaction, setValue])

  const selectedDate = watch('date')
  const watchAmount = watch('amount') || 0
  const watchInstallmentCount = watch('installmentCount')

  const handleToggleInstallmentAmountType = (type: 'total' | 'parcel') => {
    if (type === installmentAmountType) return
    const currentVal = watchAmount || 0
    const count = watchInstallmentCount || 2
    if (currentVal > 0 && count > 0) {
      if (type === 'parcel') {
        setValue('amount', parseFloat((currentVal / count).toFixed(2)), { shouldValidate: true })
      } else {
        setValue('amount', parseFloat((currentVal * count).toFixed(2)), { shouldValidate: true })
      }
    }
    setInstallmentAmountType(type)
  }

  const groupedCategories = groups?.map(g => ({
    group: g,
    cats: categories?.filter(c => c.groupId === g.id && !c.isHidden) ?? [],
  })).filter(g => g.cats.length > 0) ?? []

  const isInstallment = (mode === 'expense' && expensePaymentType === 'installment') || isExistingInstallment

  // Cálculos de Rateio / Split
  const sumSplits = splits.reduce((sum, s) => sum + (s.amount || 0), 0)
  const remainingToDistribute = Math.round((watchAmount - sumSplits) * 100) / 100

  const handleToggleSplit = () => {
    if (!isSplit) {
      // Ativando modo Split
      const catId = watch('categoryId') || defaultCategoryId || ''
      const half = watchAmount > 0 ? parseFloat((watchAmount / 2).toFixed(2)) : 0
      const rest = watchAmount > 0 ? parseFloat((watchAmount - half).toFixed(2)) : 0
      setSplits([
        { id: `split-1-${Date.now()}`, categoryId: catId, amount: half, notes: '' },
        { id: `split-2-${Date.now()}`, categoryId: '', amount: rest, notes: '' },
      ])
      setIsSplit(true)
    } else {
      // Desativando modo Split
      setIsSplit(false)
    }
  }

  const handleAddSplit = () => {
    const nextAmount = remainingToDistribute > 0 ? remainingToDistribute : 0
    setSplits(prev => [
      ...prev,
      { id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, categoryId: '', amount: nextAmount, notes: '' },
    ])
  }

  const handleRemoveSplit = (id: string) => {
    if (splits.length <= 2) return
    setSplits(prev => prev.filter(s => s.id !== id))
  }

  const handleUpdateSplit = (id: string, fieldUpdates: Partial<SplitRow>) => {
    setSplits(prev => prev.map(s => (s.id === id ? { ...s, ...fieldUpdates } : s)))
  }

  const handleFillRemaining = (targetIndex?: number) => {
    if (splits.length === 0) return
    const idx = targetIndex !== undefined ? targetIndex : splits.length - 1
    const currentSplitAmount = splits[idx].amount || 0
    const newAmount = Math.max(0, parseFloat((currentSplitAmount + remainingToDistribute).toFixed(2)))
    setSplits(prev => prev.map((s, i) => (i === idx ? { ...s, amount: newAmount } : s)))
  }

  const onSubmit = async (data: FormData) => {
    saveLastTxDate(data.date)
    const txDate = new Date(data.date + 'T12:00:00')
    const selectedCat = categories?.find(c => c.id === data.categoryId)
    const finalPayee = data.payee?.trim() || selectedCat?.name || (mode === 'transfer' ? 'Transferência' : 'Despesa')
    const catId = data.categoryId && data.categoryId.trim() !== '' ? data.categoryId : undefined

    if (mode !== 'transfer' && isSplit) {
      // Validação de soma no modo rateio
      if (splits.length < 2) {
        alert('Adicione pelo menos 2 categorias para dividir a transação.')
        return
      }
      if (Math.abs(remainingToDistribute) >= 0.01) {
        alert(`A soma das divisões (${formatCurrency(sumSplits)}) deve ser exatamente igual ao valor total (${formatCurrency(data.amount)}). Restante: ${formatCurrency(remainingToDistribute)}`)
        return
      }

      // Salva ou atualiza beneficiário
      await getOrCreatePayee(finalPayee, splits[0]?.categoryId)

      const splitPayload = splits.map(s => ({
        categoryId: s.categoryId && s.categoryId.trim() !== '' ? s.categoryId : undefined,
        amount: s.amount,
        notes: s.notes?.trim() || undefined,
      }))

      if (transaction?.splitGroupId) {
        await updateSplitTransaction(transaction.splitGroupId, {
          accountId: data.accountId,
          date: txDate,
          payee: finalPayee,
          type: mode === 'income' ? 'income' : 'expense',
          notes: data.notes,
          splits: splitPayload,
        })
      } else if (isEdit && transaction?.id) {
        // Transação avulsa anterior sendo convertida em split
        await deleteTransaction(transaction.id)
        await createSplitTransaction({
          accountId: data.accountId,
          date: txDate,
          payee: finalPayee,
          type: mode === 'income' ? 'income' : 'expense',
          notes: data.notes,
          splits: splitPayload,
        })
      } else {
        await createSplitTransaction({
          accountId: data.accountId,
          date: txDate,
          payee: finalPayee,
          type: mode === 'income' ? 'income' : 'expense',
          notes: data.notes,
          splits: splitPayload,
        })
      }

      onSuccess?.()
      onClose()
      return
    }

    if (isExistingInstallment && transaction?.installmentGroupId) {
      if (mode !== 'transfer') {
        await getOrCreatePayee(finalPayee, catId)
      }
      const finalTotalAmount = installmentAmountType === 'parcel'
        ? parseFloat((data.amount * (data.installmentCount || 2)).toFixed(2))
        : data.amount

      await updateInstallmentPurchase(transaction.installmentGroupId, {
        accountId: data.accountId,
        categoryId: catId,
        description: finalPayee,
        totalAmount: finalTotalAmount,
        installmentCount: data.installmentCount || 2,
        startDate: txDate,
        payee: finalPayee,
        notes: data.notes,
      })
    } else if (isEdit && transaction?.id) {
      if (mode !== 'transfer') {
        await getOrCreatePayee(finalPayee, catId)
      }
      // Se estava em split e virou única, remove o split_group_id
      await updateTransaction(transaction.id, {
        accountId: data.accountId,
        date: txDate,
        amount: data.amount,
        payee: finalPayee,
        categoryId: catId,
        notes: data.notes,
        type: mode === 'income' ? 'income' : mode === 'transfer' ? 'transfer' : 'expense',
        transferAccountId: mode === 'transfer' ? (data.transferAccountId || undefined) : undefined,
        splitGroupId: undefined,
      })
    } else if (mode === 'transfer') {
      if (!data.transferAccountId) return
      await createTransfer({
        fromAccountId: data.accountId,
        toAccountId: data.transferAccountId,
        amount: data.amount,
        date: txDate,
        notes: data.notes,
        payee: finalPayee,
      })
    } else if (isInstallment) {
      if (!data.installmentCount) return
      const finalTotalAmount = installmentAmountType === 'parcel'
        ? parseFloat((data.amount * data.installmentCount).toFixed(2))
        : data.amount

      await createInstallmentPurchase({
        accountId: data.accountId,
        categoryId: catId,
        description: finalPayee,
        totalAmount: finalTotalAmount,
        installmentCount: data.installmentCount,
        startDate: txDate,
        payee: finalPayee,
        notes: data.notes,
      })
    } else {
      await getOrCreatePayee(finalPayee, catId)
      await createTransaction({
        accountId: data.accountId,
        date: txDate,
        amount: data.amount,
        payee: finalPayee,
        categoryId: catId,
        notes: data.notes,
        cleared: false,
        type: mode === 'income' ? 'income' : 'expense',
      })
    }
    onSuccess?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
              {isExistingInstallment
                ? `Editar Parcela ${transaction.installmentNumber} de ${transaction.installmentTotal}`
                : isSplit
                  ? (isEdit ? 'Editar divisão de categorias' : 'Nova transação dividida')
                  : isEdit
                    ? 'Editar transação'
                    : 'Nova transação'}
            </h2>
            {isExistingInstallment && (
              <p className="text-xs text-violet-400 mt-0.5">
                Compra parcelada no cartão
              </p>
            )}
            {isSplit && (
              <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                <Split className="w-3 h-3" /> Rateio entre {splits.length} categorias
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de tipo principal */}
        <div className="px-5 pt-4 pb-1 space-y-2 flex-shrink-0">
          <div className="flex gap-1.5">
            {(Object.entries(MODE_CONFIG) as [TxMode, typeof MODE_CONFIG[TxMode]][]).map(([m, cfg]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  if (m === 'transfer') setIsSplit(false)
                }}
                disabled={isExistingInstallment && m !== 'expense'}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                  mode === m ? `${cfg.activeBg} ${cfg.color}` : 'border-slate-700 text-slate-500 hover:border-slate-600 disabled:opacity-40'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Sub-seletor de Despesa: À vista vs Parcelado */}
          {mode === 'expense' && (
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => !isExistingInstallment && setExpensePaymentType('single')}
                disabled={isExistingInstallment}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  expensePaymentType === 'single'
                    ? 'bg-slate-700 text-slate-100 shadow'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400'
                }`}
              >
                À vista
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpensePaymentType('installment')
                  setIsSplit(false)
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  expensePaymentType === 'installment'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Parcelado
              </button>
            </div>
          )}
        </div>

        {/* Formulário scrollável */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 space-y-3.5 overflow-y-auto flex-1">

          {/* Data */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">
                {isInstallment ? 'Data da compra (1ª parcela)' : 'Data'}
              </label>
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => {
                    setValue('date', todayStr, { shouldValidate: true })
                    saveLastTxDate(todayStr)
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                >
                  Usar hoje
                </button>
              )}
            </div>
            <input
              {...register('date')}
              type="date"
              className="input-base w-full max-w-full min-w-0"
              onChange={e => {
                register('date').onChange(e)
                if (e.target.value) {
                  saveLastTxDate(e.target.value)
                }
              }}
            />
            {errors.date && <p className="text-rose-400 text-xs mt-1">{errors.date.message}</p>}
          </div>

          {/* Valor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">
                {isInstallment
                  ? (installmentAmountType === 'total' ? 'Valor total da compra' : 'Valor por parcela')
                  : isSplit
                    ? 'Valor total da transação'
                    : 'Valor'}
              </label>

              {/* Seletor de Tipo de Valor para Parcelamento */}
              {isInstallment && (
                <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700/60 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleToggleInstallmentAmountType('total')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      installmentAmountType === 'total'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Valor total
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleInstallmentAmountType('parcel')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      installmentAmountType === 'parcel'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Por parcela
                  </button>
                </div>
              )}
            </div>

            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <PriceInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />

            {/* Resumo do cálculo em tempo real */}
            {isInstallment && watchAmount > 0 && watchInstallmentCount && watchInstallmentCount >= 2 && (
              <div className="mt-1.5 p-2.5 bg-violet-950/30 border border-violet-800/40 rounded-xl flex items-center justify-between text-xs">
                <span className="text-violet-300 font-medium">
                  {installmentAmountType === 'total' ? 'Divisão das parcelas:' : 'Total calculado da compra:'}
                </span>
                <span className="text-violet-200 font-bold tabular-nums">
                  {installmentAmountType === 'total'
                    ? `${watchInstallmentCount}x de ${formatCurrency(watchAmount / watchInstallmentCount)}`
                    : `${watchInstallmentCount}x de ${formatCurrency(watchAmount)} = ${formatCurrency(watchAmount * watchInstallmentCount)}`}
                </span>
              </div>
            )}

            {errors.amount && <p className="text-rose-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Descrição da operação (campo único unificado) */}
          <div>
            <label className="label">
              {mode === 'transfer'
                ? 'Descrição da transferência'
                : isInstallment
                  ? 'Descrição da compra'
                  : 'Descrição'}
            </label>
            <input
              {...register('payee')}
              className="input-base"
              placeholder={
                mode === 'transfer'
                  ? 'Ex: Pagamento de fatura, TED, Pix…'
                  : isInstallment
                    ? 'Ex: Notebook, Smartphone, Geladeira…'
                    : mode === 'income'
                      ? 'Ex: Salário, Freelance, Rendimentos…'
                      : 'Ex: Supermercado, Restaurante, Combustível…'
              }
              autoComplete="off"
            />
            {errors.payee && <p className="text-rose-400 text-xs mt-1">{errors.payee.message}</p>}
          </div>

          {/* Conta */}
          <div>
            <label className="label">{mode === 'transfer' ? 'Conta origem' : 'Conta'}</label>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => {
                const onBudgetAccs = accounts.filter(a => a.type !== 'off_budget')
                const offBudgetAccs = accounts.filter(a => a.type === 'off_budget')
                return (
                  <select
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className="input-base"
                  >
                    <option value="">Selecione…</option>
                    {offBudgetAccs.length > 0 ? (
                      <>
                        <optgroup label="No Orçamento">
                          {onBudgetAccs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </optgroup>
                        <optgroup label="Fora do Orçamento">
                          {offBudgetAccs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </optgroup>
                      </>
                    ) : (
                      accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                    )}
                  </select>
                )
              }}
            />
            {errors.accountId && <p className="text-rose-400 text-xs mt-1">{errors.accountId.message}</p>}
          </div>

          {/* Conta destino */}
          {mode === 'transfer' && (
            <div>
              <label className="label">Conta destino</label>
              <Controller
                name="transferAccountId"
                control={control}
                render={({ field }) => {
                  const onBudgetAccs = accounts.filter(a => a.type !== 'off_budget')
                  const offBudgetAccs = accounts.filter(a => a.type === 'off_budget')
                  return (
                    <select
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value || undefined)}
                      onBlur={field.onBlur}
                      className="input-base"
                    >
                      <option value="">Selecione…</option>
                      {offBudgetAccs.length > 0 ? (
                        <>
                          <optgroup label="No Orçamento">
                            {onBudgetAccs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                          <optgroup label="Fora do Orçamento">
                            {offBudgetAccs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        </>
                      ) : (
                        accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                      )}
                    </select>
                  )
                }}
              />
            </div>
          )}

          {/* Parcelas */}
          {isInstallment && (
            <div>
              <label className="label">Quantidade de parcelas</label>
              <input
                {...register('installmentCount')}
                type="number"
                step="1"
                min="2"
                max="120"
                placeholder="Ex: 2, 3, 6, 12…"
                className="input-base"
              />
              {errors.installmentCount && (
                <p className="text-rose-400 text-xs mt-1">{errors.installmentCount.message}</p>
              )}
            </div>
          )}

          {/* Categoria / Rateio em Múltiplas Categorias */}
          {mode !== 'transfer' && !isInstallment && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Categoria</label>
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                    isSplit
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <Split className="w-3.5 h-3.5" />
                  {isSplit ? 'Dividindo em categorias' : 'Dividir em categorias'}
                </button>
              </div>

              {!isSplit ? (
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <select
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value || undefined)}
                      onBlur={field.onBlur}
                      style={{ colorScheme: 'dark' }}
                      className="input-base"
                    >
                      <option value="" className="text-slate-400 bg-slate-900">Sem categoria</option>
                      {groupedCategories.map(({ group: g, cats }) => (
                        <optgroup key={g.id} label={g.name} className="bg-slate-950 text-indigo-300 font-semibold">
                          {cats.map(c => (
                            <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100 py-1">
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                />
              ) : (
                /* Bloco do Rateio / Split */
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-indigo-900/40 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Split className="w-4 h-4" />
                      Divisões ({splits.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSplit}
                      className="text-xs text-indigo-400 hover:text-indigo-200 font-semibold flex items-center gap-1 bg-indigo-950/60 border border-indigo-800/60 px-2 py-1 rounded-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Categoria
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {splits.map((split, idx) => (
                      <div key={split.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Divisão #{idx + 1}
                          </span>
                          {splits.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSplit(split.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition-colors"
                              title="Remover esta categoria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={split.categoryId}
                            onChange={e => handleUpdateSplit(split.id, { categoryId: e.target.value })}
                            className="input-base text-xs py-2"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="">Sem categoria</option>
                            {groupedCategories.map(({ group: g, cats }) => (
                              <optgroup key={g.id} label={g.name}>
                                {cats.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <PriceInput
                            value={split.amount}
                            onChange={val => handleUpdateSplit(split.id, { amount: val })}
                            placeholder="R$ 0,00"
                          />
                        </div>

                        <input
                          type="text"
                          value={split.notes}
                          onChange={e => handleUpdateSplit(split.id, { notes: e.target.value })}
                          placeholder="Nota específica para esta divisão (opcional)"
                          className="input-base text-[11px] py-1.5"
                          autoComplete="off"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Painel de conferência de saldo restante */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Distribuído:</span>
                      <strong className="text-slate-200 tabular-nums">{formatCurrency(sumSplits)}</strong>
                      <span className="text-slate-600">/ {formatCurrency(watchAmount)}</span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      {Math.abs(remainingToDistribute) < 0.009 ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 100% Distribuído
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold tabular-nums ${remainingToDistribute > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {remainingToDistribute > 0 ? 'Falta:' : 'Excedeu:'} {formatCurrency(Math.abs(remainingToDistribute))}
                          </span>
                          {remainingToDistribute > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFillRemaining()}
                              className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold shadow-sm transition-all active:scale-95"
                              title="Preencher restante na última divisão"
                            >
                              Preencher restante
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categoria única em compra parcelada */}
          {isInstallment && (
            <div>
              <label className="label">Categoria</label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || undefined)}
                    onBlur={field.onBlur}
                    style={{ colorScheme: 'dark' }}
                    className="input-base"
                  >
                    <option value="" className="text-slate-400 bg-slate-900">Sem categoria</option>
                    {groupedCategories.map(({ group: g, cats }) => (
                      <optgroup key={g.id} label={g.name} className="bg-slate-950 text-indigo-300 font-semibold">
                        {cats.map(c => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100 py-1">
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting
                ? 'Salvando…'
                : isExistingInstallment
                  ? 'Salvar compra parcelada'
                  : isSplit
                    ? (isEdit ? 'Salvar divisão' : 'Salvar transação dividida')
                    : isEdit
                      ? 'Salvar alterações'
                      : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

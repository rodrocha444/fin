// src/components/organisms/TransactionForm.tsx — Formulário de Transação (padrão CUID)
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { createTransaction, createInstallmentPurchase, createTransfer, updateTransaction } from '@/db/repositories/transactions'
import { getOrCreatePayee } from '@/db/repositories/payees'
import PriceInput from '@/components/atoms/PriceInput'
import { formatCurrency } from '@/utils/format'
import type { Transaction } from '@/types'

type TxMode = 'expense' | 'income' | 'transfer'
type ExpensePaymentType = 'single' | 'installment'

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
  transaction,
  defaultAccountId,
  defaultTransferAccountId,
  defaultCategoryId,
  defaultMode = 'expense',
  defaultAmount,
  defaultPayee,
}: TransactionFormProps) {
  const isEdit = !!transaction
  const initialMode: TxMode = transaction
    ? (transaction.type === 'transfer' ? 'transfer' : transaction.type === 'income' ? 'income' : 'expense')
    : (defaultMode === 'installment' ? 'expense' : defaultMode)

  const [mode, setMode] = useState<TxMode>(initialMode)
  const [expensePaymentType, setExpensePaymentType] = useState<ExpensePaymentType>(
    defaultMode === 'installment' ? 'installment' : 'single'
  )
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

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: transaction ? format(new Date(transaction.date), 'yyyy-MM-dd') : getLastTxDate(),
      accountId: initialAccountId ?? '',
      transferAccountId: transaction?.transferAccountId ?? defaultTransferAccountId ?? '',
      amount: transaction?.amount ?? defaultAmount,
      payee: transaction?.payee ?? defaultPayee,
      categoryId: transaction?.categoryId ?? defaultCategoryId ?? '',
      notes: transaction?.notes,
      installmentCount: 2,
    },
  })

  const selectedDate = watch('date')
  const watchAmount = watch('amount')
  const watchInstallmentCount = watch('installmentCount')

  const groupedCategories = groups?.map(g => ({
    group: g,
    cats: categories?.filter(c => c.groupId === g.id && !c.isHidden) ?? [],
  })).filter(g => g.cats.length > 0) ?? []

  const isInstallment = mode === 'expense' && expensePaymentType === 'installment'

  const onSubmit = async (data: FormData) => {
    saveLastTxDate(data.date)
    const txDate = new Date(data.date + 'T12:00:00')
    const selectedCat = categories?.find(c => c.id === data.categoryId)
    const finalPayee = data.payee?.trim() || selectedCat?.name || (mode === 'transfer' ? 'Transferência' : 'Despesa')
    const catId = data.categoryId && data.categoryId.trim() !== '' ? data.categoryId : undefined

    if (isEdit && transaction?.id) {
      if (mode !== 'transfer') {
        await getOrCreatePayee(finalPayee, catId)
      }
      await updateTransaction(transaction.id, {
        accountId: data.accountId,
        date: txDate,
        amount: data.amount,
        payee: finalPayee,
        categoryId: catId,
        notes: data.notes,
        type: mode === 'income' ? 'income' : mode === 'transfer' ? 'transfer' : 'expense',
        transferAccountId: mode === 'transfer' ? (data.transferAccountId || undefined) : undefined,
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
      await createInstallmentPurchase({
        accountId: data.accountId,
        categoryId: catId,
        description: finalPayee,
        totalAmount: data.amount,
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
          <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
            {isEdit ? 'Editar transação' : 'Nova transação'}
          </h2>
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
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                  mode === m ? `${cfg.activeBg} ${cfg.color}` : 'border-slate-700 text-slate-500 hover:border-slate-600'
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
                onClick={() => setExpensePaymentType('single')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  expensePaymentType === 'single'
                    ? 'bg-slate-700 text-slate-100 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                À vista
              </button>
              <button
                type="button"
                onClick={() => setExpensePaymentType('installment')}
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
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 space-y-3 overflow-y-auto flex-1">

          {/* Data */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Data</label>
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
            {transaction?.installmentGroupId && (
              <p className="text-[11px] text-violet-400 mt-1 flex items-center gap-1">
                <span>✦ Parcela {transaction.installmentNumber} de {transaction.installmentTotal} (ajustará as datas de todas as parcelas)</span>
              </p>
            )}
            {errors.date && <p className="text-rose-400 text-xs mt-1">{errors.date.message}</p>}
          </div>

          {/* Valor */}
          <div>
            <label className="label">
              {isInstallment ? 'Total da compra' : transaction?.installmentGroupId ? 'Valor por parcela' : 'Valor'}
            </label>
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
            {transaction?.installmentGroupId && (
              <p className="text-[11px] text-violet-400 mt-1">
                ✦ O novo valor será sincronizado em todas as {transaction.installmentTotal} parcelas deste parcelamento.
              </p>
            )}
            {errors.amount && <p className="text-rose-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Favorecido / Descrição */}
          {(mode === 'transfer' || isInstallment) && (
            <div>
              <label className="label">
                {mode === 'transfer' ? 'Descrição' : 'Descrição da compra (opcional)'}
              </label>
              <input
                {...register('payee')}
                className="input-base"
                placeholder={mode === 'transfer' ? 'Pagamento fatura…' : 'Ex: Notebook, Smartphone…'}
                autoComplete="off"
              />
              {errors.payee && <p className="text-rose-400 text-xs mt-1">{errors.payee.message}</p>}
            </div>
          )}

          {/* Conta */}
          <div>
            <label className="label">{mode === 'transfer' ? 'Conta origem' : 'Conta'}</label>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="input-base"
                >
                  <option value="">Selecione…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
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
                render={({ field }) => (
                  <select
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || undefined)}
                    onBlur={field.onBlur}
                    className="input-base"
                  >
                    <option value="">Selecione…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              />
            </div>
          )}

          {/* Parcelas */}
          {isInstallment && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Quantidade de parcelas</label>
                {watchAmount > 0 && watchInstallmentCount && watchInstallmentCount >= 2 && (
                  <span className="text-xs text-violet-400 font-semibold tabular-nums">
                    {watchInstallmentCount}x de {formatCurrency(watchAmount / watchInstallmentCount)}
                  </span>
                )}
              </div>
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

          {/* Categoria */}
          {mode !== 'transfer' && (
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
                    {groupedCategories.map(({ group, cats }) => (
                      <optgroup key={group.id} label={group.name} className="bg-slate-950 text-indigo-300 font-semibold">
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

          {/* Notas */}
          <div>
            <label className="label">Notas (opcional)</label>
            <input {...register('notes')} className="input-base" placeholder="Observações adicionais…" autoComplete="off" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

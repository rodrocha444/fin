import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ArrowDownLeft, ArrowUpRight, Plus, Pencil, Layers } from 'lucide-react'
import { format } from 'date-fns'
import { createDebtItem, updateDebtItem, createDebtInstallments } from '@/db/repositories/debts'
import { formatCurrency } from '@/utils/format'
import PriceInput from '@/components/atoms/PriceInput'
import type { DebtItem, DebtType } from '@/types'

const schema = z.object({
  description: z.string().min(1, 'Descrição da pendência é obrigatória'),
  amount: z.coerce.number().positive('Valor deve ser maior que zero'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface DebtItemFormProps {
  debtAccountId: string
  accountName: string
  item?: DebtItem
  defaultType?: DebtType
  onClose: () => void
  onSuccess?: () => void
}

export default function DebtItemForm({
  debtAccountId,
  accountName,
  item,
  defaultType = 'receivable',
  onClose,
  onSuccess,
}: DebtItemFormProps) {
  const isEdit = !!item
  const [type, setType] = useState<DebtType>(item?.type || defaultType)
  const [installmentCount, setInstallmentCount] = useState<number>(item?.installmentTotal || 1)

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          description: item.description,
          amount: item.amount,
          dueDate: item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '',
          notes: item.notes || '',
        }
      : {
          description: '',
          amount: 0,
          dueDate: '',
          notes: '',
        },
  })

  const currentAmount = watch('amount') || 0

  const onSubmit = async (data: FormData) => {
    const dueDateParsed = data.dueDate ? new Date(data.dueDate + 'T12:00:00') : undefined

    if (isEdit && item.id) {
      await updateDebtItem(item.id, {
        description: data.description,
        type,
        amount: data.amount,
        dueDate: dueDateParsed,
        notes: data.notes?.trim() || undefined,
      })
    } else if (installmentCount > 1) {
      await createDebtInstallments({
        debtAccountId,
        description: data.description,
        type,
        totalAmount: data.amount,
        installmentCount,
        startDate: dueDateParsed || new Date(),
        notes: data.notes?.trim() || undefined,
      })
    } else {
      await createDebtItem({
        debtAccountId,
        description: data.description,
        type,
        amount: data.amount,
        dueDate: dueDateParsed,
        status: 'pending',
        notes: data.notes?.trim() || undefined,
      })
    }

    onSuccess?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg flex items-center gap-2">
              {isEdit ? <Pencil className="w-4 h-4 text-indigo-400" /> : <Plus className="w-4 h-4 text-indigo-400" />}
              {isEdit ? 'Editar Pendência' : 'Nova Pendência'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Para: <strong className="text-slate-200 font-semibold">{accountName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Seletor de Tipo: A Receber vs A Pagar */}
          <div>
            <label className="label">Tipo de pendência</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('receivable')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'receivable'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm shadow-emerald-950/20'
                    : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>A Receber</span>
              </button>

              <button
                type="button"
                onClick={() => setType('payable')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'payable'
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm shadow-rose-950/20'
                    : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span>A Pagar</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {type === 'receivable'
                ? `Você pagou ou emprestou para ${accountName} e deve receber.`
                : `${accountName} pagou algo para você e você deve reembolsar.`}
            </p>
          </div>

          {/* Valor */}
          <div>
            <label className="label">
              {!isEdit && installmentCount > 1 ? 'Valor Total Parcelado' : 'Valor da pendência'}
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
            {errors.amount && <p className="text-rose-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Parcelamento (apenas no modo de criação) */}
          {!isEdit && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Parcelamento</span>
                </label>
                {installmentCount > 1 && currentAmount > 0 && (
                  <span className="text-xs text-indigo-400 font-semibold tabular-nums">
                    {installmentCount}x de {formatCurrency(Math.round((currentAmount / installmentCount) * 100) / 100)}
                  </span>
                )}
              </div>
              <select
                value={installmentCount}
                onChange={e => setInstallmentCount(Number(e.target.value))}
                style={{ colorScheme: 'dark' }}
                className="input-base"
              >
                <option value={1} className="bg-slate-900 text-slate-100">À vista / Parcela única (1x)</option>
                {Array.from({ length: 35 }, (_, i) => i + 2).map(n => (
                  <option key={n} value={n} className="bg-slate-900 text-slate-100">
                    {n}x parcelas mensais
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="label">Descrição do item / motivo</label>
            <input
              {...register('description')}
              className="input-base"
              placeholder="Ex: Tênis comprado no meu cartão, Almoço de domingo…"
              autoComplete="off"
              autoFocus
            />
            {errors.description && <p className="text-rose-400 text-xs mt-1">{errors.description.message}</p>}
          </div>

          {/* Prazo / Data de Vencimento */}
          <div>
            <label className="label">
              {!isEdit && installmentCount > 1 ? 'Vencimento da 1ª Parcela (opcional)' : 'Data limite / Prazo de acerto (opcional)'}
            </label>
            <input
              {...register('dueDate')}
              type="date"
              className="input-base"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="label">Observações adicionais (opcional)</label>
            <input
              {...register('notes')}
              className="input-base"
              placeholder="Ex: Pagará no dia 10 junto com a fatura…"
              autoComplete="off"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Lançar pendência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

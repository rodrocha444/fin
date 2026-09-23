// src/components/organisms/DebtItemForm.tsx — Modal para lançar/editar pendência de cobrança
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDownLeft, ArrowUpRight, Plus, Pencil, Layers, History, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { createDebtItem, updateDebtItem, createDebtInstallments } from '@/services/api/debts'
import { formatCurrency } from '@/utils/format'
import Modal from '@/components/atoms/Modal'
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
        debtAccountId: item.debtAccountId || debtAccountId,
        description: data.description,
        type,
        amount: data.amount,
        dueDate: dueDateParsed,
        notes: data.notes?.trim() || undefined,
        changes: item.changes,
        installmentGroupId: item.installmentGroupId,
        installmentNumber: item.installmentNumber,
        installmentTotal: item.installmentTotal,
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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      icon={isEdit ? <Pencil className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
      title={isEdit ? 'Editar Pendência' : 'Nova Pendência'}
      description={`Para: ${accountName}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
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

          {/* Aviso quando o valor for alterado */}
          {isEdit && item && Math.abs(currentAmount - item.amount) > 0.001 && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-start gap-2 text-xs">
              <History className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-indigo-200">
                  Alteração de valor detectada
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Valor anterior: <span className="font-semibold text-slate-300">{formatCurrency(item.amount)}</span> ➔ Novo valor: <span className="font-semibold text-indigo-300">{formatCurrency(currentAmount)}</span>
                  {' '}({currentAmount > item.amount ? '+' : ''}{formatCurrency(currentAmount - item.amount)}).
                  Essa alteração será registrada no histórico hoje, atualizando a evolução patrimonial nos relatórios.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Parcelamento (apenas no modo de criação) */}
        {!isEdit && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Parcelas (1 = à vista)</span>
              </label>
              {installmentCount > 1 && currentAmount > 0 && (
                <span className="text-xs text-indigo-400 font-semibold tabular-nums">
                  {installmentCount}x de {formatCurrency(Math.round((currentAmount / installmentCount) * 100) / 100)}
                </span>
              )}
            </div>
            <input
              type="number"
              step="1"
              min="1"
              max="120"
              value={installmentCount}
              onChange={e => setInstallmentCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="input-base"
              placeholder="1 (à vista) ou quantidade de parcelas"
            />
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

        {/* Histórico de Alterações de Valor */}
        {isEdit && item?.changes && item.changes.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>Histórico de Alterações ({item.changes.length})</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {[...item.changes]
                .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                .map((ch, idx) => {
                  const diff = ch.newAmount - ch.previousAmount
                  const isUp = diff > 0
                  return (
                    <div key={ch.id || idx} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/60 flex items-center justify-between text-[11px]">
                      <div>
                        <p className="font-medium text-slate-200 flex items-center gap-1">
                          <span>{formatCurrency(ch.previousAmount)}</span>
                          <span className="text-slate-500">➔</span>
                          <span className="font-bold text-slate-100">{formatCurrency(ch.newAmount)}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {format(new Date(ch.changedAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isUp ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                      }`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{formatCurrency(diff)}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3 font-semibold shadow-md">
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Lançar pendência'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

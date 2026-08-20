// src/components/organisms/ScheduledForm.tsx — Formulário de Transações Agendadas (padrão CUID)
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { createScheduled, updateScheduled, processScheduledTransactions } from '@/db/repositories/scheduled'
import PriceInput from '@/components/atoms/PriceInput'
import type { ScheduledTransaction } from '@/types'

const schema = z.object({
  accountId: z.string().min(1, 'Conta obrigatória'),
  payee: z.string().optional(),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.string().optional(),
  transferAccountId: z.string().optional(),
  frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly', 'yearly']),
  nextDate: z.string().min(1, 'Data obrigatória'),
  endDate: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function ScheduledForm({
  scheduled,
  onClose,
}: {
  scheduled?: ScheduledTransaction
  onClose: () => void
}) {
  const accounts = useAccounts() ?? []
  const isEdit = !!scheduled

  const { register, handleSubmit, watch, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: scheduled
      ? {
          accountId: scheduled.accountId,
          payee: scheduled.payee,
          amount: scheduled.amount,
          type: scheduled.type,
          categoryId: scheduled.categoryId ?? '',
          transferAccountId: scheduled.transferAccountId ?? '',
          frequency: scheduled.frequency,
          nextDate: format(new Date(scheduled.nextDate), 'yyyy-MM-dd'),
          endDate: scheduled.endDate ? format(new Date(scheduled.endDate), 'yyyy-MM-dd') : undefined,
          notes: scheduled.notes,
        }
      : { type: 'expense', frequency: 'monthly', nextDate: format(new Date(), 'yyyy-MM-dd'), accountId: '' },
  })

  const type = watch('type')
  const categoryType = type === 'income' ? 'income' : 'expense'
  const { categories, groups } = useCategoriesWithGroups(categoryType) ?? { categories: [], groups: [] }

  const groupedCategories = groups?.map(g => ({
    group: g,
    cats: categories?.filter(c => c.groupId === g.id && !c.isHidden) ?? [],
  })).filter(g => g.cats.length > 0) ?? []

  const onSubmit = async (data: FormData) => {
    const selectedCat = categories?.find(c => c.id === data.categoryId)
    const finalPayee =
      data.payee?.trim() ||
      selectedCat?.name ||
      (data.type === 'transfer' ? 'Transferência' : data.type === 'income' ? 'Renda' : 'Despesa')
    const catId = data.categoryId && data.categoryId.trim() !== '' ? data.categoryId : undefined

    const payload: Omit<ScheduledTransaction, 'id' | 'createdAt'> = {
      accountId: data.accountId,
      payee: finalPayee,
      amount: data.amount,
      type: data.type,
      categoryId: catId,
      transferAccountId: data.type === 'transfer' ? (data.transferAccountId || undefined) : undefined,
      frequency: data.frequency,
      nextDate: new Date(data.nextDate + 'T12:00:00'),
      endDate: data.endDate ? new Date(data.endDate + 'T12:00:00') : undefined,
      notes: data.notes,
      isActive: true,
    }
    if (isEdit && scheduled.id) await updateScheduled(scheduled.id, payload)
    else await createScheduled(payload)
    await processScheduledTransactions().catch(console.error)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col">

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="font-semibold text-slate-100 text-base sm:text-lg">{isEdit ? 'Editar agendamento' : 'Novo agendamento'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 pt-4 space-y-3 overflow-y-auto flex-1">

          {/* Tipo */}
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['expense', 'income', 'transfer'] as const).map(t => {
                const cfg = {
                  expense: { label: 'Despesa', active: 'border-rose-600/40 bg-rose-600/20 text-rose-300' },
                  income:  { label: 'Renda',   active: 'border-emerald-600/40 bg-emerald-600/20 text-emerald-300' },
                  transfer:{ label: 'Transfer', active: 'border-sky-600/40 bg-sky-600/20 text-sky-300' },
                }[t]
                return (
                  <label
                    key={t}
                    className={`py-2.5 rounded-xl border text-xs font-medium text-center cursor-pointer transition-all active:scale-95 ${
                      type === t ? cfg.active : 'border-slate-700 text-slate-500'
                    }`}
                  >
                    <input {...register('type')} type="radio" value={t} className="sr-only" />
                    {cfg.label}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Descrição da operação */}
          <div>
            <label className="label">
              {type === 'transfer' ? 'Descrição da transferência' : 'Descrição'}
            </label>
            <input
              {...register('payee')}
              className="input-base"
              placeholder={
                type === 'transfer'
                  ? 'Ex: Pagamento de fatura, TED…'
                  : type === 'income'
                    ? 'Ex: Salário, Aluguel recebido…'
                    : 'Ex: Netflix, Aluguel, Academia…'
              }
              autoComplete="off"
            />
            {errors.payee && <p className="text-rose-400 text-xs mt-1">{errors.payee.message}</p>}
          </div>

          {/* Valor + Conta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor</label>
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
            <div>
              <label className="label">Conta</label>
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
            </div>
          </div>

          {type === 'transfer' && (
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

          {type !== 'transfer' && (
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
                      <optgroup key={group.id} label={group.name ?? ''} className="bg-slate-950 text-indigo-300 font-semibold">
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

          {/* Frequência + Próxima data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Frequência</label>
              <select {...register('frequency')} className="input-base">
                <option value="once">Uma vez</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div>
              <label className="label">Próxima data</label>
              <input {...register('nextDate')} type="date" className="input-base" />
            </div>
          </div>

          <div>
            <label className="label">Data de fim (opcional)</label>
            <input {...register('endDate')} type="date" className="input-base" />
          </div>

          <div className="flex gap-2 pt-1 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

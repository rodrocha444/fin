// src/components/organisms/ScheduledForm.tsx — Formulário de Transações Agendadas
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { createScheduled, updateScheduled, processScheduledTransactions } from '@/services/api/scheduled'
import Modal from '@/components/atoms/Modal'
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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      title={isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
          {(['expense', 'income', 'transfer'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => control._defaultValues.type = t}
              {...register('type')}
              value={t}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === t
                  ? t === 'income' ? 'bg-emerald-600 text-white shadow-md' : t === 'expense' ? 'bg-rose-600 text-white shadow-md' : 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'expense' ? 'Despesa' : t === 'income' ? 'Renda' : 'Transferência'}
            </button>
          ))}
        </div>

        {/* Valor */}
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

        {/* Descrição / Favorecido */}
        <div>
          <label className="label">Descrição da operação</label>
          <input
            {...register('payee')}
            className="input-base"
            placeholder={type === 'transfer' ? 'Ex: Reserva de emergência, Poupança…' : 'Ex: Aluguel, Salário, Internet…'}
            autoComplete="off"
            autoFocus
          />
        </div>

        {/* Conta Origem */}
        <div>
          <label className="label">{type === 'transfer' ? 'Conta de Origem' : 'Conta'}</label>
          <select {...register('accountId')} className="input-base">
            <option value="">Selecione a conta…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {errors.accountId && <p className="text-rose-400 text-xs mt-1">{errors.accountId.message}</p>}
        </div>

        {/* Conta Destino (transferência) */}
        {type === 'transfer' && (
          <div>
            <label className="label">Conta de Destino</label>
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

        <div className="flex gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3 font-semibold shadow-md">
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar agendamento'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// src/components/organisms/DebtAccountForm.tsx — Modal para criar/editar conta de cobrança / devedor
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, UserPlus, Pencil } from 'lucide-react'
import { createDebtAccount, updateDebtAccount } from '@/db/repositories/debts'
import ColorPicker from '@/components/atoms/ColorPicker'
import type { DebtAccount } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nome do contato/conta é obrigatório'),
  phone: z.string().optional(),
  notes: z.string().optional(),
  color: z.string(),
})

type FormData = z.infer<typeof schema>

interface DebtAccountFormProps {
  account?: DebtAccount
  onClose: () => void
  onSuccess?: (id: string) => void
}

export default function DebtAccountForm({
  account,
  onClose,
  onSuccess,
}: DebtAccountFormProps) {
  const isEdit = !!account

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: account
      ? {
          name: account.name,
          phone: account.phone || '',
          notes: account.notes || '',
          color: account.color || '#6366f1',
        }
      : {
          name: '',
          phone: '',
          notes: '',
          color: '#6366f1',
        },
  })

  const color = watch('color')

  const onSubmit = async (data: FormData) => {
    let finalColor = data.color?.trim() || '#6366f1'
    if (!finalColor.startsWith('#')) finalColor = `#${finalColor}`

    try {
      if (isEdit && account.id) {
        await updateDebtAccount(account.id, {
          name: data.name,
          phone: data.phone?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          color: finalColor,
        })
        onSuccess?.(account.id)
      } else {
        const newId = await createDebtAccount({
          name: data.name,
          phone: data.phone?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          color: finalColor,
          isActive: true,
        })
        onSuccess?.(newId)
      }
      onClose()
    } catch (err: any) {
      setError('name', { type: 'manual', message: err.message || 'Erro ao salvar contato.' })
    }
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
          <div className="flex items-center gap-2 text-indigo-400">
            {isEdit ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
              {isEdit ? 'Editar Contato / Conta' : 'Novo Contato / Conta'}
            </h2>
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
          {/* Nome */}
          <div>
            <label className="label">Nome da pessoa ou entidade</label>
            <input
              {...register('name')}
              className="input-base"
              placeholder="Ex: João Silva, Mãe, Empresa X…"
              autoComplete="off"
              autoFocus
            />
            {errors.name && <p className="text-rose-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Telefone / Contato */}
          <div>
            <label className="label">Telefone / WhatsApp (opcional)</label>
            <input
              {...register('phone')}
              className="input-base"
              placeholder="Ex: (11) 99999-9999"
              autoComplete="off"
            />
          </div>

          {/* Cor */}
          <ColorPicker
            value={color}
            onChange={c => setValue('color', c, { shouldValidate: true })}
            error={errors.color?.message}
          />

          {/* Notas */}
          <div>
            <label className="label">Observações adicionais (opcional)</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="input-base py-2.5 resize-none"
              placeholder="Ex: Colega de trabalho, divisão de despesas do apartamento…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

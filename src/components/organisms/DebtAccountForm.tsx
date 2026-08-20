// src/components/organisms/DebtAccountForm.tsx — Modal para criar/editar conta de cobrança / devedor
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Pencil } from 'lucide-react'
import { createDebtAccount, updateDebtAccount } from '@/services/api/debts'
import Modal from '@/components/atoms/Modal'
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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      icon={isEdit ? <Pencil className="w-5 h-5 text-indigo-400" /> : <UserPlus className="w-5 h-5 text-indigo-400" />}
      title={isEdit ? 'Editar Contato / Conta' : 'Novo Contato / Conta'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
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
        <div className="flex gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3 font-semibold shadow-md">
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar contato'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// src/components/organisms/AccountForm.tsx — Modal / Form de Conta (No Orçamento e Fora do Orçamento)
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Lock, Landmark, CreditCard, HandCoins, Wallet, TrendingUp } from 'lucide-react'
import { createAccount, updateAccount } from '@/db/repositories/accounts'
import { createDebtAccount, updateDebtAccount } from '@/db/repositories/debts'
import { useHasAccountTransactions } from '@/hooks/useAccounts'
import PriceInput from '@/components/atoms/PriceInput'
import ColorPicker from '@/components/atoms/ColorPicker'
import type { Account, DebtAccount } from '@/types'

const optionalNumber = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : Number(v)),
  z.number().optional()
)

const optionalDay = z.preprocess(
  v => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : Number(v)),
  z.number().min(1, 'Dia deve ser entre 1 e 31').max(31, 'Dia deve ser entre 1 e 31').optional()
)

const schema = z.object({
  categoryGroup: z.enum(['on_budget', 'off_budget']),
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['checking', 'credit_card', 'off_budget', 'debt']),
  phone: z.string().optional(),
  notes: z.string().optional(),
  initialBalance: z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? 0 : Number(v)),
    z.number().default(0)
  ),
  creditLimit: optionalNumber,
  statementClosingDay: optionalDay,
  paymentDueDay: optionalDay,
  color: z.string().default('#6366f1'),
  icon: z.string().default('bank'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  account?: Account
  debtAccount?: DebtAccount
  initialCategory?: 'on_budget' | 'off_budget'
  onClose: () => void
  onSuccess?: (id: string) => void
}

export default function AccountForm({
  account,
  debtAccount,
  initialCategory = 'on_budget',
  onClose,
  onSuccess,
}: Props) {
  const isEditAccount = !!account
  const isEditDebt = !!debtAccount
  const isEdit = isEditAccount || isEditDebt

  const hasTransactions = useHasAccountTransactions(account?.id) ?? false

  const initialCatGroup = isEditDebt
    ? 'off_budget'
    : isEditAccount
    ? account.type === 'off_budget'
      ? 'off_budget'
      : 'on_budget'
    : initialCategory

  const initialType = isEditDebt
    ? 'debt'
    : account?.type
    ? account.type
    : initialCategory === 'off_budget'
    ? 'off_budget'
    : 'checking'

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: isEditDebt
      ? {
          categoryGroup: 'off_budget',
          name: debtAccount.name,
          type: 'debt',
          phone: debtAccount.phone || '',
          notes: debtAccount.notes || '',
          color: debtAccount.color || '#6366f1',
          icon: 'bank',
          initialBalance: 0,
        }
      : account
      ? {
          categoryGroup: account.type === 'off_budget' ? 'off_budget' : 'on_budget',
          name: account.name,
          type: account.type,
          initialBalance: account.initialBalance ?? 0,
          creditLimit: account.creditLimit,
          statementClosingDay: account.statementClosingDay,
          paymentDueDay: account.paymentDueDay,
          color: account.color,
          icon: account.icon,
        }
      : {
          categoryGroup: initialCatGroup,
          name: '',
          type: initialType,
          color: '#6366f1',
          icon: 'bank',
          initialBalance: 0,
          phone: '',
          notes: '',
        },
  })

  const categoryGroup = watch('categoryGroup')
  const type = watch('type')
  const color = watch('color')

  const handleCategoryChange = (cat: 'on_budget' | 'off_budget') => {
    setValue('categoryGroup', cat)
    if (cat === 'off_budget') {
      setValue('type', 'off_budget')
    } else {
      setValue('type', 'checking')
    }
  }

  const onSubmit = async (data: FormValues) => {
    let finalColor = data.color?.trim() || '#6366f1'
    if (!finalColor.startsWith('#')) finalColor = `#${finalColor}`
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(finalColor)) {
      finalColor = '#6366f1'
    }

    try {
      if (data.type === 'debt') {
        if (isEditDebt && debtAccount?.id) {
          await updateDebtAccount(debtAccount.id, {
            name: data.name.trim(),
            phone: data.phone?.trim() || undefined,
            notes: data.notes?.trim() || undefined,
            color: finalColor,
          })
          onSuccess?.(debtAccount.id)
        } else {
          const newId = await createDebtAccount({
            name: data.name.trim(),
            phone: data.phone?.trim() || undefined,
            notes: data.notes?.trim() || undefined,
            color: finalColor,
            isActive: true,
          })
          onSuccess?.(newId)
        }
      } else {
        const payload = {
          name: data.name.trim(),
          type: (data.categoryGroup === 'off_budget' ? 'off_budget' : data.type) as Account['type'],
          initialBalance: isEditAccount && hasTransactions ? (account.initialBalance ?? 0) : (data.initialBalance ?? 0),
          creditLimit: data.type === 'credit_card' && data.creditLimit ? data.creditLimit : undefined,
          statementClosingDay: data.type === 'credit_card' && data.statementClosingDay ? data.statementClosingDay : undefined,
          paymentDueDay: data.type === 'credit_card' && data.paymentDueDay ? data.paymentDueDay : undefined,
          color: finalColor,
          icon: data.icon || 'bank',
        }

        if (isEditAccount && account?.id) {
          await updateAccount(account.id, payload)
          onSuccess?.(account.id)
        } else {
          const newId = await createAccount({ ...payload, isActive: true })
          onSuccess?.(newId)
        }
      }
      onClose()
    } catch (err: any) {
      setError('name', { type: 'manual', message: err.message || 'Já existe uma conta com este nome.' })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
            {isEdit ? 'Editar conta' : 'Nova conta'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário scrollável */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Seletor de Grupo: No Orçamento vs Fora do Orçamento */}
          {!isEdit && (
            <div>
              <label className="label mb-1.5">Classificação da Conta</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('on_budget')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    categoryGroup === 'on_budget'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>No Orçamento</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('off_budget')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    categoryGroup === 'off_budget'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <HandCoins className="w-3.5 h-3.5" />
                  <span>Fora do Orçamento</span>
                </button>
              </div>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="label">
              {type === 'debt'
                ? 'Nome do Contato ou Entidade'
                : categoryGroup === 'off_budget'
                ? 'Nome da Dívida ou Investimento'
                : 'Nome da Conta'}
            </label>
            <input
              {...register('name')}
              className="input-base"
              placeholder={
                type === 'debt'
                  ? 'Ex: João Silva, Mãe, Empresa X…'
                  : categoryGroup === 'off_budget'
                  ? 'Ex: Financiamento Imobiliário, Tesouro Direto, CDB, Empréstimo…'
                  : 'Ex: Nubank, Itaú CC…'
              }
              autoComplete="off"
              autoFocus
            />
            {errors.name && <p className="text-rose-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Tipo de Conta No Orçamento */}
          {categoryGroup === 'on_budget' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Tipo de Conta</label>
                {hasTransactions && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500" /> Tipo fixo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['checking', 'credit_card'] as const).map(t => {
                  const labels = { checking: 'Conta Corrente', credit_card: 'Cartão de Crédito' }
                  const isSelected = type === t
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={hasTransactions && !isSelected}
                      onClick={() => !hasTransactions && setValue('type', t)}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-sm'
                          : hasTransactions
                          ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-50'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500 active:scale-95'
                      }`}
                    >
                      {t === 'credit_card' ? <CreditCard className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                      <span>{labels[t]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tipo de Conta Fora do Orçamento */}
          {categoryGroup === 'off_budget' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Tipo Fora do Orçamento</label>
                {hasTransactions && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500" /> Tipo fixo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={hasTransactions && type !== 'off_budget'}
                  onClick={() => !hasTransactions && setValue('type', 'off_budget')}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    type === 'off_budget'
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-sm'
                      : hasTransactions
                      ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-50'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 active:scale-95'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Dívida / Investimento</span>
                </button>
                <button
                  type="button"
                  disabled={hasTransactions && type !== 'debt'}
                  onClick={() => !hasTransactions && setValue('type', 'debt')}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    type === 'debt'
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-sm'
                      : hasTransactions
                      ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-50'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 active:scale-95'
                  }`}
                >
                  <HandCoins className="w-3.5 h-3.5" />
                  <span>Contas a Receber / Pagar</span>
                </button>
              </div>
            </div>
          )}

          {/* Telefone e Notas para Contas a Receber / Pagar */}
          {type === 'debt' && (
            <>
              <div>
                <label className="label">Telefone / WhatsApp (opcional)</label>
                <input
                  {...register('phone')}
                  className="input-base"
                  placeholder="Ex: (11) 99999-9999"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="label">Observações (opcional)</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="input-base py-2.5 resize-none"
                  placeholder="Ex: Empréstimos, compras divididas, pendências…"
                />
              </div>
            </>
          )}

          {/* Cor (Atom ColorPicker) */}
          <ColorPicker
            value={color}
            onChange={c => setValue('color', c, { shouldValidate: true })}
            error={errors.color?.message}
          />

          {/* Saldo inicial (Conta Corrente no orçamento OU Conta Fora do Orçamento) */}
          {(type === 'checking' || type === 'off_budget') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Saldo inicial</label>
                {hasTransactions && (
                  <span className="text-[11px] text-amber-400/90 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-amber-400" /> Bloqueado para edição
                  </span>
                )}
              </div>
              <Controller
                name="initialBalance"
                control={control}
                render={({ field }) => (
                  <PriceInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    disabled={hasTransactions}
                    allowNegative={true}
                  />
                )}
              />
              {type === 'off_budget' ? (
                <p className="text-[10px] text-slate-500 mt-1">
                  Valores positivos representam aplicações/investimentos. Valores negativos representam dívidas, financiamentos ou saldos devedores.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 mt-1">
                  Use positivo para saldo credor ou negativo para cheque especial / saldo devedor.
                </p>
              )}
              {hasTransactions && (
                <p className="text-[11px] text-slate-400 mt-2 flex items-start gap-1.5 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60 leading-relaxed">
                  <span>Não é possível alterar o saldo inicial porque esta conta já possui transações cadastradas. Para corrigir o saldo atual, lance uma transação de ajuste.</span>
                </p>
              )}
            </div>
          )}

          {/* Cartão de Crédito - Limite e Fatura */}
          {type === 'credit_card' && (
            <div className="space-y-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Configurações da Fatura</p>
                <span className="text-[11px] text-slate-500 font-normal">Opcional</span>
              </div>
              <div>
                <label className="label">
                  Limite de crédito <span className="text-slate-500 font-normal text-xs">(opcional)</span>
                </label>
                <Controller
                  name="creditLimit"
                  control={control}
                  render={({ field }) => (
                    <PriceInput
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
                {errors.creditLimit && <p className="text-rose-400 text-xs mt-1">{errors.creditLimit.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Dia de Fechamento</label>
                  <input
                    {...register('statementClosingDay')}
                    type="number"
                    inputMode="numeric"
                    min="1" max="31"
                    className="input-base"
                    placeholder="Ex: 15"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dia em que a fatura fecha</p>
                  {errors.statementClosingDay && <p className="text-rose-400 text-xs mt-1">{errors.statementClosingDay.message}</p>}
                </div>
                <div>
                  <label className="label">Dia de Vencimento</label>
                  <input
                    {...register('paymentDueDay')}
                    type="number"
                    inputMode="numeric"
                    min="1" max="31"
                    className="input-base"
                    placeholder="Ex: 25"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dia do pagamento</p>
                  {errors.paymentDueDay && <p className="text-rose-400 text-xs mt-1">{errors.paymentDueDay.message}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-3">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

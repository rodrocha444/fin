// src/components/molecules/CreditCardPurchaseItem.tsx — Item de linha de compra no cartão de crédito
import { Trash2, Pencil } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { CreditCardPurchase } from '@/hooks/useTransactions'

interface CreditCardPurchaseItemProps {
  purchase: CreditCardPurchase
  categoryName?: string
  onEdit?: () => void
  onDelete: () => void
}

export default function CreditCardPurchaseItem({
  purchase,
  categoryName,
  onEdit,
  onDelete,
}: CreditCardPurchaseItemProps) {
  const isExpense = purchase.type === 'expense'
  const amtColor = isExpense ? 'text-rose-400' : 'text-emerald-400'
  const timeStr = purchase.createdAt ? formatTime(purchase.createdAt) : formatTime(purchase.date)

  return (
    <div
      onClick={onEdit}
      className={`flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition-colors ${
        onEdit ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-200 truncate">{purchase.payee}</p>
          {purchase.isInstallment && purchase.installmentCount && (
            <Badge variant="violet">
              {purchase.installmentCount}x{' '}
              {purchase.installmentAmount ? `de ${formatCurrency(purchase.installmentAmount)}` : ''}
            </Badge>
          )}
          {purchase.splitGroupId && (
            <Badge variant="info">
              Divisão
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
          <span>
            {formatDate(purchase.date)}
            {timeStr ? ` às ${timeStr}` : ''}
          </span>
          <span>·</span>
          <span className="truncate">
            {purchase.type === 'transfer' ? 'Transferência / Pagamento' : categoryName ?? 'Sem categoria'}
          </span>
        </div>
        {purchase.notes && purchase.notes !== purchase.payee && <p className="text-xs text-slate-600 truncate mt-0.5">{purchase.notes}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className={`text-sm sm:text-base font-semibold tabular-nums ${amtColor}`}>
          {isExpense ? '-' : '+'}
          {formatCurrency(purchase.amount)}
        </span>

        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            title="Editar compra"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 active:bg-rose-900/30 transition-colors"
          title={purchase.isInstallment ? 'Excluir compra parcelada' : 'Excluir transação'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

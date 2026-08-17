// src/components/molecules/TransactionItem.tsx — Item de linha de transação
import { Trash2, Pencil } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { Transaction } from '@/types'

interface TransactionItemProps {
  tx: Transaction
  accountName: string
  categoryName?: string
  installmentGroup?: { totalAmount: number; installmentCount: number; installmentAmount: number }
  onEdit?: () => void
  onDelete: () => void
}

export default function TransactionItem({
  tx,
  accountName,
  categoryName,
  installmentGroup,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const amtColor =
    tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-sky-400' : 'text-rose-400'
  const prefix = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''
  const totalAmount =
    installmentGroup?.totalAmount ?? (tx.installmentTotal ? tx.installmentTotal * tx.amount : undefined)

  const timeStr = tx.createdAt ? formatTime(tx.createdAt) : formatTime(tx.date)

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/20 active:bg-slate-800/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-slate-200 truncate font-medium">{tx.payee}</p>
          {tx.installmentGroupId && (
            <Badge variant="violet">
              {tx.installmentNumber}/{tx.installmentTotal}x
            </Badge>
          )}
          {tx.isScheduledProjection && (
            <Badge variant="info">
              Agendado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-500">
            {formatDate(tx.date)}
            {timeStr && !tx.isScheduledProjection ? ` às ${timeStr}` : ''}
          </span>
          <span className="text-[10px] text-slate-600">·</span>
          <span className="text-[10px] text-slate-500 truncate">
            {tx.type === 'transfer' ? 'Transferência' : categoryName ?? <span className="italic">Sem categoria</span>}
          </span>
          <span className="text-[10px] text-slate-600">· {accountName}</span>
          {tx.installmentGroupId && totalAmount && (
            <>
              <span className="text-[10px] text-slate-600">·</span>
              <span className="text-[10px] text-violet-400 font-medium">
                Total da compra: {formatCurrency(totalAmount)}
              </span>
            </>
          )}
        </div>
        {tx.notes && <p className="text-[10px] text-slate-600 truncate mt-0.5">{tx.notes}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <span className={`text-sm font-semibold tabular-nums ${amtColor}`}>
            {prefix}
            {formatCurrency(tx.amount)}
          </span>
          {tx.installmentGroupId && totalAmount && (
            <p className="text-[10px] text-slate-400 font-medium tabular-nums">Total {formatCurrency(totalAmount)}</p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-950/40 active:bg-indigo-950/60 transition-colors"
            title="Editar transação"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-700 hover:text-rose-400 hover:bg-rose-900/20 active:bg-rose-900/30 transition-colors"
          title="Excluir transação"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

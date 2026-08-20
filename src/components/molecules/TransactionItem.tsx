// src/components/molecules/TransactionItem.tsx — Item de linha de transação
import { Trash2, Pencil, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { Transaction } from '@/types'

interface TransactionItemProps {
  tx: Transaction
  accountName: string
  transferAccountName?: string
  currentAccountId?: string
  categoryName?: string
  installmentGroup?: { totalAmount: number; installmentCount: number; installmentAmount: number }
  onEdit?: () => void
  onDelete: () => void
  onConfirmScheduled?: () => void
}

export default function TransactionItem({
  tx,
  accountName,
  transferAccountName,
  currentAccountId,
  categoryName,
  installmentGroup,
  onEdit,
  onDelete,
  onConfirmScheduled,
}: TransactionItemProps) {
  const isTransfer = tx.type === 'transfer'
  const isOutgoingTransfer = isTransfer && currentAccountId ? tx.accountId === currentAccountId : false
  const isIncomingTransfer = isTransfer && currentAccountId ? tx.transferAccountId === currentAccountId : false

  let amtColor = 'text-rose-400'
  let prefix = '-'

  if (tx.type === 'income' || isIncomingTransfer) {
    amtColor = 'text-emerald-400'
    prefix = '+'
  } else if (isOutgoingTransfer) {
    amtColor = 'text-rose-400'
    prefix = '-'
  } else if (isTransfer) {
    amtColor = 'text-sky-400'
    prefix = ''
  } else if (tx.type === 'expense') {
    amtColor = 'text-rose-400'
    prefix = '-'
  }

  let transferDetail = 'Transferência'
  if (isTransfer) {
    if (currentAccountId) {
      if (isOutgoingTransfer) {
        transferDetail = `Transferência ➔ ${transferAccountName || 'Destino'}`
      } else if (isIncomingTransfer) {
        transferDetail = `Transferência de ${accountName || 'Origem'}`
      }
    } else if (transferAccountName) {
      transferDetail = `Transferência · ${accountName} ➔ ${transferAccountName}`
    } else {
      transferDetail = `Transferência · ${accountName}`
    }
  }

  const totalAmount =
    installmentGroup?.totalAmount ?? (tx.installmentTotal ? tx.installmentTotal * tx.amount : undefined)

  const timeStr = tx.createdAt ? formatTime(tx.createdAt) : formatTime(tx.date)

  return (
    <div
      onClick={onEdit}
      className={`flex items-center gap-3 px-3 sm:px-4 py-3 border-b transition-colors ${
        tx.isScheduledProjection
          ? 'border-dashed border-sky-800/40 bg-sky-950/10 hover:bg-sky-950/20'
          : 'border-slate-800/30 hover:bg-slate-800/20 active:bg-slate-800/40'
      } ${onEdit ? 'cursor-pointer' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-slate-200 truncate font-medium">{tx.payee}</p>
          {tx.installmentGroupId && (
            <Badge variant="violet">
              {tx.installmentNumber}/{tx.installmentTotal}x
            </Badge>
          )}
          {tx.splitGroupId && (
            <Badge variant="info">
              Divisão
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
          {isTransfer ? (
            <span className="text-[10px] text-sky-400/90 font-medium truncate">
              {transferDetail}
            </span>
          ) : (
            <>
              <span className="text-[10px] text-slate-500 truncate">
                {categoryName ?? <span className="italic">Sem categoria</span>}
              </span>
              <span className="text-[10px] text-slate-600">· {accountName}</span>
            </>
          )}
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

      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <div className="text-right">
          <span className={`text-sm font-semibold tabular-nums ${amtColor}`}>
            {prefix}
            {formatCurrency(tx.amount)}
          </span>
          {tx.installmentGroupId && totalAmount && (
            <p className="text-[10px] text-slate-400 font-medium tabular-nums">Total {formatCurrency(totalAmount)}</p>
          )}
        </div>

        {tx.isScheduledProjection && onConfirmScheduled && (
          <button
            onClick={onConfirmScheduled}
            className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 active:scale-95 transition-all shadow-sm"
            title="Efetivar e transformar em transação real"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Efetivar</span>
          </button>
        )}

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
          title={tx.isScheduledProjection ? "Remover agendamento" : "Excluir transação"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// src/utils/debts.ts — Helpers para Contas a Receber/Pagar, Histórico de Alterações e Evolução Temporal
import type { DebtItem, DebtItemChange } from '@/types'

const CHANGES_TAG_REGEX = /<!--\s*fin_changes:([\s\S]*?)-->/

interface RawSerializedChange {
  id: string
  debtItemId: string
  previousAmount: number
  newAmount: number
  changedAt: string
  notes?: string
}

/**
 * Extrai anotações limpas do usuário e histórico estruturado de alterações de valor a partir do campo notes bruto.
 */
export function parseDebtItemNotesAndChanges(rawNotes: string | null | undefined): {
  notes: string | undefined
  changes: DebtItemChange[]
} {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return { notes: undefined, changes: [] }
  }

  const match = rawNotes.match(CHANGES_TAG_REGEX)
  if (!match) {
    return { notes: rawNotes.trim() || undefined, changes: [] }
  }

  let changes: DebtItemChange[] = []
  try {
    const parsed = JSON.parse(match[1].trim()) as RawSerializedChange[]
    if (Array.isArray(parsed)) {
      changes = parsed.map(c => ({
        id: c.id,
        debtItemId: c.debtItemId,
        previousAmount: Number(c.previousAmount) || 0,
        newAmount: Number(c.newAmount) || 0,
        changedAt: new Date(c.changedAt),
        notes: c.notes,
      }))
    }
  } catch (err) {
    console.warn('[debts] Falha ao desserializar histórico de alterações do item:', err)
  }

  const cleanNotes = rawNotes.replace(CHANGES_TAG_REGEX, '').trim()
  return {
    notes: cleanNotes || undefined,
    changes,
  }
}

/**
 * Serializa o histórico de alterações embutido no campo notes de forma segura e transparente.
 */
export function formatDebtItemNotesWithChanges(
  notes: string | null | undefined,
  changes: DebtItemChange[] | undefined
): string | null {
  const cleanNotes = (notes || '').replace(CHANGES_TAG_REGEX, '').trim()

  if (!changes || changes.length === 0) {
    return cleanNotes || null
  }

  const serialized: RawSerializedChange[] = changes.map(c => ({
    id: c.id,
    debtItemId: c.debtItemId,
    previousAmount: c.previousAmount,
    newAmount: c.newAmount,
    changedAt: c.changedAt instanceof Date ? c.changedAt.toISOString() : new Date(c.changedAt).toISOString(),
    notes: c.notes,
  }))

  const tag = `<!-- fin_changes:${JSON.stringify(serialized)} -->`
  if (!cleanNotes) {
    return tag
  }

  return `${cleanNotes}\n\n${tag}`
}

/**
 * Retorna o valor vigente de uma parcela / item de cobrança em uma data específica.
 * Permite que relatórios e gráficos históricos reflitam a evolução exata no dia da alteração.
 */
export function getDebtItemAmountAtDate(item: DebtItem, targetDate: Date): number {
  const itemCreatedAt = new Date(item.createdAt)
  // Se o ponto histórico for anterior à criação da pendência, seu valor era zero
  if (itemCreatedAt > targetDate) {
    return 0
  }

  const changes = item.changes
  if (!changes || changes.length === 0) {
    return item.amount
  }

  // Ordena cronologicamente
  const sorted = [...changes].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())

  // Se a data for anterior à primeira alteração registrada, o valor vigente era o valor original (previousAmount da primeira)
  const firstChangeDate = new Date(sorted[0].changedAt)
  if (targetDate < firstChangeDate) {
    return sorted[0].previousAmount
  }

  // Encontra a alteração mais recente cuja data seja menor ou igual a targetDate
  let effectiveAmount = sorted[0].newAmount
  for (const ch of sorted) {
    const chDate = new Date(ch.changedAt)
    if (chDate <= targetDate) {
      effectiveAmount = ch.newAmount
    } else {
      break
    }
  }

  return effectiveAmount
}

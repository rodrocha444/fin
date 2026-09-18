// src/utils/accountingPeriod.ts — Gerenciamento e sincronização nuvem do Início do Período Contábil
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getSupabaseClient } from '@/services/supabase'

const STORAGE_KEY = 'fin_accounting_start_date'
const EVENT_KEY = 'finplan_accounting_period_changed'
const SYSTEM_PAYEE_ID = 'system_accounting_period'

/**
 * Retorna o ID isolado por usuário no formato system_accounting_period_<uid>
 */
async function getSystemPayeeId(): Promise<string> {
  const client = getSupabaseClient()
  if (!client) return SYSTEM_PAYEE_ID
  try {
    const { data } = await client.auth.getSession()
    const uid = data.session?.user?.id
    return uid ? `system_accounting_period_${uid}` : SYSTEM_PAYEE_ID
  } catch {
    return SYSTEM_PAYEE_ID
  }
}

/**
 * Obtém a data configurada como início do período contábil (formato YYYY-MM-DD) ou null
 */
export function getAccountingStartDate(): string | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(STORAGE_KEY)
  if (!val || val.trim() === '') return null
  return val.trim()
}

/**
 * Sincroniza a data de início contábil do Supabase para o dispositivo local
 */
export async function syncAccountingStartDateWithRemote(): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return getAccountingStartDate()

  try {
    const targetId = await getSystemPayeeId()

    // Busca o registro do usuário (seja pelo ID com UID ou legado)
    const { data } = await (client.from('payees') as any)
      .select('*')
      .like('id', 'system_accounting_period%')
      .limit(1)
      .maybeSingle()

    if (data && data.name) {
      const remoteDate = String(data.name).trim()
      const localDate = getAccountingStartDate()
      if (remoteDate !== localDate) {
        localStorage.setItem(STORAGE_KEY, remoteDate)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { date: remoteDate } }))
        }
      }

      // Se o registro estava com ID legado, migra para o ID isolado por UID
      if (data.id !== targetId && targetId !== SYSTEM_PAYEE_ID) {
        await (client.from('payees') as any).upsert({
          id: targetId,
          name: remoteDate,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        await (client.from('payees') as any).delete().eq('id', data.id)
      }

      return remoteDate
    } else {
      // Se não há no remoto, mas temos local, sincroniza para o remoto com o ID único
      const localDate = getAccountingStartDate()
      if (localDate) {
        await (client.from('payees') as any).upsert({
          id: targetId,
          name: localDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }
  } catch {
    // Silencioso em caso de falha transitória de rede
  }

  return getAccountingStartDate()
}

/**
 * Salva ou remove a data de início do período contábil localmente e no Supabase
 */
export async function setAccountingStartDate(date: string | null): Promise<void> {
  const clean = date?.trim() || null

  if (typeof window !== 'undefined') {
    if (!clean) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, clean)
    }
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { date: clean } }))
  }

  const client = getSupabaseClient()
  if (client) {
    try {
      const targetId = await getSystemPayeeId()
      if (clean) {
        await (client.from('payees') as any).upsert({
          id: targetId,
          name: clean,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        // Remove ID legado se diferente do targetId
        if (targetId !== SYSTEM_PAYEE_ID) {
          await (client.from('payees') as any).delete().eq('id', SYSTEM_PAYEE_ID)
        }
      } else {
        await (client.from('payees') as any).delete().like('id', 'system_accounting_period%')
      }
    } catch (err) {
      console.warn('Falha ao sincronizar período contábil no Supabase:', err)
    }
  }
}

/**
 * Retorna o mês inicial (YYYY-MM) a partir da data de início contábil, ou null se não configurado
 */
export function getAccountingStartMonth(): string | null {
  const dateStr = getAccountingStartDate()
  if (!dateStr) return null
  return dateStr.substring(0, 7)
}

/**
 * Verifica se uma data específica é anterior ao início do período contábil
 */
export function isDateBeforeAccountingStart(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const startStr = getAccountingStartDate()
  if (!startStr) return false

  const targetStr = typeof date === 'string'
    ? (date.length >= 10 ? date.substring(0, 10) : format(new Date(date), 'yyyy-MM-dd'))
    : format(date, 'yyyy-MM-dd')

  return targetStr < startStr
}

/**
 * Verifica se um mês (YYYY-MM) é anterior ao mês do início contábil
 */
export function isMonthBeforeAccountingStart(monthKey: string): boolean {
  const startMonth = getAccountingStartMonth()
  if (!startMonth) return false
  return monthKey < startMonth
}

/**
 * Hook React reativo para ler e atualizar a data de início do período contábil
 */
export function useAccountingPeriod() {
  const [startDate, setStartDateState] = useState<string | null>(() => getAccountingStartDate())

  useEffect(() => {
    // Sincroniza inicialmente com o Supabase para dispositivos móveis
    syncAccountingStartDateWithRemote().then((remoteDate) => {
      if (remoteDate) setStartDateState(remoteDate)
    })

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ date: string | null }>
      setStartDateState(customEvent.detail?.date ?? getAccountingStartDate())
    }

    window.addEventListener(EVENT_KEY, handleUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        setStartDateState(getAccountingStartDate())
      }
    })

    return () => {
      window.removeEventListener(EVENT_KEY, handleUpdate)
    }
  }, [])

  const updateStartDate = (newDate: string | null) => {
    setAccountingStartDate(newDate)
    setStartDateState(newDate ? newDate.trim() : null)
  }

  return {
    startDate,
    startMonth: startDate ? startDate.substring(0, 7) : null,
    hasRestriction: Boolean(startDate),
    setStartDate: updateStartDate,
  }
}

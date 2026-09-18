import { getSupabaseClient } from '@/services/supabase'
import type { UserSubscription, SubscriptionStatus, BillingPeriod } from '@/types/subscription'
import { notifyDataChanged } from './events'

interface SubscriptionDbRow {
  user_id: string
  customer_id: string | null
  status: string
  entitlement_id: string | null
  plan_id: string | null
  billing_period: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export async function getUserSubscriptionFromDb(userId: string): Promise<UserSubscription | null> {
  try {
    const rawClient = getSupabaseClient()
    if (!rawClient) return null
    const client = rawClient as any

    const { data, error } = await client
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      // Se a tabela ainda não foi criada no Supabase pelo usuário, retorna null silenciosamente
      return null
    }

    if (!data) return null

    const row = data as SubscriptionDbRow
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null
    const isPro = row.status === 'pro' && (!expiresAt || expiresAt.getTime() > Date.now())

    return {
      userId: row.user_id,
      status: (row.status as SubscriptionStatus) || 'free',
      entitlementId: row.entitlement_id ?? undefined,
      planId: row.plan_id ?? undefined,
      billingPeriod: (row.billing_period as BillingPeriod) ?? undefined,
      expiresAt,
      isActive: isPro,
      isPro,
      updatedAt: new Date(row.updated_at),
    }
  } catch {
    return null
  }
}

export async function syncUserSubscriptionToDb(payload: {
  userId: string
  customerId?: string
  status: SubscriptionStatus
  entitlementId?: string
  planId?: string
  billingPeriod?: BillingPeriod
  expiresAt?: Date | null
}): Promise<void> {
  try {
    const rawClient = getSupabaseClient()
    if (!rawClient) return
    const client = rawClient as any

    const row = {
      user_id: payload.userId,
      customer_id: payload.customerId ?? null,
      status: payload.status,
      entitlement_id: payload.entitlementId ?? null,
      plan_id: payload.planId ?? null,
      billing_period: payload.billingPeriod ?? null,
      expires_at: payload.expiresAt ? payload.expiresAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await client
      .from('user_subscriptions')
      .upsert(row, { onConflict: 'user_id' })

    if (!error) {
      notifyDataChanged('user_subscriptions' as any, 'update', payload.userId)
    }
  } catch {
    // Ignora silenciosamente se o banco não estiver disponível
  }
}

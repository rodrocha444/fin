// src/types/subscription.ts — Tipos de Assinatura e Planos (RevenueCat)
// ─────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'free' | 'pro' | 'past_due' | 'canceled'

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime'

export interface UserSubscription {
  userId: string
  status: SubscriptionStatus
  entitlementId?: string
  planId?: string
  billingPeriod?: BillingPeriod
  expiresAt?: Date | null
  isActive: boolean
  isPro: boolean
  updatedAt?: Date
}

export interface SubscriptionPackage {
  id: string
  identifier: string
  title: string
  description?: string
  priceString: string
  price: number
  currency: string
  period: BillingPeriod
  rawPackage?: any
}

export interface SubscriptionOffering {
  identifier: string
  packages: SubscriptionPackage[]
  monthly?: SubscriptionPackage
  annual?: SubscriptionPackage
}

export interface SubscriptionContextValue {
  isPro: boolean
  status: SubscriptionStatus
  subscription: UserSubscription | null
  offerings: SubscriptionOffering | null
  isLoading: boolean
  isPaywallOpen: boolean
  openPaywall: () => void
  closePaywall: () => void
  purchase: (pkg: SubscriptionPackage) => Promise<boolean>
  restore: () => Promise<boolean>
  refetchStatus: () => Promise<void>
}

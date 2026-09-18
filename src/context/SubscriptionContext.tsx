// src/context/SubscriptionContext.tsx — Gerenciamento global de Assinatura e Planos Pro
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  initRevenueCat,
  resetRevenueCatUser,
  fetchCustomerInfo,
  fetchOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/revenuecat'
import {
  getUserSubscriptionFromDb,
  syncUserSubscriptionToDb,
} from '@/services/api/subscription'
import type {
  SubscriptionContextValue,
  UserSubscription,
  SubscriptionOffering,
  SubscriptionPackage,
  SubscriptionStatus,
} from '@/types/subscription'
import { useAlert } from '@/context/ConfirmContext'

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const showAlert = useAlert()

  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [offerings, setOfferings] = useState<SubscriptionOffering | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaywallOpen, setIsPaywallOpen] = useState(false)

  const openPaywall = useCallback(() => setIsPaywallOpen(true), [])
  const closePaywall = useCallback(() => setIsPaywallOpen(false), [])

  const loadSubscriptionData = useCallback(async (userId: string) => {
    setIsLoading(true)
    try {
      // 1. Inicializa o SDK RevenueCat para o usuário
      await initRevenueCat(userId)

      // 2. Busca dados de ofertas (planos)
      const off = await fetchOfferings()
      setOfferings(off)

      // 3. Busca status no RevenueCat
      const rcSub = await fetchCustomerInfo(userId)

      if (rcSub.isPro) {
        setSubscription(rcSub)
        // Sincroniza espelho com o Supabase
        await syncUserSubscriptionToDb({
          userId,
          status: 'pro',
          entitlementId: rcSub.entitlementId,
          planId: rcSub.planId,
          billingPeriod: rcSub.billingPeriod,
          expiresAt: rcSub.expiresAt,
        })
      } else {
        // Fallback: Verifica se no Supabase consta como Pro (ex: via webhook server-side)
        const dbSub = await getUserSubscriptionFromDb(userId)
        if (dbSub && dbSub.isPro) {
          setSubscription(dbSub)
        } else {
          setSubscription(rcSub)
        }
      }
    } catch (err) {
      console.warn('[SubscriptionContext] Erro ao carregar dados de assinatura:', err)
      setSubscription({
        userId,
        status: 'free',
        isActive: false,
        isPro: false,
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setIsLoading(false)
      resetRevenueCatUser()
      return
    }

    loadSubscriptionData(user.id)
  }, [user, loadSubscriptionData])

  const purchase = useCallback(
    async (pkg: SubscriptionPackage): Promise<boolean> => {
      if (!user) {
        await showAlert({
          title: 'Faça Login',
          message: 'Você precisa estar conectado em sua conta para assinar o Fin Pro.',
        })
        return false
      }

      setIsLoading(true)
      const result = await purchasePackage(pkg, user.email)
      setIsLoading(false)

      if (result.success) {
        await loadSubscriptionData(user.id)
        closePaywall()
        await showAlert({
          title: '🎉 Bem-vindo ao Pro!',
          message: 'Sua assinatura foi confirmada com sucesso. Todos os recursos avançados já estão liberados!',
        })
        return true
      }

      if (result.error && !result.error.includes('cancelada')) {
        await showAlert({
          title: 'Falha no Pagamento',
          message: result.error,
        })
      }
      return false
    },
    [user, loadSubscriptionData, closePaywall, showAlert]
  )

  const restore = useCallback(async (): Promise<boolean> => {
    if (!user) return false

    setIsLoading(true)
    try {
      const restored = await restorePurchases(user.id)
      setIsLoading(false)

      if (restored.isPro) {
        setSubscription(restored)
        await syncUserSubscriptionToDb({
          userId: user.id,
          status: 'pro',
          entitlementId: restored.entitlementId,
          planId: restored.planId,
          billingPeriod: restored.billingPeriod,
          expiresAt: restored.expiresAt,
        })
        await showAlert({
          title: 'Compras Restauradas',
          message: 'Sua assinatura Pro foi localizada e ativada nesta conta!',
        })
        return true
      }

      await showAlert({
        title: 'Nenhuma Assinatura Ativa',
        message: 'Não localizamos nenhuma compra ativa vinculada ao seu usuário.',
      })
      return false
    } catch (err: any) {
      setIsLoading(false)
      await showAlert({
        title: 'Erro ao Restaurar',
        message: err?.message || 'Não foi possível restaurar suas compras no momento.',
      })
      return false
    }
  }, [user, showAlert])

  const refetchStatus = useCallback(async () => {
    if (user) {
      await loadSubscriptionData(user.id)
    }
  }, [user, loadSubscriptionData])

  const isPro = Boolean(subscription?.isPro)
  const status: SubscriptionStatus = subscription?.status || 'free'

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        status,
        subscription,
        offerings,
        isLoading,
        isPaywallOpen,
        openPaywall,
        closePaywall,
        purchase,
        restore,
        refetchStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription deve ser utilizado dentro de um SubscriptionProvider')
  }
  return context
}

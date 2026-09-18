// src/services/revenuecat.ts — Abstração Unificada do RevenueCat (Web/PWA, iOS e Android)
import { Purchases, type CustomerInfo, type Offerings, type Package } from '@revenuecat/purchases-js'
import type { SubscriptionOffering, SubscriptionPackage, UserSubscription, BillingPeriod } from '@/types/subscription'

// Entitlement esperado configurado no RevenueCat Dashboard (default: 'pro')
export const REVENUECAT_ENTITLEMENT_ID = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'pro'

// Chaves de API por plataforma
export function getRevenueCatApiKey(): string | null {
  const isCapacitor = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.())
  const capacitorPlatform = isCapacitor ? (window as any).Capacitor?.getPlatform?.() : null

  if (capacitorPlatform === 'ios') {
    return import.meta.env.VITE_REVENUECAT_IOS_KEY || null
  }
  if (capacitorPlatform === 'android') {
    return import.meta.env.VITE_REVENUECAT_ANDROID_KEY || null
  }

  // Web / PWA
  return (
    import.meta.env.VITE_REVENUECAT_WEB_KEY ||
    import.meta.env.VITE_REVENUECAT_PUBLIC_KEY ||
    import.meta.env.VITE_REVENUECAT_API_KEY ||
    null
  )
}

let isInitialized = false
let currentUserId: string | null = null

/**
 * Retorna se o runtime é nativo (Capacitor iOS ou Android)
 */
export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.())
}

/**
 * Inicializa a instância do SDK do RevenueCat para o usuário autenticado.
 */
export async function initRevenueCat(userId: string): Promise<boolean> {
  const apiKey = getRevenueCatApiKey()
  if (!apiKey) {
    console.info('[RevenueCat] Nenhuma chave de API configurada. Modo demonstração/offline ativado.')
    currentUserId = userId
    return false
  }

  try {
    if (isNativePlatform()) {
      // Se estiver executando em container Capacitor com plugin nativo instalado
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.configure === 'function') {
        await NativePurchases.configure({ apiKey, appUserID: userId })
        isInitialized = true
        currentUserId = userId
        return true
      }
    }

    // Web / PWA via purchases-js
    if (!Purchases.isConfigured()) {
      Purchases.configure({
        apiKey,
        appUserId: userId,
      })
    } else if (currentUserId !== userId) {
      const purchases = Purchases.getSharedInstance()
      await purchases.changeUser(userId)
    }

    isInitialized = true
    currentUserId = userId
    return true
  } catch (err) {
    console.error('[RevenueCat] Falha ao inicializar SDK:', err)
    return false
  }
}

/**
 * Limpa o identificador do usuário ao efetuar logout
 */
export async function resetRevenueCatUser(): Promise<void> {
  currentUserId = null
  if (!isInitialized) return

  try {
    if (isNativePlatform()) {
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.logOut === 'function') {
        await NativePurchases.logOut()
      }
      return
    }

    // No Web SDK purchases-js, podemos redefinir para um ID anônimo novo gerado
    if (Purchases.isConfigured()) {
      const purchases = Purchases.getSharedInstance()
      const anonId = `anon_${Math.random().toString(36).slice(2, 12)}`
      await purchases.changeUser(anonId)
    }
  } catch (err) {
    console.warn('[RevenueCat] Aviso ao limpar usuário no logout:', err)
  }
}

/**
 * Avalia se o CustomerInfo possui o entitlement Pro ativo
 */
export function checkCustomerProStatus(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo || !customerInfo.entitlements) return false
  const activeEntitlements = customerInfo.entitlements.active
  return Boolean(activeEntitlements && activeEntitlements[REVENUECAT_ENTITLEMENT_ID])
}

/**
 * Extrai os detalhes de assinatura a partir do CustomerInfo do RevenueCat
 */
export function parseCustomerSubscription(
  userId: string,
  customerInfo: CustomerInfo | null | undefined
): UserSubscription {
  if (!customerInfo) {
    return {
      userId,
      status: 'free',
      isActive: false,
      isPro: false,
    }
  }

  const entitlement = customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID]
  const isPro = Boolean(entitlement)

  let billingPeriod: BillingPeriod | undefined
  if (entitlement?.productIdentifier?.toLowerCase().includes('annual') || entitlement?.productIdentifier?.toLowerCase().includes('year')) {
    billingPeriod = 'annual'
  } else if (entitlement?.productIdentifier?.toLowerCase().includes('month')) {
    billingPeriod = 'monthly'
  }

  const expiresDate = entitlement?.expirationDate ? new Date(entitlement.expirationDate) : null

  return {
    userId,
    status: isPro ? 'pro' : 'free',
    entitlementId: entitlement?.identifier,
    planId: entitlement?.productIdentifier,
    billingPeriod,
    expiresAt: expiresDate,
    isActive: isPro,
    isPro,
  }
}

/**
 * Busca o status atual do usuário no RevenueCat
 */
export async function fetchCustomerInfo(userId: string): Promise<UserSubscription> {
  const apiKey = getRevenueCatApiKey()
  if (!apiKey) {
    return {
      userId,
      status: 'free',
      isActive: false,
      isPro: false,
    }
  }

  try {
    if (isNativePlatform()) {
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.getCustomerInfo === 'function') {
        const { customerInfo } = await NativePurchases.getCustomerInfo()
        return parseCustomerSubscription(userId, customerInfo)
      }
    }

    if (!Purchases.isConfigured()) {
      await initRevenueCat(userId)
    }

    if (Purchases.isConfigured()) {
      const purchases = Purchases.getSharedInstance()
      const info = await purchases.getCustomerInfo()
      return parseCustomerSubscription(userId, info)
    }
  } catch (err) {
    console.warn('[RevenueCat] Falha ao consultar customerInfo:', err)
  }

  return {
    userId,
    status: 'free',
    isActive: false,
    isPro: false,
  }
}

/**
 * Converte um pacote do RevenueCat para nosso tipo normalizado SubscriptionPackage
 */
function normalizePackage(pkg: Package): SubscriptionPackage {
  const identifier = pkg.identifier
  const product = pkg.rcBillingProduct
  const isAnnual = identifier.toLowerCase().includes('annual') || pkg.rcBillingProduct?.identifier?.toLowerCase().includes('annual')
  const period: BillingPeriod = isAnnual ? 'annual' : 'monthly'

  return {
    id: pkg.identifier,
    identifier: pkg.identifier,
    title: product?.displayName || (isAnnual ? 'Plano Anual' : 'Plano Mensal'),
    description: product?.description || (isAnnual ? 'Cobrado anualmente (economia garantida)' : 'Cobrado mensalmente com flexibilidade'),
    priceString: product?.currentPrice?.formattedPrice || (isAnnual ? 'R$ 119,90/ano' : 'R$ 14,90/mês'),
    price: product?.currentPrice?.amount ? product.currentPrice.amount / 100 : (isAnnual ? 119.90 : 14.90),
    currency: product?.currentPrice?.currency || 'BRL',
    period,
    rawPackage: pkg,
  }
}

/**
 * Pacotes de fallback para visualização quando chaves ainda não foram configuradas
 */
export function getMockOfferings(): SubscriptionOffering {
  const monthly: SubscriptionPackage = {
    id: '$rc_monthly',
    identifier: '$rc_monthly',
    title: 'Plano Mensal',
    description: 'Acesso total a todos os recursos. Cancele quando quiser.',
    priceString: 'R$ 14,90 / mês',
    price: 14.90,
    currency: 'BRL',
    period: 'monthly',
  }

  const annual: SubscriptionPackage = {
    id: '$rc_annual',
    identifier: '$rc_annual',
    title: 'Plano Anual',
    description: 'Equivalente a R$ 9,99/mês. Mais de 30% de economia.',
    priceString: 'R$ 119,90 / ano',
    price: 119.90,
    currency: 'BRL',
    period: 'annual',
  }

  return {
    identifier: 'default',
    packages: [monthly, annual],
    monthly,
    annual,
  }
}

/**
 * Busca as ofertas e pacotes disponíveis configurados no dashboard do RevenueCat
 */
export async function fetchOfferings(): Promise<SubscriptionOffering | null> {
  const apiKey = getRevenueCatApiKey()
  if (!apiKey) {
    return getMockOfferings()
  }

  try {
    if (isNativePlatform()) {
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.getOfferings === 'function') {
        const { current } = await NativePurchases.getOfferings()
        if (current && current.availablePackages) {
          const packages: SubscriptionPackage[] = current.availablePackages.map((p: any) => ({
            id: p.identifier,
            identifier: p.identifier,
            title: p.product.title,
            description: p.product.description,
            priceString: p.product.priceString,
            price: p.product.price,
            currency: p.product.currencyCode,
            period: p.packageType === 'ANNUAL' ? 'annual' : 'monthly',
            rawPackage: p,
          }))
          return {
            identifier: current.identifier,
            packages,
            monthly: packages.find(p => p.period === 'monthly'),
            annual: packages.find(p => p.period === 'annual'),
          }
        }
      }
    }

    if (Purchases.isConfigured()) {
      const purchases = Purchases.getSharedInstance()
      const offerings: Offerings = await purchases.getOfferings()
      const currentOffering = offerings.current

      if (currentOffering && currentOffering.availablePackages.length > 0) {
        const packages = currentOffering.availablePackages.map(normalizePackage)
        return {
          identifier: currentOffering.identifier,
          packages,
          monthly: packages.find(p => p.period === 'monthly') || packages[0],
          annual: packages.find(p => p.period === 'annual') || packages[1],
        }
      }
    }
  } catch (err) {
    console.warn('[RevenueCat] Falha ao carregar offerings do servidor, usando fallback:', err)
  }

  return getMockOfferings()
}

/**
 * Realiza o checkout/compra de um plano
 */
export async function purchasePackage(
  pkg: SubscriptionPackage,
  customerEmail?: string
): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
  const apiKey = getRevenueCatApiKey()
  if (!apiKey) {
    return {
      success: false,
      error: 'RevenueCat não configurado. Por favor, adicione sua chave pública no arquivo .env.',
    }
  }

  try {
    if (isNativePlatform()) {
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.purchasePackage === 'function') {
        const result = await NativePurchases.purchasePackage({ aPackage: pkg.rawPackage })
        const isPro = checkCustomerProStatus(result.customerInfo)
        return { success: isPro, customerInfo: result.customerInfo }
      }
    }

    if (Purchases.isConfigured() && pkg.rawPackage) {
      const purchases = Purchases.getSharedInstance()
      const result = await purchases.purchase({
        rcPackage: pkg.rawPackage,
        customerEmail,
      })
      const isPro = checkCustomerProStatus(result.customerInfo)
      return { success: isPro, customerInfo: result.customerInfo }
    }

    return { success: false, error: 'Pacote indisponível para checkout direto.' }
  } catch (err: any) {
    if (err?.errorCode === 1 || err?.message?.includes('UserCancelled')) {
      return { success: false, error: 'Compra cancelada pelo usuário.' }
    }
    return { success: false, error: err?.message || 'Falha ao processar pagamento.' }
  }
}

/**
 * Restaura compras anteriores (necessário em iOS / Android)
 */
export async function restorePurchases(userId: string): Promise<UserSubscription> {
  if (isNativePlatform()) {
    try {
      const NativePurchases = (window as any).Purchases
      if (NativePurchases && typeof NativePurchases.restorePurchases === 'function') {
        const { customerInfo } = await NativePurchases.restorePurchases()
        return parseCustomerSubscription(userId, customerInfo)
      }
    } catch (err) {
      console.warn('[RevenueCat] Erro ao restaurar compras nativas:', err)
    }
  }

  // Em web / purchases-js, a sincronização de getCustomerInfo já obtém o estado mais recente
  return fetchCustomerInfo(userId)
}

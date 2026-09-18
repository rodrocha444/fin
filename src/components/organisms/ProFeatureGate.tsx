// src/components/organisms/ProFeatureGate.tsx — Protetor de Funcionalidades Pro
import React from 'react'
import { Sparkles, Lock } from 'lucide-react'
import { useSubscription } from '@/context/SubscriptionContext'
import ProBadge from '@/components/atoms/ProBadge'

interface ProFeatureGateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  title?: string
  description?: string
  compact?: boolean
}

export default function ProFeatureGate({
  children,
  fallback,
  title = 'Recurso Exclusivo FinPlan Pro',
  description = 'Faça upgrade para ter acesso a relatórios avançados, projeções ilimitadas e muito mais.',
  compact = false,
}: ProFeatureGateProps) {
  const { isPro, openPaywall } = useSubscription()

  if (isPro) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={openPaywall}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors"
      >
        <Lock className="w-3.5 h-3.5 text-amber-400" />
        <span>Desbloquear no Pro</span>
      </button>
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-black border border-amber-500/30 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-amber-400" />
      </div>

      <div className="space-y-1 max-w-sm">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <ProBadge size="sm" variant="gold" />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>

      <button
        type="button"
        onClick={openPaywall}
        className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-md shadow-amber-500/10 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4 text-amber-300" />
        <span>Conhecer o FinPlan Pro</span>
      </button>
    </div>
  )
}

// src/components/organisms/PaywallModal.tsx — Paywall de Assinatura FinPlan Pro
import React, { useState } from 'react'
import {
  Sparkles, CheckCircle2, ShieldCheck, Zap,
  TrendingUp, Layers, RefreshCw, X
} from 'lucide-react'
import Modal from '@/components/atoms/Modal'
import { useSubscription } from '@/context/SubscriptionContext'
import ProBadge from '@/components/atoms/ProBadge'

export default function PaywallModal() {
  const {
    isPaywallOpen,
    closePaywall,
    offerings,
    purchase,
    restore,
    isLoading,
    isPro,
  } = useSubscription()

  const [selectedPeriod, setSelectedPeriod] = useState<'annual' | 'monthly'>('annual')
  const [isRestoring, setIsRestoring] = useState(false)

  const annualPkg = offerings?.annual
  const monthlyPkg = offerings?.monthly

  const activePkg = selectedPeriod === 'annual' ? (annualPkg || monthlyPkg) : (monthlyPkg || annualPkg)

  const handleSubscribe = async () => {
    if (!activePkg) return
    await purchase(activePkg)
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    await restore()
    setIsRestoring(false)
  }

  const PRO_BENEFITS = [
    {
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      title: 'Contas & Cartões Ilimitados',
      description: 'Adicione quantas contas correntes, cartões e patrimônio desejar.',
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      title: 'Relatórios & Gráficos Avançados',
      description: 'Evolução patrimonial, cashflow e detalhamento por categoria.',
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      title: 'Projeções de Meses Futuros',
      description: 'Planejamento orçamentário ilimitado com cálculo de rollover.',
    },
    {
      icon: <RefreshCw className="w-4 h-4 text-cyan-400" />,
      title: 'Sincronização Nuvem Multi-dispositivo',
      description: 'Seus dados sincronizados em tempo real no PWA, iOS e Android.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-purple-400" />,
      title: 'Backup & Segurança Contínua',
      description: 'Exportação completa de dados e proteção RLS com criptografia.',
    },
  ]

  return (
    <Modal
      isOpen={isPaywallOpen}
      onClose={closePaywall}
      size="lg"
      hideCloseButton
      className="bg-black border-slate-800 text-slate-100"
      contentClassName="p-0"
    >
      <div className="relative">
        {/* Botão Fechar no canto superior direito */}
        <button
          type="button"
          onClick={closePaywall}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero do Topo */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden border-b border-slate-900 bg-gradient-to-b from-indigo-950/40 via-purple-950/20 to-black">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg shadow-indigo-500/20 mb-3">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-400" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">FinPlan</h2>
            <ProBadge size="md" variant="gold" />
          </div>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Desbloqueie todo o poder do Orçamento Base Zero e tenha controle financeiro absoluto.
          </p>
        </div>

        {/* Lista de Vantagens */}
        <div className="px-6 py-5 space-y-3.5 border-b border-slate-900 bg-slate-950/50">
          {PRO_BENEFITS.map((b, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                {b.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-200 leading-snug">{b.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Seleção de Planos */}
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Opção Anual */}
            <button
              type="button"
              onClick={() => setSelectedPeriod('annual')}
              className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                selectedPeriod === 'annual'
                  ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border-indigo-500 ring-1 ring-indigo-500 shadow-md shadow-indigo-500/10'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                Economize ~33%
              </div>
              <span className={`text-xs font-semibold ${selectedPeriod === 'annual' ? 'text-indigo-400' : 'text-slate-400'}`}>
                Anual
              </span>
              <span className="text-lg font-bold text-white mt-1">
                {annualPkg?.priceString || 'R$ 119,90/ano'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                R$ 9,99/mês faturado anualmente
              </span>
            </button>

            {/* Opção Mensal */}
            <button
              type="button"
              onClick={() => setSelectedPeriod('monthly')}
              className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                selectedPeriod === 'monthly'
                  ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border-indigo-500 ring-1 ring-indigo-500 shadow-md shadow-indigo-500/10'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <span className={`text-xs font-semibold ${selectedPeriod === 'monthly' ? 'text-indigo-400' : 'text-slate-400'}`}>
                Mensal
              </span>
              <span className="text-lg font-bold text-white mt-1">
                {monthlyPkg?.priceString || 'R$ 14,90/mês'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Cobrado todo mês com flexibilidade
              </span>
            </button>
          </div>

          {/* Botão de Ação CTA */}
          <button
            type="button"
            disabled={isLoading || isPro}
            onClick={handleSubscribe}
            className="w-full py-3.5 px-4 mt-2 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPro ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>Você já é Pro!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Assinar {selectedPeriod === 'annual' ? 'Plano Anual' : 'Plano Mensal'}</span>
              </>
            )}
          </button>

          {/* Ações Secundárias e Termos Legais */}
          <div className="pt-2 text-center space-y-2">
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring || isLoading}
              className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
            >
              {isRestoring ? 'Restaurando...' : 'Já possui uma assinatura? Restaurar compras'}
            </button>

            <p className="text-[10px] text-slate-400 leading-tight">
              A cobrança será efetuada na sua conta vinculada. A assinatura é renovada automaticamente ao final do período, podendo ser cancelada a qualquer momento nas preferências da sua loja de aplicativos ou configurações de conta.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

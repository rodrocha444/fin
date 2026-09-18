// src/components/organisms/OnboardingWizardModal.tsx — Assistente de Inicialização e Onboarding Guiado
import { useState } from 'react'
import {
  Sparkles,
  Wallet,
  Layers,
  ArrowRight,
  CheckCircle2,
  Check,
  Building,
  Loader2,
  X
} from 'lucide-react'
import { createAccount } from '@/services/api/accounts'
import { createGroup, createCategory } from '@/services/api/categories'
import { useAuth } from '@/context/AuthContext'
import { useFinancialData } from '@/context/FinancialDataContext'
import PriceInput from '@/components/atoms/PriceInput'
import { formatCurrency } from '@/utils/format'

interface OnboardingWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted?: () => void
}

const DEFAULT_GROUPS_PRESETS = [
  {
    name: 'Moradia & Contas Fixas',
    type: 'expense' as const,
    categories: ['Aluguel / Condomínio', 'Energia & Água', 'Internet & Celular'],
  },
  {
    name: 'Alimentação & Dia a Dia',
    type: 'expense' as const,
    categories: ['Supermercado', 'Restaurantes & Lanches', 'Farmácia & Saúde'],
  },
  {
    name: 'Transporte',
    type: 'expense' as const,
    categories: ['Combustível', 'Transporte Público / Aplicativos'],
  },
  {
    name: 'Lazer & Estilo de Vida',
    type: 'expense' as const,
    categories: ['Lazer & Passeios', 'Assinaturas & Streaming'],
  },
  {
    name: 'Metas & Futuro',
    type: 'expense' as const,
    categories: ['Reserva de Emergência'],
  },
  {
    name: 'Rendas & Receitas',
    type: 'income' as const,
    categories: ['Salário', 'Rendas Extras'],
  },
]

export default function OnboardingWizardModal({
  isOpen,
  onClose,
  onCompleted,
}: OnboardingWizardModalProps) {
  const { user } = useAuth()
  const { accounts, categoryGroups } = useFinancialData()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accountName, setAccountName] = useState('Conta Corrente')
  const [initialBalance, setInitialBalance] = useState(0)
  const [useDefaultCategories, setUseDefaultCategories] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const markCompleted = () => {
    if (user?.id) {
      localStorage.setItem(`finplan_onboarding_completed_${user.id}`, 'true')
    }
    localStorage.setItem('finplan_onboarding_completed', 'true')
    onCompleted?.()
    onClose()
  }

  const handleCreateSetup = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      // 1. Cria conta se ainda não existir nenhuma com o mesmo nome
      const existingAccount = accounts.find(a => a.name.toLowerCase() === accountName.trim().toLowerCase())
      if (!existingAccount && accountName.trim()) {
        await createAccount({
          name: accountName.trim(),
          type: 'checking',
          initialBalance: Math.max(0, initialBalance),
          color: '#6366f1',
          icon: 'bank',
          isActive: true,
        })
      }

      // 2. Cria categorias padrão caso solicitado e o usuário não possua grupos
      if (useDefaultCategories && categoryGroups.length === 0) {
        for (const preset of DEFAULT_GROUPS_PRESETS) {
          const groupId = await createGroup({
            name: preset.name,
            type: preset.type,
          })

          for (const catName of preset.categories) {
            await createCategory({
              groupId,
              name: catName,
            })
          }
        }
      }

      setStep(3)
    } catch (err: any) {
      console.error('Erro no setup inicial:', err)
      setErrorMsg(err.message || 'Ocorreu um erro ao configurar seu ambiente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl shadow-indigo-950/40 flex flex-col max-h-[90vh]">
        {/* Header com indicador de etapas */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Configuração Inicial Guiada</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step === i
                      ? 'w-6 bg-indigo-500'
                      : step > i
                      ? 'w-2.5 bg-emerald-500'
                      : 'w-2.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={markCompleted}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors"
              title="Pular assistente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo da Etapa */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                  <Wallet className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-100">Qual é o seu saldo atual?</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  No Orçamento Base Zero, começamos registrando o dinheiro real que você tem hoje na sua conta bancária principal.
                </p>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="label text-xs">Nome da Conta</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      placeholder="Ex: Nubank, Itaú, Santander..."
                      className="input-base pl-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Saldo Atual em Conta</label>
                  <PriceInput
                    value={initialBalance}
                    onChange={setInitialBalance}
                    className="input-base text-lg font-bold text-emerald-400 py-2.5"
                    placeholder="R$ 0,00"
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Esse valor será o seu ponto de partida para distribuir nos envelopes.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-1.5 shadow-lg"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-100">Envelopes de Gastos (Categorias)</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Para facilitar seu início, preparamos uma estrutura com as principais despesas e receitas do dia a dia.
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  onClick={() => setUseDefaultCategories(!useDefaultCategories)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    useDefaultCategories
                      ? 'bg-indigo-950/30 border-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center mt-0.5 transition-colors ${
                      useDefaultCategories
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    {useDefaultCategories && <Check className="w-3.5 h-3.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      Carregar categorias essenciais recomendadas
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Moradia, Supermercado, Transporte, Lazer, Metas e Salário. Você poderá renomear ou criar novas a qualquer momento.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Moradia & Contas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Alimentação & Mercado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>Transporte & Apps</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    <span>Metas & Reserva</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="btn-secondary py-2.5 px-4 text-xs"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleCreateSetup}
                  disabled={isSubmitting}
                  className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-1.5 shadow-lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Configurando...</span>
                    </>
                  ) : (
                    <>
                      <span>Salvar e Avançar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-100">Tudo Pronto para Começar!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Você tem <strong className="text-emerald-400">{formatCurrency(initialBalance)}</strong> pronto para distribuir.
                </p>
              </div>

              {/* Guia em 3 passos do ZBB */}
              <div className="space-y-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-900/60 text-indigo-400 border border-indigo-700/50 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </span>
                  <div>
                    <h5 className="font-semibold text-slate-200">Distribua o Saldo nos Envelopes</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      Na tela de <strong>Orçamento</strong>, clique na coluna <em>Orçado</em> das categorias que você precisará pagar este mês até zerar o "Disponível a Orçar".
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-900/60 text-indigo-400 border border-indigo-700/50 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </span>
                  <div>
                    <h5 className="font-semibold text-slate-200">Lance as Compras na Hora</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      Conforme gastar, use o botão <strong>+</strong> para registrar a despesa. O valor será abatido do envelope correspondente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-900/60 text-indigo-400 border border-indigo-700/50 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </span>
                  <div>
                    <h5 className="font-semibold text-slate-200">Cartão de Crédito Descomplicado</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      Suas compras no cartão já consom os envelopes de gastos. O pagamento da fatura é apenas uma transferência interna sem categoria.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={markCompleted}
                className="btn-primary w-full py-3 text-xs font-bold tracking-wide shadow-lg shadow-indigo-950/40"
              >
                Ir para o Meu Orçamento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

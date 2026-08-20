// src/components/organisms/ResetDatabaseModal.tsx — Modal de confirmação com delay de 10s para zerar banco
import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, Clock } from 'lucide-react'
import { clearEntireDatabase } from '@/services/api/backup'
import { useAlert } from '@/context/ConfirmContext'
import Modal from '@/components/atoms/Modal'

interface ResetDatabaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ResetDatabaseModal({
  isOpen,
  onClose,
  onSuccess,
}: ResetDatabaseModalProps) {
  const [countdown, setCountdown] = useState(10)
  const [isResetting, setIsResetting] = useState(false)
  const showAlert = useAlert()

  useEffect(() => {
    if (!isOpen) return

    setCountdown(10)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirmReset = async () => {
    if (countdown > 0 || isResetting) return
    try {
      setIsResetting(true)
      await clearEntireDatabase()
      onSuccess?.()
      onClose()
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao zerar banco',
        message: err?.message || 'Ocorreu um erro ao zerar o banco de dados.',
        variant: 'danger',
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isResetting ? () => {} : onClose}
      size="md"
      icon={
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
      }
      title="Zerar Banco de Dados"
    >
      <div className="p-5 space-y-4">
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs sm:text-sm space-y-2">
          <p className="font-semibold text-rose-300">
            ⚠️ Esta é uma ação destrutiva e irreversível!
          </p>
          <p className="text-slate-300 leading-relaxed">
            Todos os seus dados locais e no Supabase serão permanentemente apagados, incluindo:
          </p>
          <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
            <li>Todas as contas bancárias e cartões de crédito</li>
            <li>Histórico completo de transações e parcelamentos</li>
            <li>Orçamentos mensais e metas</li>
            <li>Transações agendadas e categorias personalizadas</li>
          </ul>
        </div>

        {/* Countdown indicator */}
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono">
          <Clock className="w-4 h-4 text-slate-400" />
          {countdown > 0 ? (
            <span className="text-amber-400">
              Aguarde <strong className="text-base text-amber-300 font-bold">{countdown}s</strong> para habilitar a confirmação
            </span>
          ) : (
            <span className="text-emerald-400 font-medium">
              Confirmação liberada. Proceda com cautela.
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="btn-secondary flex-1 py-3 text-xs sm:text-sm font-medium"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={countdown > 0 || isResetting}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              countdown > 0 || isResetting
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-70'
                : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-900/30'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {isResetting
              ? 'Zerando…'
              : countdown > 0
              ? `Aguarde (${countdown}s)`
              : 'Zerar Banco de Dados'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

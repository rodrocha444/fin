// src/context/ConfirmContext.tsx — Contexto global para Diálogos de Confirmação e Alertas Personalizados
import React, { createContext, useContext, useState, useCallback } from 'react'
import { AlertTriangle, Info, CheckCircle2, Trash2, Copy, Check } from 'lucide-react'
import Modal from '@/components/atoms/Modal'

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success'

export interface ConfirmOptions {
  title?: string
  message: string | React.ReactNode
  details?: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
}

export interface AlertOptions {
  title?: string
  message: string | React.ReactNode
  details?: string
  buttonText?: string
  variant?: DialogVariant
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
  alert: (options: AlertOptions | string) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAlert, setIsAlert] = useState(false)
  const [copied, setCopied] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Confirmação',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
  })
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    return new Promise(resolve => {
      const parsedOpts: ConfirmOptions =
        typeof opts === 'string'
          ? {
              title: 'Confirmar Ação',
              message: opts,
              confirmText: 'Confirmar',
              cancelText: 'Cancelar',
              variant: 'danger',
            }
          : {
              title: opts.title ?? 'Confirmar Ação',
              message: opts.message,
              details: opts.details,
              confirmText: opts.confirmText ?? 'Confirmar',
              cancelText: opts.cancelText ?? 'Cancelar',
              variant: opts.variant ?? 'danger',
            }

      setOptions(parsedOpts)
      setIsAlert(false)
      setCopied(false)
      setResolver(() => resolve)
      setIsOpen(true)
    })
  }, [])

  const showAlert = useCallback((opts: AlertOptions | string): Promise<void> => {
    return new Promise(resolve => {
      const parsedOpts: ConfirmOptions =
        typeof opts === 'string'
          ? {
              title: 'Aviso',
              message: opts,
              confirmText: 'OK',
              variant: 'info',
            }
          : {
              title: opts.title ?? 'Aviso',
              message: opts.message,
              details: opts.details,
              confirmText: opts.buttonText ?? 'OK',
              variant: opts.variant ?? 'info',
            }

      setOptions(parsedOpts)
      setIsAlert(true)
      setCopied(false)
      setResolver(() => () => resolve())
      setIsOpen(true)
    })
  }, [])

  const handleConfirm = () => {
    setIsOpen(false)
    resolver?.(true)
  }

  const handleCancel = () => {
    setIsOpen(false)
    resolver?.(false)
  }

  const handleCopyText = async () => {
    const textToCopy = [
      typeof options.message === 'string' ? options.message : '',
      options.details ? `\nDetalhes:\n${options.details}` : '',
    ].filter(Boolean).join('\n')

    if (!textToCopy.trim()) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Falha ao copiar texto:', err)
    }
  }

  const variant = options.variant ?? 'danger'
  const isErrorOrWarning = variant === 'danger' || variant === 'warning'

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-5 h-5 text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/20',
          btnConfirm: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-rose-950/30',
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/20',
          btnConfirm: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-amber-950/30',
        }
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          iconBg: 'bg-emerald-500/10 border-emerald-500/20',
          btnConfirm: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/30',
        }
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-400" />,
          iconBg: 'bg-sky-500/10 border-sky-500/20',
          btnConfirm: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-950/30',
        }
    }
  }

  const styles = getVariantStyles()
  const canCopy = typeof options.message === 'string' || !!options.details

  return (
    <ConfirmContext.Provider value={{ confirm, alert: showAlert }}>
      {children}

      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        size="sm"
        hideCloseButton={false}
        title={
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${styles.iconBg} flex-shrink-0`}>
              {styles.icon}
            </div>
            <span className="font-semibold text-slate-100 text-base">{options.title}</span>
          </div>
        }
      >
        <div className="p-5 space-y-4">
          {/* Mensagem Principal */}
          <div
            className={`text-slate-300 text-sm leading-relaxed whitespace-pre-line relative ${
              isErrorOrWarning
                ? 'p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-200'
                : ''
            }`}
          >
            {options.message}

            {options.details && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-xs font-mono text-slate-400 bg-slate-900/80 p-2 rounded-lg max-h-36 overflow-y-auto break-all">
                {options.details}
              </div>
            )}
          </div>

          {/* Botão de Copiar Erro / Mensagem para Área de Transferência */}
          {canCopy && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 active:bg-slate-700/80 border border-slate-800 transition-colors"
                title="Copiar mensagem para a área de transferência"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isErrorOrWarning ? 'Copiar descrição de erro' : 'Copiar mensagem'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2.5 pt-1">
            {!isAlert && (
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary flex-1 py-2.5 text-xs sm:text-sm font-medium"
              >
                {options.cancelText || 'Cancelar'}
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              autoFocus
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 ${styles.btnConfirm}`}
            >
              {options.confirmText || 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider')
  }
  return context.confirm
}

export function useAlert() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useAlert deve ser usado dentro de ConfirmProvider')
  }
  return context.alert
}

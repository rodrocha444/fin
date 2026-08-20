// src/context/ConfirmContext.tsx — Contexto global para Diálogos de Confirmação e Alertas Personalizados
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, Info, CheckCircle2, Trash2, Copy, Check } from 'lucide-react'
import { copyToClipboard } from '@/utils/clipboard'
import Modal from '@/components/atoms/Modal'

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success'

export interface ConfirmOptions {
  title?: string
  message: string | React.ReactNode
  details?: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
  countdownSeconds?: number
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

/** Função auxiliar para extrair texto limpo de ReactNodes / JSX */
function extractTextFromNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractTextFromNode).join(' ')
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return extractTextFromNode(props.children)
  }
  if (typeof node === 'object' && 'message' in (node as any)) {
    return String((node as any).message)
  }
  return String(node)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAlert, setIsAlert] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const messageContainerRef = useRef<HTMLDivElement>(null)

  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Confirmação',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
  })
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  // ── Gerenciamento do timer de contagem regressiva ───────────────────────────
  useEffect(() => {
    if (!isOpen || countdown <= 0) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, countdown])

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
              countdownSeconds: opts.countdownSeconds,
            }

      setOptions(parsedOpts)
      setCountdown(parsedOpts.countdownSeconds && parsedOpts.countdownSeconds > 0 ? parsedOpts.countdownSeconds : 0)
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
      setCountdown(0)
      setIsAlert(true)
      setCopied(false)
      setResolver(() => () => resolve())
      setIsOpen(true)
    })
  }, [])

  const handleConfirm = () => {
    if (countdown > 0) return
    setIsOpen(false)
    resolver?.(true)
  }

  const handleCancel = () => {
    setIsOpen(false)
    setCountdown(0)
    resolver?.(false)
  }

  const handleCopyText = async () => {
    // 1. Prioriza o texto real renderizado no DOM dentro do container
    const domText = messageContainerRef.current?.innerText || messageContainerRef.current?.textContent || ''
    
    // 2. Se o DOM estiver vazio, faz fallback extraindo do ReactNode
    const nodeText = extractTextFromNode(options.message)
    const baseText = domText.trim() || nodeText.trim()
    
    const parts = [baseText]
    if (options.details && !baseText.includes(options.details.trim())) {
      parts.push(`Detalhes: ${options.details.trim()}`)
    }

    const fullText = parts.filter(Boolean).join('\n\n').trim()
    if (!fullText) return

    const success = await copyToClipboard(fullText)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
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
          <div
            ref={messageContainerRef}
            className={`text-slate-300 text-sm leading-relaxed whitespace-pre-line select-text relative ${
              isErrorOrWarning
                ? 'p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-200'
                : ''
            }`}
          >
            <div className="select-text break-words">
              {options.message}
            </div>

            {options.details && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-xs font-mono text-slate-400 bg-slate-900/80 p-2.5 rounded-lg max-h-36 overflow-y-auto break-all select-text">
                {options.details}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCopyText}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95 touch-manipulation cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-950/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 active:bg-slate-700'
              }`}
              title="Copiar mensagem para a área de transferência"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Copiado para a área de transferência!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>{isErrorOrWarning ? 'Copiar descrição de erro' : 'Copiar mensagem'}</span>
                </>
              )}
            </button>
          </div>

          {/* Barra de contagem regressiva (se houver countdown ativo) */}
          {options.countdownSeconds && options.countdownSeconds > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Tempo de segurança para confirmação
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {countdown > 0 ? `${countdown}s restantes` : 'Liberado para confirmar'}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((options.countdownSeconds - countdown) / options.countdownSeconds) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

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
              disabled={countdown > 0}
              autoFocus={countdown === 0}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 ${
                countdown > 0
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                  : styles.btnConfirm
              }`}
            >
              {countdown > 0
                ? `${options.confirmText || 'Confirmar'} (${countdown}s)`
                : (options.confirmText || 'Confirmar')}
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

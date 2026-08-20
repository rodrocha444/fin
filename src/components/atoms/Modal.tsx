// src/components/atoms/Modal.tsx — Componente base reutilizável de Modal e Bottom Sheet com Focus Trap
import React, { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: string
  icon?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  children: React.ReactNode
  footer?: React.ReactNode
  headerRight?: React.ReactNode
  hideCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  className?: string
  contentClassName?: string
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

const SIZE_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
}

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  )
  return elements.filter(el => {
    return (
      el.offsetParent !== null &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true'
    )
  })
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  children,
  footer,
  headerRight,
  hideCloseButton = false,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className = '',
  contentClassName = '',
  initialFocusRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  // Captura o elemento ativo anterior e define o foco inicial no modal
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null

      const focusTimer = setTimeout(() => {
        if (!dialogRef.current) return

        if (initialFocusRef?.current) {
          initialFocusRef.current.focus()
          return
        }

        // Procura elemento com autofocus explícito
        const autofocusElement = dialogRef.current.querySelector<HTMLElement>(
          '[autofocus], [data-autofocus]'
        )
        if (autofocusElement) {
          autofocusElement.focus()
          return
        }

        // Foca no primeiro elemento interativo do modal
        const focusables = getFocusableElements(dialogRef.current)
        if (focusables.length > 0) {
          focusables[0].focus()
        } else {
          dialogRef.current.focus()
        }
      }, 50)

      return () => clearTimeout(focusTimer)
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.()
      previousActiveElementRef.current = null
    }
  }, [isOpen, initialFocusRef])

  // Gerenciamento de teclado: Escape e Focus Trap com Tab / Shift+Tab
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !dialogRef.current) return

      if (closeOnEsc && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const focusables = getFocusableElements(dialogRef.current)
        if (focusables.length === 0) {
          e.preventDefault()
          dialogRef.current.focus()
          return
        }

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]
        const activeElement = document.activeElement as HTMLElement | null

        // Se o foco de alguma forma escapou para fora do modal, redireciona para dentro
        if (!dialogRef.current.contains(activeElement)) {
          e.preventDefault()
          firstElement.focus()
          return
        }

        if (e.shiftKey) {
          // Shift + Tab: se estiver no primeiro elemento, move para o último
          if (activeElement === firstElement || activeElement === dialogRef.current) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: se estiver no último elemento, volta para o primeiro
          if (activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    },
    [isOpen, closeOnEsc, onClose]
  )

  useEffect(() => {
    if (!isOpen) return

    document.addEventListener('keydown', handleKeyDown)
    // Trava o scroll do body para evitar rolagem de fundo
    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalStyle
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={e => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full ${SIZE_CLASSES[size]} shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col overflow-hidden relative outline-none ${className}`}
      >
        {/* Handle tátil no mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Cabeçalho do Modal (se houver título ou botão fechar) */}
        {(title || !hideCloseButton || headerRight) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {icon && <div className="flex-shrink-0">{icon}</div>}
              <div className="min-w-0">
                {typeof title === 'string' ? (
                  <h2 className="font-semibold text-slate-100 text-base sm:text-lg truncate">
                    {title}
                  </h2>
                ) : (
                  title
                )}
                {description && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {headerRight}
              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
        <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
          {children}
        </div>

        {/* Rodapé opcional */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-800/80 bg-slate-950/40 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// src/hooks/usePwaInstall.ts — Hook para detecção e acionamento da instalação PWA
import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const DISMISS_KEY = 'fin_pwa_prompt_dismissed_at'
const LEGACY_DISMISS_KEY = 'finplan_pwa_prompt_dismissed_at'
const DAYS_TO_WAIT_AFTER_DISMISS = 7

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true)

  useEffect(() => {
    // 1. Detecta se já está rodando em modo standalone (PWA instalado)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches
      const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
      return isStandaloneMedia || isNavigatorStandalone
    }

    const standalone = checkStandalone()
    setIsStandalone(standalone)

    // 2. Detecta se é iOS / Safari
    const ua = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(ua)
    setIsIos(isIosDevice)

    // 3. Verifica se o usuário já dispensou recentemente
    const dismissedAt = localStorage.getItem(DISMISS_KEY) || localStorage.getItem(LEGACY_DISMISS_KEY)
    if (dismissedAt) {
      const diffMs = Date.now() - parseInt(dismissedAt, 10)
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      setIsDismissed(diffDays < DAYS_TO_WAIT_AFTER_DISMISS)
    } else {
      setIsDismissed(false)
    }

    // 4. Captura evento nativo do Chromium (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return choice.outcome === 'accepted'
    } catch (err) {
      console.error('Erro ao acionar instalação PWA:', err)
      return false
    }
  }, [deferredPrompt])

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }, [])

  const resetDismiss = useCallback(() => {
    localStorage.removeItem(DISMISS_KEY)
    localStorage.removeItem(LEGACY_DISMISS_KEY)
    setIsDismissed(false)
  }, [])

  // Pode exibir se não estiver instalado e não foi dispensado
  const canInstall = !isStandalone && (!!deferredPrompt || isIos)
  const shouldShowBanner = canInstall && !isDismissed

  return {
    isStandalone,
    isIos,
    canInstall,
    shouldShowBanner,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    dismissPrompt,
    resetDismiss,
  }
}

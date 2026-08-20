// src/utils/clipboard.ts — Utilitário universal de cópia para área de transferência compatível com iOS/Safari e Android
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // Feedback tátil no mobile quando suportado
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(35)
    } catch {
      // Ignora erro de vibração
    }
  }

  // 1. Tenta a Clipboard API moderna (se disponível no contexto)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Continua para o fallback de seleção do iOS se a Promise for rejeitada
    }
  }

  // 2. Fallback resiliente com textarea para iOS Safari, WebKit e ambientes HTTP locais
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Estilos para evitar zoom, pulo de tela ou scroll no iOS
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '-9999px'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.fontSize = '16px' // Evita zoom no iOS Safari
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)

    // Seleção otimizada para iOS
    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent || '')
    if (isIOS) {
      const range = document.createRange()
      range.selectNodeContents(textArea)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      textArea.setSelectionRange(0, 999999)
    } else {
      textArea.focus()
      textArea.select()
    }

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('Erro ao executar fallback de cópia:', err)
    return false
  }
}

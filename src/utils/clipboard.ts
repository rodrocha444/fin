// src/utils/clipboard.ts — Utilitário universal de cópia para área de transferência compatível com iOS/Safari e Android
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof text !== 'string') return false
  const cleanText = text.trim()
  if (!cleanText) return false

  // Feedback tátil no mobile quando suportado
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(35)
    } catch {
      // Ignora erro de vibração
    }
  }

  // 1. Tenta a Clipboard API moderna (em contexto seguro)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    (window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ) {
    try {
      await navigator.clipboard.writeText(cleanText)
      return true
    } catch {
      // Continua para o fallback de seleção do iOS se a Promise for rejeitada
    }
  }

  // 2. Fallback 100% compatível com iOS Safari / WebKit e ambientes HTTP locais
  try {
    const textArea = document.createElement('textarea')
    textArea.value = cleanText

    // Mantém na tela (top: 0, left: 0), mas quase transparente e sem interferir
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '1px'
    textArea.style.height = '1px'
    textArea.style.padding = '0'
    textArea.style.margin = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.fontSize = '16px' // Impede zoom no iOS Safari
    textArea.style.opacity = '0.01'
    textArea.style.zIndex = '-9999'

    // Importante no iOS Safari: permitir foco e seleção
    textArea.contentEditable = 'true'
    textArea.readOnly = false

    document.body.appendChild(textArea)

    // Seleção robusta no iOS
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, cleanText.length)

    const range = document.createRange()
    range.selectNodeContents(textArea)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    textArea.setSelectionRange(0, 999999)

    const successful = document.execCommand('copy')

    if (selection) {
      selection.removeAllRanges()
    }
    document.body.removeChild(textArea)

    return successful
  } catch (err) {
    console.error('Erro ao executar fallback de cópia:', err)
    return false
  }
}

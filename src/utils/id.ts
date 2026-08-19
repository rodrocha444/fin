// src/utils/id.ts
// ─────────────────────────────────────────────────────────────
// Gerador e utilitários de identificadores únicos no padrão CUID2
// ─────────────────────────────────────────────────────────────

import { init, isCuid } from '@paralleldrive/cuid2'

// Cria gerador de CUID padrão (24 caracteres, aleatório, seguro e ordenável)
export const createId = init({
  length: 24,
})

export { isCuid }

/**
 * Garante que um valor seja retornado como ID string.
 * Se já for uma string válida ou número, retorna como string ou gera um novo CUID se vazio.
 */
export function ensureId(id?: string | number | null): string {
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    return String(id)
  }
  return createId()
}

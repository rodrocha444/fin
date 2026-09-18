// src/utils/id.ts
// ─────────────────────────────────────────────────────────────
// Gerador e utilitários de identificadores únicos no padrão CUID2
// ─────────────────────────────────────────────────────────────

import { init } from '@paralleldrive/cuid2'

// Cria gerador de CUID padrão (24 caracteres, aleatório, seguro e ordenável)
export const createId = init({
  length: 24,
})

/**
 * Valida e sanitiza identificadores antes de interpolá-los em filtros PostgREST (.or),
 * prevenindo manipulação de sintaxe e filter injection.
 */
export function assertSafeFilterId(id: string): string {
  const clean = String(id || '').trim()
  if (!clean || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error(`Identificador inválido ou inseguro para consulta: "${id}"`)
  }
  return clean
}


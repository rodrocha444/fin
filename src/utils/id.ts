// src/utils/id.ts
// ─────────────────────────────────────────────────────────────
// Gerador e utilitários de identificadores únicos no padrão CUID2
// ─────────────────────────────────────────────────────────────

import { init } from '@paralleldrive/cuid2'

// Cria gerador de CUID padrão (24 caracteres, aleatório, seguro e ordenável)
export const createId = init({
  length: 24,
})

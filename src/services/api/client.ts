// src/services/api/client.ts — Obtenção do cliente Supabase para API
import { getSupabaseClient } from '@/services/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Retorna o cliente Supabase para operações de API.
 * O cliente não carrega o tipo Database diretamente aqui para compatibilidade
 * com as funções de mutação (insert/update) que recebem objetos genéricos dos
 * conversores *ToRow(). A tipagem do schema é feita nos conversores rowTo*()
 * via Tables<'tabela'> importado de @/types/database.types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClient(): SupabaseClient<any> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase não configurado. Por favor, configure as credenciais nas Configurações.')
  }
  return client
}

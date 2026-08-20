// src/services/api/client.ts — Obtenção do cliente Supabase para API
import { getSupabaseClient } from '@/services/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getClient(): SupabaseClient {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase não configurado. Por favor, configure as credenciais nas Configurações.')
  }
  return client
}

// src/services/supabase.ts — Cliente e Gerenciamento de Credenciais Supabase
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

// Limpeza preventiva de chaves legadas armazenadas no navegador
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('fin_supabase_config')
    localStorage.removeItem('finplan_supabase_config')
  } catch {
    // Silencioso em caso de restrição de storage
  }
}

/**
 * Verifica se uma chave JWT do Supabase possui a role "service_role".
 * O uso da service_role no client-side é estritamente proibido por contornar o RLS.
 */
export function isServiceRoleKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  try {
    const parts = key.trim().split('.')
    if (parts.length === 3) {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const jsonStr = atob(base64)
      const payload = JSON.parse(jsonStr)
      if (payload && (payload.role === 'service_role' || payload.iss === 'supabase-service-role')) {
        return true
      }
    }
  } catch {
    // Silencioso se não for JWT padrão
  }
  return false
}

/** Retorna as credenciais configuradas a partir das variáveis de ambiente Vite */
export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (envUrl && envAnonKey && envUrl.startsWith('http')) {
    if (isServiceRoleKey(envAnonKey)) {
      console.error('Segurança: Chave service_role detectada no .env client-side e ignorada!')
      return null
    }
    return {
      url: envUrl.trim(),
      anonKey: envAnonKey.trim(),
    }
  }

  return null
}

// Instância singleton em cache do cliente, tipado com o schema do banco
let cachedClient: SupabaseClient<Database> | null = null

/** Retorna a instância do cliente Supabase tipado ou null se não configurado */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (cachedClient) return cachedClient

  const config = getSupabaseConfig()
  if (!config) return null

  try {
    cachedClient = createClient<Database>(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
    return cachedClient
  } catch (err) {
    console.error('Falha ao instanciar Supabase Client:', err)
    return null
  }
}


/** Testa a conexão com o Supabase */
export async function testSupabaseConnection(customConfig?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  const config = customConfig || getSupabaseConfig()
  if (!config || !config.url || !config.anonKey) {
    return { success: false, message: 'URL e Chave Anon são obrigatórias.' }
  }

  if (isServiceRoleKey(config.anonKey)) {
    return {
      success: false,
      message: 'Chave rejeitada por segurança: você inseriu a chave "service_role" (admin secreta). Use apenas a chave "anon" pública no aplicativo para preservar o isolamento RLS.',
    }
  }

  try {
    const testClient = createClient<Database>(config.url, config.anonKey)
    // Tenta uma consulta simples na tabela accounts
    const { error } = await testClient.from('accounts').select('id').limit(1)

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Conectado ao Supabase, mas as tabelas ainda não foram criadas. Execute o Script SQL fornecido no painel do Supabase.',
        }
      }
      return { success: false, message: `Erro ao conectar: ${error.message} (Código: ${error.code})` }
    }

    return { success: true, message: 'Conexão com o Supabase estabelecida com sucesso!' }
  } catch (err: any) {
    return { success: false, message: `Falha de rede ou configuração inválida: ${err.message || err}` }
  }
}

// src/services/supabase.ts — Cliente e Gerenciamento de Credenciais Supabase
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

const STORAGE_KEY = 'finplan_supabase_config'

/** Retorna as credenciais configuradas (ou do .env ou do localStorage) */
export function getSupabaseConfig(): SupabaseConfig | null {
  // 1. Tenta pegar do localStorage (prioridade caso o usuário configure pela interface)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
        }
      }
    }
  } catch (e) {
    console.error('Erro ao ler credenciais do localStorage:', e)
  }

  // 2. Fallback para variáveis de ambiente Vite (.env)
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (envUrl && envAnonKey && envUrl.startsWith('http')) {
    return {
      url: envUrl.trim(),
      anonKey: envAnonKey.trim(),
    }
  }

  return null
}

/** Salva as credenciais no localStorage */
export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    url: config.url.trim(),
    anonKey: config.anonKey.trim(),
  }))
  resetSupabaseClient()
}

/** Limpa as credenciais salvas */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
  resetSupabaseClient()
}

// Instância singleton em cache do cliente
let cachedClient: SupabaseClient | null = null

/** Retorna a instância do cliente Supabase ou null se não configurado */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient

  const config = getSupabaseConfig()
  if (!config) return null

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    return cachedClient
  } catch (err) {
    console.error('Falha ao instanciar Supabase Client:', err)
    return null
  }
}

/** Reseta a instância cached */
function resetSupabaseClient(): void {
  cachedClient = null
}

/** Testa a conexão com o Supabase */
export async function testSupabaseConnection(customConfig?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  const config = customConfig || getSupabaseConfig()
  if (!config || !config.url || !config.anonKey) {
    return { success: false, message: 'URL e Chave Anon são obrigatórias.' }
  }

  try {
    const testClient = createClient(config.url, config.anonKey)
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

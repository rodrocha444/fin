// src/services/api/auth.ts — Serviços de Autenticação Supabase
import { getSupabaseClient } from '@/services/supabase'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

export async function signIn(email: string, password: string):Promise<{ user: User | null; session: Session | null }> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase não configurado.')

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw error
  }

  return { user: data.user, session: data.session }
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; session: Session | null }> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase não configurado.')

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
  })

  if (error) {
    throw error
  }

  return { user: data.user, session: data.session }
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return

  const { error } = await client.auth.signOut()
  if (error) {
    throw error
  }
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase não configurado.')

  const { error } = await client.auth.resetPasswordForEmail(email.trim())
  if (error) {
    throw error
  }
}

export async function updatePassword(password: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase não configurado.')

  const { error } = await client.auth.updateUser({ password })
  if (error) {
    throw error
  }
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const { data } = await client.auth.getSession()
  return data.session
}

export async function getUser(): Promise<User | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const { data } = await client.auth.getUser()
  return data.user
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const client = getSupabaseClient()
  if (!client) return { unsubscribe: () => {} }

  const { data: { subscription } } = client.auth.onAuthStateChange(callback)
  return { unsubscribe: () => subscription.unsubscribe() }
}

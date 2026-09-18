// src/context/AuthContext.tsx — Contexto de Autenticação Supabase
import React, { createContext, useContext, useEffect, useState, useTransition } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  resetPasswordForEmail as apiResetPassword,
  getSession,
  onAuthStateChange,
} from '@/services/api/auth'
import { getSupabaseConfig } from '@/services/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()

  const isConfigured = Boolean(getSupabaseConfig())

  useEffect(() => {
    let mounted = true

    if (!isConfigured) {
      setIsLoading(false)
      return
    }

    // Busca a sessão persistida inicial
    getSession()
      .then((initialSession) => {
        if (!mounted) return
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      })
      .catch((err) => {
        console.error('Erro ao recuperar sessão inicial:', err)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    // Escuta mudanças de auth (login, logout, token_refresh)
    const { unsubscribe } = onAuthStateChange((event, currentSession) => {
      if (!mounted) return

      startTransition(() => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setIsLoading(false)
      })

      if (event === 'SIGNED_OUT') {
        // Limpa todo o cache em memória de queries para isolamento de dados
        queryClient.clear()
      } else if (event === 'SIGNED_IN') {
        // Invalida e recarrega as queries para o novo usuário
        queryClient.invalidateQueries()
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [isConfigured, queryClient])

  const signIn = async (email: string, password: string) => {
    const result = await apiSignIn(email, password)
    setSession(result.session)
    setUser(result.user)
  }

  const signUp = async (email: string, password: string) => {
    const result = await apiSignUp(email, password)
    setSession(result.session)
    setUser(result.user)
  }

  const signOut = async () => {
    await apiSignOut()
    queryClient.clear()
    setUser(null)
    setSession(null)
  }

  const resetPassword = async (email: string) => {
    await apiResetPassword(email)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}

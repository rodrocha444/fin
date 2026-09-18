// src/context/AuthContext.tsx — Contexto de Autenticação Supabase
import React, { createContext, useContext, useEffect, useState, useTransition } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  resetPasswordForEmail as apiResetPassword,
  updatePassword as apiUpdatePassword,
  getSession,
  onAuthStateChange,
} from '@/services/api/auth'
import { getSupabaseConfig } from '@/services/supabase'
import { clearUserSessionData } from '@/utils/sessionCleanup'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserPassword: (password: string) => Promise<void>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
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

    // Escuta mudanças de auth (login, logout, token_refresh, password_recovery)
    const { unsubscribe } = onAuthStateChange((event, currentSession) => {
      if (!mounted) return

      startTransition(() => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setIsLoading(false)
      })

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        // Limpa todo o cache em memória de queries e dados locais de sessão
        clearUserSessionData()
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
    clearUserSessionData()
    queryClient.clear()
    setUser(null)
    setSession(null)
  }

  const resetPassword = async (email: string) => {
    await apiResetPassword(email)
  }

  const updateUserPassword = async (password: string) => {
    await apiUpdatePassword(password)
    setIsPasswordRecovery(false)
  }

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUserPassword,
        clearPasswordRecovery,
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

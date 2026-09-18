// src/components/organisms/ProtectedRoute.tsx — Proteção de rotas autenticadas
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium tracking-wide">Carregando autenticação...</span>
      </div>
    </div>
  )
}

export default function ProtectedRoute() {
  const { user, isLoading, isConfigured } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <PageFallback />
  }

  // Se não houver configuração do Supabase ou usuário autenticado, direciona para o login
  if (!isConfigured || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

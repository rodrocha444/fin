// src/components/atoms/SyncStatusBadge.tsx — Indicador visual de conexão com o Supabase (Cloud-Only)
import { useNavigate } from 'react-router-dom'
import { Cloud, CloudCheck, RefreshCw } from 'lucide-react'
import { useFinancialData } from '@/context/FinancialDataContext'

interface SyncStatusBadgeProps {
  compact?: boolean
  showTime?: boolean
  interactive?: boolean
  className?: string
}

export default function SyncStatusBadge({
  compact = false,
  showTime = true,
  interactive = true,
  className = '',
}: SyncStatusBadgeProps) {
  const navigate = useNavigate()
  const { isConfigured, isLoading, lastUpdated, refetch } = useFinancialData()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!interactive) return

    if (!isConfigured) {
      navigate('/settings')
    } else if (!isLoading) {
      refetch()
    }
  }

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  if (compact) {
    if (!isConfigured) {
      return (
        <button
          onClick={handleClick}
          title="Supabase não configurado (clique para configurar)"
          className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ${className}`}
        >
          <Cloud className="w-4 h-4 opacity-60" />
        </button>
      )
    }

    if (isLoading) {
      return (
        <div title="Carregando dados da nuvem..." className={`p-1.5 rounded-lg text-sky-400 bg-sky-950/40 border border-sky-800/40 ${className}`}>
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      )
    }

    return (
      <button
        onClick={handleClick}
        title={timeLabel ? `Conectado à nuvem (${timeLabel})` : 'Conectado à nuvem'}
        className={`p-1.5 rounded-lg text-emerald-400 hover:bg-slate-800 transition-colors flex items-center gap-1 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <CloudCheck className="w-4 h-4" />
      </button>
    )
  }

  if (!isConfigured) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 transition-all ${className}`}
      >
        <Cloud className="w-3.5 h-3.5 text-slate-500" />
        <span>Nuvem não configurada</span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-700/50 shadow-sm ${className}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
        <span>Atualizando…</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/30 transition-all ${className}`}
      title="Conectado e sincronizado com o Supabase. Clique para recarregar."
    >
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="font-semibold text-emerald-200">Nuvem Ativa</span>
      </div>
      {showTime && timeLabel && (
        <span className="text-[10px] text-emerald-400/80 font-normal tabular-nums">
          {timeLabel}
        </span>
      )}
    </button>
  )
}

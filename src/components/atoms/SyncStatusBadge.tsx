// src/components/atoms/SyncStatusBadge.tsx — Indicador visual de sincronização em nuvem
import { useNavigate } from 'react-router-dom'
import { Cloud, CloudCheck, CloudOff, RefreshCw, AlertCircle, CloudUpload } from 'lucide-react'
import { useSync } from '@/hooks/useSync'

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
  const { status, lastSyncAt, isSyncing, syncNow, lastError } = useSync()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!interactive) return

    if (status === 'unconfigured') {
      navigate('/settings')
    } else if (!isSyncing) {
      syncNow()
    }
  }

  // Formatação de hora amigável
  const timeLabel = lastSyncAt
    ? lastSyncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  // ── Renderização Compacta (apenas ícone / pílula mini) ──────
  if (compact) {
    if (status === 'unconfigured') {
      return (
        <button
          onClick={handleClick}
          title="Nuvem não configurada (clique para configurar)"
          className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ${className}`}
        >
          <Cloud className="w-4 h-4 opacity-60" />
        </button>
      )
    }

    if (isSyncing || status === 'syncing') {
      return (
        <div title="Sincronizando com a nuvem..." className={`p-1.5 rounded-lg text-sky-400 bg-sky-950/40 border border-sky-800/40 ${className}`}>
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      )
    }

    if (status === 'offline') {
      return (
        <button
          onClick={handleClick}
          title="Modo offline. Alterações salvas localmente."
          className={`p-1.5 rounded-lg text-amber-400 bg-amber-950/40 border border-amber-800/40 ${className}`}
        >
          <CloudOff className="w-4 h-4" />
        </button>
      )
    }

    if (status === 'error') {
      return (
        <button
          onClick={handleClick}
          title={`Erro de sincronização: ${lastError || 'Falha ao conectar'}. Clique para tentar novamente.`}
          className={`p-1.5 rounded-lg text-rose-400 bg-rose-950/40 border border-rose-800/40 ${className}`}
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      )
    }

    return (
      <button
        onClick={handleClick}
        title={timeLabel ? `Sincronizado às ${timeLabel} (clique para sincronizar agora)` : 'Sincronizado na nuvem'}
        className={`p-1.5 rounded-lg text-emerald-400 hover:bg-slate-800 transition-colors flex items-center gap-1 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <CloudCheck className="w-4 h-4" />
      </button>
    )
  }

  // ── Renderização Padrão (com rótulo e hora) ────────────────
  if (status === 'unconfigured') {
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

  if (isSyncing || status === 'syncing') {
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-700/50 shadow-sm ${className}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
        <span>Sincronizando…</span>
      </div>
    )
  }

  if (status === 'offline') {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-amber-950/50 text-amber-300 border border-amber-800/50 hover:bg-amber-900/40 transition-all ${className}`}
        title="Clique para tentar reconectar"
      >
        <CloudOff className="w-3.5 h-3.5 text-amber-400" />
        <span>Offline (Local)</span>
      </button>
    )
  }

  if (status === 'error') {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/40 transition-all ${className}`}
        title={lastError || 'Erro ao sincronizar. Clique para tentar novamente.'}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
        <span className="truncate max-w-[130px]">Erro no sync</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/30 transition-all ${className}`}
      title="Sincronizado na nuvem. Clique para sincronizar agora."
    >
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="font-semibold text-emerald-200">Sincronizado</span>
      </div>
      {showTime && timeLabel && (
        <span className="text-[10px] text-emerald-400/80 font-normal tabular-nums">
          {timeLabel}
        </span>
      )}
      <CloudUpload className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
    </button>
  )
}

import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'violet' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  danger: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
  warning: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  info: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
  violet: 'bg-violet-950/80 text-violet-300 border-violet-600/40',
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
}

export default function Badge({
  children,
  variant = 'neutral',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

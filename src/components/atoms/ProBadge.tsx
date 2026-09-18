// src/components/atoms/ProBadge.tsx — Selo visual indicativo de plano Pro
import React from 'react'
import { Sparkles } from 'lucide-react'

interface ProBadgeProps {
  size?: 'sm' | 'md'
  variant?: 'gold' | 'indigo'
  className?: string
  showIcon?: boolean
}

export default function ProBadge({
  size = 'sm',
  variant = 'gold',
  className = '',
  showIcon = true,
}: ProBadgeProps) {
  const isSm = size === 'sm'

  const colorStyles =
    variant === 'gold'
      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-600/20 text-amber-300 border-amber-500/30'
      : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30'

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border tracking-wide uppercase shadow-xs ${colorStyles} ${
        isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      {showIcon && <Sparkles className={isSm ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />}
      <span>PRO</span>
    </span>
  )
}

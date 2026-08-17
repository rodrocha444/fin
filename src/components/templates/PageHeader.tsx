import type { ReactNode } from 'react'

interface PageHeaderProps {
  children: ReactNode
  className?: string
}

export default function PageHeader({
  children,
  className = 'flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900',
}: PageHeaderProps) {
  return (
    <div
      className={className}
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      {children}
    </div>
  )
}

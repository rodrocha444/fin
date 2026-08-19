// src/components/atoms/SearchBar.tsx — Campo de busca reutilizável com ícone
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar…',
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        type="text"
        autoFocus={autoFocus}
        className="input-base !pl-10 py-2 text-xs h-9 w-full"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

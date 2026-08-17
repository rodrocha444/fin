// src/components/atoms/ColorPicker.tsx — Seletor de cores predefinidas e personalizadas
import { Pipette, Check } from 'lucide-react'

export const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  colors?: string[]
  error?: string
}

export default function ColorPicker({
  value = '#6366f1',
  onChange,
  colors = DEFAULT_COLORS,
  error,
}: ColorPickerProps) {
  const isCustom = !colors.some(c => c.toLowerCase() === value?.toLowerCase())
  const validHex = value?.startsWith('#') && (value.length === 7 || value.length === 4) ? value : '#6366f1'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label mb-0">Cor</label>
        <span className="text-[11px] text-slate-400 font-mono uppercase">{value}</span>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {colors.map(c => {
          const isSelected = value?.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`w-8 h-8 rounded-full transition-all active:scale-95 flex items-center justify-center ${
                isSelected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg'
                  : 'hover:scale-105 opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            >
              {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
            </button>
          )
        })}

        {/* Botão de cor personalizada */}
        <div className="flex items-center gap-2">
          <label
            title="Escolher cor personalizada"
            className={`relative w-8 h-8 rounded-full cursor-pointer flex items-center justify-center transition-all active:scale-95 overflow-hidden ${
              isCustom
                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg'
                : 'border border-slate-600 hover:border-slate-400 bg-gradient-to-br from-indigo-500/30 via-pink-500/30 to-emerald-500/30 hover:bg-slate-700/60'
            }`}
            style={isCustom ? { backgroundColor: value } : undefined}
          >
            <input
              type="color"
              value={validHex}
              onChange={e => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {isCustom ? (
              <Check className="w-4 h-4 text-white drop-shadow-md pointer-events-none" />
            ) : (
              <Pipette className="w-4 h-4 text-slate-300 pointer-events-none" />
            )}
          </label>

          {/* Campo para digitar código HEX */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <span className="text-slate-500 font-mono mr-0.5 select-none">#</span>
            <input
              type="text"
              maxLength={6}
              placeholder="HEX"
              value={value?.startsWith('#') ? value.slice(1) : value || ''}
              onChange={e => {
                const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                onChange(`#${clean}`)
              }}
              className="bg-transparent font-mono text-xs text-slate-200 outline-none w-16 uppercase placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

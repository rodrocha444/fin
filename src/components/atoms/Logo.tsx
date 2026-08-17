// src/components/atoms/Logo.tsx — Identidade visual (Logo & Ícone) do FinPlan
import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon'
  className?: string
}

export default function Logo({ size = 'md', variant = 'full', className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-16 h-16',
  }

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Símbolo / Ícone */}
      <div
        className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-950/50 flex-shrink-0`}
      >
        <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center overflow-hidden relative">
          {/* Brilho de fundo */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-emerald-500/20" />
          
          <svg
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-4/5 h-4/5 relative z-10 drop-shadow-md"
          >
            <defs>
              <linearGradient id="finGrad1" x1="4" y1="28" x2="30" y2="8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="0.5" stopColor="#818cf8" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="finGrad2" x1="10" y1="28" x2="26" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4f46e5" />
                <stop offset="1" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Barras de crescimento estilizadas com curva ascendente */}
            <path
              d="M7 27V21C7 19.8954 7.89543 19 9 19H10C11.1046 19 12 19.8954 12 21V27C12 28.1046 11.1046 29 10 29H9C7.89543 29 7 28.1046 7 27Z"
              fill="url(#finGrad2)"
              opacity="0.75"
            />
            <path
              d="M15 27V15C15 13.8954 15.8954 13 17 13H18C19.1046 13 20 13.8954 20 15V27C20 28.1046 19.1046 29 18 29H17C15.8954 29 15 28.1046 15 27Z"
              fill="url(#finGrad1)"
              opacity="0.9"
            />
            <path
              d="M23 27V9C23 7.89543 23.8954 7 25 7H26C27.1046 7 28 7.89543 28 9V27C28 28.1046 27.1046 29 26 29H25C23.8954 29 23 28.1046 23 27Z"
              fill="url(#finGrad1)"
            />
            {/* Linha dinâmica de tendência com seta */}
            <path
              d="M6 21L14 14L20 19L29 7.5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="29" cy="7.5" r="2.2" fill="#34d399" stroke="white" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Tipografia da Marca */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight font-extrabold leading-none">
            <span className={`text-slate-100 ${textSizes[size]}`}>Fin</span>
            <span className={`bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent ${textSizes[size]}`}>
              Plan
            </span>
          </div>
          {size !== 'sm' && (
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
              Gestão Financeira
            </span>
          )}
        </div>
      )}
    </div>
  )
}

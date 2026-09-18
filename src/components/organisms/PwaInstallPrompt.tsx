// src/components/organisms/PwaInstallPrompt.tsx — Banner e modal de incentivo à instalação PWA
import { useState } from 'react'
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export default function PwaInstallPrompt() {
  const { isStandalone, isIos, shouldShowBanner, hasNativePrompt, promptInstall, dismissPrompt } = usePwaInstall()
  const [showIosGuideModal, setShowIosGuideModal] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  if (isStandalone || !shouldShowBanner) return null

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      setIsInstalling(true)
      await promptInstall()
      setIsInstalling(false)
    } else if (isIos) {
      setShowIosGuideModal(true)
    }
  }

  return (
    <>
      {/* Banner inferior flutuante */}
      <aside
        aria-label="Instalação do Aplicativo"
        className="fixed bottom-16 lg:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-50 bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl shadow-indigo-950/40 animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-indigo-400">
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              Instale o Fin no Celular
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Tenha acesso rápido em tela cheia e registre seus gastos em poucos segundos.
            </p>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="btn-primary text-xs py-1.5 px-3 font-semibold shadow-md flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{hasNativePrompt ? 'Instalar App' : 'Como Instalar'}</span>
              </button>
              <button
                type="button"
                onClick={dismissPrompt}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
              >
                Depois
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissPrompt}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors flex-shrink-0 -mt-1 -mr-1"
            title="Dispensar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Modal explicativo específico para iOS / Safari */}
      {showIosGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Smartphone className="w-4 h-4" />
                <span>Instalar no iPhone / iPad</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuideModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              No navegador Safari do iOS, siga estes 2 passos simples:
            </p>

            <div className="space-y-2.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-400 border border-indigo-700/50 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  1
                </span>
                <p className="text-slate-300 leading-snug">
                  Toque no ícone de <strong className="text-slate-100 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-indigo-400 inline" /> Compartilhar</strong> na barra inferior do Safari.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-400 border border-indigo-700/50 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  2
                </span>
                <p className="text-slate-300 leading-snug">
                  Role o menu e toque em <strong className="text-slate-100 inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 text-indigo-400 inline" /> Adicionar à Tela de Início</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-xl">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>O Fin abrirá em tela cheia como um aplicativo nativo da App Store.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosGuideModal(false)
                dismissPrompt()
              }}
              className="btn-primary w-full py-2.5 text-xs font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}

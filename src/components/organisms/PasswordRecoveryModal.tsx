// src/components/organisms/PasswordRecoveryModal.tsx — Modal para definição de nova senha pós-recuperação
import { useState, type FormEvent } from 'react'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/atoms/Modal'

export default function PasswordRecoveryModal() {
  const { isPasswordRecovery, clearPasswordRecovery, updateUserPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isPasswordRecovery) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (password.length < 8) {
      setErrorMsg('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.')
      return
    }

    try {
      setLoading(true)
      await updateUserPassword(password)
      setSuccessMsg('Senha redefinida com sucesso!')
      setTimeout(() => {
        clearPasswordRecovery()
      }, 1500)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Falha ao redefinir a senha.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isPasswordRecovery}
      onClose={clearPasswordRecovery}
      size="sm"
      title="Redefinir Senha"
      icon={
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <KeyRound className="w-5 h-5" />
        </div>
      }
    >
      <form id="recovery-form" name="recovery-form" onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-xs text-slate-400">
          Você acessou através de um link de recuperação. Digite sua nova senha de acesso abaixo.
        </p>

        {errorMsg && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-start gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl flex items-start gap-2 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div>
          <label htmlFor="recovery-password" className="block text-xs font-medium text-slate-300 mb-1.5">
            Nova Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="recovery-password"
              name="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="No mínimo 8 caracteres"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="recovery-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
            Confirmar Nova Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="recovery-confirm-password"
              name="confirm-new-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Exibir confirmação de senha'}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={clearPasswordRecovery}
            className="btn-secondary py-2 px-3 text-xs"
          >
            Depois
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
          >
            {loading ? 'Salvando…' : 'Salvar Senha'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

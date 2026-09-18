// src/components/pages/LoginPage.tsx — Página de Autenticação (Login / Cadastro / Recuperação)
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/atoms/Logo'

type AuthMode = 'login' | 'register' | 'forgot'

export default function LoginPage() {
  const { user, signIn, signUp, resetPassword, isConfigured } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Redireciona se já estiver autenticado
  if (user) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/budget'
    return <Navigate to={from} replace />
  }

  const parseErrorMessage = (err: unknown): string => {
    if (!err || typeof err !== 'object') return 'Ocorreu um erro inesperado.'
    const msg = (err as { message?: string }).message || ''
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
    if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.'
    if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
    if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns instantes.'
    return msg || 'Falha ao autenticar. Tente novamente.'
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail.')
      return
    }

    if (mode === 'forgot') {
      try {
        setLoading(true)
        await resetPassword(email)
        setSuccessMsg('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.')
      } catch (err) {
        setErrorMsg(parseErrorMessage(err))
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) {
      setErrorMsg('Informe sua senha.')
      return
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.')
        return
      }
    }

    try {
      setLoading(true)
      if (mode === 'login') {
        await signIn(email, password)
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/budget'
        navigate(from, { replace: true })
      } else {
        await signUp(email, password)
        setSuccessMsg('Cadastro realizado! Se a confirmação de e-mail estiver ativa, cheque seu e-mail.')
      }
    } catch (err) {
      setErrorMsg(parseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">
            {mode === 'login' && 'Entrar na sua conta'}
            {mode === 'register' && 'Criar uma nova conta'}
            {mode === 'forgot' && 'Recuperar acesso'}
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            {mode === 'login' && 'Gerencie seus orçamentos e finanças com segurança'}
            {mode === 'register' && 'Comece seu planejamento financeiro de base zero'}
            {mode === 'forgot' && 'Enviaremos um link para você redefinir sua senha'}
          </p>
        </div>

        {!isConfigured && (
          <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <span className="font-semibold block">Supabase não configurado</span>
              Configure a URL e a Chave Anon nas Configurações da aplicação.
            </div>
          </div>
        )}

        {/* Card do Formulário */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/40">
          
          {/* Mensagens de Alerta */}
          {errorMsg && (
            <div className="mb-6 p-3.5 bg-red-950/50 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-3.5 bg-emerald-950/50 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* E-mail */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Senha (não exibida no modo forgot) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Senha
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null)
                        setSuccessMsg(null)
                        setMode('forgot')
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmar Senha (apenas no modo register) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' && (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Entrar</span>
                    </>
                  )}
                  {mode === 'register' && (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Criar Conta</span>
                    </>
                  )}
                  {mode === 'forgot' && (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Enviar Link de Recuperação</span>
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Alternar modos */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            {mode === 'login' && (
              <p className="text-xs text-slate-400">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null)
                    setSuccessMsg(null)
                    setMode('register')
                  }}
                  className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Cadastre-se gratuitamente
                </button>
              </p>
            )}

            {mode === 'register' && (
              <p className="text-xs text-slate-400">
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null)
                    setSuccessMsg(null)
                    setMode('login')
                  }}
                  className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Fazer login
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null)
                  setSuccessMsg(null)
                  setMode('login')
                }}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Voltar para o login
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

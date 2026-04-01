import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import LayoutAuth from '../../componentes/layout/LayoutAuth'
import useAuth from '../../hooks/useAuth'
import { useToast } from '../../contextos/ToastContexto'

const obterMensagemErroLogin = (erro) => {
  if (erro?.erro?.codigo === 'CREDENCIAIS_INVALIDAS') {
    return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.'
  }

  return erro?.erro?.mensagem || 'Erro ao fazer login. Tente novamente.'
}

const Login = () => {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!email || !senha) {
      setErro('Preencha todos os campos.')
      return
    }

    setCarregando(true)
    try {
      const usuario = await login(email, senha)
      if (!usuario.onboardingCompleto) {
        navigate('/onboarding/negocio')
      } else {
        navigate('/dashboard')
      }
    } catch (e) {
      const mensagem = obterMensagemErroLogin(e)

      if (e?.erro?.codigo === 'CREDENCIAIS_INVALIDAS') {
        setErro('')
        toast(mensagem, 'erro')
        return
      }

      setErro(mensagem)
    } finally {
      setCarregando(false)
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? ''

  return (
    <LayoutAuth>
      <h1 className="text-2xl font-semibold text-texto mb-1">Bem-vindo de volta!</h1>
      <p className="text-texto-sec text-sm mb-8">Entre na sua conta para continuar</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Campo email */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-texto mb-1.5">E-mail</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full px-4 py-2.5 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
          />
        </div>

        {/* Campo senha */}
        <div>
          <label htmlFor="login-senha" className="block text-sm font-medium text-texto mb-1.5">Senha</label>
          <div className="relative">
            <input
              id="login-senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••••"
              className="w-full px-4 py-2.5 pr-11 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-sec hover:text-texto transition-colors"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Recuperação de senha */}
        <div className="flex justify-end">
          <Link to="/recuperar-senha" className="text-sm text-primaria hover:text-primaria-escura transition-colors">
            Esqueceu a senha?
          </Link>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {erro}
          </div>
        )}

        {/* Botão entrar */}
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>

        {/* Divisor */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-borda" />
          </div>
          <div className="relative flex justify-center text-xs text-texto-sec">
            <span className="bg-white px-3">ou</span>
          </div>
        </div>

        {/* Google OAuth */}
        <a
          href={`${apiUrl}/api/auth/google`}
          className="w-full border border-borda hover:bg-gray-50 text-texto font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Entrar com Google
        </a>
      </form>

      <p className="text-center text-sm text-texto-sec mt-8">
        Não tem uma conta?{' '}
        <Link to="/cadastro" className="text-primaria font-medium hover:text-primaria-escura transition-colors">
          Criar conta
        </Link>
      </p>
    </LayoutAuth>
  )
}

export default Login

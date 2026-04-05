import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { Shield } from 'lucide-react'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      await login(email, senha)
      nav('/')
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primaria rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Marcai Admin</h1>
            <p className="text-xs text-slate-500">Painel administrativo</p>
          </div>
        </div>

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{erro}</div>}

        <div className="space-y-4">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
          <input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha" required
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
          <button
            type="submit" disabled={loading}
            className="w-full bg-primaria hover:bg-primaria-escura text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

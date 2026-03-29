import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import LayoutAuth from '../../componentes/layout/LayoutAuth'
import api from '../../servicos/api'

const RecuperarSenha = () => {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setErro('Informe seu e-mail'); return }
    setErro('')
    setCarregando(true)
    try {
      await api.post('/api/auth/recuperar-senha', { email })
      setEnviado(true)
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao enviar e-mail.')
    } finally {
      setCarregando(false)
    }
  }

  if (enviado) {
    return (
      <LayoutAuth>
        <div className="text-center py-8">
          <CheckCircle2 size={48} className="text-sucesso mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-texto mb-2">E-mail enviado!</h2>
          <p className="text-texto-sec text-sm mb-6">
            Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve.
          </p>
          <Link to="/login" className="text-primaria text-sm font-medium hover:text-primaria-escura transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={16} />
            Voltar para o login
          </Link>
        </div>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth>
      <Link to="/login" className="flex items-center gap-1 text-sm text-texto-sec hover:text-texto mb-8 transition-colors">
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <h1 className="text-2xl font-semibold text-texto mb-1">Recuperar senha</h1>
      <p className="text-texto-sec text-sm mb-8">Informe seu e-mail e enviaremos um link de recuperação.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full px-4 py-2.5 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
          />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{erro}</div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {carregando ? 'Enviando...' : 'Enviar link'}
        </button>
      </form>
    </LayoutAuth>
  )
}

export default RecuperarSenha

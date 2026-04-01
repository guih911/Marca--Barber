import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import LayoutAuth from '../../componentes/layout/LayoutAuth'
import api from '../../servicos/api'

const obterMensagemErroReset = (erro) => {
  if (erro?.erro?.codigo === 'TOKEN_INVALIDO') {
    return 'Este link de redefinição é inválido ou expirou. Solicite um novo e-mail.'
  }

  return erro?.erro?.mensagem || 'Erro ao redefinir a senha. Tente novamente.'
}

const RedefinirSenha = () => {
  const { token = '' } = useParams()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!token) {
      setErro('Link de redefinição inválido.')
      return
    }

    if (!novaSenha || !confirmarSenha) {
      setErro('Preencha os dois campos.')
      return
    }

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem.')
      return
    }

    setCarregando(true)
    try {
      await api.post('/api/auth/redefinir-senha', { token, novaSenha })
      setSucesso(true)
    } catch (e) {
      setErro(obterMensagemErroReset(e))
    } finally {
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <LayoutAuth>
        <div className="text-center py-8">
          <CheckCircle2 size={48} className="text-sucesso mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-texto mb-2">Senha redefinida com sucesso!</h1>
          <p className="text-texto-sec text-sm mb-6">
            Sua conta já está pronta para acesso com a nova senha.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1 text-primaria text-sm font-medium hover:text-primaria-escura transition-colors"
          >
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

      <h1 className="text-2xl font-semibold text-texto mb-1">Criar nova senha</h1>
      <p className="text-texto-sec text-sm mb-8">Digite e confirme sua nova senha para continuar.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="nova-senha" className="block text-sm font-medium text-texto mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              id="nova-senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 pr-11 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-sec hover:text-texto transition-colors"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmar-nova-senha" className="block text-sm font-medium text-texto mb-1.5">Confirmar nova senha</label>
          <input
            id="confirmar-nova-senha"
            type={mostrarSenha ? 'text' : 'password'}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Repita a nova senha"
            className="w-full px-4 py-2.5 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
          />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {carregando ? 'Redefinindo...' : 'Salvar nova senha'}
        </button>
      </form>
    </LayoutAuth>
  )
}

export default RedefinirSenha

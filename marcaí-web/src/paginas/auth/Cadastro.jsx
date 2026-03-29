import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import LayoutAuth from '../../componentes/layout/LayoutAuth'
import useAuth from '../../hooks/useAuth'

const Cadastro = () => {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const { cadastrar } = useAuth()
  const navigate = useNavigate()

  const atualizar = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!form.nome || !form.email || !form.senha) {
      setErro('Preencha todos os campos obrigatórios')
      return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres')
      return
    }
    if (form.senha !== form.confirmarSenha) {
      setErro('As senhas não conferem')
      return
    }

    setCarregando(true)
    try {
      await cadastrar(form.nome, form.email, form.senha)
      navigate('/onboarding/negocio')
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <LayoutAuth>
      <h1 className="text-2xl font-semibold text-texto mb-1">Criar conta</h1>
      <p className="text-texto-sec text-sm mb-8">Configure seu salão em minutos</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Nome completo</label>
          <input
            type="text"
            value={form.nome}
            onChange={atualizar('nome')}
            placeholder="Seu nome"
            className="w-full px-4 py-2.5 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={atualizar('email')}
            placeholder="seu@email.com"
            className="w-full px-4 py-2.5 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={form.senha}
              onChange={atualizar('senha')}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 pr-11 rounded-lg border border-borda bg-white text-texto placeholder:text-texto-sec/60 focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-sec hover:text-texto"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Confirmar senha</label>
          <input
            type="password"
            value={form.confirmarSenha}
            onChange={atualizar('confirmarSenha')}
            placeholder="Repita a senha"
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
          className="w-full bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {carregando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-sm text-texto-sec mt-6">
        Já tem uma conta?{' '}
        <Link to="/login" className="text-primaria font-medium hover:text-primaria-escura transition-colors">
          Entrar
        </Link>
      </p>
    </LayoutAuth>
  )
}

export default Cadastro

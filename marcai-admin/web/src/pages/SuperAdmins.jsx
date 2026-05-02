import { useState, useEffect } from 'react'
import { api, getUser } from '../api'
import { Plus, X, Shield, User, Headphones, ToggleLeft, ToggleRight } from 'lucide-react'

const PAPEIS = {
  OWNER: { label: 'Owner', color: 'badge-gold', icon: Shield, desc: 'Acesso total + criação de admins' },
  ADMIN: { label: 'Admin', color: 'badge-blue', icon: User, desc: 'Acesso completo ao painel' },
  SUPPORT: { label: 'Suporte', color: 'badge-slate', icon: Headphones, desc: 'Acesso ao atendimento e leads' },
}

function AdminAvatar({ nome, size = 'md' }) {
  const inicial = (nome || '?')[0].toUpperCase()
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-500']
  const color = colors[(nome || '').charCodeAt(0) % colors.length]
  const sz = size === 'md' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
  return (
    <div className={`${sz} ${color} rounded-xl flex items-center justify-center text-white font-bold shrink-0`}>
      {inicial}
    </div>
  )
}

export default function SuperAdmins() {
  const currentUser = getUser()
  const [admins, setAdmins] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', papel: 'ADMIN' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const carregar = () => api('/api/admin/superadmins').then(setAdmins).catch(console.error)
  useEffect(() => { carregar() }, [])

  const criar = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      await api('/api/admin/superadmins', { method: 'POST', body: JSON.stringify(form) })
      setModal(false)
      setForm({ nome: '', email: '', senha: '', papel: 'ADMIN' })
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isOwner = currentUser?.papel === 'OWNER'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Super Admins</h1>
          <p className="text-sm text-slate-500 mt-0.5">{admins.length} usuário{admins.length !== 1 ? 's' : ''} cadastrado{admins.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={16} /> Novo admin
          </button>
        )}
      </div>

      {/* Papéis info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(PAPEIS).map(([key, conf]) => {
          const Icon = conf.icon
          const count = admins.filter(a => (a.papel || 'ADMIN') === key).length
          return (
            <div key={key} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                <Icon size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{conf.label}</p>
                <p className="text-xs text-slate-500">{count} usuário{count !== 1 ? 's' : ''}</p>
              </div>
              <span className={`badge ${conf.color} ml-auto`}>{conf.label}</span>
            </div>
          )
        })}
      </div>

      {/* Lista */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="section-title">Equipe administrativa</p>
        </div>
        <div className="divide-y divide-slate-100">
          {admins.map(a => {
            const papelConf = PAPEIS[a.papel || 'ADMIN'] || PAPEIS.ADMIN
            const isMe = a.id === currentUser?.id
            return (
              <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <AdminAvatar nome={a.nome} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{a.nome}</p>
                    {isMe && <span className="text-[10px] text-primaria font-semibold bg-primaria/10 px-1.5 py-0.5 rounded-full">Você</span>}
                  </div>
                  <p className="text-xs text-slate-500">{a.email}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Criado em {new Date(a.criadoEm).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${papelConf.color}`}>{papelConf.label}</span>
                  <div className={`flex items-center gap-1 text-xs font-medium ${a.ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${a.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            )
          })}
          {admins.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">Nenhum admin cadastrado</p>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setModal(false)}>
          <form
            onSubmit={criar}
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Novo Super Admin</h3>
              <button type="button" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm mb-4">
                {erro}
              </div>
            )}

            <div className="space-y-3">
              <input
                value={form.nome}
                onChange={e => setForm(p => ({...p, nome: e.target.value}))}
                placeholder="Nome completo"
                required
                className="input-field"
              />
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({...p, email: e.target.value}))}
                placeholder="Email"
                required
                className="input-field"
              />
              <input
                type="password"
                value={form.senha}
                onChange={e => setForm(p => ({...p, senha: e.target.value}))}
                placeholder="Senha"
                required
                className="input-field"
              />
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1.5 block">Papel</label>
                <div className="space-y-2">
                  {Object.entries(PAPEIS).map(([key, conf]) => {
                    const Icon = conf.icon
                    return (
                      <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.papel === key ? 'border-primaria bg-primaria/5' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input
                          type="radio"
                          name="papel"
                          value={key}
                          checked={form.papel === key}
                          onChange={() => setForm(p => ({...p, papel: key}))}
                          className="hidden"
                        />
                        <Icon size={15} className={form.papel === key ? 'text-primaria' : 'text-slate-400'} />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{conf.label}</p>
                          <p className="text-xs text-slate-500">{conf.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1">
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Criando...</>
                ) : (
                  <><Plus size={15} /> Criar admin</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

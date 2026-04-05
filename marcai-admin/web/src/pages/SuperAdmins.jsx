import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, X } from 'lucide-react'

export default function SuperAdmins() {
  const [admins, setAdmins] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
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
      setForm({ nome: '', email: '', senha: '' })
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Super Admins</h1>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 bg-primaria text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primaria-escura">
          <Plus size={16} /> Novo admin
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
            <th className="text-left px-4 py-3">Nome</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-center px-4 py-3">Ativo</th>
            <th className="text-left px-4 py-3">Criado em</th>
          </tr></thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{a.nome}</td>
                <td className="px-4 py-3 text-slate-500">{a.email}</td>
                <td className="px-4 py-3 text-center"><span className={`inline-block w-2 h-2 rounded-full ${a.ativo ? 'bg-emerald-500' : 'bg-red-400'}`} /></td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.criadoEm).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <form onSubmit={criar} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Novo Super Admin</h3>
              <button type="button" onClick={() => setModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}
            <div className="space-y-3">
              <input value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Nome" required className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="Email" required className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              <input type="password" value={form.senha} onChange={e => setForm(p => ({...p, senha: e.target.value}))} placeholder="Senha" required className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              <button type="submit" disabled={loading} className="w-full bg-primaria text-white py-2 rounded-lg text-sm font-medium hover:bg-primaria-escura disabled:opacity-60">
                {loading ? 'Criando...' : 'Criar admin'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

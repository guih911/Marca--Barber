import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ChevronLeft, ExternalLink, Power } from 'lucide-react'

export default function TenantDetalhe() {
  const { id } = useParams()
  const nav = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api(`/api/admin/tenants/${id}`)
      .then(setTenant)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const toggleAtivo = async () => {
    const updated = await api(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: !tenant.ativo }),
    })
    setTenant(updated)
  }

  const impersonar = async () => {
    try {
      const data = await api(`/api/admin/impersonar/${id}`, { method: 'POST' })
      window.open(`${data.url}?token=${data.token}`, '_blank')
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className="text-slate-500">Carregando...</p>
  if (!tenant) return <p className="text-red-500">Tenant não encontrado</p>

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'usuarios', label: `Usuários (${tenant.usuarios?.length || 0})` },
  ]

  return (
    <div>
      <button onClick={() => nav('/tenants')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ChevronLeft size={16} /> Voltar
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{tenant.nome}</h1>
          <p className="text-sm text-slate-500">{tenant.slug} | {tenant.planoContratado || 'Sem plano'} | {tenant.endereco || 'Sem endereço'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={impersonar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            <ExternalLink size={14} /> Acessar como
          </button>
          <button onClick={toggleAtivo} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white ${tenant.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            <Power size={14} /> {tenant.ativo ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-primaria text-primaria' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              ['Telefone', tenant.telefone || '—'],
              ['Plano', tenant.planoContratado || '—'],
              ['Ciclo', tenant.cicloCobranca || '—'],
              ['Onboarding', tenant.onboardingCompleto ? 'Completo' : 'Pendente'],
              ['Ativo', tenant.ativo ? 'Sim' : 'Não'],
              ['Criado em', new Date(tenant.criadoEm).toLocaleDateString('pt-BR')],
              ['Serviços', tenant._count?.servicos ?? '—'],
              ['Profissionais', tenant._count?.profissionais ?? '—'],
              ['Segmento', tenant.segmento || '—'],
              ['Timezone', tenant.timezone || '—'],
              ['NPS ativo', tenant.npsAtivo ? 'Sim' : 'Não'],
              ['Fidelidade', tenant.fidelidadeAtivo ? 'Sim' : 'Não'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-slate-400 text-xs uppercase mb-1">{k}</p>
                <p className="text-slate-800 font-medium">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Perfil</th>
              <th className="text-center px-4 py-3">Ativo</th>
            </tr></thead>
            <tbody>
              {(tenant.usuarios || []).map(u => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">{u.nome}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100">{u.perfil}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block w-2 h-2 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-red-400'}`} /></td>
                </tr>
              ))}
              {(tenant.usuarios || []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-sm">Nenhum usuário</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

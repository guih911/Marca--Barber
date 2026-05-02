import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiCriarTenant, apiStatusPagamento } from '../api'
import {
  Search, ChevronLeft, ChevronRight, Plus, X,
  CheckCircle2, AlertCircle, Clock, Power, Trash2
} from 'lucide-react'

const PLANO_CONFIG = {
  SALAO: { label: 'Salão', color: 'badge-emerald' },
  SOLO: { label: 'Solo', color: 'badge-blue' },
}

function BadgeTrial({ trialExpira }) {
  if (!trialExpira) return null
  const dias = Math.ceil((new Date(trialExpira) - Date.now()) / 86400000)
  if (dias <= 0) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Trial expirado</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
      <Clock size={9} /> {dias}d trial
    </span>
  )
}

function ModalCriarTenant({ onClose, onCriado }) {
  const [form, setForm] = useState({
    nome: '', telefone: '', planoContratado: 'SALAO', cicloCobranca: 'MENSAL',
    adminNome: '', adminEmail: '', adminSenha: '',
  })
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const criar = async (e) => {
    e.preventDefault()
    setCriando(true)
    setErro('')
    try {
      const novo = await apiCriarTenant(form)
      onCriado(novo)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <form
        onSubmit={criar}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Novo Tenant</h3>
            <p className="text-xs text-slate-500 mt-0.5">7 dias de trial gratuito</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm">
            {erro}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dados do salão</p>
          <input
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Nome do salão *"
            required
            className="input-field"
          />
          <input
            value={form.telefone}
            onChange={e => set('telefone', e.target.value)}
            placeholder="Telefone (55...)"
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">Plano</label>
              <select value={form.planoContratado} onChange={e => set('planoContratado', e.target.value)} className="input-field">
                <option value="SALAO">Salão (equipe)</option>
                <option value="SOLO">Solo (1 profissional)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">Ciclo</label>
              <select value={form.cicloCobranca} onChange={e => set('cicloCobranca', e.target.value)} className="input-field">
                <option value="MENSAL">Mensal</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-1 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Conta do administrador</p>
          <input
            value={form.adminNome}
            onChange={e => set('adminNome', e.target.value)}
            placeholder="Nome do responsável"
            className="input-field"
          />
          <input
            type="email"
            value={form.adminEmail}
            onChange={e => set('adminEmail', e.target.value)}
            placeholder="Email de acesso *"
            required
            className="input-field"
          />
          <input
            type="password"
            value={form.adminSenha}
            onChange={e => set('adminSenha', e.target.value)}
            placeholder="Senha inicial *"
            required
            minLength={6}
            className="input-field"
          />
        </div>

        <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-xs text-violet-700">
          <Clock size={11} className="inline mr-1" />
          Conta criada com <strong>7 dias de trial gratuito</strong>. Marque como inadimplente após vencimento.
        </div>

        <button type="submit" disabled={criando} className="btn-primary w-full justify-center">
          {criando ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Criando...</>
          ) : (
            <><Plus size={15} /> Criar conta (7 dias trial)</>
          )}
        </button>
      </form>
    </div>
  )
}

export default function Tenants() {
  const nav = useNavigate()
  const [data, setData] = useState({ tenants: [], total: 0 })
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filtroAtivo, setFiltroAtivo] = useState('')
  const [deletandoId, setDeletandoId] = useState(null)
  const [showCriar, setShowCriar] = useState(false)

  const carregar = () => {
    setLoading(true)
    const params = new URLSearchParams({ pagina, limite: 20 })
    if (busca) params.set('busca', busca)
    api(`/api/admin/tenants?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(carregar, [pagina])
  const totalPaginas = Math.max(1, Math.ceil(data.total / 20))

  const tenantsFiltrados = filtroAtivo === 'ativo'
    ? data.tenants.filter(t => t.ativo)
    : filtroAtivo === 'inativo'
    ? data.tenants.filter(t => !t.ativo)
    : data.tenants

  const excluir = async (e, tenant) => {
    e.stopPropagation()
    if (tenant.ativo) { alert('Desative o tenant antes de excluir.'); return }
    if (!confirm(`Excluir permanentemente "${tenant.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletandoId(tenant.id)
    try {
      await api(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      carregar()
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletandoId(null)
    }
  }

  const toggleAtivo = async (e, tenant) => {
    e.stopPropagation()
    await api(`/api/admin/tenants/${tenant.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: !tenant.ativo }),
    })
    carregar()
  }

  const togglePagamento = async (e, tenant) => {
    e.stopPropagation()
    await apiStatusPagamento(tenant.id, !tenant.adimplente)
    carregar()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tenants</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data.total} conta{data.total !== 1 ? 's' : ''} cadastrada{data.total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCriar(true)} className="btn-primary">
          <Plus size={15} /> Novo tenant
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: '', label: `Todos (${data.total})` },
          { key: 'ativo', label: `Ativos (${data.tenants.filter(t => t.ativo).length})` },
          { key: 'inativo', label: `Inativos (${data.tenants.filter(t => !t.ativo).length})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltroAtivo(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${filtroAtivo === f.key ? 'bg-primaria text-white border-primaria' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            {f.label}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && carregar()}
            placeholder="Buscar por nome ou slug..."
            className="input-field pl-8 py-2 w-64"
          />
        </div>
        <button onClick={() => { setPagina(1); carregar() }} className="btn-primary py-2">Buscar</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Plano</th>
              <th className="text-center">Pagamento</th>
              <th className="text-center">Status</th>
              <th>Criado em</th>
              <th className="w-28 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10">
                <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-primaria rounded-full animate-spin" /></div>
              </td></tr>
            ) : tenantsFiltrados.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">Nenhum tenant encontrado</td></tr>
            ) : tenantsFiltrados.map(t => (
              <tr key={t.id} onClick={() => nav(`/tenants/${t.id}`)} className="cursor-pointer">
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                      {(t.nome || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-800 text-sm">{t.nome}</p>
                        {t.emTrial && <BadgeTrial trialExpira={t.trialExpira} />}
                      </div>
                      <p className="text-xs text-slate-400">{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${(PLANO_CONFIG[t.planoContratado] || {}).color || 'badge-slate'}`}>
                    {(PLANO_CONFIG[t.planoContratado] || {}).label || t.planoContratado || '—'}
                  </span>
                </td>
                <td className="text-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => togglePagamento(e, t)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${t.adimplente !== false ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'}`}
                    title="Clique para alternar"
                  >
                    {t.adimplente !== false
                      ? <><CheckCircle2 size={11} /> Em dia</>
                      : <><AlertCircle size={11} /> Inadimplente</>
                    }
                  </button>
                </td>
                <td className="text-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${t.ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="text-slate-400 text-xs">{new Date(t.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td onClick={e => e.stopPropagation()} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={e => toggleAtivo(e, t)}
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                      className={`p-1.5 rounded-lg border transition-all text-xs ${t.ativo ? 'border-red-200 text-red-400 hover:bg-red-50' : 'border-emerald-200 text-emerald-500 hover:bg-emerald-50'}`}
                    >
                      <Power size={12} />
                    </button>
                    {!t.ativo && (
                      <button
                        onClick={e => excluir(e, t)}
                        disabled={deletandoId === t.id}
                        title="Excluir permanentemente"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                      >
                        {deletandoId === t.id ? <span className="text-[10px]">...</span> : <Trash2 size={12} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">{data.total} tenant(s)</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagina(p => Math.max(1, p-1))} disabled={pagina <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-slate-600">{pagina}/{totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p+1))} disabled={pagina >= totalPaginas} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCriar && (
        <ModalCriarTenant
          onClose={() => setShowCriar(false)}
          onCriado={() => { setShowCriar(false); carregar() }}
        />
      )}
    </div>
  )
}

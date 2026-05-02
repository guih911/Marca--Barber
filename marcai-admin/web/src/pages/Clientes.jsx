import { useState, useEffect, useMemo } from 'react'
import { apiClientes } from '../api'
import { Search, Users, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export default function Clientes() {
  const [data, setData] = useState({ clientes: [], total: 0, pagina: 1, limite: 20 })
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)

  const carregar = async (p = 1) => {
    setLoading(true)
    try {
      const params = { pagina: String(p), limite: '20' }
      if (busca) params.busca = busca
      const resp = await apiClientes(params)
      setData(resp)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar(1) }, [])
  const totalPaginas = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / 20)), [data])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Todos os clientes · {data.total || 0} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && carregar(1)}
              placeholder="Buscar por nome ou telefone..."
              className="input-field pl-8 py-2 w-64"
            />
          </div>
          <button onClick={() => carregar(1)} className="btn-primary py-2">Buscar</button>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Tenant</th>
              <th className="text-center">Agendamentos</th>
              <th className="text-center">Tags</th>
              <th>Cadastrado em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10">
                <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-primaria rounded-full animate-spin" /></div>
              </td></tr>
            ) : (data.clientes || []).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">Nenhum cliente encontrado</td></tr>
            ) : (data.clientes || []).map(c => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                      {(c.nome || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{c.nome}</p>
                      {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="text-slate-600 text-sm font-mono">{c.telefone}</td>
                <td className="text-slate-600 text-sm">{c.tenant?.nome || '—'}</td>
                <td className="text-center">
                  <span className="badge badge-blue">{c._count?.agendamentos || 0}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">{tag}</span>
                    ))}
                    {(c.tags || []).length > 3 && (
                      <span className="text-[10px] text-slate-400">+{c.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="text-slate-400 text-xs">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">{data.total || 0} cliente(s)</p>
          <div className="flex items-center gap-1">
            <button onClick={() => { setPagina(p => Math.max(1, p-1)); carregar(Math.max(1, pagina-1)) }} disabled={pagina <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 text-xs text-slate-600">{pagina}/{totalPaginas}</span>
            <button onClick={() => { setPagina(p => Math.min(totalPaginas, p+1)); carregar(Math.min(totalPaginas, pagina+1)) }} disabled={pagina >= totalPaginas} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

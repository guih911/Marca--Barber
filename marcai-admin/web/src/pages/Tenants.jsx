import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Tenants() {
  const nav = useNavigate()
  const [data, setData] = useState({ tenants: [], total: 0 })
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)

  const carregar = () => {
    setLoading(true)
    const params = new URLSearchParams({ pagina, limite: 20 })
    if (busca) params.set('busca', busca)
    api(`/api/admin/tenants?${params}`).then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(carregar, [pagina])

  const totalPaginas = Math.ceil(data.total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Tenants</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca} onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregar()}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Plano</th>
              <th className="text-center px-4 py-3">Clientes</th>
              <th className="text-center px-4 py-3">Agendamentos</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
            ) : data.tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum tenant encontrado</td></tr>
            ) : data.tenants.map((t) => (
              <tr
                key={t.id}
                onClick={() => nav(`/tenants/${t.id}`)}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{t.nome}</p>
                  <p className="text-xs text-slate-400">{t.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.planoContratado === 'SALAO' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {t.planoContratado || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{t._count.clientes}</td>
                <td className="px-4 py-3 text-center text-slate-600">{t._count.agendamentos}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${t.ativo ? 'bg-emerald-500' : 'bg-red-400'}`} />
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(t.criadoEm).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">{data.total} tenant(s)</p>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-2 text-xs text-slate-600">{pagina} / {totalPaginas}</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

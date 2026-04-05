import { useState, useEffect } from 'react'
import { api } from '../api'
import { RefreshCw } from 'lucide-react'

export default function Logs() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = () => {
    setLoading(true)
    api('/api/admin/logs').then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(carregar, [])

  if (loading) return <p className="text-slate-500">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Logs de Atividade</h1>
        <button onClick={carregar} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase mb-3">Novos Tenants</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Plano</th>
                <th className="text-left px-4 py-2">Criado em</th>
              </tr></thead>
              <tbody>
                {(data?.tenantsRecentes || []).map(t => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{t.nome}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{t.planoContratado}</span></td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{new Date(t.criadoEm).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase mb-3">Clientes Recentes (todos tenants)</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Telefone</th>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Criado em</th>
              </tr></thead>
              <tbody>
                {(data?.clientesRecentes || []).map(c => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{c.nome}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{c.telefone}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{c.tenant?.nome}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{new Date(c.criadoEm).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase mb-3">Agendamentos Recentes</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0"><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-left px-4 py-2">Serviço</th>
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-center px-4 py-2">Status</th>
              </tr></thead>
              <tbody>
                {(data?.agendamentosRecentes || []).map(a => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-500 text-xs">{a.tenant?.nome}</td>
                    <td className="px-4 py-2 text-slate-800 text-xs">{a.cliente?.nome || '—'}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{a.servico?.nome || '—'}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{new Date(a.inicioEm).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        { CONCLUIDO: 'bg-emerald-100 text-emerald-700', CANCELADO: 'bg-red-100 text-red-700', AGENDADO: 'bg-blue-100 text-blue-700', CONFIRMADO: 'bg-amber-100 text-amber-700' }[a.status] || 'bg-slate-100'
                      }`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

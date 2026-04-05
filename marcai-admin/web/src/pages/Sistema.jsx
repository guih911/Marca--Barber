import { useState, useEffect } from 'react'
import { api } from '../api'
import { Cpu, HardDrive, Clock, Container, RefreshCw } from 'lucide-react'

const formatUptime = (s) => {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

export default function Sistema() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = () => {
    setLoading(true)
    api('/api/admin/sistema').then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(carregar, [])

  if (loading) return <p className="text-slate-500">Carregando...</p>
  if (!data) return <p className="text-red-500">Erro</p>

  const memPct = Math.round(((data.servidor.totalMem - data.servidor.freeMem) / data.servidor.totalMem) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Sistema</h1>
        <button onClick={carregar} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2"><Clock size={14} className="text-slate-400" /><span className="text-xs text-slate-500 uppercase">Uptime</span></div>
          <p className="text-lg font-bold text-slate-800">{formatUptime(data.uptime)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2"><Cpu size={14} className="text-slate-400" /><span className="text-xs text-slate-500 uppercase">CPUs</span></div>
          <p className="text-lg font-bold text-slate-800">{data.servidor.cpus} cores</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2"><HardDrive size={14} className="text-slate-400" /><span className="text-xs text-slate-500 uppercase">Memória</span></div>
          <p className="text-lg font-bold text-slate-800">{memPct}%</p>
          <p className="text-[10px] text-slate-400">{data.servidor.totalMem - data.servidor.freeMem}MB / {data.servidor.totalMem}MB</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2"><HardDrive size={14} className="text-slate-400" /><span className="text-xs text-slate-500 uppercase">Node Heap</span></div>
          <p className="text-lg font-bold text-slate-800">{data.memoria.heapUsed}MB</p>
          <p className="text-[10px] text-slate-400">de {data.memoria.heapTotal}MB | RSS: {data.memoria.rss}MB</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-600 uppercase mb-3">Containers Docker</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {data.containers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">Docker indisponivel ou sem containers</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Imagem</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr></thead>
            <tbody>
              {data.containers.map((c, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800 text-xs">{c.nome}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{c.imagem}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs ${c.status.includes('Up') ? 'text-emerald-600' : 'text-red-500'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">Node {data.node} | {data.servidor.platform} | {data.servidor.hostname}</p>
    </div>
  )
}

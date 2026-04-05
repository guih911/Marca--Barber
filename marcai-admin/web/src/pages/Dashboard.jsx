import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DollarSign, TrendingUp, Building2, UserPlus, Clock, Scissors, Users, CalendarClock } from 'lucide-react'

const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const Card = ({ icon: Icon, label, value, sub, color = 'bg-primaria' }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">{label}</p>
    </div>
    <p className="text-2xl font-bold text-slate-800">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
)

const Badge = ({ label, value, color }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>{value}</span>
  </div>
)

export default function Dashboard() {
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/admin/dashboard').then(setD).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Carregando...</div>
  if (!d) return <div className="text-red-500 p-4">Erro ao carregar dashboard</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Financeiro</h1>
      <p className="text-sm text-slate-500 mb-6">Visao geral de receita e assinantes</p>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card icon={DollarSign} label="MRR" value={fmt(d.mrr)} sub="Receita mensal recorrente" color="bg-emerald-600" />
        <Card icon={TrendingUp} label="ARR" value={fmt(d.arr)} sub="Projecao anual" color="bg-green-600" />
        <Card icon={Building2} label="Assinantes" value={d.tenantsAtivos} sub={`${d.totalTenants} cadastrados total`} color="bg-primaria" />
        <Card icon={UserPlus} label="Novos (30d)" value={d.novos30d} sub={`${d.novos7d} nos ultimos 7 dias`} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Distribuicao por plano */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide mb-4">Por Plano</p>
          <Badge label="Solo (R$ 55,90)" value={d.planos.solo} color="bg-blue-100 text-blue-700" />
          <Badge label="Salao (R$ 139,90)" value={d.planos.salao} color="bg-emerald-100 text-emerald-700" />
          <div className="border-t border-slate-100 mt-2 pt-2">
            <Badge label="Sem plano / free" value={d.tenantsAtivos - d.planos.solo - d.planos.salao} color="bg-slate-100 text-slate-500" />
          </div>
        </div>

        {/* Distribuicao por ciclo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide mb-4">Por Ciclo</p>
          <Badge label="Mensal" value={d.ciclos.mensal} color="bg-slate-100 text-slate-600" />
          <Badge label="Semestral (10% off)" value={d.ciclos.semestral} color="bg-amber-100 text-amber-700" />
          <Badge label="Anual (20% off)" value={d.ciclos.anual} color="bg-emerald-100 text-emerald-700" />
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide mb-4">Status</p>
          <Badge label="Ativos" value={d.tenantsAtivos} color="bg-emerald-100 text-emerald-700" />
          <Badge label="Onboarding pendente" value={d.onboardingPendente} color="bg-amber-100 text-amber-700" />
          <Badge label="Inativos" value={d.totalTenants - d.tenantsAtivos} color="bg-red-100 text-red-600" />
        </div>
      </div>

      {/* Ultimos cadastros */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Ultimos cadastros</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left px-5 py-2.5">Nome</th>
              <th className="text-left px-5 py-2.5">Plano</th>
              <th className="text-left px-5 py-2.5">Ciclo</th>
              <th className="text-center px-5 py-2.5">Status</th>
              <th className="text-left px-5 py-2.5">Data</th>
            </tr>
          </thead>
          <tbody>
            {d.ultimosTenants.map(t => (
              <tr key={t.id} onClick={() => nav(`/tenants/${t.id}`)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800">{t.nome}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.plano === 'SALAO' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>{t.plano || '—'}</span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{t.ciclo || 'Mensal'}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${t.ativo ? 'bg-emerald-500' : 'bg-red-400'}`} />
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs">{new Date(t.criadoEm).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

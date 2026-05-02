import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  DollarSign, TrendingUp, Building2, UserPlus,
  Activity, Users, AlertTriangle, CheckCircle2,
  ArrowUpRight, Zap
} from 'lucide-react'

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR')

function KpiCard({ icon: Icon, label, value, sub, colorClass = 'bg-primaria', trend }) {
  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            <ArrowUpRight size={12} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 mb-1">{value}</p>
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ items, colorClass = 'bg-primaria' }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-24 shrink-0 truncate">{item.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${colorClass} rounded-full transition-all duration-700`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-8 text-right shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/admin/dashboard')
      .then(setD)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-primaria rounded-full animate-spin" />
        <span className="text-sm">Carregando dashboard...</span>
      </div>
    </div>
  )

  if (!d) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-2 text-red-500">
        <AlertTriangle size={24} />
        <span className="text-sm">Erro ao carregar dashboard</span>
      </div>
    </div>
  )

  const planoChartData = [
    { label: 'Plano Solo', value: d.planos.solo },
    { label: 'Plano Salão', value: d.planos.salao },
    { label: 'Sem plano', value: Math.max(0, d.tenantsAtivos - d.planos.solo - d.planos.salao) },
  ]

  const cicloChartData = [
    { label: 'Mensal', value: d.ciclos.mensal },
    { label: 'Semestral', value: d.ciclos.semestral },
    { label: 'Anual', value: d.ciclos.anual },
  ]

  const statusOk = d.tenantsAtivos > 0 && d.onboardingPendente === 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard executivo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão consolidada · atualizado agora</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${statusOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {statusOk ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {statusOk ? 'Operação normal' : `${d.onboardingPendente} pendências`}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="MRR"
          value={fmt(d.mrr)}
          sub="Receita mensal recorrente"
          colorClass="bg-emerald-500"
        />
        <KpiCard
          icon={TrendingUp}
          label="ARR"
          value={fmt(d.arr)}
          sub="Projeção anual"
          colorClass="bg-green-600"
        />
        <KpiCard
          icon={Building2}
          label="Assinantes ativos"
          value={fmtNum(d.tenantsAtivos)}
          sub={`${fmtNum(d.totalTenants)} cadastrados total`}
          colorClass="bg-primaria"
        />
        <KpiCard
          icon={UserPlus}
          label="Novos (30d)"
          value={fmtNum(d.novos30d)}
          sub={`${fmtNum(d.novos7d)} nos últimos 7 dias`}
          colorClass="bg-blue-500"
        />
      </div>

      {/* Charts + Status row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Por Plano */}
        <div className="card p-5">
          <p className="section-title mb-4">Distribuição por plano</p>
          <BarChart items={planoChartData} colorClass="bg-primaria" />
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
            <div>
              <p className="text-lg font-bold text-slate-800">{d.planos.solo}</p>
              <p className="text-xs text-slate-500">Solo · R$ 55,90</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{d.planos.salao}</p>
              <p className="text-xs text-slate-500">Salão · R$ 139,90</p>
            </div>
          </div>
        </div>

        {/* Por Ciclo */}
        <div className="card p-5">
          <p className="section-title mb-4">Distribuição por ciclo</p>
          <BarChart items={cicloChartData} colorClass="bg-amber-500" />
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Clientes anuais recebem 20% de desconto</p>
          </div>
        </div>

        {/* Status */}
        <div className="card p-5">
          <p className="section-title mb-4">Status da base</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-700">Ativos</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{d.tenantsAtivos}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-700">Onboarding pendente</span>
              </div>
              <span className={`text-sm font-bold ${d.onboardingPendente > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {d.onboardingPendente}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-sm text-slate-700">Inativos</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{d.totalTenants - d.tenantsAtivos}</span>
            </div>
            <div className="mt-2 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Activity size={12} />
                Taxa de ativação: {d.totalTenants > 0 ? Math.round((d.tenantsAtivos / d.totalTenants) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Últimos cadastros */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="section-title">Últimos cadastros</p>
          <button
            onClick={() => nav('/tenants')}
            className="text-xs text-primaria hover:text-primaria-escura font-semibold flex items-center gap-1"
          >
            Ver todos <ArrowUpRight size={12} />
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Plano</th>
              <th>Ciclo</th>
              <th className="text-center">Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {d.ultimosTenants.map(t => (
              <tr key={t.id} onClick={() => nav(`/tenants/${t.id}`)} className="cursor-pointer">
                <td className="font-medium text-slate-800">{t.nome}</td>
                <td>
                  <span className={`badge ${t.plano === 'SALAO' ? 'badge-emerald' : t.plano === 'SOLO' ? 'badge-blue' : 'badge-slate'}`}>
                    {t.plano || '—'}
                  </span>
                </td>
                <td className="text-slate-500">{t.ciclo || 'Mensal'}</td>
                <td className="text-center">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.ativo ? 'text-emerald-600' : 'text-red-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="text-slate-400 text-xs">{new Date(t.criadoEm).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { apiRelatoriosAdmins, apiRelatoriosLeads, apiRelatoriosTenants, apiRelatoriosFunil } from '../api'
import { Trophy, Users, Building2, TrendingUp, MessageSquare, BarChart3, ArrowUpRight } from 'lucide-react'

function BarRow({ label, value, max, color = 'bg-primaria', suffix = '', sublabel }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <p className="text-sm font-medium text-slate-800 truncate">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 truncate">{sublabel}</p>}
      </div>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-slate-700 w-16 text-right shrink-0">{value}{suffix}</span>
    </div>
  )
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
      <Icon size={28} className="opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export default function Relatorios() {
  const [admins, setAdmins] = useState(null)
  const [leads, setLeads] = useState(null)
  const [tenants, setTenants] = useState(null)
  const [funil, setFunil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      apiRelatoriosAdmins(),
      apiRelatoriosLeads(),
      apiRelatoriosTenants(),
      apiRelatoriosFunil(),
    ]).then(([r1, r2, r3, r4]) => {
      if (r1.status === 'fulfilled') setAdmins(r1.value)
      if (r2.status === 'fulfilled') setLeads(r2.value)
      if (r3.status === 'fulfilled') setTenants(r3.value)
      if (r4.status === 'fulfilled') setFunil(r4.value)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-primaria rounded-full animate-spin" />
        <span className="text-sm">Carregando relatórios...</span>
      </div>
    </div>
  )

  const adminsMaxMsg = Math.max(...(admins?.ranking || []).map(a => a.mensagens || 0), 1)
  const leadsMax = Math.max(...(leads?.topLeads || []).map(l => l.agendamentos || 0), 1)
  const tenantsMax = Math.max(...(tenants?.topTenants || []).map(t => t.agendamentos || 0), 1)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Relatórios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Análise de performance da equipe, leads e clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking de admins */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-primaria/10 rounded-lg flex items-center justify-center">
              <MessageSquare size={15} className="text-primaria" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Ranking de Admins</p>
              <p className="text-xs text-slate-500">Mensagens humanas enviadas</p>
            </div>
          </div>
          {(admins?.ranking || []).length === 0 ? (
            <EmptyState icon={MessageSquare} label="Sem dados de mensagens" />
          ) : (
            <div className="space-y-4">
              {(admins?.ranking || []).map((a, i) => (
                <div key={a.adminId || i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-gold-500 text-gray-900' : i === 1 ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <BarRow
                    label={a.nome || a.adminId?.slice(0, 8) || 'Admin'}
                    value={a.mensagens || 0}
                    max={adminsMaxMsg}
                    color={i === 0 ? 'bg-gold-500' : 'bg-primaria'}
                    suffix=" msg"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top leads */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Trophy size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Top Leads por Agendamentos</p>
              <p className="text-xs text-slate-500">Leads mais engajados</p>
            </div>
          </div>
          {(leads?.topLeads || []).length === 0 ? (
            <EmptyState icon={Trophy} label="Sem dados de leads" />
          ) : (
            <div className="space-y-4">
              {(leads?.topLeads || []).map((l, i) => (
                <BarRow
                  key={l.id || i}
                  label={l.nome || 'Lead'}
                  sublabel={l.tenant?.nome}
                  value={l.agendamentos || 0}
                  max={leadsMax}
                  color="bg-emerald-500"
                  suffix=" agend."
                />
              ))}
            </div>
          )}
        </div>

        {/* Top tenants */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Top Tenants por Agendamentos</p>
              <p className="text-xs text-slate-500">Clientes com maior volume</p>
            </div>
          </div>
          {(tenants?.topTenants || []).length === 0 ? (
            <EmptyState icon={Building2} label="Sem dados de tenants" />
          ) : (
            <div className="space-y-4">
              {(tenants?.topTenants || []).map((t, i) => (
                <BarRow
                  key={t.id || i}
                  label={t.nome || 'Tenant'}
                  sublabel={t.plano}
                  value={t.agendamentos || 0}
                  max={tenantsMax}
                  color="bg-blue-500"
                  suffix=" agend."
                />
              ))}
            </div>
          )}
        </div>

        {/* Funil de conversão */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Funil de Conversão de Leads</p>
              <p className="text-xs text-slate-500">Por estágio do CRM</p>
            </div>
          </div>
          {!funil || (funil?.estagios || []).length === 0 ? (
            <EmptyState icon={TrendingUp} label="Sem dados de funil" />
          ) : (
            <div className="space-y-3">
              {(funil.estagios || []).map((est, i) => {
                const colors = {
                  NOVO: 'bg-slate-400',
                  QUALIFICACAO: 'bg-blue-500',
                  PROPOSTA: 'bg-violet-500',
                  NEGOCIACAO: 'bg-amber-500',
                  GANHO: 'bg-emerald-500',
                  PERDIDO: 'bg-red-400',
                }
                const maxEst = Math.max(...funil.estagios.map(e => e.total || 0), 1)
                return (
                  <div key={est.estagio || i} className="flex items-center gap-3">
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-semibold text-slate-700">{est.estagio}</p>
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${colors[est.estagio] || 'bg-slate-400'} rounded-full transition-all duration-700`}
                        style={{ width: `${(est.total / maxEst) * 100}%` }}
                      />
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <span className="text-sm font-bold text-slate-700">{est.total}</span>
                      {funil.totalLeads > 0 && (
                        <span className="text-xs text-slate-400 ml-1">({Math.round((est.total/funil.totalLeads)*100)}%)</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {funil.conversaoGanho !== undefined && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">Taxa de conversão (GANHO)</p>
                    <p className="text-lg font-bold text-emerald-600">{funil.conversaoGanho}%</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

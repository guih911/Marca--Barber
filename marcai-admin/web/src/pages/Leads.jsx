import { useEffect, useMemo, useState } from 'react'
import { api, getUser } from '../api'
import { Plus, Send, Filter, MessageSquare, Users, Trophy, ChevronLeft, ChevronRight, X } from 'lucide-react'

const ESTAGIOS = ['NOVO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO']

const ESTAGIO_CONFIG = {
  NOVO: { label: 'Novo', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  QUALIFICACAO: { label: 'Qualificação', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROPOSTA: { label: 'Proposta', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  NEGOCIACAO: { label: 'Negociação', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  GANHO: { label: 'Ganho', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PERDIDO: { label: 'Perdido', color: 'bg-red-50 text-red-700 border-red-200' },
}

const ESTAGIO_BAR = {
  NOVO: 'bg-slate-400',
  QUALIFICACAO: 'bg-blue-500',
  PROPOSTA: 'bg-violet-500',
  NEGOCIACAO: 'bg-amber-500',
  GANHO: 'bg-emerald-500',
  PERDIDO: 'bg-red-400',
}

export default function Leads() {
  const user = getUser()
  const [busca, setBusca] = useState('')
  const [estagio, setEstagio] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ leads: [], total: 0, pagina: 1, limite: 20 })
  const [selecionados, setSelecionados] = useState([])
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formLead, setFormLead] = useState({ tenantId: '', nome: '', telefone: '', email: '', origem: 'MANUAL', estagio: 'NOVO' })

  const carregar = async (pagina = 1) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ pagina: String(pagina), limite: '20' })
      if (busca) qs.set('busca', busca)
      if (estagio) qs.set('estagio', estagio)
      const resp = await api(`/api/admin/leads?${qs}`)
      setData(resp)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar(1) }, [])
  const totalPaginas = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / 20)), [data])

  const alternar = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleTodos = () => {
    const ids = (data.leads || []).map(l => l.id)
    setSelecionados(prev => prev.length === ids.length ? [] : ids)
  }

  const criarLead = async (e) => {
    e.preventDefault()
    if (!formLead.tenantId || !formLead.nome || !formLead.telefone) return
    await api('/api/admin/leads', { method: 'POST', body: JSON.stringify(formLead) })
    setFormLead({ tenantId: '', nome: '', telefone: '', email: '', origem: 'MANUAL', estagio: 'NOVO' })
    setShowForm(false)
    carregar(1)
  }

  const atualizarEstagio = async (leadId, novoEstagio) => {
    await api(`/api/admin/leads/${leadId}/estagio`, {
      method: 'PATCH',
      body: JSON.stringify({ estagio: novoEstagio }),
    })
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => {
        if (l.id !== leadId) return l
        const tags = (l.tags || []).filter(t => !String(t).startsWith('estagio:'))
        return { ...l, tags: [...tags, `estagio:${novoEstagio}`] }
      }),
    }))
  }

  const enviarLote = async () => {
    if (!mensagem.trim() || selecionados.length === 0) return
    setEnviando(true)
    setResultado(null)
    try {
      const resp = await api('/api/admin/leads/mensagens/lote', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selecionados, texto: mensagem.trim() }),
      })
      setResultado(resp)
      setMensagem('')
      setSelecionados([])
    } finally {
      setEnviando(false)
    }
  }

  const estagioCount = useMemo(() => {
    const counts = {}
    ESTAGIOS.forEach(e => { counts[e] = 0 })
    ;(data.leads || []).forEach(l => {
      const est = (l.tags || []).find(t => String(t).startsWith('estagio:'))?.split(':')?.[1] || 'NOVO'
      counts[est] = (counts[est] || 0) + 1
    })
    return counts
  }, [data.leads])

  const rankingLeads = useMemo(() => {
    return [...(data.leads || [])]
      .sort((a, b) => (b._count?.agendamentos || 0) - (a._count?.agendamentos || 0))
      .slice(0, 5)
  }, [data.leads])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Leads CRM</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestão de leads · {data.total || 0} registros</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Novo lead
        </button>
      </div>

      {/* Kanban resumido por estágio */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ESTAGIOS.map(est => {
          const conf = ESTAGIO_CONFIG[est]
          return (
            <button
              key={est}
              onClick={() => setEstagio(estagio === est ? '' : est)}
              className={`card p-3 text-left transition-all hover:shadow-md ${estagio === est ? 'ring-2 ring-primaria ring-offset-1' : ''}`}
            >
              <div className={`w-6 h-1 rounded-full mb-2 ${ESTAGIO_BAR[est]}`} />
              <p className="text-lg font-bold text-slate-800">{estagioCount[est] || 0}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{conf.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros + tabela */}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-8 py-2"
              placeholder="Buscar por nome, telefone ou email..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && carregar(1)}
            />
          </div>
          <select
            className="input-field w-auto py-2"
            value={estagio}
            onChange={e => setEstagio(e.target.value)}
          >
            <option value="">Todos os estágios</option>
            {ESTAGIOS.map(e => <option key={e} value={e}>{ESTAGIO_CONFIG[e].label}</option>)}
          </select>
          <button onClick={() => carregar(1)} className="btn-primary py-2">Filtrar</button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  checked={selecionados.length === data.leads?.length && data.leads?.length > 0}
                  onChange={toggleTodos}
                  className="rounded"
                />
              </th>
              <th>Lead</th>
              <th>Tenant</th>
              <th>Estágio</th>
              <th className="text-center">Agendamentos</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">
                <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-primaria rounded-full animate-spin" /></div>
              </td></tr>
            ) : (data.leads || []).length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">Nenhum lead encontrado</td></tr>
            ) : (data.leads || []).map(lead => {
              const estagioAtual = (lead.tags || []).find(t => String(t).startsWith('estagio:'))?.split(':')?.[1] || 'NOVO'
              const conf = ESTAGIO_CONFIG[estagioAtual]
              return (
                <tr key={lead.id}>
                  <td><input type="checkbox" checked={selecionados.includes(lead.id)} onChange={() => alternar(lead.id)} className="rounded" /></td>
                  <td>
                    <p className="font-semibold text-slate-800">{lead.nome}</p>
                    <p className="text-xs text-slate-400">{lead.telefone}{lead.email ? ` · ${lead.email}` : ''}</p>
                  </td>
                  <td className="text-slate-600 text-sm">{lead.tenant?.nome || lead.tenantId?.slice(0, 8)}</td>
                  <td>
                    <select
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border ${conf.color} appearance-none cursor-pointer bg-transparent`}
                      value={estagioAtual}
                      onChange={e => atualizarEstagio(lead.id, e.target.value)}
                    >
                      {ESTAGIOS.map(e => <option key={e} value={e}>{ESTAGIO_CONFIG[e].label}</option>)}
                    </select>
                  </td>
                  <td className="text-center">
                    <span className="badge badge-slate">{lead._count?.agendamentos || 0}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Paginação */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">{data.total || 0} lead(s) · {selecionados.length} selecionados</p>
          <div className="flex items-center gap-1">
            <button onClick={() => carregar(Math.max(1, (data.pagina||1)-1))} disabled={(data.pagina||1)<=1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 text-xs text-slate-600">{data.pagina||1}/{totalPaginas}</span>
            <button onClick={() => carregar(Math.min(totalPaginas,(data.pagina||1)+1))} disabled={(data.pagina||1)>=totalPaginas} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Envio em massa + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Envio em massa */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Send size={16} className="text-primaria" />
            <p className="font-semibold text-slate-800 text-sm">Mensagem em massa</p>
            {selecionados.length > 0 && (
              <span className="badge badge-blue">{selecionados.length} selecionados</span>
            )}
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Será enviada via WhatsApp Meta. Assinado automaticamente como: <strong>{user?.nome || 'Admin'}</strong>
          </p>

          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            rows={4}
            className="input-field resize-none mb-3"
            placeholder={`Olá [nome do cliente], aqui é ${user?.nome || 'a equipe Marcai'} 👋\n\nDigite sua mensagem aqui...`}
          />

          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 mb-3">
              ✓ {resultado.enviados} enviados · {resultado.falhas} falha(s)
            </div>
          )}

          <button
            disabled={enviando || selecionados.length === 0 || !mensagem.trim()}
            onClick={enviarLote}
            className="btn-primary w-full justify-center"
          >
            {enviando ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
            ) : (
              <><Send size={14} /> Enviar via WhatsApp</>
            )}
          </button>
        </div>

        {/* Ranking de leads */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-gold-500" />
            <p className="font-semibold text-slate-800 text-sm">Top leads por agendamentos</p>
          </div>
          {rankingLeads.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados nesta página</p>
          ) : (
            <div className="space-y-3">
              {rankingLeads.map((lead, i) => (
                <div key={lead.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-gold-500 text-gray-900' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{lead.nome}</p>
                    <p className="text-xs text-slate-400">{lead.tenant?.nome || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-800">{lead._count?.agendamentos || 0}</p>
                    <p className="text-[10px] text-slate-400">agend.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal novo lead */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <form onSubmit={criarLead} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Novo Lead</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input className="input-field" placeholder="Tenant ID *" required value={formLead.tenantId} onChange={e => setFormLead(p => ({...p, tenantId: e.target.value}))} />
              <input className="input-field" placeholder="Nome completo *" required value={formLead.nome} onChange={e => setFormLead(p => ({...p, nome: e.target.value}))} />
              <input className="input-field" placeholder="Telefone (55...)" required value={formLead.telefone} onChange={e => setFormLead(p => ({...p, telefone: e.target.value}))} />
              <input type="email" className="input-field" placeholder="Email (opcional)" value={formLead.email} onChange={e => setFormLead(p => ({...p, email: e.target.value}))} />
              <select className="input-field" value={formLead.estagio} onChange={e => setFormLead(p => ({...p, estagio: e.target.value}))}>
                {ESTAGIOS.map(e => <option key={e} value={e}>{ESTAGIO_CONFIG[e].label}</option>)}
              </select>
              <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Cadastrar lead</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

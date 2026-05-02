import { useEffect, useState } from 'react'
import { api } from '../api'

const fmtMoney = (valor = 0) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const Card = ({ title, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <p className="text-xs uppercase text-slate-500 font-semibold">{title}</p>
    <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
    {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
  </div>
)

export default function Billing() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    try {
      setLoading(true)
      const resp = await api('/api/admin/billing/resumo')
      setDados(resp)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  if (loading) return <p className="text-slate-400">Carregando billing...</p>
  if (!dados) return <p className="text-red-500">Falha ao carregar dados de billing.</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Billing operacional</h1>
        <p className="text-sm text-slate-500">Base comercial para decisões de crescimento e retenção.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card title="MRR" value={fmtMoney(dados.mrr)} sub="Receita recorrente mensal" />
        <Card title="ARR" value={fmtMoney(dados.arr)} sub="Projeção anual" />
        <Card title="Contratos ativos" value={dados.contratosAtivos} />
        <Card title="Novos pagantes (30d)" value={dados.novosPagantes30d} />
        <Card title="Churn proxy" value={`${dados.churnProxy}%`} sub="Inativos / base total" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
        Use este painel como camada operacional inicial. Próximo passo: consolidar cobranças reais (eventos de pagamento),
        inadimplência e cohort por mês de aquisição.
      </div>
    </div>
  )
}

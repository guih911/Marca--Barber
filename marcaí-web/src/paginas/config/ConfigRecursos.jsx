import { useState, useEffect } from 'react'
import { Loader2, Save, Star, Package, BarChart2, Gift, Archive, Smartphone, MessageSquare, Images, ClipboardList, Landmark } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import useAuth from '../../hooks/useAuth'

const recursos = [
  {
    chave: 'npsAtivo',
    icone: Star,
    titulo: 'Avaliação pós-atendimento',
    descricao: 'Envia automaticamente uma pesquisa de satisfação (1 a 5 ⭐) via WhatsApp após o atendimento ser concluído.',
    cor: 'text-yellow-500',
    fundo: 'bg-yellow-50',
    recomendado: true,
  },
  {
    chave: 'fidelidadeAtivo',
    icone: Gift,
    titulo: 'Programa de fidelidade',
    descricao: 'Acumule pontos por atendimento. Ao atingir o limite, o cliente recebe um benefício (ex: 1 serviço grátis). Notificação automática via WhatsApp.',
    cor: 'text-purple-500',
    fundo: 'bg-purple-50',
    recomendado: true,
  },
  {
    chave: 'relatorioDiarioAtivo',
    icone: BarChart2,
    titulo: 'Relatório diário via WhatsApp',
    descricao: 'Todo dia às 20h, o gestor recebe no WhatsApp um resumo do dia: atendimentos, receita, cancelamentos e próximos agendamentos.',
    cor: 'text-blue-500',
    fundo: 'bg-blue-50',
    recomendado: true,
  },
  {
    chave: 'comissoesAtivo',
    icone: BarChart2,
    titulo: 'Comissões por profissional',
    descricao: 'Configure o percentual de comissão por serviço. Veja o relatório mensal de quanto cada profissional gerou e quanto deve receber.',
    cor: 'text-green-500',
    fundo: 'bg-green-50',
  },
  {
    chave: 'comandaAtivo',
    icone: MessageSquare,
    titulo: 'Comanda digital',
    descricao: 'Adicione produtos e extras ao atendimento. O cliente recebe o recibo completo via WhatsApp ao final.',
    cor: 'text-orange-500',
    fundo: 'bg-orange-50',
  },
  {
    chave: 'estoqueAtivo',
    icone: Archive,
    titulo: 'Controle de estoque',
    descricao: 'Gerencie produtos, entradas e saídas. Receba alertas via WhatsApp quando um produto atingir o estoque mínimo.',
    cor: 'text-red-500',
    fundo: 'bg-red-50',
  },
  {
    chave: 'pacotesAtivo',
    icone: Package,
    titulo: 'Pacotes e combos',
    descricao: 'Crie combos de serviços com preço especial (ex: Corte + Barba por R$45). A IA pode oferecer os pacotes durante o agendamento via WhatsApp.',
    cor: 'text-primaria',
    fundo: 'bg-primaria-clara',
  },
  {
    chave: 'membershipsAtivo',
    icone: Smartphone,
    titulo: 'Planos e assinaturas mensais',
    descricao: 'Crie planos mensais com créditos de serviço. Clientes assinam e consomem os créditos a cada atendimento.',
    cor: 'text-teal-500',
    fundo: 'bg-teal-50',
  },
  {
    chave: 'galeriaAtivo',
    icone: Images,
    titulo: 'Galeria',
    descricao: 'Adicione fotos dos trabalhos realizados para mostrar aos clientes.',
    cor: 'text-pink-500',
    fundo: 'bg-pink-50',
  },
  {
    chave: 'listaEsperaAtivo',
    icone: ClipboardList,
    titulo: 'Lista de espera',
    descricao: 'Gerencie a fila de espera dos clientes que chegam sem agendamento.',
    cor: 'text-indigo-500',
    fundo: 'bg-indigo-50',
  },
  {
    chave: 'caixaAtivo',
    icone: Landmark,
    titulo: 'Caixa',
    descricao: 'Controle de entradas e saídas financeiras do estabelecimento.',
    cor: 'text-emerald-500',
    fundo: 'bg-emerald-50',
  },
]

const ToggleSwitch = ({ ativo, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${ativo ? 'bg-primaria' : 'bg-borda'}`}
  >
    <span
      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${ativo ? 'left-6' : 'left-0.5'}`}
    />
  </button>
)

const ConfigRecursos = () => {
  const toast = useToast()
  const { carregarTenant } = useAuth()
  const [flags, setFlags] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/api/tenants/meu').then((res) => {
      const t = res.dados || {}
      const estado = {}
      recursos.forEach((r) => { estado[r.chave] = t[r.chave] ?? false })
      setFlags(estado)
      setCarregando(false)
    }).catch(() => {
      toast('Erro ao carregar configurações', 'erro')
      setCarregando(false)
    })
  }, [])

  const toggle = (chave) => setFlags((prev) => ({ ...prev, [chave]: !prev[chave] }))

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.patch('/api/tenants/meu', flags)
      await carregarTenant()
      toast('Recursos atualizados com sucesso!', 'sucesso')
    } catch {
      toast('Erro ao salvar. Tente novamente.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4 max-w-3xl">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-borda animate-pulse" />
        ))}
      </div>
    )
  }

  const ativos = Object.values(flags).filter(Boolean).length

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Recursos do sistema</h1>
        <p className="text-texto-sec text-sm mt-1">
          Ative apenas o que faz sentido para a sua barbearia. Cada recurso pode ser ligado ou desligado a qualquer momento.
        </p>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-3 bg-primaria-clara rounded-2xl px-4 py-3 border border-primaria/20">
        <div className="w-9 h-9 rounded-xl bg-primaria flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{ativos}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-texto">{ativos} recurso{ativos !== 1 ? 's' : ''} ativo{ativos !== 1 ? 's' : ''}</p>
          <p className="text-xs text-texto-sec">de {recursos.length} disponíveis</p>
        </div>
      </div>

      {/* Lista de recursos */}
      <div className="space-y-3">
        {recursos.map((r) => {
          const Icone = r.icone
          const ativo = flags[r.chave] ?? false
          return (
            <div
              key={r.chave}
              className={`bg-white rounded-2xl border p-4 md:p-5 shadow-sm transition-all ${ativo ? 'border-primaria/25 ring-1 ring-primaria/10' : 'border-borda'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-xl shrink-0 ${r.fundo}`}>
                    <Icone size={18} className={r.cor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-texto">{r.titulo}</p>
                      {r.recomendado && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-primaria text-white px-2 py-0.5 rounded-full">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-texto-sec mt-1 leading-relaxed">{r.descricao}</p>
                  </div>
                </div>
                <ToggleSwitch ativo={ativo} onChange={() => toggle(r.chave)} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar configurações
        </button>
      </div>
    </div>
  )
}

export default ConfigRecursos

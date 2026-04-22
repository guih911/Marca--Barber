import { useState, useEffect } from 'react'
import { Loader2, Save, Star, BarChart2, Smartphone, ClipboardList, Landmark, Lock, Zap } from 'lucide-react'
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
    chave: 'relatorioDiarioAtivo',
    icone: BarChart2,
    titulo: 'Relatório diário via WhatsApp',
    descricao: 'Todo dia às 20h, o gestor recebe no WhatsApp um resumo do dia: atendimentos, receita, cancelamentos e próximos agendamentos.',
    cor: 'text-blue-500',
    fundo: 'bg-blue-50',
    recomendado: true,
  },
  {
    chave: 'listaEsperaAtivo',
    icone: ClipboardList,
    titulo: 'Lista de espera',
    descricao: 'Fila para quando não houver horário; avisa o cliente (ou encaixa automaticamente, se a opção abaixo estiver ativa) quando alguém cancelar e abrir a vaga.',
    cor: 'text-indigo-500',
    fundo: 'bg-indigo-50',
  },
  {
    chave: 'filaEncaixeAutomaticoAtivo',
    icone: Zap,
    titulo: 'Encaixe automático (fila)',
    descricao: 'Se um horário abrir, o sistema reserva o cliente em primeiro lugar da fila e envia a confirmação no WhatsApp. Se desligar, só avisa a vaga e o cliente confirma antes de marcar.',
    cor: 'text-violet-500',
    fundo: 'bg-violet-50',
    dependeDe: 'listaEsperaAtivo',
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
  const [planoAtual, setPlanoAtual] = useState('SALAO')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/api/tenants/meu').then((res) => {
      const t = res.dados || {}
      setPlanoAtual(t.planoContratado || 'SALAO')
      const estado = {}
      recursos.forEach((r) => {
        if (r.chave === 'filaEncaixeAutomaticoAtivo') {
          estado[r.chave] = t.filaEncaixeAutomaticoAtivo !== false
        } else {
          estado[r.chave] = t[r.chave] ?? false
        }
      })
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
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao salvar. Tente novamente.', 'erro')
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

  const recursosDisponiveis = recursos.filter((recurso) => {
    if (recurso.plano && recurso.plano !== planoAtual) return false
    if (recurso.dependeDe && !flags[recurso.dependeDe]) return false
    return true
  })
  const recursosUpgrade = recursos.filter((recurso) => recurso.plano && recurso.plano !== planoAtual)
  const ativos = recursosDisponiveis.filter((recurso) => flags[recurso.chave]).length

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Recursos do sistema</h1>
        <p className="text-texto-sec text-sm mt-1">
          Ative apenas o que faz sentido para a sua barbearia. Cada recurso pode ser ligado ou desligado a qualquer momento.
        </p>
      </div>

      <div className="flex items-center gap-3 bg-primaria-clara rounded-2xl px-4 py-3 border border-primaria/20">
        <div className="w-9 h-9 rounded-xl bg-primaria flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{ativos}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-texto">{ativos} recurso{ativos !== 1 ? 's' : ''} ativo{ativos !== 1 ? 's' : ''}</p>
          <p className="text-xs text-texto-sec">de {recursosDisponiveis.length} disponíveis</p>
        </div>
      </div>

      <div className="space-y-3">
        {recursosDisponiveis.map((r) => {
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
                      <span className="text-[10px] font-medium uppercase tracking-wide bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                        Incluído no seu plano
                      </span>
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

      {recursosUpgrade.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-2">
            <Lock size={14} className="text-texto-sec" />
            <p className="text-sm font-semibold text-texto-sec">
              Disponível no plano {recursosUpgrade[0].plano === 'SALAO' ? 'Salão' : recursosUpgrade[0].plano}
            </p>
          </div>
          {recursosUpgrade.map((r) => {
            const Icone = r.icone
            return (
              <div
                key={r.chave}
                className="bg-fundo rounded-2xl border border-borda p-4 md:p-5 opacity-70"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl shrink-0 bg-gray-100">
                      <Icone size={18} className="text-texto-sec" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-texto">{r.titulo}</p>
                        <span className="text-[10px] font-medium uppercase tracking-wide bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Lock size={9} /> Plano {r.plano === 'SALAO' ? 'Salão' : r.plano}
                        </span>
                      </div>
                      <p className="text-xs text-texto-sec mt-1 leading-relaxed">{r.descricao}</p>
                    </div>
                  </div>
                  <div className="shrink-0 w-12 h-6 rounded-full bg-borda/50 cursor-not-allowed" title="Disponível no plano Salão" />
                </div>
              </div>
            )
          })}
        </div>
      )}

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

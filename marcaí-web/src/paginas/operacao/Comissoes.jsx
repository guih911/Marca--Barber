import { useState, useEffect } from 'react'
import { BarChart2, ChevronDown, ChevronUp, Loader2, Save, Settings2 } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import { formatarMoeda, obterIniciais } from '../../lib/utils'

const Comissoes = () => {
  const toast = useToast()
  const [dados, setDados] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [filtro, setFiltro] = useState({ inicio: '', fim: '' })
  const [salvandoComissao, setSalvandoComissao] = useState(null)
  const [editandoPercent, setEditandoPercent] = useState({}) // profissionalId -> percent

  const carregar = async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (filtro.inicio) params.set('inicio', filtro.inicio)
      if (filtro.fim) params.set('fim', filtro.fim)
      const [resComissoes, resProfissionais] = await Promise.all([
        api.get(`/api/comissoes?${params}`),
        api.get('/api/profissionais'),
      ])
      setDados(resComissoes.dados)
      setProfissionais(resProfissionais.dados || resProfissionais.profissionais || [])
    } catch { toast('Erro ao carregar comissões', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  const salvarComissaoPadrao = async (profissionalId) => {
    const percentual = editandoPercent[profissionalId]
    if (percentual === undefined) return
    setSalvandoComissao(profissionalId)
    try {
      await api.patch(`/api/comissoes/profissionais/${profissionalId}/padrao`, {
        comissaoPercent: percentual === '' ? null : Number(percentual),
      })
      toast('Comissão atualizada!', 'sucesso')
      carregar()
    } catch (e) { toast(e?.erro?.mensagem || 'Erro ao salvar', 'erro') }
    finally { setSalvandoComissao(null) }
  }

  const formatarPeriodo = (periodo) => {
    if (!periodo) return ''
    const ini = new Date(periodo.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const fim = new Date(periodo.fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `${ini} – ${fim}`
  }

  if (carregando) return (
    <div className="space-y-4 max-w-4xl">
      {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-borda animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Comissões</h1>
        <p className="text-texto-sec text-sm mt-1">Acompanhe quanto cada profissional gerou e quanto deve receber de comissão.</p>
      </div>

      {/* Configuração de comissões por profissional */}
      <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-borda">
          <Settings2 size={16} className="text-primaria" />
          <h2 className="text-sm font-semibold text-texto">Configurar % por profissional</h2>
        </div>
        <div className="divide-y divide-borda">
          {profissionais.length === 0 ? (
            <p className="px-5 py-6 text-sm text-texto-sec">Nenhum profissional cadastrado.</p>
          ) : profissionais.map((prof) => {
            const percent = editandoPercent[prof.id]
            const percentAtual = percent !== undefined ? percent : (prof.comissaoPercent ?? '')
            return (
              <div key={prof.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-primaria/15 flex items-center justify-center shrink-0">
                  <span className="text-primaria text-xs font-bold">{obterIniciais(prof.nome)}</span>
                </div>
                <p className="text-sm font-medium text-texto flex-1 min-w-0 truncate">{prof.nome}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="1"
                      placeholder="0"
                      value={percentAtual}
                      onChange={(e) => setEditandoPercent((prev) => ({ ...prev, [prof.id]: e.target.value }))}
                      className="w-20 px-3 py-1.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 text-right pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-texto-sec pointer-events-none">%</span>
                  </div>
                  <button
                    onClick={() => salvarComissaoPadrao(prof.id)}
                    disabled={salvandoComissao === prof.id || percent === undefined}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primaria hover:bg-primaria-escura disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {salvandoComissao === prof.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Salvar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-texto-sec mb-1">De</label>
          <input type="date" value={filtro.inicio} onChange={(e) => setFiltro((p) => ({ ...p, inicio: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-texto-sec mb-1">Até</label>
          <input type="date" value={filtro.fim} onChange={(e) => setFiltro((p) => ({ ...p, fim: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
        </div>
        <button onClick={carregar}
          className="mt-5 px-4 py-2 bg-primaria hover:bg-primaria-escura text-white text-sm font-medium rounded-lg transition-colors">
          Filtrar
        </button>
      </div>

      {/* Totais */}
      {dados && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Atendimentos', valor: dados.totais?.atendimentos },
            { label: 'Receita total', valor: formatarMoeda(dados.totais?.receitaTotalCentavos) },
            { label: 'Total comissões', valor: formatarMoeda(dados.totais?.comissaoTotalCentavos) },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-borda p-4 shadow-sm">
              <p className="text-xs text-texto-sec font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-texto mt-1">{card.valor ?? '—'}</p>
              <p className="text-[11px] text-texto-ter">{formatarPeriodo(dados?.periodo)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Por profissional */}
      <div className="space-y-3">
        {dados?.profissionais?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-borda p-10 text-center">
            <BarChart2 size={32} className="text-borda mx-auto mb-2" />
            <p className="text-sm text-texto-sec">Nenhum atendimento concluído no período</p>
          </div>
        ) : (
          dados?.profissionais?.map((p) => {
            const aberto = expandido === p.profissionalId
            const percentAtual = editandoPercent[p.profissionalId]
            return (
              <div key={p.profissionalId} className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandido(aberto ? null : p.profissionalId)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-fundo/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primaria/15 flex items-center justify-center shrink-0">
                    <span className="text-primaria text-xs font-bold">{obterIniciais(p.nome)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-texto">{p.nome}</p>
                    <p className="text-xs text-texto-sec">{p.atendimentos} atendimentos</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-sucesso">{formatarMoeda(p.comissaoTotalCentavos)}</p>
                    <p className="text-xs text-texto-sec">{formatarMoeda(p.receitaTotalCentavos)} gerados</p>
                  </div>
                  {aberto ? <ChevronUp size={16} className="text-texto-sec shrink-0" /> : <ChevronDown size={16} className="text-texto-sec shrink-0" />}
                </button>

                {aberto && (
                  <div className="border-t border-borda px-5 py-4 space-y-4 bg-fundo/30">
                    {/* Editar % padrão */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-texto-sec mb-1">% Comissão padrão (todos os serviços)</label>
                        <input
                          type="number" min="0" max="100" step="1"
                          placeholder="Ex: 40"
                          value={percentAtual ?? ''}
                          onChange={(e) => setEditandoPercent((prev) => ({ ...prev, [p.profissionalId]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                        />
                      </div>
                      <button
                        onClick={() => salvarComissaoPadrao(p.profissionalId)}
                        disabled={salvandoComissao === p.profissionalId || percentAtual === undefined}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primaria hover:bg-primaria-escura disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {salvandoComissao === p.profissionalId
                          ? <Loader2 size={13} className="animate-spin" />
                          : <><Save size={13} /> Salvar</>
                        }
                      </button>
                    </div>

                    {/* Detalhe por serviço */}
                    <div>
                      <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide mb-2">Detalhamento</p>
                      <div className="space-y-1.5">
                        {p.detalhes.slice(0, 10).map((d, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-texto-sec py-1.5 border-b border-borda/50 last:border-0">
                            <span className="truncate max-w-[60%]">{d.servico}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span>{d.percentual}%</span>
                              <span className="font-medium text-sucesso">{formatarMoeda(d.comissaoCentavos)}</span>
                            </div>
                          </div>
                        ))}
                        {p.detalhes.length > 10 && (
                          <p className="text-xs text-texto-ter">+ {p.detalhes.length - 10} atendimentos...</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Comissoes

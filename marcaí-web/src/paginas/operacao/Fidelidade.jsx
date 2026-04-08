import { useState, useEffect } from 'react'
import { Gift, Trophy, RotateCcw, Save, Loader2, Star, ChevronRight } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import { obterIniciais } from '../../lib/utils'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'

// Calcula nível com base no total histórico de pontos ganhos
const calcularNivel = (totalGanho = 0) => {
  if (totalGanho >= 150) return { label: 'Ouro', emoji: '🥇', cor: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  if (totalGanho >= 50) return { label: 'Prata', emoji: '🥈', cor: 'text-gray-600 bg-gray-50 border-gray-200' }
  return { label: 'Bronze', emoji: '🥉', cor: 'text-orange-700 bg-orange-50 border-orange-200' }
}

const CONFIG_PADRAO = {
  pontosPerServico: 1,
  pontosParaResgate: 10,
  descricaoResgate: '1 serviço grátis',
  aniversarioAtivo: false,
  aniversarioBeneficioTipo: 'CORTE_GRATIS',
  aniversarioDescricao: '',
  aniversarioValorCentavos: null,
  ativo: true,
}

const BadgeNivel = ({ totalGanho }) => {
  const nivel = calcularNivel(totalGanho)
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${nivel.cor}`}>
      {nivel.emoji} {nivel.label}
    </span>
  )
}

const Fidelidade = () => {
  const toast = useToast()
  const [ranking, setRanking] = useState([])
  const [config, setConfig] = useState(CONFIG_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [resgatando, setResgatando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const carregar = async () => {
    try {
      const [resRanking, resConfig] = await Promise.all([
        api.get('/api/fidelidade/ranking?limite=30'),
        api.get('/api/fidelidade/config'),
      ])
      setRanking(resRanking.dados || [])
      setConfig({ ...CONFIG_PADRAO, ...(resConfig.dados || {}) })
    } catch {
      toast('Erro ao carregar dados de fidelidade', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const salvarConfig = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put('/api/fidelidade/config', config)
      toast('Configuração salva!', 'sucesso')
    } catch {
      toast('Erro ao salvar', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const resgatar = (clienteId, nome) => {
    setConfirmar({
      titulo: 'Confirmar resgate',
      mensagem: `Resgatar ${config.pontosParaResgate} pontos para ${nome}? O benefício será enviado via WhatsApp.`,
      labelConfirmar: 'Resgatar',
      corBotao: 'primaria',
      onConfirmar: async () => {
        setConfirmar(null)
        setResgatando(clienteId)
        try {
          await api.post(`/api/fidelidade/clientes/${clienteId}/resgatar`)
          toast(`Resgate de ${nome} confirmado! WhatsApp enviado.`, 'sucesso')
          carregar()
        } catch (e) {
          toast(e?.erro?.mensagem || 'Erro ao resgatar', 'erro')
        } finally {
          setResgatando(null)
        }
      },
    })
  }

  const podeResgatar = (pontos) => pontos >= config.pontosParaResgate
  const beneficioAniversarioDescricao = config.aniversarioDescricao?.trim()
    || (config.aniversarioBeneficioTipo === 'VALE_PRESENTE'
      ? (config.aniversarioValorCentavos ? `vale-presente de R$ ${(config.aniversarioValorCentavos / 100).toFixed(2)}` : (config.descricaoResgate || 'vale-presente de aniversário'))
      : (config.descricaoResgate || 'corte grátis de aniversário'))

  if (carregando) {
    return (
      <div className="space-y-4 max-w-4xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-borda animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Programa de Fidelidade</h1>
        <p className="text-texto-sec text-sm mt-1">Clientes acumulam pontos a cada atendimento e resgatam benefícios automaticamente via WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="lg:col-span-1">
          <form onSubmit={salvarConfig} className="bg-white rounded-2xl border border-borda p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift size={16} className="text-primaria" />
              <h2 className="text-sm font-semibold text-texto">Configurações</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1.5">Pontos por atendimento</label>
              <input
                type="number" min="1" max="100"
                value={config.pontosPerServico}
                onChange={(e) => setConfig((p) => ({ ...p, pontosPerServico: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1.5">Pontos para resgatar</label>
              <input
                type="number" min="1"
                value={config.pontosParaResgate}
                onChange={(e) => setConfig((p) => ({ ...p, pontosParaResgate: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1.5">Benefício do resgate</label>
              <input
                type="text"
                value={config.descricaoResgate}
                onChange={(e) => setConfig((p) => ({ ...p, descricaoResgate: e.target.value }))}
                placeholder="Ex: 1 serviço grátis"
                className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm"
              />
            </div>

            <div className="rounded-xl bg-fundo px-3 py-2.5 text-xs text-texto-sec">
              A cada <strong>{config.pontosPerServico}</strong> {config.pontosPerServico === 1 ? 'ponto' : 'pontos'} por atendimento → ao atingir <strong>{config.pontosParaResgate}</strong> pontos → cliente ganha: <strong>{config.descricaoResgate}</strong>
            </div>

            <div className="rounded-xl border border-borda px-3 py-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide">Aniversário</p>
                  <p className="text-[11px] text-texto-ter mt-0.5">Quando ativo, o sistema envia parabéns e cria o benefício automático.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-texto-sec">
                  <input
                    type="checkbox"
                    checked={Boolean(config.aniversarioAtivo)}
                    onChange={(e) => setConfig((p) => ({ ...p, aniversarioAtivo: e.target.checked }))}
                    className="rounded border-borda text-primaria focus:ring-primaria/30"
                  />
                  Ativar
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-sec mb-1.5">Benefício do aniversário</label>
                <select
                  value={config.aniversarioBeneficioTipo}
                  onChange={(e) => setConfig((p) => ({ ...p, aniversarioBeneficioTipo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm bg-white"
                >
                  <option value="CORTE_GRATIS">Corte grátis</option>
                  <option value="VALE_PRESENTE">Vale-presente</option>
                </select>
              </div>

              {config.aniversarioBeneficioTipo === 'VALE_PRESENTE' && (
                <div>
                  <label className="block text-xs font-medium text-texto-sec mb-1.5">Valor do vale-presente (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={config.aniversarioValorCentavos != null ? (config.aniversarioValorCentavos / 100).toFixed(2) : ''}
                    onChange={(e) => setConfig((p) => ({
                      ...p,
                      aniversarioValorCentavos: e.target.value === ''
                        ? null
                        : (() => {
                            const normalizado = Number(e.target.value.replace(',', '.'))
                            return Number.isFinite(normalizado) ? Math.round(normalizado * 100) : null
                          })(),
                    }))}
                    className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm"
                    placeholder="Ex: 50,00"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-texto-sec mb-1.5">Descrição do benefício</label>
                <input
                  type="text"
                  value={config.aniversarioDescricao}
                  onChange={(e) => setConfig((p) => ({ ...p, aniversarioDescricao: e.target.value }))}
                  placeholder="Ex: corte grátis de aniversário"
                  className="w-full px-3 py-2 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm"
                />
                <p className="text-[11px] text-texto-ter mt-1">
                  Se vazio, usamos a descrição do resgate padrão: <strong>{beneficioAniversarioDescricao}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-borda px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide mb-2">Níveis automáticos</p>
              {[
                { label: 'Bronze', emoji: '🥉', desc: '0–49 pts acumulados', cor: 'text-orange-700' },
                { label: 'Prata', emoji: '🥈', desc: '50–149 pts acumulados', cor: 'text-gray-600' },
                { label: 'Ouro', emoji: '🥇', desc: '150+ pts acumulados', cor: 'text-yellow-600' },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${n.cor}`}>{n.emoji} {n.label}</span>
                  <span className="text-xs text-texto-sec">{n.desc}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full flex items-center justify-center gap-2 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Salvar configuração
            </button>
          </form>
        </div>

        {/* Ranking */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-borda">
              <Trophy size={16} className="text-primaria" />
              <h2 className="text-sm font-semibold text-texto">Ranking de Pontos</h2>
              <span className="ml-auto text-xs text-texto-sec">{ranking.length} clientes</span>
            </div>

            {ranking.length === 0 ? (
              <div className="text-center py-12">
                <Gift size={36} className="text-borda mx-auto mb-2" />
                <p className="text-sm text-texto-sec">Nenhum ponto registrado ainda</p>
                <p className="text-xs text-texto-ter mt-1">Os pontos são acumulados automaticamente após cada atendimento.</p>
              </div>
            ) : (
              <div className="divide-y divide-borda">
                {ranking.map((item, i) => {
                  const progresso = Math.min((item.pontos / config.pontosParaResgate) * 100, 100)
                  const pode = podeResgatar(item.pontos)
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-fundo/50 transition-colors">
                      {/* Posição */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-fundo text-texto-sec'
                      }`}>
                        {i + 1}
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primaria/15 flex items-center justify-center shrink-0">
                        <span className="text-primaria text-xs font-bold">{obterIniciais(item.cliente?.nome)}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium text-texto truncate">{item.cliente?.nome}</p>
                            <BadgeNivel totalGanho={item.totalGanho} />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-bold text-texto">{item.pontos}</span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-fundo overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primaria-escura to-primaria-brilho transition-all"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-texto-ter mt-0.5">
                          {pode ? '✅ Pode resgatar!' : `${config.pontosParaResgate - item.pontos} pts para resgatar`}
                          {item.totalGanho > 0 && <span className="ml-1 text-texto-sec">· {item.totalGanho} pts total</span>}
                        </p>
                      </div>

                      {/* Ação resgate */}
                      {pode && (
                        <button
                          onClick={() => resgatar(item.clienteId, item.cliente?.nome)}
                          disabled={resgatando === item.clienteId}
                          className="flex items-center gap-1 text-xs font-semibold text-primaria hover:text-primaria-escura disabled:opacity-50 shrink-0 transition-colors"
                        >
                          {resgatando === item.clienteId
                            ? <Loader2 size={13} className="animate-spin" />
                            : <><RotateCcw size={13} /> Resgatar</>
                          }
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {confirmar && (
        <ModalConfirmar {...confirmar} onCancelar={() => setConfirmar(null)} />
      )}
    </div>
  )
}

export default Fidelidade

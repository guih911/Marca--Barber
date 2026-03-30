import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Filter, MessageSquare, UserPlus, Trash2, Send, Star, CheckCircle2, Ban, Megaphone, CalendarClock, UserX, Sparkles, Gift, Clock, ListChecks } from 'lucide-react'
import api from '../../servicos/api'
import { cn, formatarHora, formatarTelefone, statusAgendamento } from '../../lib/utils'
import { Button } from '../../componentes/ui/button'
import { Input } from '../../componentes/ui/input'
import { Label } from '../../componentes/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import AvatarPessoa from '../../componentes/ui/AvatarPessoa'
import { useToast } from '../../contextos/ToastContexto'
import useAuth from '../../hooks/useAuth'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_SEMANA_COMPLETO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const HORAS = Array.from({ length: 13 }, (_, i) => i + 7)
const ALTURA_FAIXA_HORA = 64
const ESPACAMENTO_CARD_AGENDA = 6

const CORES_PROFISSIONAL = ['#6C63FF','#22C55E','#F59E0B','#EF4444','#3B82F6','#EC4899','#8B5CF6']

const coresPorStatus = {
  AGENDADO:       { bg: 'bg-blue-50 border-l-4 border-blue-400',        texto: 'text-blue-800' },
  CONFIRMADO:     { bg: 'bg-yellow-100 border-l-4 border-yellow-400',   texto: 'text-yellow-800' },
  CONCLUIDO:      { bg: 'bg-green-100 border-l-4 border-green-500',     texto: 'text-green-800' },
  CANCELADO:      { bg: 'bg-red-50 border-l-4 border-red-400',          texto: 'text-red-500 line-through' },
  REMARCADO:      { bg: 'bg-purple-50 border-l-4 border-purple-400',    texto: 'text-purple-700' },
  NAO_COMPARECEU: { bg: 'bg-orange-50 border-l-4 border-orange-400',    texto: 'text-orange-600 line-through' },
}

const fmt = (centavos) =>
  centavos != null ? (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

// Mini-calendÃ¡rio
const obterInicioMs = (agendamento) => new Date(agendamento.inicioEm).getTime()
const obterFimMs = (agendamento) => (
  agendamento.fimEm
    ? new Date(agendamento.fimEm).getTime()
    : obterInicioMs(agendamento) + (30 * 60 * 1000)
)

const calcularColunasDeSobreposicao = (agendamentos) => {
  const ordenados = [...agendamentos].sort((a, b) => {
    const diffInicio = obterInicioMs(a) - obterInicioMs(b)
    if (diffInicio !== 0) return diffInicio
    return obterFimMs(a) - obterFimMs(b)
  })

  const grupos = []
  let grupoAtual = []
  let maiorFimDoGrupo = -Infinity

  ordenados.forEach((agendamento) => {
    const inicio = obterInicioMs(agendamento)
    const fim = obterFimMs(agendamento)

    if (!grupoAtual.length || inicio < maiorFimDoGrupo) {
      grupoAtual.push(agendamento)
      maiorFimDoGrupo = Math.max(maiorFimDoGrupo, fim)
      return
    }

    grupos.push(grupoAtual)
    grupoAtual = [agendamento]
    maiorFimDoGrupo = fim
  })

  if (grupoAtual.length) grupos.push(grupoAtual)

  return grupos.reduce((acc, grupo) => {
    const finaisPorColuna = []
    const atribuicoes = []

    grupo.forEach((agendamento) => {
      const inicio = obterInicioMs(agendamento)
      const fim = obterFimMs(agendamento)
      let coluna = finaisPorColuna.findIndex((fimColuna) => fimColuna <= inicio)

      if (coluna === -1) coluna = finaisPorColuna.length

      finaisPorColuna[coluna] = fim
      atribuicoes.push({ id: agendamento.id, coluna })
    })

    const totalColunas = Math.max(finaisPorColuna.length, 1)
    atribuicoes.forEach(({ id, coluna }) => {
      acc[id] = { coluna, totalColunas }
    })

    return acc
  }, {})
}

const clientePresente = (agendamento) => Boolean(agendamento?.presencaConfirmadaEm)

const MiniCalendario = ({ data, onChange }) => {
  const [mes, setMes] = useState(new Date(data.getFullYear(), data.getMonth(), 1))

  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay()
  const hoje = new Date()

  const navMes = (dir) => {
    const novo = new Date(mes)
    novo.setMonth(novo.getMonth() + dir)
    setMes(novo)
  }

  const diasGrid = []
  for (let i = 0; i < primeiroDia; i++) diasGrid.push(null)
  for (let i = 1; i <= diasNoMes; i++) diasGrid.push(i)

  const ehHoje = (dia) => {
    if (!dia) return false
    return new Date(mes.getFullYear(), mes.getMonth(), dia).toDateString() === hoje.toDateString()
  }

  const ehSelecionado = (dia) => {
    if (!dia) return false
    return new Date(mes.getFullYear(), mes.getMonth(), dia).toDateString() === data.toDateString()
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-texto">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </span>
        <div className="flex gap-1">
          <button onClick={() => navMes(-1)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-texto-sec">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => navMes(1)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-texto-sec">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DIAS_SEMANA_ABREV.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-texto-sec py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {diasGrid.map((dia, i) => (
          <button
            key={i}
            disabled={!dia}
            onClick={() => dia && onChange(new Date(mes.getFullYear(), mes.getMonth(), dia))}
            className={cn(
              'text-xs w-full aspect-square flex items-center justify-center rounded-full transition-colors',
              !dia ? '' : 'hover:bg-primaria/10',
              ehHoje(dia) && !ehSelecionado(dia) ? 'text-primaria font-bold' : '',
              ehSelecionado(dia) ? 'bg-primaria text-white font-bold' : dia ? 'text-texto' : ''
            )}
          >
            {dia}
          </button>
        ))}
      </div>
    </div>
  )
}

// Modal adicionar item Ã  comanda (inline na agenda)
const ModalAdicionarItem = ({ agendamentoId, produtos, onFechar, onSalvar }) => {
  const toast = useToast()
  const [modo, setModo] = useState('produto')
  const [produtoId, setProdutoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)

  const produtoSelecionado = produtos.find((p) => p.id === produtoId)

  useEffect(() => {
    if (produtoSelecionado?.precoVendaCentavos) {
      setPreco((produtoSelecionado.precoVendaCentavos / 100).toFixed(2))
      setDescricao(produtoSelecionado.nome)
    }
  }, [produtoId])

  const salvar = async () => {
    const desc = modo === 'produto' ? produtoSelecionado?.nome || descricao : descricao
    if (!desc) { toast('Informe a descrição', 'aviso'); return }
    if (!preco || isNaN(parseFloat(preco))) { toast('Informe o preço', 'aviso'); return }
    setSalvando(true)
    try {
      await api.post(`/api/comanda/${agendamentoId}/itens`, {
        produtoId: modo === 'produto' ? produtoId || null : null,
        descricao: desc,
        quantidade: parseInt(quantidade) || 1,
        precoCentavos: Math.round(parseFloat(preco) * 100),
      })
      toast('Item adicionado!', 'sucesso')
      onSalvar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao adicionar item', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-texto">Adicionar item</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {[['produto', 'Produto do estoque'], ['avulso', 'Item avulso']].map(([m, label]) => (
            <button
              key={m}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${modo === m ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:bg-fundo'}`}
              onClick={() => setModo(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {modo === 'produto' ? (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Produto</label>
              {produtos.length > 0 ? (
                <Select value={produtoId || '__sel__'} onValueChange={(v) => setProdutoId(v === '__sel__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sel__">Selecione um produto...</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}{p.quantidadeAtual !== undefined ? ` (${p.quantidadeAtual} em estoque)` : ''}{p.precoVendaCentavos ? ` — ${fmt(p.precoVendaCentavos)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-texto-sec italic">Nenhum produto no estoque.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Descrição</label>
              <input
                className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30"
                placeholder="Ex: Hidratação, Pigmentação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          )}
          <div className="flex gap-3">
            <div className="w-24">
              <label className="block text-xs font-medium text-texto-sec mb-1">Qtd</label>
              <input type="number" min="1" className="w-full border border-borda rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-texto-sec mb-1">Preço (R$)</label>
              <input type="number" step="0.01" min="0" className="w-full border border-borda rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variante="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}

// Modal de detalhes do agendamento â€” com aba Comanda embutida
const ModalDetalhes = ({ agendamento, onClose, onAcao, onRecarregar, produtos }) => {
  const [carregandoAcao, setCarregandoAcao] = useState(false)
  const [comanda, setComanda] = useState(null)
  const [carregandoComanda, setCarregandoComanda] = useState(false)
  const [mostrarAddItem, setMostrarAddItem] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [mostrarNaoCompareceu, setMostrarNaoCompareceu] = useState(false)
  const [mostrarRemarcar, setMostrarRemarcar] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [statusAtual, setStatusAtual] = useState(agendamento.status)
  const [presencaConfirmadaEm, setPresencaConfirmadaEm] = useState(agendamento.presencaConfirmadaEm)
  const [tipoCorteCliente, setTipoCorteCliente] = useState(agendamento.cliente?.tipoCortePreferido || '')
  const [preferenciasCliente, setPreferenciasCliente] = useState(agendamento.cliente?.preferencias || '')
  const [salvandoPreferencias, setSalvandoPreferencias] = useState(false)

  const navigate = useNavigate()
  const { tenant } = useAuth()
  const toast = useToast()

  const temComanda = tenant?.comandaAtivo && ['AGENDADO', 'CONFIRMADO', 'CONCLUIDO'].includes(statusAtual)
  const podeEditarComanda = statusAtual !== 'CONCLUIDO'
  const exigeConfirmacaoPresenca = Boolean(tenant?.exigirConfirmacaoPresenca)
  const presencaConfirmada = clientePresente({ presencaConfirmadaEm })
  const podeOperar = ['AGENDADO', 'CONFIRMADO'].includes(statusAtual)
  const presencaObrigatoriaPendente = exigeConfirmacaoPresenca && !presencaConfirmada && podeOperar

  useEffect(() => {
    setStatusAtual(agendamento.status)
    setPresencaConfirmadaEm(agendamento.presencaConfirmadaEm)
    setTipoCorteCliente(agendamento.cliente?.tipoCortePreferido || '')
    setPreferenciasCliente(agendamento.cliente?.preferencias || '')
    setFormaPagamento('')
  }, [agendamento.id, agendamento.status, agendamento.presencaConfirmadaEm, agendamento.cliente?.tipoCortePreferido, agendamento.cliente?.preferencias])

  const carregarComanda = async () => {
    setCarregandoComanda(true)
    try {
      const res = await api.get(`/api/comanda/${agendamento.id}`)
      setComanda(res.dados)
    } catch {
      toast('Erro ao carregar comanda', 'erro')
    } finally {
      setCarregandoComanda(false)
    }
  }

  useEffect(() => { if (temComanda) carregarComanda() }, [agendamento.id, temComanda])

  const executarAcao = async (acao) => {
    setCarregandoAcao(true)
    try {
      await onAcao(acao, agendamento.id)
      onClose()
    } finally {
      setCarregandoAcao(false)
    }
  }

  const salvarPreferencias = async () => {
    if (!agendamento.cliente?.id) return
    setSalvandoPreferencias(true)
    try {
      await api.patch(`/api/clientes/${agendamento.cliente.id}`, {
        tipoCortePreferido: tipoCorteCliente.trim() || null,
        preferencias: preferenciasCliente.trim() || null,
      })
      toast('Perfil do cliente salvo.', 'sucesso')
      onRecarregar?.()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao salvar perfil do cliente', 'erro')
    } finally {
      setSalvandoPreferencias(false)
    }
  }

  const confirmarAgendamento = async () => {
    setCarregandoAcao(true)
    try {
      const res = await api.patch(`/api/agendamentos/${agendamento.id}/confirmar`, {})
      setStatusAtual(res.dados?.status || 'CONFIRMADO')
      toast('Agendamento confirmado!', 'sucesso')
      onRecarregar?.()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao confirmar agendamento', 'erro')
    } finally {
      setCarregandoAcao(false)
    }
  }

  const confirmarPresenca = async () => {
    setCarregandoAcao(true)
    try {
      const res = await api.patch(`/api/agendamentos/${agendamento.id}/confirmar-presenca`, {})
      setStatusAtual(res.dados?.status || statusAtual)
      setPresencaConfirmadaEm(res.dados?.presencaConfirmadaEm || new Date().toISOString())
      toast('Presença confirmada.', 'sucesso')
      onRecarregar?.()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao confirmar presença', 'erro')
    } finally {
      setCarregandoAcao(false)
    }
  }

  const removerItem = async (itemId) => {
    setRemovendo(itemId)
    try {
      await api.delete(`/api/comanda/${agendamento.id}/itens/${itemId}`)
      carregarComanda()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao remover', 'erro')
    } finally {
      setRemovendo(null)
    }
  }

  const enviarRecibo = async () => {
    setEnviando(true)
    try {
      await api.post(`/api/comanda/${agendamento.id}/enviar-recibo`, {})
      toast('Recibo enviado pelo WhatsApp!', 'sucesso')
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao enviar recibo', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  const finalizar = async () => {
    if (!formaPagamento) { toast('Selecione a forma de pagamento', 'aviso'); return }
    if (presencaObrigatoriaPendente) { toast('Confirme a chegada do cliente antes de finalizar.', 'aviso'); return }
    setFinalizando(true)
    try {
      await api.patch(`/api/agendamentos/${agendamento.id}/concluir`, { formaPagamento })
      toast('Atendimento finalizado!', 'sucesso')
      onRecarregar?.()
      onClose()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao finalizar', 'erro')
    } finally {
      setFinalizando(false)
    }
  }

  const totalCentavos = comanda
    ? (comanda.servico?.precoCentavos || 0) + (comanda.comandaItens?.reduce((acc, i) => acc + i.precoCentavos * i.quantidade, 0) || 0)
    : 0

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-borda shrink-0">
          <div className="flex items-center gap-3">
            <AvatarPessoa pessoa={agendamento.cliente} tamanho="md" />
            <div>
              <h3 className="text-lg font-semibold text-texto">{agendamento.cliente?.nome}</h3>
              <p className="text-texto-sec text-sm">{agendamento.servico?.nome}</p>
              {presencaConfirmada && (
                <p className="text-[11px] text-green-700 font-medium mt-1">Cliente chegou às {formatarHora(presencaConfirmadaEm)}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-texto-sec hover:text-texto mt-0.5"><X size={20} /></button>
        </div>

        {/* Body scrollavel */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          <div className="space-y-2.5">
            {[
              ['Horário', `${formatarHora(agendamento.inicioEm)} - ${formatarHora(agendamento.fimEm)}`],
              ['Telefone', formatarTelefone(agendamento.cliente?.telefone) || '—'],
              ['Profissional', agendamento.profissional?.nome || '—'],
              ['Tipo de corte', tipoCorteCliente || '—'],
              ['Valor', agendamento.servico?.precoCentavos ? fmt(agendamento.servico.precoCentavos) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-texto-sec">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-texto-sec">Status</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusAgendamento[statusAtual]?.cor}`}>
                {statusAgendamento[statusAtual]?.label}
              </span>
            </div>
            {statusAtual === 'CONCLUIDO' && agendamento.concluidoEm && (
              <div className="flex justify-between text-sm">
                <span className="text-texto-sec">Finalizado às</span>
                <span className="font-medium text-emerald-700">{formatarHora(agendamento.concluidoEm)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm gap-3">
              <span className="text-texto-sec">Presença</span>
              <span className={cn('font-medium text-right', presencaConfirmada ? 'text-green-700' : 'text-texto')}>
                {presencaConfirmada
                  ? `Chegou às ${formatarHora(presencaConfirmadaEm)}`
                  : exigeConfirmacaoPresenca
                  ? 'Pendente'
                  : 'Opcional'}
              </span>
            </div>
          </div>

          {/* â”€â”€ Comanda (quando ativa) â”€â”€ */}
          {agendamento.cliente?.avatarUrl && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-green-700 mb-1">Foto real do WhatsApp ativa</p>
              <p className="text-sm text-green-800">
                Essa foto já aparece na agenda e nas mensagens para facilitar a identificação na recepção.
              </p>
            </div>
          )}

          {presencaObrigatoriaPendente && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700 mb-1">Chegada do cliente pendente</p>
              <p className="text-sm text-amber-800">
                A presença precisa ser confirmada antes de concluir este atendimento.
              </p>
            </div>
          )}

          {temComanda && (
            carregandoComanda ? (
              <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-texto-sec" /></div>
            ) : (
              <div className="rounded-xl border border-borda overflow-hidden">
                <div className="px-3 py-2 bg-fundo border-b border-borda">
                  <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide">Comanda</p>
                </div>
                <div className="px-3 py-2.5 flex justify-between text-sm bg-white">
                  <span className="text-texto">{comanda?.servico?.nome || agendamento.servico?.nome}</span>
                  <span className="font-medium">{fmt(comanda?.servico?.precoCentavos || agendamento.servico?.precoCentavos)}</span>
                </div>

                {comanda?.comandaItens?.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 border-t border-borda bg-fundo">
                      <p className="text-[11px] font-semibold text-texto-sec uppercase tracking-wide">Extras</p>
                    </div>
                    {comanda.comandaItens.map((item) => (
                      <div key={item.id} className="px-3 py-2.5 border-t border-borda bg-white flex items-center justify-between">
                        <div>
                          <p className="text-sm text-texto">{item.descricao}</p>
                          <p className="text-xs text-texto-sec">{item.quantidade}x - {fmt(item.precoCentavos)} cada</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{fmt(item.precoCentavos * item.quantidade)}</span>
                          {podeEditarComanda && (
                            <button onClick={() => removerItem(item.id)} disabled={removendo === item.id} className="text-red-400 hover:text-red-600 transition-colors">
                              {removendo === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="px-3 py-2.5 border-t border-primaria/20 bg-primaria/5 flex justify-between items-center">
                  <span className="font-semibold text-sm text-texto">Total</span>
                  <span className="text-base font-bold text-primaria">{fmt(totalCentavos)}</span>
                </div>
              </div>
            )
          )}

          {/* â”€â”€ AÃ§Ãµes da comanda â”€â”€ */}
          {temComanda && !carregandoComanda && (
            <div className="flex gap-2">
              {podeEditarComanda && (
                <Button onClick={() => setMostrarAddItem(true)} className="gap-1.5 flex-1" tamanho="sm">
                  <Plus size={13} /> Adicionar item
                </Button>
              )}
              <Button variante="outline" tamanho="sm" onClick={enviarRecibo} disabled={enviando} className="gap-1.5">
                {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Recibo
              </Button>
            </div>
          )}

          {/* â”€â”€ ComissÃ£o â”€â”€ */}
          {agendamento.profissional?.comissaoPercentual > 0 && agendamento.servico?.precoCentavos && (
            <div className="bg-fundo border border-borda rounded-xl px-3 py-2.5 flex justify-between text-sm">
              <span className="text-texto-sec">{agendamento.profissional?.nome} ({agendamento.profissional?.comissaoPercentual}%)</span>
              <span className="font-semibold text-texto">{fmt(Math.round(agendamento.servico.precoCentavos * agendamento.profissional.comissaoPercentual / 100))}</span>
            </div>
          )}

          {/* â”€â”€ AvaliaÃ§Ã£o NPS â”€â”€ */}
          {agendamento.feedbackNota && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-700 mb-1.5">Avaliação</p>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={14} className={s <= agendamento.feedbackNota ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                ))}
                <span className="text-sm font-semibold text-yellow-700 ml-1">{agendamento.feedbackNota}/5</span>
              </div>
              {agendamento.feedbackComentario && (
                <p className="text-sm text-yellow-800 mt-1.5 italic">"{agendamento.feedbackComentario}"</p>
              )}
            </div>
          )}

          {/* â”€â”€ Notas â”€â”€ */}
          {agendamento.notas && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-yellow-700 mb-1">Notas</p>
              <p className="text-sm text-yellow-800">{agendamento.notas}</p>
            </div>
          )}
          {agendamento.cliente?.notas && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-700 mb-1">Ficha do cliente</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{agendamento.cliente.notas}</p>
            </div>
          )}

          {/* â”€â”€ Ver conversa â”€â”€ */}
          <div className="rounded-xl border border-borda p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide">Perfil do cliente</p>
                <p className="text-[11px] text-texto-sec mt-1">
                  Salve o tipo de corte e as observações que ajudam no próximo atendimento.
                </p>
              </div>
              <Button
                tamanho="sm"
                variante="outline"
                onClick={salvarPreferencias}
                disabled={salvandoPreferencias || !agendamento.cliente?.id}
                className="shrink-0"
              >
                {salvandoPreferencias ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
              </Button>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-texto-sec">Tipo de corte</p>
              <input
                value={tipoCorteCliente}
                onChange={(e) => setTipoCorteCliente(e.target.value)}
                placeholder="Ex: degradê baixo, social, moicano disfarçado"
                className="w-full rounded-xl border border-borda px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-texto-sec">Preferências e observações</p>
              <textarea
                value={preferenciasCliente}
                onChange={(e) => setPreferenciasCliente(e.target.value)}
                rows={4}
                placeholder="Ex: prefere tesoura, não tirar muito em cima, gosta de confirmar pelo WhatsApp."
                className="w-full rounded-xl border border-borda px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
              />
            </div>
          </div>

          <button
            onClick={() => { onClose(); navigate('/dashboard/mensagens', { state: { telefone: agendamento.cliente?.telefone || '' } }) }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-texto hover:border-primaria/40 transition-colors"
          >
            <MessageSquare size={13} /> Ver conversa
          </button>

          {/* â”€â”€ Forma de pagamento + Finalizar (quando pendente) â”€â”€ */}
          {podeOperar && (
            <>
              <div className="grid gap-2 pb-1 md:grid-cols-2">
                {statusAtual === 'AGENDADO' && (
                  <Button tamanho="sm" variante="secondary" onClick={confirmarAgendamento} disabled={carregandoAcao}>
                    Confirmar agenda
                  </Button>
                )}
                {!presencaConfirmada && (
                  <Button
                    tamanho="sm"
                    variante="outline"
                    className={cn('gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50', statusAtual === 'AGENDADO' ? '' : 'col-span-2')}
                    onClick={confirmarPresenca}
                    disabled={carregandoAcao}
                  >
                    <CheckCircle2 size={13} /> Cliente chegou
                  </Button>
                )}
                <Button tamanho="sm" variante="outline" className="gap-1.5 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => setMostrarRemarcar(true)} disabled={carregandoAcao}>
                  <CalendarClock size={13} /> Remarcar
                </Button>
                {!presencaConfirmada && (
                  <Button tamanho="sm" variante="outline" className="gap-1.5 text-orange-500 border-orange-300 hover:bg-orange-50" onClick={() => setMostrarNaoCompareceu(true)} disabled={carregandoAcao}>
                    <UserX size={13} /> Não compareceu
                  </Button>
                )}
                <Button tamanho="sm" variante="destructive" className={!presencaConfirmada ? 'col-span-2' : ''} onClick={() => setConfirmarCancelar(true)} disabled={carregandoAcao}>
                  Cancelar
                </Button>
              </div>

              <div>
                <p className="text-sm font-semibold text-texto mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[['PIX', 'Pix'], ['DINHEIRO', 'Dinheiro'], ['CREDITO', 'Crédito'], ['DEBITO', 'Débito']].map(([forma, label]) => (
                    <button
                      key={forma}
                      onClick={() => setFormaPagamento(forma)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${formaPagamento === forma ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={finalizar}
                disabled={finalizando || !formaPagamento || presencaObrigatoriaPendente}
                className="w-full bg-green-600 hover:bg-green-700 gap-2"
              >
                {finalizando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Finalizar atendimento
              </Button>
            </>
          )}

          {/* Ações para CONCLUIDO */}
          {statusAtual === 'CONCLUIDO' && (
            <div className="grid gap-2 pb-1">
              <Button
                tamanho="sm"
                variante="outline"
                className="gap-1.5"
                onClick={() => { onClose(); navigate('/operacao/comanda') }}
              >
                <CheckCircle2 size={13} /> Ver comanda completa
              </Button>
            </div>
          )}

          {/* Ações para CANCELADO */}
          {statusAtual === 'CANCELADO' && (
            <div className="grid gap-2 pb-1">
              <Button
                tamanho="sm"
                variante="secondary"
                className="gap-1.5"
                onClick={() => setMostrarRemarcar(true)}
              >
                <CalendarClock size={13} /> Reagendar
              </Button>
            </div>
          )}

        </div>
      </div>

      {mostrarAddItem && (
        <ModalAdicionarItem
          agendamentoId={agendamento.id}
          produtos={produtos}
          onFechar={() => setMostrarAddItem(false)}
          onSalvar={() => { setMostrarAddItem(false); carregarComanda() }}
        />
      )}

      {mostrarNaoCompareceu && (
        <ModalNaoCompareceu
          agendamento={agendamento}
          onFechar={() => setMostrarNaoCompareceu(false)}
          onConfirmar={async (mensagem) => {
            setCarregandoAcao(true)
            try {
              await api.patch(`/api/agendamentos/${agendamento.id}/nao-compareceu`, { mensagemWhatsApp: mensagem })
              onRecarregar?.()
              onClose()
            } catch (e) {
              toast(e?.erro?.mensagem || 'Erro ao registrar', 'erro')
            } finally {
              setCarregandoAcao(false)
            }
          }}
        />
      )}

      {mostrarRemarcar && (
        <ModalRemarcar
          agendamento={agendamento}
          onFechar={() => setMostrarRemarcar(false)}
          onConfirmar={async (novoInicio) => {
            setCarregandoAcao(true)
            try {
              await api.patch(`/api/agendamentos/${agendamento.id}/remarcar`, { novoInicio })
              toast('Agendamento remarcado!', 'sucesso')
              onRecarregar?.()
              onClose()
            } catch (e) {
              toast(e?.erro?.mensagem || 'Erro ao remarcar', 'erro')
            } finally {
              setCarregandoAcao(false)
            }
          }}
        />
      )}

      {confirmarCancelar && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmarCancelar(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <Ban size={15} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-texto text-sm">Cancelar agendamento</h3>
            </div>
            <p className="text-sm text-texto-sec">Tem certeza que deseja cancelar este agendamento? O cliente sera notificado.</p>
            <div className="flex gap-2.5">
              <Button variante="outline" className="flex-1" onClick={() => setConfirmarCancelar(false)}>Voltar</Button>
              <Button variante="destructive" className="flex-1" onClick={() => { setConfirmarCancelar(false); executarAcao('cancelar') }} disabled={carregandoAcao}>
                Sim, cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Modal NÃ£o Compareceu â€” registra ausÃªncia e envia mensagem de recontato pelo WhatsApp
const ModalNaoCompareceu = ({ agendamento, onFechar, onConfirmar }) => {
  const primeiroNome = agendamento.cliente?.nome?.split(' ')[0] || 'cliente'
  const hora = formatarHora(agendamento.inicioEm)
  const servico = agendamento.servico?.nome || 'seu horário'
  const temTelefone = !!agendamento.cliente?.telefone

  const [enviarMsg, setEnviarMsg] = useState(temTelefone)
  const [mensagem, setMensagem] = useState(
    `Oi, ${primeiroNome}! Notamos que você não compareceu ao seu ${servico} de hoje às ${hora}. Tudo bem? Que tal remarcarmos para outro dia?`
  )
  const [salvando, setSalvando] = useState(false)

  const confirmar = async () => {
    setSalvando(true)
    await onConfirmar(enviarMsg && temTelefone ? mensagem : null)
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-borda">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <UserX size={15} className="text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-texto text-sm">Não compareceu</h3>
              <p className="text-xs text-texto-sec">{agendamento.cliente?.nome}</p>
            </div>
          </div>
          <button onClick={onFechar} className="text-texto-sec hover:text-texto"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {temTelefone ? (
            <>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarMsg}
                  onChange={(e) => setEnviarMsg(e.target.checked)}
                  className="w-4 h-4 accent-primaria"
                />
                <span className="text-sm text-texto">Enviar mensagem de recontato pelo WhatsApp</span>
              </label>
              {enviarMsg && (
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  className="w-full border border-borda rounded-xl px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
                />
              )}
            </>
          ) : (
            <p className="text-sm text-texto-sec">Este cliente não tem telefone cadastrado.</p>
          )}
        </div>

        <div className="flex gap-2.5 px-5 pb-5">
          <Button variante="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={confirmar}
            disabled={salvando}
          >
            {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Registrar ausência
          </Button>
        </div>
      </div>
    </div>
  )
}

// Modal Remarcar â€” escolhe nova data e horÃ¡rio
const ModalRemarcar = ({ agendamento, onFechar, onConfirmar }) => {
  const [data, setData] = useState(agendamento.inicioEm ? new Date(agendamento.inicioEm).toISOString().split('T')[0] : '')
  const [slots, setSlots] = useState([])
  const [slotSelecionado, setSlotSelecionado] = useState('')
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!data) return
    const buscar = async () => {
      setCarregandoSlots(true)
      setSlots([])
      setSlotSelecionado('')
      try {
        const res = await api.get(
          `/api/agendamentos/disponibilidade?profissionalId=${agendamento.profissionalId}&servicoId=${agendamento.servicoId}&data=${data}`
        )
        setSlots((res.dados || []).filter(s => s.disponivel !== false))
      } catch {
        toast('Erro ao buscar horários disponíveis', 'erro')
      } finally {
        setCarregandoSlots(false)
      }
    }
    buscar()
  }, [data])

  const confirmar = async () => {
    if (!slotSelecionado) { toast('Selecione um horário', 'aviso'); return }
    setSalvando(true)
    await onConfirmar(slotSelecionado)
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-borda">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <CalendarClock size={15} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-texto text-sm">Remarcar agendamento</h3>
              <p className="text-xs text-texto-sec">{agendamento.cliente?.nome} — {agendamento.servico?.nome}</p>
            </div>
          </div>
          <button onClick={onFechar} className="text-texto-sec hover:text-texto"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1.5">Nova data</label>
            <input
              type="date"
              value={data}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setData(e.target.value)}
              className="w-full border border-borda rounded-xl px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>

          {data && (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1.5">Horário disponível</label>
              {carregandoSlots ? (
                <div className="flex items-center justify-center py-4 text-texto-sec gap-2">
                  <Loader2 size={16} className="animate-spin" /> Buscando horários...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-texto-sec text-center py-3">Nenhum horário disponível nesta data.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot.inicio}
                      onClick={() => setSlotSelecionado(slot.inicio)}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                        slotSelecionado === slot.inicio
                          ? 'bg-primaria text-white border-primaria'
                          : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria'
                      }`}
                    >
                      {formatarHora(slot.inicio)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 px-5 pb-5">
          <Button variante="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button
            className="flex-1"
            onClick={confirmar}
            disabled={salvando || !slotSelecionado}
          >
            {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Confirmar remarcação
          </Button>
        </div>
      </div>
    </div>
  )
}

// Modal novo agendamento
const ModalNovoAgendamento = ({ dataInicial, preset, onClose, onSalvar }) => {
  const toast = useToast()
  const dataBase = preset?.dataHora || dataInicial || new Date()
  const [form, setForm] = useState({
    profissionalId: preset?.profissionalId || '',
    servicoId: '',
    clienteNome: '',
    clienteTelefone: '',
    clienteTipoCorte: '',
    clientePreferencias: '',
    data: dataBase.toISOString().split('T')[0],
    horario: preset?.dataHora ? preset.dataHora.toISOString() : '',
  })
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [slots, setSlots] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState(false)

  useEffect(() => {
    const digitos = form.clienteTelefone.replace(/\D/g, '')
    if (digitos.length < 8) { setClienteEncontrado(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/clientes?busca=${digitos}&limite=1`)
        const c = res.clientes?.[0]
        if (c) {
          setForm(p => ({
            ...p,
            clienteNome: p.clienteNome || c.nome || '',
            clienteTipoCorte: p.clienteTipoCorte || c.tipoCortePreferido || '',
            clientePreferencias: p.clientePreferencias || c.preferencias || '',
          }))
          setClienteEncontrado(true)
        } else {
          setClienteEncontrado(false)
        }
      } catch { setClienteEncontrado(false) }
    }, 600)
    return () => clearTimeout(t)
  }, [form.clienteTelefone])

  useEffect(() => {
    Promise.all([api.get('/api/profissionais'), api.get('/api/servicos')]).then(([p, s]) => {
      setProfissionais(p.dados)
      setServicos(s.dados)
    })
  }, [])

  useEffect(() => {
    if (form.profissionalId && form.servicoId && form.data) {
      api.get(`/api/agendamentos/disponibilidade?profissionalId=${form.profissionalId}&servicoId=${form.servicoId}&data=${form.data}`)
        .then((res) => setSlots(res.dados?.filter((s) => s.disponivel) || []))
        .catch(() => setSlots([]))
    }
  }, [form.profissionalId, form.servicoId, form.data])

  const handleSalvar = async () => {
    if (!form.profissionalId || !form.servicoId || !form.horario || !form.clienteTelefone) return
    setCarregando(true)
    try {
      let clienteRes = await api.get(`/api/clientes?busca=${form.clienteTelefone}&limite=1`)
      let clienteId = clienteRes.clientes?.[0]?.id
      if (!clienteId) {
        const novo = await api.post('/api/clientes', {
          nome: form.clienteNome || form.clienteTelefone,
          telefone: form.clienteTelefone,
          tipoCortePreferido: form.clienteTipoCorte.trim() || undefined,
          preferencias: form.clientePreferencias.trim() || undefined,
        })
        clienteId = novo.dados.id
      } else {
        const atualizacaoCliente = {}
        if (form.clienteNome.trim()) atualizacaoCliente.nome = form.clienteNome.trim()
        if (form.clienteTipoCorte.trim()) atualizacaoCliente.tipoCortePreferido = form.clienteTipoCorte.trim()
        if (form.clientePreferencias.trim()) atualizacaoCliente.preferencias = form.clientePreferencias.trim()
        if (Object.keys(atualizacaoCliente).length > 0) {
          await api.patch(`/api/clientes/${clienteId}`, atualizacaoCliente)
        }
      }
      await api.post('/api/agendamentos', { clienteId, profissionalId: form.profissionalId, servicoId: form.servicoId, inicio: form.horario })
      onSalvar()
      onClose()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao criar agendamento', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h3 className="text-lg font-semibold text-texto">Novo Agendamento</h3>
          <button onClick={onClose}><X size={20} className="text-texto-sec" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={form.profissionalId || '__sel__'} onValueChange={(v) => setForm(p => ({ ...p, profissionalId: v === '__sel__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sel__">Selecionar</SelectItem>
                  {profissionais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              <Select value={form.servicoId || '__sel__'} onValueChange={(v) => setForm(p => ({ ...p, servicoId: v === '__sel__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sel__">Selecionar</SelectItem>
                  {servicos.filter(s => s.ativo).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={set('data')} min={new Date().toISOString().split('T')[0]} />
          </div>

          <div>
            <Label className="block mb-2">Horário disponível</Label>
            {!form.profissionalId || !form.servicoId ? (
              <p className="text-sm text-texto-sec bg-fundo rounded-lg px-3 py-2">Selecione profissional e serviço para ver horários disponíveis</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-texto-sec bg-fundo rounded-lg px-3 py-2">Nenhum horário disponível nesta data</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                {slots.map((slot) => {
                  const hora = new Date(slot.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const sel = form.horario === slot.inicio
                  return (
                    <button key={slot.inicio} onClick={() => setForm(p => ({ ...p, horario: slot.inicio }))}
                      className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors', sel ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria')}>
                      {hora}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-borda pt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">Telefone do cliente <span className="text-perigo">*</span>{clienteEncontrado && <span className="text-[11px] font-medium text-sucesso bg-sucesso/10 px-2 py-0.5 rounded-full">Cliente encontrado</span>}</Label>
              <Input value={form.clienteTelefone} onChange={set('clienteTelefone')} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input value={form.clienteNome} onChange={set('clienteNome')} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de corte</Label>
              <Input value={form.clienteTipoCorte} onChange={set('clienteTipoCorte')} placeholder="Ex: degradê baixo, social, buzz cut" />
            </div>
            <div className="space-y-1.5">
              <Label>Preferências do cliente</Label>
              <textarea
                value={form.clientePreferencias}
                onChange={set('clientePreferencias')}
                placeholder="Ex: prefere tesoura, gosta de confirmar pelo WhatsApp, não passar navalha."
                rows={3}
                className="w-full rounded-xl border border-borda px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-4 border-t border-borda shrink-0">
          <Button variante="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSalvar} disabled={carregando || !form.horario || !form.clienteTelefone}>
            {carregando && <Loader2 size={16} className="animate-spin" />}
            Agendar
          </Button>
        </div>
      </div>
    </div>
  )
}

// Grade semanal
const GradeSemana = ({ dataAtual, agendamentos, profissionaisFiltro, onClickAgendamento }) => {
  const inicio = new Date(dataAtual)
  inicio.setDate(dataAtual.getDate() - dataAtual.getDay())

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    return d
  })

  const hoje = new Date()

  const agsPorDiaHora = (data, hora) => {
    return agendamentos.filter((a) => {
      const dt = new Date(a.inicioEm)
      return dt.getDate() === data.getDate() &&
        dt.getMonth() === data.getMonth() &&
        dt.getFullYear() === data.getFullYear() &&
        dt.getHours() === hora &&
        (profissionaisFiltro.length === 0 || profissionaisFiltro.includes(a.profissionalId))
    })
  }

  return (
    <div className="h-full overflow-auto">
      <div className="min-w-full h-full flex flex-col">
      <div className="grid sticky top-0 bg-white z-10 border-b border-borda" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-borda" />
        {dias.map((d, i) => {
          const ehHoje = d.toDateString() === hoje.toDateString()
          return (
            <div key={i} className="text-center py-3 border-r border-borda last:border-0">
              <p className="text-[11px] font-semibold text-texto-sec uppercase">{DIAS_SEMANA_COMPLETO[d.getDay()].substring(0, 3)}</p>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mt-0.5', ehHoje ? 'bg-primaria text-white' : 'text-texto')}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>
      <div>
        {HORAS.map((hora) => (
          <div key={hora} className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: '60px' }}>
            <div className="border-r border-borda border-b px-2 pt-1">
              <span className="text-[11px] text-texto-sec">{hora}:00</span>
            </div>
            {dias.map((d, i) => {
              const ags = agsPorDiaHora(d, hora)
              const ehHoje = d.toDateString() === hoje.toDateString()
              return (
                <div key={i} className={cn('border-r border-b border-borda last:border-r-0 p-0.5 relative', ehHoje ? 'bg-primaria/3' : '')}>
                  {ags.slice(0, 2).map((ag) => {
                    const cor = coresPorStatus[ag.status] || coresPorStatus.AGENDADO
                    return (
                      <button key={ag.id} onClick={() => onClickAgendamento(ag)}
                        className={cn('w-full text-left px-2 py-1 rounded text-[11px] leading-tight mb-0.5', cor.bg, cor.texto, 'hover:opacity-90 transition-opacity')}>
                        <div className="flex items-start gap-1.5">
                          <AvatarPessoa pessoa={ag.cliente} tamanho="xs" className="mt-0.5 border border-white/70" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate flex items-center gap-1">
                              <span className="truncate">{ag.cliente?.nome}</span>
                              {clientePresente(ag) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                            </div>
                            <div className="opacity-75 truncate">{ag.servico?.nome}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {ags.length > 2 && <p className="text-[10px] text-texto-sec pl-1 font-medium">+{ags.length - 2} mais</p>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

// Vista de dia
const GradeDia = ({ dataAtual, agendamentos, onClickAgendamento }) => {
  const ags = agendamentos.filter((a) => {
    const dt = new Date(a.inicioEm)
    return dt.toDateString() === dataAtual.toDateString()
  }).sort((a, b) => new Date(a.inicioEm) - new Date(b.inicioEm))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {ags.length === 0 ? (
        <div className="text-center py-16 text-texto-sec">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium">Nenhum agendamento neste dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ags.map((ag) => {
            const cor = coresPorStatus[ag.status] || coresPorStatus.AGENDADO
            return (
              <button key={ag.id} onClick={() => onClickAgendamento(ag)} className={cn('w-full text-left p-4 rounded-xl', cor.bg, 'hover:opacity-90 transition-opacity')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <AvatarPessoa pessoa={ag.cliente} tamanho="sm" className="border border-white/70" />
                    <div className="min-w-0">
                      <p className={cn('font-semibold truncate flex items-center gap-1.5', cor.texto)}>
                        <span className="truncate">{ag.cliente?.nome}</span>
                        {clientePresente(ag) && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                      </p>
                      <p className={cn('text-sm truncate', cor.texto, 'opacity-80')}>{ag.servico?.nome} - {ag.profissional?.nome}</p>
                      {clientePresente(ag) && (
                        <p className={cn('text-xs mt-1', cor.texto, 'opacity-80')}>Chegou às {formatarHora(ag.presencaConfirmadaEm)}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium shrink-0">{formatarHora(ag.inicioEm)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Vista de mÃªs
const GradeMes = ({ dataAtual, agendamentos, onClickAgendamento }) => {
  const primeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1)
  const diasNoMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0).getDate()
  const primeiroDiaSemana = primeiroDia.getDay()
  const hoje = new Date()

  const grid = []
  for (let i = 0; i < primeiroDiaSemana; i++) grid.push(null)
  for (let i = 1; i <= diasNoMes; i++) grid.push(i)
  while (grid.length % 7 !== 0) grid.push(null)

  const agsDoDia = (dia) => {
    if (!dia) return []
    return agendamentos.filter((a) => {
      const dt = new Date(a.inicioEm)
      return dt.getDate() === dia && dt.getMonth() === dataAtual.getMonth() && dt.getFullYear() === dataAtual.getFullYear()
    })
  }

  return (
    <div className="flex-1 overflow-auto">
      <div>
      <div className="grid grid-cols-7 border-b border-borda">
        {DIAS_SEMANA_ABREV.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-texto-sec py-2 border-r border-borda last:border-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((dia, i) => {
          const ags = agsDoDia(dia)
          const ehHoje = dia && new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dia).toDateString() === hoje.toDateString()
          return (
            <div key={i} className={cn('min-h-[100px] border-r border-b border-borda last:border-r-0 p-1.5', !dia ? 'bg-gray-50/50' : '')}>
              {dia && (
                <>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1', ehHoje ? 'bg-primaria text-white' : 'text-texto')}>
                    {dia}
                  </div>
                  <div className="space-y-0.5">
                    {ags.slice(0, 3).map((ag) => {
                      const cor = coresPorStatus[ag.status] || coresPorStatus.AGENDADO
                      return (
                        <button key={ag.id} onClick={() => onClickAgendamento(ag)}
                          className={cn('w-full text-left px-1.5 py-1 rounded text-[10px] font-medium', cor.bg, cor.texto)}>
                          <div className="flex items-center gap-1 min-w-0">
                            <AvatarPessoa pessoa={ag.cliente} tamanho="xs" className="border border-white/70" />
                            <span className="truncate">{formatarHora(ag.inicioEm)} {ag.cliente?.nome}</span>
                            {clientePresente(ag) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                          </div>
                        </button>
                      )
                    })}
                    {ags.length > 3 && <p className="text-[10px] text-texto-sec pl-1">+{ags.length - 3} mais</p>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

// Vista por profissional
const GradeProfissionais = ({ dataAtual, agendamentos, profissionais, profissionaisAtivos, onClickAgendamento, onNovoAgendamento }) => {
  const profsFiltrados = profissionais.filter((p) => profissionaisAtivos.includes(p.id))
  if (profsFiltrados.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-texto-sec">Nenhum profissional selecionado</div>
  )

  const horaAtual = new Date()
  const ehHoje = dataAtual.toDateString() === new Date().toDateString()

  const agsDoProfDia = (profId) =>
    agendamentos
      .filter((a) => {
        const dt = new Date(a.inicioEm)
        return a.profissionalId === profId && dt.toDateString() === dataAtual.toDateString()
      })
      .sort((a, b) => obterInicioMs(a) - obterInicioMs(b))

  const toPx = (date) => {
    const d = new Date(date)
    return ((d.getHours() - HORAS[0]) * ALTURA_FAIXA_HORA) + (d.getMinutes() / 60) * ALTURA_FAIXA_HORA
  }

  const duracaoMinutos = (agendamento) =>
    Math.max((obterFimMs(agendamento) - obterInicioMs(agendamento)) / 60000, 30)

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-h-full" style={{ minWidth: `${56 + (profsFiltrados.length * 180)}px` }}>
      <div className="flex sticky top-0 z-10 bg-white border-b border-borda">
        <div className="w-14 shrink-0 border-r border-borda" />
        {profsFiltrados.map((p) => (
          <div key={p.id} className="flex-1 min-w-[140px] text-center py-3 border-r border-borda last:border-0">
            <div
              className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: CORES_PROFISSIONAL[profissionais.indexOf(p) % CORES_PROFISSIONAL.length] }}
            >
              {p.nome.charAt(0)}
            </div>
            <p className="text-xs font-semibold text-texto truncate px-2">{p.nome}</p>
            <p className="text-[11px] text-texto-sec">{agsDoProfDia(p.id).filter((a) => ['AGENDADO', 'CONFIRMADO'].includes(a.status)).length} agend.</p>
          </div>
        ))}
      </div>
      <div className="flex relative w-full" style={{ height: `${HORAS.length * ALTURA_FAIXA_HORA}px` }}>
        <div className="w-14 shrink-0 border-r border-borda relative">
          {HORAS.map((h) => (
            <div
              key={h}
              style={{ height: ALTURA_FAIXA_HORA, top: (h - HORAS[0]) * ALTURA_FAIXA_HORA }}
              className="absolute w-full border-b border-borda/50 px-2 pt-1"
            >
              <span className="text-[11px] text-texto-sec">{h}:00</span>
            </div>
          ))}
          {ehHoje && horaAtual.getHours() >= HORAS[0] && horaAtual.getHours() <= HORAS[HORAS.length - 1] && (
            <div className="absolute right-0 left-0 z-20 flex items-center" style={{ top: toPx(horaAtual) }}>
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          )}
        </div>
        {profsFiltrados.map((p) => {
          const ags = agsDoProfDia(p.id)
          const corProf = CORES_PROFISSIONAL[profissionais.indexOf(p) % CORES_PROFISSIONAL.length]
          const colunasPorAgendamento = calcularColunasDeSobreposicao(ags)

          return (
            <div key={p.id} className="flex-1 min-w-[140px] border-r border-borda last:border-0 relative">
              {HORAS.map((h) => (
                <div
                  key={h}
                  style={{ height: ALTURA_FAIXA_HORA }}
                  className="border-b border-borda/30 hover:bg-primaria/3 cursor-pointer transition-colors"
                  onClick={() => onNovoAgendamento(p.id, new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate(), h, 0))}
                />
              ))}
              {ehHoje && horaAtual.getHours() >= HORAS[0] && horaAtual.getHours() <= HORAS[HORAS.length - 1] && (
                <div className="absolute left-0 right-0 h-px bg-red-400 z-10 pointer-events-none" style={{ top: toPx(horaAtual) }} />
              )}
              {ags.map((ag) => {
                const top = toPx(ag.inicioEm)
                const height = Math.max((duracaoMinutos(ag) / 60) * ALTURA_FAIXA_HORA - ESPACAMENTO_CARD_AGENDA, 36)
                const compacto = height <= 42
                const cor = coresPorStatus[ag.status] || coresPorStatus.AGENDADO
                const layout = colunasPorAgendamento[ag.id] || { coluna: 0, totalColunas: 1 }
                const larguraColuna = 100 / layout.totalColunas
                const folgaHorizontal = layout.totalColunas > 1 ? ESPACAMENTO_CARD_AGENDA + 2 : 6

                return (
                  <button
                    key={ag.id}
                    onClick={(e) => { e.stopPropagation(); onClickAgendamento(ag) }}
                    style={{
                      top,
                      height,
                      left: `calc(${layout.coluna * larguraColuna}% + 3px)`,
                      width: `calc(${larguraColuna}% - ${folgaHorizontal}px)`,
                      borderLeftColor: corProf,
                    }}
                    className={cn(
                      'absolute rounded-xl border border-white/80 border-l-4 text-left overflow-hidden z-10 shadow-sm hover:shadow-md transition-shadow backdrop-blur-[1px]',
                      compacto ? 'px-2.5 py-0' : 'px-2.5 py-1.5',
                      cor.bg
                    )}
                  >
                    {compacto ? (
                      <div className="flex h-full min-w-0 items-center gap-2.5">
                        <AvatarPessoa pessoa={ag.cliente} tamanho="xxs" className="border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]" />
                        <p className={cn('min-w-0 flex-1 text-[11px] font-semibold leading-tight truncate flex items-center gap-1', cor.texto)}>
                          <span className="truncate">{ag.cliente?.nome}</span>
                          {clientePresente(ag) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full items-start gap-2">
                        <AvatarPessoa pessoa={ag.cliente} tamanho="xs" className="mt-0.5 border border-white/70" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className={cn('text-[11px] font-bold leading-tight truncate flex items-center gap-1', cor.texto)}>
                            <span className="truncate">{ag.cliente?.nome}</span>
                            {clientePresente(ag) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                          </p>
                          {height > 42 && <p className={cn('text-[10px] leading-tight truncate opacity-80', cor.texto)}>{ag.servico?.nome}</p>}
                          {height > 58 && <p className={cn('text-[10px] leading-tight truncate opacity-70', cor.texto)}>{formatarHora(ag.inicioEm)}</p>}
                          {height > 72 && clientePresente(ag) && (
                            <p className={cn('text-[10px] leading-tight truncate opacity-80', cor.texto)}>Chegou</p>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

const ModalWalkIn = ({ onClose, onSalvar }) => {
  const toast = useToast()
  const [form, setForm] = useState({ profissionalId: '', servicoId: '', clienteTelefone: '', clienteNome: '', clienteTipoCorte: '', clientePreferencias: '' })
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/api/profissionais'), api.get('/api/servicos')]).then(([p, s]) => {
      setProfissionais(p.dados || [])
      setServicos(s.dados || [])
    })
  }, [])

  const handleSalvar = async () => {
    if (!form.profissionalId || !form.servicoId || !form.clienteTelefone) {
      toast('Preencha profissional, serviço e telefone', 'aviso')
      return
    }
    setCarregando(true)
    try {
      let clienteRes = await api.get(`/api/clientes?busca=${form.clienteTelefone}&limite=1`)
      let clienteId = clienteRes.clientes?.[0]?.id
      if (!clienteId) {
        const novo = await api.post('/api/clientes', {
          nome: form.clienteNome || form.clienteTelefone,
          telefone: form.clienteTelefone,
          tipoCortePreferido: form.clienteTipoCorte.trim() || undefined,
          preferencias: form.clientePreferencias.trim() || undefined,
        })
        clienteId = novo.dados.id
      } else {
        const atualizacaoCliente = {}
        if (form.clienteNome.trim()) atualizacaoCliente.nome = form.clienteNome.trim()
        if (form.clienteTipoCorte.trim()) atualizacaoCliente.tipoCortePreferido = form.clienteTipoCorte.trim()
        if (form.clientePreferencias.trim()) atualizacaoCliente.preferencias = form.clientePreferencias.trim()
        if (Object.keys(atualizacaoCliente).length > 0) {
          await api.patch(`/api/clientes/${clienteId}`, atualizacaoCliente)
        }
      }
      await api.post('/api/agendamentos', {
        clienteId,
        profissionalId: form.profissionalId,
        servicoId: form.servicoId,
        inicio: new Date().toISOString(),
        walkin: true,
      })
      toast('Walk-in registrado!', 'sucesso')
      onSalvar()
      onClose()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao registrar', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  useEffect(() => {
    const digitos = form.clienteTelefone.replace(/\D/g, '')
    if (digitos.length < 8) { setClienteEncontrado(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/clientes?busca=${digitos}&limite=1`)
        const c = res.clientes?.[0]
        if (c) {
          setForm(p => ({
            ...p,
            clienteNome: p.clienteNome || c.nome || '',
            clienteTipoCorte: p.clienteTipoCorte || c.tipoCortePreferido || '',
            clientePreferencias: p.clientePreferencias || c.preferencias || '',
          }))
          setClienteEncontrado(true)
        } else {
          setClienteEncontrado(false)
        }
      } catch { setClienteEncontrado(false) }
    }, 600)
    return () => clearTimeout(t)
  }, [form.clienteTelefone])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-texto">Atendimento Imediato</h3>
            <p className="text-xs text-texto-sec mt-0.5">Cliente sem agendamento — registra agora</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={form.profissionalId || '__sel__'} onValueChange={(v) => setForm(p => ({ ...p, profissionalId: v === '__sel__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sel__">Selecionar</SelectItem>
                  {profissionais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              <Select value={form.servicoId || '__sel__'} onValueChange={(v) => setForm(p => ({ ...p, servicoId: v === '__sel__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sel__">Selecionar</SelectItem>
                  {servicos.filter(s => s.ativo).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t border-borda pt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">Telefone do cliente <span className="text-perigo">*</span>{clienteEncontrado && <span className="text-[11px] font-medium text-sucesso bg-sucesso/10 px-2 py-0.5 rounded-full">Cliente encontrado</span>}</Label>
              <Input value={form.clienteTelefone} onChange={set('clienteTelefone')} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input value={form.clienteNome} onChange={set('clienteNome')} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de corte</Label>
              <Input value={form.clienteTipoCorte} onChange={set('clienteTipoCorte')} placeholder="Ex: degradê baixo, social, moicano disfarçado" />
            </div>
            <div className="space-y-1.5">
              <Label>Preferências do cliente</Label>
              <textarea
                value={form.clientePreferencias}
                onChange={set('clientePreferencias')}
                placeholder="Ex: não tirar muito em cima, prefere acabamento na navalha, confirma melhor por WhatsApp."
                rows={3}
                className="w-full rounded-xl border border-borda px-3 py-2.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variante="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSalvar} disabled={carregando}>
            {carregando && <Loader2 size={16} className="animate-spin mr-1" />}
            Registrar agora
          </Button>
        </div>
      </div>
    </div>
  )
}

const ModalCancelarPeriodo = ({ onClose, onSucesso }) => {
  const toast = useToast()
  const [form, setForm] = useState({
    inicio: '', fim: '', mensagem: '',
    enviarMensagem: true, tentarRemarcar: true,
    incluirPromo: false, promoDescricao: '',
  })
  const [carregando, setCarregando] = useState(false)
  const [gerandoMensagem, setGerandoMensagem] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [pacotes, setPacotes] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/api/estoque').catch(() => ({ dados: [] })),
      api.get('/api/pacotes').catch(() => ({ dados: [] })),
    ]).then(([estRes, pacRes]) => {
      setProdutos((estRes.dados || []).filter(p => p.ativo && p.quantidadeAtual > 0))
      setPacotes(pacRes.dados || [])
    })
  }, [])

  const gerarMensagemIA = async () => {
    setGerandoMensagem(true)
    try {
      const res = await api.post('/api/agendamentos/gerar-mensagem-cancelamento', {
        promo: form.incluirPromo && form.promoDescricao ? form.promoDescricao : null,
        tentarRemarcar: form.tentarRemarcar,
      })
      setForm(p => ({ ...p, mensagem: res.dados?.mensagem || '' }))
    } catch {
      toast('Erro ao gerar mensagem com IA', 'erro')
    } finally {
      setGerandoMensagem(false)
    }
  }

  const confirmarCancelamento = async () => {
    if (!form.inicio || !form.fim) { toast('Informe o período', 'aviso'); return }
    setCarregando(true)
    try {
      const res = await api.post('/api/agendamentos/cancelar-periodo', {
        dataInicio: form.inicio,
        dataFim: form.fim,
        mensagemWhatsApp: form.enviarMensagem && form.mensagem ? form.mensagem : undefined,
      })
      const total = res.dados?.cancelados || res.cancelados || 0
      toast(`${total} agendamento(s) cancelado(s)`, 'sucesso')
      onSucesso()
      onClose()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao cancelar período', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  const itensPromo = [
    ...pacotes.map(p => ({ tipo: 'pacote', id: p.id, label: `Pacote: ${p.nome}${p.precoCentavos ? ` — R$${(p.precoCentavos/100).toFixed(2).replace('.',',')}` : ''}` })),
    ...produtos.map(p => ({ tipo: 'produto', id: p.id, label: `Produto: ${p.nome}${p.precoVendaCentavos ? ` — R$${(p.precoVendaCentavos/100).toFixed(2).replace('.',',')}` : ''}` })),
  ]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-texto">Cancelar por período</h3>
            <p className="text-xs text-texto-sec mt-0.5">Cancela todos os agendamentos no intervalo</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="space-y-4">
          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-texto mb-1.5">Data início</label>
              <input type="date" value={form.inicio} onChange={(e) => setForm(p => ({...p, inicio: e.target.value}))} className="w-full px-3 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-texto mb-1.5">Data fim</label>
              <input type="date" value={form.fim} onChange={(e) => setForm(p => ({...p, fim: e.target.value}))} min={form.inicio} className="w-full px-3 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
            </div>
          </div>

          {/* Avisar clientes */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="envMsgCancel" checked={form.enviarMensagem} onChange={(e) => setForm(p => ({...p, enviarMensagem: e.target.checked}))} className="rounded" />
            <label htmlFor="envMsgCancel" className="text-sm text-texto cursor-pointer">Avisar clientes pelo WhatsApp</label>
          </div>

          {form.enviarMensagem && (
            <>
              {/* Tentar remarcar */}
              <div className="flex items-center gap-2 pl-1">
                <input type="checkbox" id="tentarRemarcar" checked={form.tentarRemarcar} onChange={(e) => setForm(p => ({...p, tentarRemarcar: e.target.checked}))} className="rounded" />
                <label htmlFor="tentarRemarcar" className="text-sm text-texto cursor-pointer">Convidar para remarcar</label>
              </div>

              {/* Incluir promoção */}
              <div className="border border-borda rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="incluirPromo" checked={form.incluirPromo} onChange={(e) => setForm(p => ({...p, incluirPromo: e.target.checked, promoDescricao: ''}))} className="rounded" />
                  <label htmlFor="incluirPromo" className="text-sm font-medium text-texto cursor-pointer flex items-center gap-1.5">
                    <Gift size={14} className="text-primaria" />
                    Incluir promoção na mensagem
                  </label>
                </div>
                {form.incluirPromo && (
                  <div className="space-y-2">
                    {itensPromo.length > 0 ? (
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                        onChange={(e) => {
                          const item = itensPromo.find(i => i.id === e.target.value)
                          setForm(p => ({ ...p, promoDescricao: item?.label?.replace(/^(Pacote|Produto): /, '') || '' }))
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Selecionar produto ou pacote...</option>
                        {itensPromo.map(item => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      value={form.promoDescricao}
                      onChange={(e) => setForm(p => ({ ...p, promoDescricao: e.target.value }))}
                      placeholder="Ex: Corte + barba por R$40,00 essa semana"
                      className="w-full px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                    />
                  </div>
                )}
              </div>

              {/* Mensagem */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-texto">Mensagem para os clientes</label>
                  <button
                    onClick={gerarMensagemIA}
                    disabled={gerandoMensagem}
                    className="flex items-center gap-1 text-xs text-primaria hover:text-primaria/80 font-medium disabled:opacity-50"
                  >
                    {gerandoMensagem
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Sparkles size={12} />}
                    Gerar com IA
                  </button>
                </div>
                <textarea
                  value={form.mensagem}
                  onChange={(e) => setForm(p => ({...p, mensagem: e.target.value}))}
                  placeholder="Use {nome}, {servico} e {data} como variáveis. Clique em 'Gerar com IA' para criar automaticamente."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
                />
                <p className="text-xs text-texto-sec mt-1">Variáveis disponíveis: {'{nome}'}, {'{servico}'}, {'{data}'}</p>
              </div>
            </>
          )}

          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            Esta ação cancela todos os agendamentos do período e não pode ser desfeita.
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button variante="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmarCancelamento} disabled={carregando || !form.inicio || !form.fim}>
            {carregando && <Loader2 size={14} className="animate-spin mr-1" />}
            Confirmar cancelamento
          </Button>
        </div>
      </div>
    </div>
  )
}

const ModalPromocao = ({ onClose }) => {
  const toast = useToast()
  const [form, setForm] = useState({ mensagem: '', filtro: 'todos' })
  const [carregando, setCarregando] = useState(false)

  const enviar = async () => {
    if (!form.mensagem.trim()) { toast('Escreva a mensagem da promoção', 'aviso'); return }
    setCarregando(true)
    try {
      const res = await api.post('/api/agendamentos/promocao', { mensagem: form.mensagem, filtro: form.filtro })
      const total = res.dados?.enviados || res.enviados || 0
      toast(`Promoção enviada para ${total} ${total === 1 ? 'cliente' : 'clientes'}!`, 'sucesso')
      onClose()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao enviar promoção', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-texto">Enviar promoção</h3>
            <p className="text-xs text-texto-sec mt-0.5">Mensagem via WhatsApp para seus clientes</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">Enviar para</label>
            <div className="grid grid-cols-3 gap-2">
              {[['todos', 'Todos os clientes'], ['recentes', 'Últimos 30 dias'], ['inativos', 'Sem visita há 60+ dias']].map(([v, l]) => (
                <button key={v} onClick={() => setForm(p => ({...p, filtro: v}))}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors text-center ${form.filtro === v ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria/40'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-texto mb-1.5">Mensagem</label>
            <textarea
              value={form.mensagem}
              onChange={(e) => setForm(p => ({...p, mensagem: e.target.value}))}
              placeholder="Ex: Oi! Temos 20% de desconto no corte essa semana. Quer agendar?"
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
            />
            <p className="text-xs text-texto-sec mt-1">{form.mensagem.length} caracteres</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
            A mensagem será enviada pelo WhatsApp conectado à sua conta.
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button variante="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 gap-1.5" onClick={enviar} disabled={carregando || !form.mensagem.trim()}>
            {carregando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar promoção
          </Button>
        </div>
      </div>
    </div>
  )
}

const obterVisaoInicialAgenda = () => {
  try {
    return 'dia'
  } catch {
    return 'dia'
  }
}

const PainelLateralAgenda = ({
  dataAtual,
  onChangeData,
  profissionais,
  profissionaisAtivos,
  onToggleProfissional,
  className = '',
}) => (
  <div className={cn('flex flex-col gap-5', className)}>
    <MiniCalendario data={dataAtual} onChange={onChangeData} />

    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-texto uppercase tracking-wide">Profissionais</span>
      </div>
      <div className="space-y-1.5">
        {profissionais.map((p, i) => {
          const cor = CORES_PROFISSIONAL[i % CORES_PROFISSIONAL.length]
          const ativo = profissionaisAtivos.includes(p.id)
          return (
            <button
              key={p.id}
              onClick={() => onToggleProfissional(p.id)}
              className="flex items-center gap-2.5 w-full text-left hover:bg-gray-50 rounded-lg px-1 py-1"
            >
              <div
                className={cn('w-3.5 h-3.5 rounded flex items-center justify-center border-2 shrink-0')}
                style={{ backgroundColor: ativo ? cor : 'transparent', borderColor: cor }}
              >
                {ativo && (
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-texto truncate">{p.nome}</span>
            </button>
          )
        })}
      </div>
    </div>

    <div>
      <span className="text-xs font-semibold text-texto uppercase tracking-wide block mb-2">Categorias</span>
      <div className="space-y-1.5">
        {[
          { label: 'Agendado',        cor: '#60A5FA' },
          { label: 'Confirmado',      cor: '#EAB308' },
          { label: 'Concluído',       cor: '#22C55E' },
          { label: 'Cancelado',       cor: '#EF4444' },
          { label: 'Remarcado',       cor: '#A855F7' },
          { label: 'Não compareceu',  cor: '#FB923C' },
        ].map(({ label, cor }) => (
          <div key={label} className="flex items-center gap-2.5 px-1">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
            <span className="text-xs text-texto">{label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const PainelFilaEspera = ({ profissionais, onFechar }) => {
  const toast = useToast()
  const [fila, setFila] = useState([])
  const [servicos, setServicos] = useState([])
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ clienteId: '', servicoId: '', profissionalId: '', dataDesejada: '' })
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState([])
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [resF, resS] = await Promise.all([
        api.get('/api/fila-espera?status=AGUARDANDO'),
        api.get('/api/servicos'),
      ])
      setFila(resF.dados || [])
      setServicos(resS.dados || resS || [])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (buscaCliente.length < 2) { setClientesFiltrados([]); return }
    const timer = setTimeout(async () => {
      const res = await api.get(`/api/clientes?busca=${encodeURIComponent(buscaCliente)}&limite=5`).catch(() => null)
      setClientesFiltrados(res?.clientes || res?.dados || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaCliente])

  const salvar = async () => {
    if (!form.clienteId || !form.servicoId || !form.dataDesejada) {
      toast('Preencha cliente, serviço e data desejada.', 'aviso')
      return
    }
    setSalvando(true)
    try {
      await api.post('/api/fila-espera', form)
      toast('Adicionado à lista de espera!', 'sucesso')
      setMostrarForm(false)
      setForm({ clienteId: '', servicoId: '', profissionalId: '', dataDesejada: '' })
      setBuscaCliente('')
      carregar()
    } catch {
      toast('Erro ao adicionar à lista de espera.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const atualizarStatus = async (id, status) => {
    try {
      await api.patch(`/api/fila-espera/${id}/status`, { status })
      setFila((prev) => prev.filter((e) => e.id !== id))
      toast(status === 'CONVERTIDO' ? 'Marcado como convertido!' : 'Entrada removida.', 'sucesso')
    } catch {
      toast('Erro ao atualizar.', 'erro')
    }
  }

  const remover = async (id) => {
    try {
      await api.delete(`/api/fila-espera/${id}`)
      setFila((prev) => prev.filter((e) => e.id !== id))
    } catch {
      toast('Erro ao remover.', 'erro')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onFechar} />
      <div className="w-full max-w-sm bg-white flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-borda">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-primaria" />
            <h2 className="font-semibold text-texto">Lista de espera</h2>
            {fila.length > 0 && <span className="bg-primaria text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{fila.length}</span>}
          </div>
          <button onClick={onFechar}><X size={18} className="text-texto-sec" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-texto-sec" /></div>
          ) : (
            <div className="divide-y divide-borda">
              {fila.length === 0 && !mostrarForm && (
                <p className="px-5 py-8 text-sm text-texto-sec text-center">Nenhum cliente aguardando.</p>
              )}
              {fila.map((entrada) => (
                <div key={entrada.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto truncate">{entrada.cliente?.nome}</p>
                      <p className="text-xs text-texto-sec">{entrada.servico?.nome}</p>
                      {entrada.profissional && <p className="text-xs text-texto-sec">{entrada.profissional.nome}</p>}
                      <p className="text-xs text-primaria mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(entrada.dataDesejada + (entrada.dataDesejada.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => atualizarStatus(entrada.id, 'CONVERTIDO')} title="Convertido em agendamento" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => remover(entrada.id)} title="Remover" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostrarForm && (
            <div className="px-5 py-4 border-t border-borda space-y-3">
              <p className="text-sm font-semibold text-texto">Adicionar à fila</p>
              <div>
                <label className="block text-xs text-texto-sec mb-1">Cliente</label>
                <input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                />
                {clientesFiltrados.length > 0 && (
                  <div className="mt-1 border border-borda rounded-lg overflow-hidden bg-white shadow-sm">
                    {clientesFiltrados.map((c) => (
                      <button key={c.id} onClick={() => { setForm((f) => ({ ...f, clienteId: c.id })); setBuscaCliente(c.nome); setClientesFiltrados([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-fundo transition-colors border-b last:border-0 border-borda">
                        {c.nome} <span className="text-texto-sec text-xs">— {c.telefone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-texto-sec mb-1">Serviço</label>
                <select value={form.servicoId} onChange={(e) => setForm((f) => ({ ...f, servicoId: e.target.value }))}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30">
                  <option value="">Selecionar...</option>
                  {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-texto-sec mb-1">Profissional (opcional)</label>
                <select value={form.profissionalId} onChange={(e) => setForm((f) => ({ ...f, profissionalId: e.target.value }))}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30">
                  <option value="">Qualquer um</option>
                  {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-texto-sec mb-1">Data desejada</label>
                <input type="date" value={form.dataDesejada} onChange={(e) => setForm((f) => ({ ...f, dataDesejada: e.target.value }))}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMostrarForm(false)} className="flex-1 border border-borda text-texto-sec py-2 rounded-lg text-sm hover:text-texto transition-colors">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="flex-1 bg-primaria text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-1">
                  {salvando && <Loader2 size={13} className="animate-spin" />} Salvar
                </button>
              </div>
            </div>
          )}
        </div>

        {!mostrarForm && (
          <div className="p-4 border-t border-borda">
            <button onClick={() => setMostrarForm(true)} className="w-full bg-primaria text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primaria-escura transition-colors flex items-center justify-center gap-2">
              <Plus size={15} /> Adicionar à fila
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const Agenda = () => {
  const [visao, setVisao] = useState(obterVisaoInicialAgenda)
  const [dataAtual, setDataAtual] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [produtos, setProdutos] = useState([])
  const [profissionaisAtivos, setProfissionaisAtivos] = useState([])
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [mostrarNovoModal, setMostrarNovoModal] = useState(false)
  const [mostrarWalkIn, setMostrarWalkIn] = useState(false)
  const [mostrarCancelarPeriodo, setMostrarCancelarPeriodo] = useState(false)
  const [mostrarPromocao, setMostrarPromocao] = useState(false)
  const [mostrarFilaEspera, setMostrarFilaEspera] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [mostrarPainelMobile, setMostrarPainelMobile] = useState(false)

  const carregarAgendamentos = async () => {
    try {
      setCarregando(true)
      let inicio, fim
      if (visao === 'dia') {
        inicio = new Date(dataAtual); inicio.setHours(0, 0, 0, 0)
        fim = new Date(dataAtual); fim.setHours(23, 59, 59, 999)
      } else if (visao === 'semana') {
        const dia = dataAtual.getDay()
        inicio = new Date(dataAtual); inicio.setDate(dataAtual.getDate() - dia); inicio.setHours(0, 0, 0, 0)
        fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999)
      } else {
        inicio = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1)
        fim = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0, 23, 59, 59)
      }
      const res = await api.get(`/api/agendamentos?inicio=${inicio.toISOString()}&fim=${fim.toISOString()}&limite=200&status=AGENDADO,CONFIRMADO,CONCLUIDO,CANCELADO,NAO_COMPARECEU`)
      setAgendamentos(res.agendamentos || res.dados || [])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    Promise.all([api.get('/api/profissionais'), api.get('/api/estoque')]).then(([r, p]) => {
      setProfissionais(r.dados || [])
      setProfissionaisAtivos((r.dados || []).map(prof => prof.id))
      setProdutos(p.dados || [])
    })
  }, [])

  useEffect(() => { carregarAgendamentos() }, [dataAtual, visao])

  const navegar = (dir) => {
    const nova = new Date(dataAtual)
    if (visao === 'dia' || visao === 'profissionais') nova.setDate(nova.getDate() + dir)
    else if (visao === 'semana') nova.setDate(nova.getDate() + dir * 7)
    else nova.setMonth(nova.getMonth() + dir)
    setDataAtual(nova)
  }

  const [novoAgendamentoPreset, setNovoAgendamentoPreset] = useState(null)

  const executarAcao = async (acao, id) => {
    const endpoint = acao === 'naoCompareceu' ? 'nao-compareceu' : acao
    await api.patch(`/api/agendamentos/${id}/${endpoint}`, {})
    carregarAgendamentos()
  }

  const abrirNovoComPreset = (profissionalId, dataHora) => {
    setNovoAgendamentoPreset({ profissionalId, dataHora })
    setMostrarNovoModal(true)
  }

  const tituloNavegacao = () => {
    if (visao === 'mes') return `${MESES[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`
    if (visao === 'profissionais' || visao === 'dia') {
      return `${DIAS_SEMANA_COMPLETO[dataAtual.getDay()]}, ${dataAtual.getDate()} de ${MESES[dataAtual.getMonth()]}`
    }
    const dia = dataAtual.getDay()
    const inicio = new Date(dataAtual); inicio.setDate(dataAtual.getDate() - dia)
    return `${MESES[inicio.getMonth()]} ${inicio.getFullYear()}`
  }

  const toggleProfissional = (id) => {
    setProfissionaisAtivos(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const agsFiltrados = agendamentos.filter(a =>
    profissionaisAtivos.length === 0 || profissionaisAtivos.includes(a.profissionalId)
  )

  const quantidadeProfissionaisAtivos = profissionaisAtivos.length || profissionais.length
  const resumoProfissionais = quantidadeProfissionaisAtivos >= profissionais.length
    ? 'Todos os profissionais'
    : `${quantidadeProfissionaisAtivos} selecionados`

  const trocarVisao = (novaVisao) => {
    setVisao(novaVisao)
  }

  const atualizarData = (novaData) => {
    setDataAtual(novaData)
    setMostrarPainelMobile(false)
  }

  const gradeAgenda = carregando ? (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primaria" />
    </div>
  ) : visao === 'profissionais' ? (
    <GradeProfissionais
      dataAtual={dataAtual}
      agendamentos={agsFiltrados}
      profissionais={profissionais}
      profissionaisAtivos={profissionaisAtivos}
      onClickAgendamento={setModalDetalhe}
      onNovoAgendamento={abrirNovoComPreset}
    />
  ) : visao === 'semana' ? (
    <GradeSemana
      dataAtual={dataAtual}
      agendamentos={agsFiltrados}
      profissionaisFiltro={profissionaisAtivos}
      onClickAgendamento={setModalDetalhe}
    />
  ) : visao === 'dia' ? (
    <GradeDia dataAtual={dataAtual} agendamentos={agsFiltrados} onClickAgendamento={setModalDetalhe} />
  ) : (
    <GradeMes dataAtual={dataAtual} agendamentos={agsFiltrados} onClickAgendamento={setModalDetalhe} />
  )

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-borda bg-white shadow-sm md:h-[calc(100vh-var(--header-h)-2rem)] md:flex-row md:-mt-4 md:-mx-2">
      <div className="hidden md:flex w-56 border-r border-borda py-5 px-4 shrink-0 overflow-y-auto">
        <PainelLateralAgenda
          dataAtual={dataAtual}
          onChangeData={atualizarData}
          profissionais={profissionais}
          profissionaisAtivos={profissionaisAtivos}
          onToggleProfissional={toggleProfissional}
          onAbrirNovoAgendamento={() => setMostrarNovoModal(true)}
          className="w-full"
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="border-b border-borda bg-white shrink-0">
          <div className="flex flex-col gap-3 px-3 py-3 md:px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <div className="flex border border-borda rounded-xl overflow-hidden shrink-0">
                {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => trocarVisao(val)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors shrink-0',
                      visao === val ? 'bg-primaria text-white' : 'text-texto-sec hover:text-texto hover:bg-gray-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setMostrarPainelMobile((prev) => !prev)}
                className="md:hidden inline-flex items-center gap-1.5 rounded-xl border border-borda px-3 py-2 text-sm font-medium text-texto-sec hover:bg-fundo shrink-0"
              >
                <Filter size={15} />
                Filtros
              </button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => navegar(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-texto-sec transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <h2 className="text-sm font-semibold text-texto min-w-0 flex-1 text-center px-1">{tituloNavegacao()}</h2>
                <button onClick={() => navegar(1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-texto-sec transition-colors">
                  <ChevronRight size={16} />
                </button>
                <Button variante="outline" tamanho="sm" onClick={() => setDataAtual(new Date())} className="shrink-0">
                  Hoje
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <button
                  title="Cancelar período"
                  onClick={() => setMostrarCancelarPeriodo(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-borda hover:bg-red-50 hover:border-red-300 text-texto-sec hover:text-red-600 transition-colors shrink-0"
                >
                  <Ban size={15} />
                </button>
                <button
                  title="Enviar promoção"
                  onClick={() => setMostrarPromocao(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-borda hover:bg-primaria/5 hover:border-primaria/40 text-texto-sec hover:text-primaria transition-colors shrink-0"
                >
                  <Megaphone size={15} />
                </button>
                <button
                  title="Lista de espera"
                  onClick={() => setMostrarFilaEspera(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-borda hover:bg-primaria/5 hover:border-primaria/40 text-texto-sec hover:text-primaria transition-colors shrink-0"
                >
                  <ListChecks size={15} />
                </button>
                <button
                  onClick={() => setMostrarWalkIn(true)}
                  className="flex-1 min-w-[132px] sm:flex-none inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium px-3.5 py-2 rounded-xl text-sm transition-colors"
                >
                  <UserPlus size={15} /> Encaixe
                </button>
                <Button onClick={() => setMostrarNovoModal(true)} className="flex-1 min-w-[132px] sm:flex-none">
                  <Plus size={15} /> Agendar
                </Button>
              </div>
            </div>
          </div>

          {mostrarPainelMobile && (
            <div className="md:hidden border-t border-borda bg-fundo/50 px-3 py-4">
              <PainelLateralAgenda
                dataAtual={dataAtual}
                onChangeData={atualizarData}
                profissionais={profissionais}
                profissionaisAtivos={profissionaisAtivos}
                onToggleProfissional={toggleProfissional}
                onAbrirNovoAgendamento={() => setMostrarNovoModal(true)}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">{gradeAgenda}</div>
      </div>

      {modalDetalhe && (
        <ModalDetalhes
          agendamento={modalDetalhe}
          onClose={() => setModalDetalhe(null)}
          onAcao={executarAcao}
          onRecarregar={carregarAgendamentos}
          produtos={produtos}
        />
      )}
      {mostrarNovoModal && (
        <ModalNovoAgendamento
          dataInicial={dataAtual}
          preset={novoAgendamentoPreset}
          onClose={() => { setMostrarNovoModal(false); setNovoAgendamentoPreset(null) }}
          onSalvar={carregarAgendamentos}
        />
      )}
      {mostrarWalkIn && (
        <ModalWalkIn
          onClose={() => setMostrarWalkIn(false)}
          onSalvar={carregarAgendamentos}
        />
      )}
      {mostrarCancelarPeriodo && <ModalCancelarPeriodo onClose={() => setMostrarCancelarPeriodo(false)} onSucesso={carregarAgendamentos} />}
      {mostrarPromocao && <ModalPromocao onClose={() => setMostrarPromocao(false)} />}
      {mostrarFilaEspera && <PainelFilaEspera profissionais={profissionais} onFechar={() => setMostrarFilaEspera(false)} />}
    </div>
  )
}

export default Agenda

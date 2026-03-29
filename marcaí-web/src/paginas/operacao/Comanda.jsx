import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Send, X, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import { formatarMoeda, formatarHora } from '../../lib/utils'
import { Button } from '../../componentes/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import useAuth from '../../hooks/useAuth'
import AvatarPessoa from '../../componentes/ui/AvatarPessoa'

const clientePresente = (agendamento) => Boolean(agendamento?.presencaConfirmadaEm)

const formatarReais = (centavos) => {
  if (!centavos && centavos !== 0) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const ModalAdicionarItem = ({ agendamentoId, produtos, onFechar, onSalvar }) => {
  const toast = useToast()
  const [modo, setModo] = useState('produto') // 'produto' | 'avulso'
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-texto">Adicionar item</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${modo === 'produto' ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:bg-fundo'}`}
            onClick={() => setModo('produto')}
          >
            Produto do estoque
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${modo === 'avulso' ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:bg-fundo'}`}
            onClick={() => setModo('avulso')}
          >
            Item avulso
          </button>
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
                        {p.nome}{p.quantidadeAtual !== undefined ? ` (${p.quantidadeAtual} em estoque)` : ''}{p.precoVendaCentavos ? ` — ${formatarReais(p.precoVendaCentavos)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-texto-sec italic">Nenhum produto cadastrado no estoque.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Descrição</label>
              <input
                className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto"
                placeholder="Ex: Hidratação, Pigmentação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="w-24">
              <label className="block text-xs font-medium text-texto-sec mb-1">Qtd</label>
              <input
                type="number"
                min="1"
                className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-texto-sec mb-1">Preço unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto"
                placeholder="0,00"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variante="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}

const PainelComanda = ({ agendamento, produtos, onVoltar, onAtualizar, exigirConfirmacaoPresenca }) => {
  const toast = useToast()
  const [comanda, setComanda] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [formaPagamento2, setFormaPagamento2] = useState('')
  const [valorPagamento2, setValorPagamento2] = useState('')
  const [desconto, setDesconto] = useState('')
  const [gorjeta, setGorjeta] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [statusAtual, setStatusAtual] = useState(agendamento.status)
  const [presencaConfirmadaEm, setPresencaConfirmadaEm] = useState(agendamento.presencaConfirmadaEm)
  const presencaObrigatoriaPendente = exigirConfirmacaoPresenca && !clientePresente({ presencaConfirmadaEm }) && ['AGENDADO', 'CONFIRMADO'].includes(statusAtual)

  const carregar = async () => {
    try {
      const res = await api.get(`/api/comanda/${agendamento.id}`)
      setComanda(res.dados)
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao carregar comanda', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [agendamento.id])

  useEffect(() => {
    setStatusAtual(agendamento.status)
    setPresencaConfirmadaEm(agendamento.presencaConfirmadaEm)
    setFormaPagamento('')
    setFormaPagamento2('')
    setValorPagamento2('')
    setDesconto('')
    setGorjeta('')
  }, [agendamento.id, agendamento.status, agendamento.presencaConfirmadaEm])

  const removerItem = async (itemId) => {
    setRemovendo(itemId)
    try {
      await api.delete(`/api/comanda/${agendamento.id}/itens/${itemId}`)
      toast('Item removido', 'sucesso')
      carregar()
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

  const confirmarPresenca = async () => {
    try {
      const res = await api.patch(`/api/agendamentos/${agendamento.id}/confirmar-presenca`, {})
      setStatusAtual(res.dados?.status || statusAtual)
      setPresencaConfirmadaEm(res.dados?.presencaConfirmadaEm || new Date().toISOString())
      toast('Presença confirmada!', 'sucesso')
      onAtualizar?.()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao confirmar presença', 'erro')
    }
  }

  const finalizar = async () => {
    if (!formaPagamento) { toast('Selecione a forma de pagamento', 'aviso'); return }
    if (presencaObrigatoriaPendente) { toast('Confirme a chegada do cliente antes de finalizar.', 'aviso'); return }
    setFinalizando(true)
    try {
      const payload = { formaPagamento }
      if (desconto) payload.descontoCentavos = Math.round(parseFloat(desconto) * 100)
      if (gorjeta) payload.gorjetaCentavos = Math.round(parseFloat(gorjeta) * 100)
      if (formaPagamento2) payload.formaPagamento2 = formaPagamento2
      if (valorPagamento2) payload.valorPagamento2Centavos = Math.round(parseFloat(valorPagamento2) * 100)
      await api.patch(`/api/agendamentos/${agendamento.id}/concluir`, payload)
      toast('Atendimento finalizado!', 'sucesso')
      onAtualizar?.()
      onVoltar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao finalizar', 'erro')
    } finally {
      setFinalizando(false)
    }
  }

  const subtotalCentavos = comanda
    ? (comanda.servico?.precoCentavos || 0) + (comanda.comandaItens?.reduce((acc, i) => acc + i.precoCentavos * i.quantidade, 0) || 0)
    : 0
  const descontoCentavos = desconto ? Math.round(parseFloat(desconto) * 100) : 0
  const gorjetaCentavos = gorjeta ? Math.round(parseFloat(gorjeta) * 100) : 0
  const totalCentavos = Math.max(0, subtotalCentavos - descontoCentavos + gorjetaCentavos)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="text-texto-sec hover:text-texto transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <AvatarPessoa pessoa={agendamento.cliente} tamanho="md" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-texto truncate">{agendamento.cliente?.nome}</h2>
          <p className="text-sm text-texto-sec truncate">{agendamento.servico?.nome} - {formatarHora(agendamento.inicioEm)} com {agendamento.profissional?.nome}</p>
          {clientePresente({ presencaConfirmadaEm }) && (
            <p className="text-xs text-green-700 font-medium mt-1">Cliente chegou às {formatarHora(presencaConfirmadaEm)}</p>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-texto-sec" /></div>
      ) : (
        <>
          {(agendamento.cliente?.tipoCortePreferido || agendamento.cliente?.preferencias) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Perfil do cliente</p>
              {agendamento.cliente?.tipoCortePreferido && (
                <div className="mb-2">
                  <p className="text-xs text-amber-700 font-medium">Tipo de corte</p>
                  <p className="text-sm text-amber-900">{agendamento.cliente.tipoCortePreferido}</p>
                </div>
              )}
              {agendamento.cliente?.preferencias && (
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferências e observações</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{agendamento.cliente.preferencias}</p>
                </div>
              )}
            </div>
          )}

          {!clientePresente({ presencaConfirmadaEm }) && ['AGENDADO', 'CONFIRMADO'].includes(statusAtual) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Chegada do cliente pendente</p>
                <p className="text-sm text-amber-700 mt-1">
                  {exigirConfirmacaoPresenca
                    ? 'Este negócio exige confirmar a presença antes de finalizar o atendimento.'
                    : 'Você pode marcar a chegada do cliente daqui para deixar o fluxo da recepção e do barbeiro mais organizado.'}
                </p>
              </div>
              <Button variante="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={confirmarPresenca}>
                <CheckCircle2 size={14} /> Cliente chegou
              </Button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
            <div className="p-4 border-b border-borda bg-fundo">
              <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide">Serviço principal</p>
            </div>
            <div className="p-4 flex justify-between text-sm">
              <span className="text-texto">{comanda?.servico?.nome}</span>
              <span className="font-medium text-texto">{formatarReais(comanda?.servico?.precoCentavos)}</span>
            </div>

            {comanda?.comandaItens?.length > 0 && (
              <>
                <div className="px-4 py-2 border-t border-borda bg-fundo">
                  <p className="text-xs font-semibold text-texto-sec uppercase tracking-wide">Produtos e extras</p>
                </div>
                {comanda.comandaItens.map((item) => (
                  <div key={item.id} className="px-4 py-3 border-t border-borda flex items-center justify-between">
                    <div>
                      <p className="text-sm text-texto">{item.descricao}</p>
                      <p className="text-xs text-texto-sec">{item.quantidade}x - {formatarReais(item.precoCentavos)} cada</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-texto">{formatarReais(item.precoCentavos * item.quantidade)}</span>
                      <button
                        onClick={() => removerItem(item.id)}
                        disabled={removendo === item.id}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        {removendo === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {(descontoCentavos > 0 || gorjetaCentavos > 0) && (
              <div className="px-4 py-2 border-t border-borda space-y-1 text-sm">
                {descontoCentavos > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Desconto</span>
                    <span>- {formatarReais(descontoCentavos)}</span>
                  </div>
                )}
                {gorjetaCentavos > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span>Gorjeta</span>
                    <span>+ {formatarReais(gorjetaCentavos)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="p-4 border-t border-primaria/20 bg-primaria/5 flex justify-between items-center">
              <span className="font-semibold text-texto">Total</span>
              <span className="text-xl font-bold text-primaria">{formatarReais(totalCentavos)}</span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => setMostrarModal(true)} className="gap-2">
              <Plus size={14} /> Adicionar item
            </Button>
            <Button
              variante="outline"
              className="gap-2"
              onClick={enviarRecibo}
              disabled={enviando}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar recibo pelo WhatsApp
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-borda shadow-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-texto">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((forma) => {
                const labels = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito' }
                return (
                  <button
                    key={forma}
                    onClick={() => setFormaPagamento(forma)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${formaPagamento === forma ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria'}`}
                  >
                    {labels[forma]}
                  </button>
                )
              })}
            </div>

            {formaPagamento && (
              <div className="space-y-3 pt-1 border-t border-borda">
                <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">Segundo método (opcional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].filter(f => f !== formaPagamento).map((forma) => {
                    const labels = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito' }
                    return (
                      <button
                        key={forma}
                        onClick={() => setFormaPagamento2(formaPagamento2 === forma ? '' : forma)}
                        className={`py-2 rounded-xl text-sm font-medium border transition-colors ${formaPagamento2 === forma ? 'bg-blue-600 text-white border-blue-600' : 'border-borda text-texto-sec hover:border-blue-400 hover:text-blue-600'}`}
                      >
                        {labels[forma]}
                      </button>
                    )
                  })}
                </div>
                {formaPagamento2 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-texto-sec mb-1">Valor no {formaPagamento2.toLowerCase()} (R$)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={valorPagamento2}
                        onChange={(e) => setValorPagamento2(e.target.value)}
                        placeholder="0,00"
                        className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-texto-sec mb-1">Valor no {formaPagamento.toLowerCase()} (R$)</label>
                      <div className="w-full border border-borda rounded-xl px-3 py-2 text-sm bg-gray-50 text-texto-sec">
                        {valorPagamento2
                          ? Math.max(0, totalCentavos / 100 - parseFloat(valorPagamento2 || 0)).toFixed(2).replace('.', ',')
                          : (totalCentavos / 100).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-borda">
              <div>
                <label className="block text-xs font-medium text-texto-sec mb-1">Desconto (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  placeholder="0,00"
                  className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-green-400/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-texto-sec mb-1">Gorjeta (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={gorjeta}
                  onChange={(e) => setGorjeta(e.target.value)}
                  placeholder="0,00"
                  className="w-full border border-borda rounded-xl px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={finalizar}
            disabled={finalizando || !formaPagamento || presencaObrigatoriaPendente}
            className="w-full bg-green-600 hover:bg-green-700 gap-2 py-3 text-base"
          >
            {finalizando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Finalizar atendimento
          </Button>
        </>
      )}

      {mostrarModal && (
        <ModalAdicionarItem
          agendamentoId={agendamento.id}
          produtos={produtos}
          onFechar={() => setMostrarModal(false)}
          onSalvar={() => { setMostrarModal(false); carregar() }}
        />
      )}
    </div>
  )
}

const Comanda = () => {
  const toast = useToast()
  const { tenant } = useAuth()
  const [agendamentos, setAgendamentos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null)

  const carregar = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const [resAg, resProd] = await Promise.allSettled([
        api.get(`/api/agendamentos?status=AGENDADO,CONFIRMADO,CONCLUIDO&dataInicio=${hoje}&dataFim=${hoje}&limite=50`),
        api.get('/api/estoque'),
      ])
      if (resAg.status === 'fulfilled') {
        setAgendamentos(resAg.value?.agendamentos || resAg.value?.dados || [])
      }
      if (resProd.status === 'fulfilled') {
        setProdutos(resProd.value?.dados || [])
      }
    } catch (e) {
      toast('Erro ao carregar', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  if (agendamentoSelecionado) {
    return (
      <PainelComanda
        agendamento={agendamentoSelecionado}
        produtos={produtos}
        exigirConfirmacaoPresenca={tenant?.exigirConfirmacaoPresenca}
        onAtualizar={carregar}
        onVoltar={() => setAgendamentoSelecionado(null)}
      />
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Comanda digital</h1>
        <p className="text-sm text-texto-sec mt-1">Selecione um atendimento de hoje para abrir a comanda.</p>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-texto-sec" /></div>
      ) : agendamentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda p-10 text-center shadow-sm">
          <FileText size={32} className="text-texto-sec/40 mx-auto mb-3" />
          <p className="text-texto-sec text-sm">Nenhum atendimento agendado para hoje.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden divide-y divide-borda">
          {agendamentos.map((ag) => (
            <button
              key={ag.id}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-fundo transition-colors text-left"
              onClick={() => setAgendamentoSelecionado(ag)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <AvatarPessoa pessoa={ag.cliente} tamanho="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-texto text-sm truncate">{ag.cliente?.nome}</p>
                    {clientePresente(ag) && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ag.status === 'CONCLUIDO' ? 'bg-gray-100 text-gray-500' : ag.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {ag.status === 'CONCLUIDO' ? 'Concluído' : ag.status === 'CONFIRMADO' ? 'Confirmado' : 'Agendado'}
                    </span>
                  </div>
                  <p className="text-xs text-texto-sec mt-0.5 truncate">
                    {ag.servico?.nome} · {formatarHora(ag.inicioEm)} · {ag.profissional?.nome}
                  </p>
                  {clientePresente(ag) && (
                    <p className="text-[11px] text-green-700 mt-1">Chegou às {formatarHora(ag.presencaConfirmadaEm)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ag.servico?.precoCentavos ? (
                  <span className="text-sm font-medium text-texto">{formatarReais(ag.servico.precoCentavos)}</span>
                ) : null}
                <ChevronRight size={16} className="text-texto-sec" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Comanda



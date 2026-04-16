import { useEffect, useState } from 'react'
import { Bike, RefreshCw, Loader2, MapPin, Phone, Clock3, CheckCircle2 } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const STATUS_LABEL = {
  NOVO: 'Novo pedido',
  PREPARANDO: 'Preparando',
  A_CAMINHO: 'Estou a caminho',
  CHEGUEI: 'Cheguei',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

const STATUS_FLOW = ['NOVO', 'PREPARANDO', 'A_CAMINHO', 'CHEGUEI', 'FINALIZADO']

const formatarReais = (centavos) =>
  centavos != null ? (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const Entregas = () => {
  const toast = useToast()
  const [pedidos, setPedidos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [atualizandoId, setAtualizandoId] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const res = await api.get('/api/entregas')
      setPedidos(res.dados || [])
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao carregar entregas', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const atualizarStatus = async (pedido, status) => {
    setAtualizandoId(pedido.id)
    try {
      await api.patch(`/api/entregas/${pedido.id}/status`, { status })
      toast(`Pedido atualizado para "${STATUS_LABEL[status]}".`, 'sucesso')
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao atualizar pedido', 'erro')
    } finally {
      setAtualizandoId(null)
    }
  }

  const pedidosAtivos = pedidos.filter((pedido) => !['FINALIZADO', 'CANCELADO'].includes(pedido.status))
  const pedidosEmRota = pedidos.filter((pedido) => pedido.status === 'A_CAMINHO').length
  const faturamentoTotal = pedidos
    .filter((pedido) => pedido.status === 'FINALIZADO')
    .reduce((total, pedido) => total + (pedido.totalCentavos || 0), 0)

  return (
    <div className="max-w-5xl space-y-5">
      <div className="rounded-3xl border border-borda bg-gradient-to-br from-white via-white to-amber-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              <Bike size={12} />
              Operação de entrega
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-texto">Entregas</h1>
              <p className="mt-1 max-w-2xl text-sm text-texto-sec">
                Acompanhe os pedidos do link público, organize o que sai primeiro e mantenha o cliente atualizado do preparo até a chegada.
              </p>
            </div>
          </div>
          <button onClick={carregar} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-borda bg-white text-texto-sec transition-colors hover:border-amber-300 hover:text-texto">
            <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-borda bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Na operação agora</p>
            <p className="mt-2 text-3xl font-semibold text-texto">{pedidosAtivos.length}</p>
            <p className="mt-1 text-sm text-texto-sec">Pedidos que ainda pedem ação da equipe.</p>
          </div>
          <div className="rounded-2xl border border-borda bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Em rota</p>
            <p className="mt-2 text-3xl font-semibold text-texto">{pedidosEmRota}</p>
            <p className="mt-1 text-sm text-texto-sec">Clientes aguardando chegada neste momento.</p>
          </div>
          <div className="rounded-2xl border border-borda bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Faturado nas entregas</p>
            <p className="mt-2 text-3xl font-semibold text-texto">{formatarReais(faturamentoTotal)}</p>
            <p className="mt-1 text-sm text-texto-sec">Total dos pedidos já concluídos.</p>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-texto-sec" /></div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-borda bg-white p-10 text-center text-texto-sec">
          Nenhum pedido de entrega por enquanto.
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => {
            const indiceAtual = STATUS_FLOW.indexOf(pedido.status)

            return (
              <div key={pedido.id} className="overflow-hidden rounded-3xl border border-borda bg-white shadow-sm">
                <div className="border-b border-borda bg-gradient-to-r from-zinc-50 via-white to-amber-50/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-texto">{pedido.clienteNome}</p>
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          {STATUS_LABEL[pedido.status] || pedido.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-texto-sec">
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          <span>{pedido.clienteTelefone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} />
                          <span>{pedido.enderecoEntrega}</span>
                        </div>
                        {pedido.referenciaEndereco && <p className="text-xs text-texto-sec">Referência: {pedido.referenciaEndereco}</p>}
                      </div>
                    </div>

                    <div className="min-w-[220px] rounded-2xl border border-borda bg-white/90 p-4 text-left lg:text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Resumo do pedido</p>
                      <p className="mt-2 text-2xl font-semibold text-texto">{formatarReais(pedido.totalCentavos)}</p>
                      <p className="mt-1 text-sm text-texto-sec">{pedido.formaPagamento}</p>
                      <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-texto-sec">
                          <Bike size={12} />
                          {pedido.janelaEntregaLabel || 'Entrega sob demanda'}
                        </span>
                        {pedido.previsaoEntregaEm && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-texto-sec">
                            <Clock3 size={12} />
                            {new Date(pedido.previsaoEntregaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-borda bg-fundo p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Itens do pedido</p>
                    <div className="mt-3 space-y-2">
                      {pedido.itens.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-borda bg-white px-4 py-3 text-sm">
                          <div>
                            <span className="font-medium text-texto">{item.nomeProduto}</span>
                            <p className="mt-1 text-xs text-texto-sec">Quantidade: {item.quantidade}</p>
                          </div>
                          <span className="font-semibold text-texto">{formatarReais(item.subtotalCentavos)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-borda bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-texto-sec">Andamento da entrega</p>
                    <div className="mt-3 flex items-center gap-2">
                      {STATUS_FLOW.map((status, index) => {
                        const ativo = index <= indiceAtual && indiceAtual >= 0
                        return (
                          <div key={status} className={`h-2 flex-1 rounded-full ${ativo ? 'bg-primaria' : 'bg-zinc-200'}`} />
                        )
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {STATUS_FLOW.map((status, index) => (
                        <button
                          key={status}
                          onClick={() => atualizarStatus(pedido, status)}
                          disabled={atualizandoId === pedido.id || pedido.status === status || pedido.status === 'FINALIZADO' || pedido.status === 'CANCELADO' || index > indiceAtual + 1}
                          className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                            pedido.status === status
                              ? 'bg-primaria text-white'
                              : 'border border-borda text-texto-sec hover:border-amber-300 hover:text-texto'
                          } disabled:opacity-50`}
                        >
                          {status === 'FINALIZADO' ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} /> {STATUS_LABEL[status]}</span> : STATUS_LABEL[status]}
                        </button>
                      ))}
                      {pedido.status !== 'FINALIZADO' && pedido.status !== 'CANCELADO' && (
                        <button
                          onClick={() => atualizarStatus(pedido, 'CANCELADO')}
                          disabled={atualizandoId === pedido.id}
                          className="rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Entregas

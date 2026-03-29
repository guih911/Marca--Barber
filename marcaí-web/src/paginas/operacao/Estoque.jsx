import { useState, useEffect, useMemo } from 'react'
import { Archive, Plus, X, Loader2, RefreshCw, AlertTriangle, Pencil, Search, Package, TrendingDown, DollarSign } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import { formatarMoeda } from '../../lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'

const ModalProduto = ({ produto, onFechar, onSalvar }) => {
  const toast = useToast()
  const [form, setForm] = useState({
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    unidade: produto?.unidade || 'unid',
    precoCustoCentavos: produto?.precoCustoCentavos ? produto.precoCustoCentavos / 100 : '',
    precoVendaCentavos: produto?.precoVendaCentavos ? produto.precoVendaCentavos / 100 : '',
    quantidadeAtual: produto?.quantidadeAtual ?? 0,
    quantidadeMinima: produto?.quantidadeMinima ?? 2,
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.nome) { toast('Nome é obrigatório', 'aviso'); return }
    setSalvando(true)
    try {
      const corpo = {
        ...form,
        precoCustoCentavos: form.precoCustoCentavos ? Math.round(parseFloat(form.precoCustoCentavos) * 100) : null,
        precoVendaCentavos: form.precoVendaCentavos ? Math.round(parseFloat(form.precoVendaCentavos) * 100) : null,
      }
      if (produto?.id) {
        await api.patch(`/api/estoque/${produto.id}`, corpo)
      } else {
        await api.post('/api/estoque', corpo)
      }
      onSalvar()
    } catch {
      toast('Erro ao salvar produto', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const f = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-texto">{produto ? 'Editar produto' : 'Novo produto'}</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Nome *</label>
            <input value={form.nome} onChange={f('nome')} placeholder="Ex: Pomada Minas Gerais"
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Unidade de medida</label>
              <Select value={form.unidade} onValueChange={(v) => setForm((p) => ({ ...p, unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unid">unid — unidade</SelectItem>
                  <SelectItem value="ml">ml — mililitro</SelectItem>
                  <SelectItem value="g">g — grama</SelectItem>
                  <SelectItem value="kg">kg — quilograma</SelectItem>
                  <SelectItem value="L">L — litro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Qtd. atual</label>
              <input type="number" min="0" step="0.1" value={form.quantidadeAtual} onChange={f('quantidadeAtual')}
                className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Qtd. mínima (alerta)</label>
            <input type="number" min="0" step="0.1" value={form.quantidadeMinima} onChange={f('quantidadeMinima')}
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            <p className="text-[11px] text-texto-ter mt-1">Alerta via WhatsApp quando atingir esse valor</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Custo (R$)</label>
              <input type="number" min="0" step="0.01" value={form.precoCustoCentavos} onChange={f('precoCustoCentavos')}
                placeholder="0,00"
                className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Venda (R$)</label>
              <input type="number" min="0" step="0.01" value={form.precoVendaCentavos} onChange={f('precoVendaCentavos')}
                placeholder="0,00"
                className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-borda text-sm font-medium text-texto-sec hover:bg-fundo transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

const ModalMovimento = ({ produto, onFechar, onSalvar }) => {
  const toast = useToast()
  const [tipo, setTipo] = useState('ENTRADA')
  const [quantidade, setQuantidade] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.post(`/api/estoque/${produto.id}/movimentos`, { tipo, quantidade: Number(quantidade), motivo })
      toast(`Movimento registrado! Estoque ${tipo === 'ENTRADA' ? 'aumentado' : 'reduzido'}.`, 'sucesso')
      onSalvar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao registrar', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-texto">Registrar movimento</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="flex items-center gap-2 bg-fundo rounded-xl px-3 py-2.5 mb-4">
          <Archive size={14} className="text-primaria" />
          <p className="text-sm text-texto">{produto.nome}</p>
          <span className="ml-auto text-xs font-semibold text-texto-sec">{produto.quantidadeAtual} {produto.unidade}</span>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            {[
              { v: 'ENTRADA', label: '↑ Entrada', cor: 'bg-green-500 border-green-500 text-white' },
              { v: 'SAIDA', label: '↓ Saída', cor: 'bg-red-500 border-red-500 text-white' },
              { v: 'AJUSTE', label: '⟳ Ajuste', cor: 'bg-primaria border-primaria text-white' },
            ].map((t) => (
              <button key={t.v} onClick={() => setTipo(t.v)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border ${tipo === t.v ? t.cor : 'border-borda text-texto-sec hover:bg-fundo'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Quantidade</label>
            <input type="number" min="0.1" step="0.1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Motivo (opcional)</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: compra de fornecedor"
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-borda text-sm text-texto-sec hover:bg-fundo transition-colors">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

const Estoque = () => {
  const toast = useToast()
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalProduto, setModalProduto] = useState(null) // null | 'novo' | produto
  const [modalMovimento, setModalMovimento] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroAlerta, setFiltroAlerta] = useState('todos')

  const carregar = async () => {
    try {
      const res = await api.get('/api/estoque')
      setProdutos(res.dados || [])
    } catch { toast('Erro ao carregar estoque', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  const alertas = useMemo(() => produtos.filter((p) => p.quantidadeAtual <= p.quantidadeMinima && p.ativo), [produtos])
  const valorTotalEstoque = useMemo(() => produtos.reduce((s, p) => s + (p.precoVendaCentavos || 0) * (p.quantidadeAtual || 0), 0), [produtos])

  const produtosFiltrados = useMemo(() => {
    let lista = produtos
    if (busca) lista = lista.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))
    if (filtroAlerta === 'alerta') lista = lista.filter((p) => p.quantidadeAtual <= p.quantidadeMinima && p.ativo)
    return lista
  }, [produtos, busca, filtroAlerta])

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Estoque</h1>
          <p className="text-texto-sec text-sm mt-1">Controle produtos, entradas e saídas — alertas automáticos via WhatsApp.</p>
        </div>
        <button onClick={() => setModalProduto('novo')}
          className="flex items-center gap-2 bg-primaria hover:bg-primaria-escura text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <Plus size={15} /> Novo produto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-borda p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-primaria" />
            <p className="text-xs text-texto-sec">Total de produtos</p>
          </div>
          <p className="text-2xl font-bold text-texto">{produtos.length}</p>
        </div>
        <div className={`bg-white rounded-2xl border p-4 ${alertas.length > 0 ? 'border-red-200 bg-red-50/40' : 'border-borda'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className={alertas.length > 0 ? 'text-red-500' : 'text-texto-sec'} />
            <p className="text-xs text-texto-sec">Em alerta</p>
          </div>
          <p className={`text-2xl font-bold ${alertas.length > 0 ? 'text-red-600' : 'text-texto'}`}>{alertas.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-borda p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-sucesso" />
            <p className="text-xs text-texto-sec">Valor em estoque</p>
          </div>
          <p className="text-xl font-bold text-texto">{formatarMoeda(valorTotalEstoque)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-sec pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-borda rounded-xl focus:outline-none focus:ring-2 focus:ring-primaria/30 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'alerta', label: `Em alerta${alertas.length > 0 ? ` (${alertas.length})` : ''}` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroAlerta(f.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${filtroAlerta === f.id ? (f.id === 'alerta' ? 'bg-red-500 text-white border-red-500' : 'bg-primaria text-white border-primaria') : 'border-borda text-texto-sec hover:border-primaria hover:text-primaria bg-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-borda animate-pulse" />)}
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda p-12 text-center shadow-sm">
          <Archive size={36} className="text-borda mx-auto mb-3" />
          <p className="text-sm font-medium text-texto-sec">
            {busca ? `Nenhum produto encontrado para "${busca}"` : 'Nenhum produto cadastrado'}
          </p>
          {!busca && (
            <button onClick={() => setModalProduto('novo')}
              className="mt-3 text-sm text-primaria hover:text-primaria-escura font-medium transition-colors">
              Adicionar primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
          <div className="divide-y divide-borda">
            {produtosFiltrados.map((p) => {
              const baixo = p.quantidadeAtual <= p.quantidadeMinima
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-4 hover:bg-fundo/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${baixo ? 'bg-red-50' : 'bg-primaria-clara'}`}>
                    <Archive size={16} className={baixo ? 'text-red-500' : 'text-primaria'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-texto">{p.nome}</p>
                      {baixo && <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Estoque baixo</span>}
                      {!p.ativo && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-texto-sec">
                        <strong className={baixo ? 'text-red-600' : 'text-texto'}>{p.quantidadeAtual}</strong>
                        {' '}{p.unidade}
                        {p.quantidadeMinima > 0 && <span className="text-texto-ter"> · mín: {p.quantidadeMinima}</span>}
                      </p>
                      {p.precoVendaCentavos ? (
                        <span className="text-xs text-texto-sec">{formatarMoeda(p.precoVendaCentavos)}/un</span>
                      ) : null}
                      {p.precoCustoCentavos && p.precoVendaCentavos ? (
                        <span className="text-xs text-sucesso font-medium">
                          margem {Math.round(((p.precoVendaCentavos - p.precoCustoCentavos) / p.precoVendaCentavos) * 100)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setModalMovimento(p)}
                      className="p-2 rounded-lg text-texto-sec hover:bg-fundo hover:text-primaria transition-colors"
                      title="Registrar movimento"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      onClick={() => setModalProduto(p)}
                      className="p-2 rounded-lg text-texto-sec hover:bg-fundo hover:text-texto transition-colors"
                      title="Editar produto"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modalProduto && (
        <ModalProduto
          produto={modalProduto === 'novo' ? null : modalProduto}
          onFechar={() => setModalProduto(null)}
          onSalvar={() => { setModalProduto(null); carregar(); toast('Produto salvo!', 'sucesso') }}
        />
      )}

      {modalMovimento && (
        <ModalMovimento
          produto={modalMovimento}
          onFechar={() => setModalMovimento(null)}
          onSalvar={() => { setModalMovimento(null); carregar() }}
        />
      )}
    </div>
  )
}

export default Estoque

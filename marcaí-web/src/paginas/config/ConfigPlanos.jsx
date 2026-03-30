import { useEffect, useState, useMemo } from 'react'
import { Crown, Loader2, Pencil, Trash2, Users, CheckCircle2, UserPlus, X, TrendingUp } from 'lucide-react'
import api from '../../servicos/api'
import { cn, formatarData, formatarMoeda } from '../../lib/utils'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'

const SITUACAO_BADGE = {
  EM_DIA:        { label: 'Em dia',        cor: 'bg-green-100 text-green-700' },
  VENCE_HOJE:    { label: 'Vence hoje',    cor: 'bg-amber-100 text-amber-700' },
  VENCE_EM_BREVE:{ label: 'Vence em breve',cor: 'bg-yellow-100 text-yellow-700' },
  ATRASADO:      { label: 'Atrasado',      cor: 'bg-red-100 text-red-700' },
  SEM_COBRANCA:  { label: 'Sem cobrança',  cor: 'bg-gray-100 text-gray-600' },
  CANCELADA:     { label: 'Cancelada',     cor: 'bg-gray-100 text-gray-500' },
}

const DIAS_SEMANA = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
  { valor: 6, label: 'Sáb' },
  { valor: 0, label: 'Dom' },
]

const estadoPlano = { id: null, nome: '', preco: '', cicloDias: '30', descricao: '', diasPermitidos: [], creditosPorServico: [] }

const ModalPlano = ({ form, setForm, servicos, resumoPlanoAtual, salvando, erro, onSalvar, onFechar }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-4">
      <div className="flex items-center justify-between p-5 border-b border-borda">
        <h2 className="font-semibold text-texto">{form.id ? 'Editar plano' : 'Novo plano mensal'}</h2>
        <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1.5">Nome do plano *</label>
            <input
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Plano Corte Mensal"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1.5">Valor mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.preco}
              onChange={(e) => setForm((p) => ({ ...p, preco: e.target.value }))}
              placeholder="0,00"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1.5">Ciclo de cobrança</label>
            <Select value={form.cicloDias} onValueChange={(v) => setForm((p) => ({ ...p, cicloDias: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Ciclo de 7 dias</SelectItem>
                <SelectItem value="15">Ciclo de 15 dias</SelectItem>
                <SelectItem value="30">Ciclo de 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1.5">Descrição (opcional)</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Corte + barba todo mês"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-borda bg-fundo/60 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-texto mb-1">Dias permitidos</p>
            <p className="text-xs text-texto-sec mb-2.5">Deixe todos desmarcados para permitir qualquer dia.</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map(({ valor, label }) => {
                const ativo = form.diasPermitidos.includes(valor)
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setForm((p) => ({
                      ...p,
                      diasPermitidos: ativo
                        ? p.diasPermitidos.filter((d) => d !== valor)
                        : [...p.diasPermitidos, valor],
                    }))}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                      ativo ? 'bg-primaria text-white border-primaria' : 'bg-white text-texto-sec border-borda hover:border-primaria/40'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {form.diasPermitidos.length > 0 && (
              <p className="text-xs text-primaria mt-2 font-medium">
                Plano válido apenas em: {DIAS_SEMANA.filter(d => form.diasPermitidos.includes(d.valor)).map(d => d.label).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-borda bg-fundo/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-texto">Serviços incluídos por ciclo</p>
              <p className="text-xs text-texto-sec mt-0.5">Selecione o que o cliente ganha nesse plano.</p>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primaria">
              {form.creditosPorServico.length} item(ns)
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {servicos.map((servico) => {
              const selecionado = form.creditosPorServico.find((c) => c.servicoId === servico.id)
              return (
                <div key={servico.id} className={cn('rounded-xl border p-3 transition-colors', selecionado ? 'border-primaria/30 bg-white' : 'border-borda bg-white/70')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-texto">{servico.nome}</p>
                      <p className="text-xs text-texto-sec mt-0.5">{formatarMoeda(servico.precoCentavos)} · {servico.duracaoMinutos}min</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((anterior) => {
                        const jaSelecionado = anterior.creditosPorServico.some((c) => c.servicoId === servico.id)
                        return {
                          ...anterior,
                          creditosPorServico: jaSelecionado
                            ? anterior.creditosPorServico.filter((c) => c.servicoId !== servico.id)
                            : [...anterior.creditosPorServico, { servicoId: servico.id, creditos: 1 }],
                        }
                      })}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0', selecionado ? 'bg-primaria text-white' : 'bg-white border border-borda text-texto-sec hover:text-texto')}
                    >
                      {selecionado ? 'Incluído' : 'Adicionar'}
                    </button>
                  </div>
                  {selecionado && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-texto-sec">Créditos/ciclo</span>
                      <input
                        type="number" min="1" max="99"
                        value={selecionado.creditos}
                        onChange={(e) => setForm((anterior) => ({
                          ...anterior,
                          creditosPorServico: anterior.creditosPorServico.map((c) =>
                            c.servicoId === servico.id ? { ...c, creditos: Math.max(1, Number(e.target.value) || 1) } : c
                          ),
                        }))}
                        className="w-20 px-3 py-1.5 rounded-lg border border-borda text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primaria/30"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="rounded-xl bg-white border border-borda px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-widest text-texto-sec mb-1">Resumo comercial</p>
            <p className="text-sm text-texto">{resumoPlanoAtual}</p>
          </div>
        </div>

        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
      <div className="flex gap-3 p-5 border-t border-borda">
        <button onClick={onFechar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm hover:text-texto transition-colors">
          Cancelar
        </button>
        <button
          onClick={onSalvar}
          disabled={salvando}
          className="flex-1 bg-primaria hover:bg-primaria-escura text-white font-medium py-2.5 rounded-lg text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
          {form.id ? 'Atualizar plano' : 'Criar plano'}
        </button>
      </div>
    </div>
  </div>
)

const resumirCreditos = (creditos = []) => {
  if (!Array.isArray(creditos) || creditos.length === 0) return 'Nenhum serviço incluído ainda.'

  return creditos
    .map((credito) => {
      const nomeServico = credito.servico?.nome || credito.nome || 'Serviço'
      return `${credito.creditos}x ${nomeServico}`
    })
    .join(' + ')
}

const ConfigPlanos = () => {
  const [aba, setAba] = useState('planos')
  const [planos, setPlanos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState(estadoPlano)
  const [modalPlanoAberto, setModalPlanoAberto] = useState(false)
  const [confirmar, setConfirmar] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [vinculando, setVinculando] = useState(false)
  const [formVinculo, setFormVinculo] = useState({ clienteId: '', planoId: '' })

  const setFeedback = (tipo, msg) => {
    if (tipo === 'erro') { setErro(msg) }
    if (tipo === 'sucesso') {
      setSucesso(msg)
      setTimeout(() => setSucesso(''), 3000)
    }
  }

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const [resPlanos, resAssinaturas, resClientes, resServicos] = await Promise.all([
        api.get('/api/planos/assinaturas'),
        api.get('/api/planos/assinaturas-clientes'),
        api.get('/api/clientes?limite=200'),
        api.get('/api/servicos'),
      ])
      setPlanos(Array.isArray(resPlanos.dados) ? resPlanos.dados : [])
      setAssinaturas(Array.isArray(resAssinaturas.dados) ? resAssinaturas.dados : [])
      setClientes(Array.isArray(resClientes.clientes) ? resClientes.clientes : [])
      setServicos(Array.isArray(resServicos.dados) ? resServicos.dados : [])
    } catch (e) {
      setFeedback('erro', e?.erro?.mensagem || 'Erro ao carregar dados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])


  const salvarPlano = async () => {
    if (!form.nome.trim()) return setFeedback('erro', 'Nome do plano é obrigatório.')
    if (form.creditosPorServico.length === 0) {
      return setFeedback('erro', 'Selecione ao menos 1 serviço incluído para o plano ficar vendável no WhatsApp.')
    }
    setSalvando(true)
    setErro('')
    try {
      const corpo = {
        nome: form.nome.trim(),
        precoCentavos: form.preco ? Math.round(Number(form.preco) * 100) : 0,
        cicloDias: Number(form.cicloDias || 30),
        descricao: form.descricao?.trim() || null,
        diasPermitidos: form.diasPermitidos || [],
        creditosPorServico: form.creditosPorServico.map((credito) => ({
          servicoId: credito.servicoId,
          creditos: Number(credito.creditos || 1),
        })),
      }
      if (form.id) await api.patch(`/api/planos/assinaturas/${form.id}`, corpo)
      else await api.post('/api/planos/assinaturas', corpo)
      setForm(estadoPlano)
      setModalPlanoAberto(false)
      await carregar()
      setFeedback('sucesso', 'Plano salvo com sucesso.')
    } catch (e) {
      setFeedback('erro', e?.erro?.mensagem || 'Erro ao salvar plano.')
    } finally {
      setSalvando(false)
    }
  }

  const removerPlano = (plano) => {
    setConfirmar({
      titulo: 'Remover plano',
      mensagem: `Remover "${plano.nome}"? Assinantes ativos não serão cancelados automaticamente.`,
      labelConfirmar: 'Remover',
      onConfirmar: async () => {
        setConfirmar(null)
        try {
          await api.delete(`/api/planos/assinaturas/${plano.id}`)
          await carregar()
          setFeedback('sucesso', 'Plano removido.')
        } catch (e) {
          setFeedback('erro', e?.erro?.mensagem || 'Erro ao remover.')
        }
      },
    })
  }

  const vincularCliente = async () => {
    if (!formVinculo.clienteId || !formVinculo.planoId) return setFeedback('erro', 'Selecione cliente e plano.')
    setSalvando(true)
    try {
      await api.post('/api/planos/assinaturas-clientes', {
        clienteId: formVinculo.clienteId,
        planoAssinaturaId: formVinculo.planoId,
      })
      setFormVinculo({ clienteId: '', planoId: '' })
      setVinculando(false)
      await carregar()
      setFeedback('sucesso', 'Assinante vinculado com sucesso.')
    } catch (e) {
      setFeedback('erro', e?.erro?.mensagem || 'Erro ao vincular.')
    } finally {
      setSalvando(false)
    }
  }

  const registrarPagamento = async (assinatura) => {
    try {
      await api.post(`/api/planos/assinaturas-clientes/${assinatura.id}/pagamento`, {
        observacoes: 'Pagamento confirmado pela equipe',
      })
      await carregar()
      setFeedback('sucesso', `Pagamento registrado — ${assinatura.cliente?.nome || 'cliente'}.`)
    } catch (e) {
      setFeedback('erro', e?.erro?.mensagem || 'Erro ao registrar pagamento.')
    }
  }

  const alterarAssinatura = async (id, acao) => {
    try {
      await api.post(`/api/planos/assinaturas-clientes/${id}/${acao.toLowerCase()}`, {})
      await carregar()
    } catch (e) {
      setFeedback('erro', e?.erro?.mensagem || 'Erro ao atualizar assinatura.')
    }
  }

  const planosAtivos = useMemo(() => planos.filter((p) => p.ativo), [planos])
  const resumoPlanoAtual = useMemo(() => (
    resumirCreditos(
      form.creditosPorServico.map((credito) => ({
        ...credito,
        servico: servicos.find((servico) => servico.id === credito.servicoId),
      }))
    )
  ), [form.creditosPorServico, servicos])
  const mrr = useMemo(() => assinaturas
    .filter((a) => a.status === 'ATIVA')
    .reduce((sum, a) => sum + (a.planoAssinatura?.precoCentavos || 0), 0), [assinaturas])

  const assinaturasFiltradas = useMemo(() => {
    if (filtroStatus === 'atrasado') return assinaturas.filter((a) => a.situacaoPagamento?.status === 'ATRASADO')
    if (filtroStatus === 'em_dia') return assinaturas.filter((a) => a.situacaoPagamento?.status === 'EM_DIA')
    if (filtroStatus === 'canceladas') return assinaturas.filter((a) => a.status === 'CANCELADA')
    return assinaturas
  }, [assinaturas, filtroStatus])

  const countAtrasado = useMemo(() => assinaturas.filter((a) => a.situacaoPagamento?.status === 'ATRASADO').length, [assinaturas])
  const countAtivos = useMemo(() => assinaturas.filter((a) => a.status === 'ATIVA').length, [assinaturas])

  if (carregando) return <div className="bg-white rounded-3xl border border-borda p-8 text-center text-texto-sec">Carregando...</div>

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Plano Mensal</h1>
        <p className="text-texto-sec text-sm mt-1">Gerencie planos de assinatura e controle pagamentos dos assinantes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-borda p-4">
          <p className="text-xs text-texto-sec">MRR estimado</p>
          <p className="text-xl font-bold text-primaria mt-1">{formatarMoeda(mrr)}</p>
          <p className="text-[11px] text-texto-sec mt-0.5">receita recorrente/mês</p>
        </div>
        <div className="bg-white rounded-2xl border border-borda p-4">
          <p className="text-xs text-texto-sec">Assinantes ativos</p>
          <p className="text-2xl font-bold text-texto mt-1">{countAtivos}</p>
        </div>
        <div className="bg-white rounded-2xl border border-borda p-4">
          <p className="text-xs text-texto-sec">Em dia</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {assinaturas.filter((a) => a.situacaoPagamento?.status === 'EM_DIA').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-borda p-4">
          <p className="text-xs text-texto-sec">Atrasados</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{countAtrasado}</p>
        </div>
      </div>

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{erro}</div>}
      {sucesso && (
        <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm px-4 py-3 inline-flex items-center gap-2">
          <CheckCircle2 size={15} /> {sucesso}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-fundo rounded-xl p-1 w-fit">
        <button
          onClick={() => setAba('planos')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2', aba === 'planos' ? 'bg-white text-texto shadow-sm' : 'text-texto-sec hover:text-texto')}
        >
          <Crown size={14} /> Planos
        </button>
        <button
          onClick={() => setAba('assinantes')}
          className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2', aba === 'assinantes' ? 'bg-white text-texto shadow-sm' : 'text-texto-sec hover:text-texto')}
        >
          <Users size={14} /> Assinantes
          {countAtrasado > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {countAtrasado}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Planos ── */}
      {aba === 'planos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-texto-sec">{planosAtivos.length} plano(s) ativo(s)</p>
            <button
              onClick={() => { setForm(estadoPlano); setErro(''); setModalPlanoAberto(true) }}
              className="inline-flex items-center gap-2 bg-primaria hover:bg-primaria-escura text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Crown size={14} /> Novo plano
            </button>
          </div>

          {planos.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {planos.map((plano) => {
                const assinantesAtivos = assinaturas.filter((a) => a.planoAssinatura?.id === plano.id && a.status === 'ATIVA').length
                return (
                  <div key={plano.id} className="bg-white rounded-2xl border border-borda p-4 hover:border-primaria/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-texto">{plano.nome}</h3>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', plano.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {plano.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-primaria mt-1">{formatarMoeda(plano.precoCentavos)}<span className="text-texto-sec font-normal">/mês · ciclo de {plano.cicloDias} dias</span></p>
                        {plano.descricao && <p className="text-xs text-texto-sec mt-1">{plano.descricao}</p>}
                        <p className={cn('text-xs mt-2', plano.creditos?.length > 0 ? 'text-texto' : 'text-amber-700')}>
                          {plano.creditos?.length > 0
                            ? `Inclui: ${resumirCreditos(plano.creditos)}`
                            : 'Sem serviços incluídos — edite para o Don vender no WhatsApp.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-borda flex items-center justify-between">
                      <p className="text-xs text-texto-sec">
                        <span className="font-semibold text-texto">{assinantesAtivos}</span> assinante(s) ativo(s)
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setForm({
                              id: plano.id,
                              nome: plano.nome,
                              preco: plano.precoCentavos ? String(plano.precoCentavos / 100) : '',
                              cicloDias: String(plano.cicloDias || 30),
                              descricao: plano.descricao || '',
                              diasPermitidos: Array.isArray(plano.diasPermitidos) ? plano.diasPermitidos : [],
                              creditosPorServico: Array.isArray(plano.creditos)
                                ? plano.creditos.map((c) => ({ servicoId: c.servicoId, creditos: c.creditos }))
                                : [],
                            })
                            setErro('')
                            setModalPlanoAberto(true)
                          }}
                          className="px-3 py-1.5 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-primaria inline-flex items-center gap-1 transition-colors"
                        >
                          <Pencil size={11} /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/api/planos/assinaturas/${plano.id}/toggle`)
                              await carregar()
                              setFeedback('sucesso', plano.ativo ? 'Plano desativado.' : 'Plano reativado.')
                            } catch (e) { setFeedback('erro', e?.erro?.mensagem || 'Erro ao alterar.') }
                          }}
                          className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 transition-colors', plano.ativo ? 'border-amber-300 text-amber-600 hover:bg-amber-50' : 'border-green-300 text-green-600 hover:bg-green-50')}
                        >
                          {plano.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => removerPlano(plano)}
                          className="px-3 py-1.5 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-perigo inline-flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={11} /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-borda bg-white px-6 py-10 text-center">
              <Crown size={32} className="text-borda mx-auto mb-3" />
              <p className="text-sm font-medium text-texto">Nenhum plano cadastrado ainda.</p>
              <p className="text-xs text-texto-sec mt-2 mb-4">
                Comece com algo simples como 2x Corte por mês ou 1x Corte + 1x Barba — o Don já consegue vender a assinatura no WhatsApp.
              </p>
              <button
                onClick={() => { setForm(estadoPlano); setErro(''); setModalPlanoAberto(true) }}
                className="inline-flex items-center gap-2 bg-primaria text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                <Crown size={14} /> Criar primeiro plano
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Assinantes ── */}
      {aba === 'assinantes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'atrasado', label: 'Atrasados' },
                { id: 'em_dia', label: 'Em dia' },
                { id: 'canceladas', label: 'Canceladas' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroStatus(f.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', filtroStatus === f.id ? 'bg-primaria text-white' : 'bg-white border border-borda text-texto-sec hover:text-texto')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setVinculando(true)}
              className="px-3 py-2 rounded-lg bg-primaria text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <UserPlus size={14} /> Novo assinante
            </button>
          </div>

          {vinculando && (
            <div className="bg-white rounded-2xl border border-borda p-4 space-y-3">
              <h3 className="font-semibold text-texto text-sm">Vincular cliente a plano</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={formVinculo.clienteId || '__sel__'} onValueChange={(v) => setFormVinculo((p) => ({ ...p, clienteId: v === '__sel__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sel__">Selecione o cliente</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={formVinculo.planoId || '__sel__'} onValueChange={(v) => setFormVinculo((p) => ({ ...p, planoId: v === '__sel__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sel__">Selecione o plano</SelectItem>
                    {planosAtivos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {formatarMoeda(p.precoCentavos)}/mês</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <button
                    onClick={vincularCliente}
                    disabled={salvando}
                    className="flex-1 px-3 py-2 rounded-lg bg-primaria text-white text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {salvando ? <Loader2 size={13} className="animate-spin" /> : null} Vincular
                  </button>
                  <button onClick={() => setVinculando(false)} className="px-3 py-2 rounded-lg border border-borda text-sm text-texto-sec">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {assinaturasFiltradas.length === 0 ? (
            <p className="text-sm text-texto-sec text-center py-10">Nenhum assinante encontrado.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-borda divide-y divide-borda">
              {assinaturasFiltradas.map((assinatura) => {
                const badge = SITUACAO_BADGE[assinatura.situacaoPagamento?.status] || SITUACAO_BADGE.SEM_COBRANCA
                const atrasado = assinatura.situacaoPagamento?.status === 'ATRASADO'
                return (
                  <div key={assinatura.id} className={cn('p-4 flex flex-col md:flex-row md:items-center gap-3', atrasado ? 'bg-red-50/40' : '')}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-texto">{assinatura.cliente?.nome || 'Cliente'}</p>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', badge.cor)}>{badge.label}</span>
                        {assinatura.status === 'PAUSADA' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">Pausada</span>
                        )}
                      </div>
                      <p className="text-sm text-texto-sec mt-0.5">
                        {assinatura.planoAssinatura?.nome} · {formatarMoeda(assinatura.planoAssinatura?.precoCentavos)}/mês
                      </p>
                      <p className="text-xs text-texto-sec mt-0.5">
                        {assinatura.situacaoPagamento?.descricao || `Próxima cobrança: ${formatarData(assinatura.proximaCobrancaEm)}`}
                      </p>
                      {Array.isArray(assinatura.creditos) && assinatura.creditos.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {assinatura.creditos.map((c) => {
                            const total = c.creditosIniciais || 0
                            const restantes = c.creditosRestantes ?? (total - (c.consumidos || 0))
                            const pct = total > 0 ? Math.round(((total - restantes) / total) * 100) : 0
                            return (
                              <div key={c.id} className="flex items-center gap-1.5">
                                <span className="text-[11px] text-texto-sec">{c.servico?.nome}</span>
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={cn('h-full rounded-full transition-all', restantes <= 0 ? 'bg-red-400' : 'bg-primaria')} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={cn('text-[11px] font-medium', restantes <= 0 ? 'text-red-500' : 'text-texto-sec')}>{restantes}/{total}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {atrasado && (
                        <p className="text-xs text-red-600 font-medium mt-1">⚠ Agendamento bloqueado — pagamento pendente</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {assinatura.status !== 'CANCELADA' && (
                        <button
                          onClick={() => registrarPagamento(assinatura)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                            atrasado
                              ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                              : 'border-borda text-texto-sec hover:text-texto'
                          )}
                        >
                          {atrasado ? '✓ Registrar pagamento' : 'Registrar pag.'}
                        </button>
                      )}
                      {assinatura.status === 'ATIVA' && (
                        <button onClick={() => alterarAssinatura(assinatura.id, 'PAUSAR')} className="px-3 py-1.5 rounded-lg border border-borda text-xs text-texto-sec hover:text-texto">
                          Pausar
                        </button>
                      )}
                      {(assinatura.status === 'PAUSADA' || assinatura.status === 'CANCELADA') && (
                        <button onClick={() => setConfirmar({
                          titulo: 'Reativar assinatura',
                          mensagem: `Reativar a assinatura de ${assinatura.cliente?.nome}?`,
                          labelConfirmar: 'Reativar',
                          corBotao: 'primaria',
                          onConfirmar: async () => {
                            setConfirmar(null)
                            await alterarAssinatura(assinatura.id, 'RETOMAR')
                          },
                        })} className="px-3 py-1.5 rounded-lg border border-green-300 text-xs text-green-700 hover:bg-green-50">
                          Reativar
                        </button>
                      )}
                      {assinatura.status !== 'CANCELADA' && (
                        <button
                          onClick={() => setConfirmar({
                            titulo: 'Cancelar assinatura',
                            mensagem: `Cancelar assinatura de ${assinatura.cliente?.nome}?`,
                            labelConfirmar: 'Cancelar assinatura',
                            onConfirmar: async () => {
                              setConfirmar(null)
                              await alterarAssinatura(assinatura.id, 'CANCELAR')
                            },
                          })}
                          className="px-3 py-1.5 rounded-lg border border-borda text-xs text-texto-sec hover:text-perigo"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {confirmar && <ModalConfirmar {...confirmar} onCancelar={() => setConfirmar(null)} />}

      {modalPlanoAberto && (
        <ModalPlano
          form={form}
          setForm={setForm}
          servicos={servicos}
          resumoPlanoAtual={resumoPlanoAtual}
          salvando={salvando}
          erro={erro}
          onSalvar={salvarPlano}
          onFechar={() => { setModalPlanoAberto(false); setForm(estadoPlano); setErro('') }}
        />
      )}
    </div>
  )
}

export default ConfigPlanos

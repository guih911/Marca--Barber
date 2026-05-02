import { useState, useEffect } from 'react'
import {
  Clock, UserPlus, Trash2, Bell, X, Loader2, Calendar, Scissors, ChevronDown, Check, Users, CircleAlert
} from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const formatarData = (data) => {
  if (!data) return '—'
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatarDataHora = (data) => {
  if (!data) return '—'
  const d = new Date(data)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const BadgeStatus = ({ status }) => {
  if (status === 'NOTIFICADO') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <Check size={11} />
        Notificado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock size={11} />
      Aguardando
    </span>
  )
}

const CardResumo = ({ titulo, valor, icone: Icone, destaque = false }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${destaque ? 'border-primaria/30 bg-primaria/5' : 'border-borda bg-white'}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-texto-sec uppercase tracking-wide">{titulo}</p>
        <p className="text-2xl font-bold text-texto mt-1">{valor}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${destaque ? 'bg-primaria/15 text-primaria' : 'bg-fundo text-texto-sec'}`}>
        <Icone size={18} />
      </div>
    </div>
  </div>
)

const CampoSelect = ({ label, value, onChange, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-texto-sec">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none border border-borda rounded-xl px-3 py-2.5 text-sm text-texto bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-primaria/30"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-texto-sec pointer-events-none" />
    </div>
  </div>
)

const ModalAdicionar = ({ onFechar, onSalvo }) => {
  const toast = useToast()
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    clienteId: '',
    servicoId: '',
    profissionalId: '',
    dataDesejada: '',
  })

  useEffect(() => {
    const buscar = async () => {
      try {
        const [resC, resS, resP] = await Promise.allSettled([
          api.get('/api/clientes'),
          api.get('/api/servicos'),
          api.get('/api/profissionais'),
        ])
        setClientes(resC.status === 'fulfilled' ? (resC.value?.clientes || []) : [])
        setServicos(resS.status === 'fulfilled' ? (resS.value?.dados || resS.value || []) : [])
        setProfissionais(resP.status === 'fulfilled' ? (resP.value?.dados || resP.value || []) : [])
      } finally {
        setCarregando(false)
      }
    }
    buscar()
  }, [])

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const handleSalvar = async () => {
    if (!form.clienteId || !form.servicoId || !form.dataDesejada) {
      toast('Preencha cliente, serviço e data desejada.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const body = {
        clienteId: form.clienteId,
        servicoId: form.servicoId,
        dataDesejada: form.dataDesejada,
      }
      if (form.profissionalId) body.profissionalId = form.profissionalId
      await api.post('/api/fila-espera', body)
      toast('Entrada adicionada à lista de espera.', 'sucesso')
      onSalvo()
    } catch {
      toast('Erro ao adicionar na lista de espera.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borda bg-fundo/60">
          <div>
            <h2 className="text-base font-semibold text-texto">Adicionar à lista de espera</h2>
            <p className="text-xs text-texto-sec mt-0.5">Cadastro rápido para não perder encaixes.</p>
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg text-texto-sec hover:bg-fundo transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {carregando ? (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-primaria" />
            </div>
          ) : (
            <>
              <CampoSelect
                label="Cliente *"
                value={form.clienteId}
                onChange={(e) => handleChange('clienteId', e.target.value)}
              >
                <option value="">Selecione um cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.telefone ? ` — ${c.telefone}` : ''}
                  </option>
                ))}
              </CampoSelect>

              <CampoSelect
                label="Serviço *"
                value={form.servicoId}
                onChange={(e) => handleChange('servicoId', e.target.value)}
              >
                <option value="">Selecione um serviço</option>
                {servicos.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </CampoSelect>

              <CampoSelect
                label="Profissional (opcional)"
                value={form.profissionalId}
                onChange={(e) => handleChange('profissionalId', e.target.value)}
              >
                <option value="">Qualquer profissional</option>
                {profissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </CampoSelect>

              {/* Data desejada */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-texto-sec">Data desejada *</label>
                <input
                  type="date"
                  value={form.dataDesejada}
                  onChange={e => handleChange('dataDesejada', e.target.value)}
                  className="border border-borda rounded-xl px-3 py-2.5 text-sm text-texto bg-white focus:outline-none focus:ring-2 focus:ring-primaria/30"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-borda">
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-xl text-sm font-medium text-texto-sec hover:bg-fundo transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || carregando}
            className="bg-primaria text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-opacity hover:bg-primaria-escura"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

const ListaEspera = () => {
  const toast = useToast()
  const [entradas, setEntradas] = useState([])
  const [resumo, setResumo] = useState({ total: 0, aguardando: 0, notificado: 0 })
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('AGUARDANDO')
  const [modalAberto, setModalAberto] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [acaoId, setAcaoId] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (filtro !== 'TODOS') params.set('status', filtro)
      const [resFiltrado, resTodos] = await Promise.all([
        api.get(`/api/fila-espera?${params}`),
        api.get('/api/fila-espera'),
      ])
      const lista = resFiltrado?.dados || resFiltrado || []
      const listaTodos = resTodos?.dados || resTodos || []
      const ordenada = [...lista].sort((a, b) => new Date(a.dataDesejada) - new Date(b.dataDesejada))
      setEntradas(ordenada)
      setResumo({
        total: listaTodos.length,
        aguardando: listaTodos.filter((item) => item.status === 'AGUARDANDO').length,
        notificado: listaTodos.filter((item) => item.status === 'NOTIFICADO').length,
      })
    } catch {
      toast('Erro ao carregar a lista de espera.', 'erro')
      setEntradas([])
      setResumo({ total: 0, aguardando: 0, notificado: 0 })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [filtro])

  const handleNotificar = async (id) => {
    setAcaoId(id)
    try {
      await api.patch(`/api/fila-espera/${id}/status`, { status: 'NOTIFICADO' })
      toast('Entrada marcada como ofertada manualmente.', 'sucesso')
      carregar()
    } catch {
      toast('Erro ao notificar cliente.', 'erro')
    } finally {
      setAcaoId(null)
    }
  }

  const handleRemover = async (id) => {
    setAcaoId(id)
    try {
      await api.delete(`/api/fila-espera/${id}`)
      toast('Entrada removida.', 'sucesso')
      setConfirmandoId(null)
      carregar()
    } catch {
      toast('Erro ao remover entrada.', 'erro')
    } finally {
      setAcaoId(null)
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <section className="rounded-3xl border border-borda bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primaria/10 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-primaria" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-texto">Lista de espera</h1>
              <p className="text-sm text-texto-sec mt-1">
                Controle de encaixes com prioridade, sem perder vaga quando houver cancelamento ou não confirmação.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="bg-primaria text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-primaria-escura transition-colors shrink-0"
          >
            <UserPlus size={16} />
            Adicionar cliente
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardResumo titulo="Na fila" valor={resumo.aguardando} icone={Clock} destaque />
        <CardResumo titulo="Já notificados" valor={resumo.notificado} icone={Bell} />
        <CardResumo titulo="Total de entradas" valor={resumo.total} icone={Users} />
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { valor: 'AGUARDANDO', label: 'Aguardando', total: resumo.aguardando },
          { valor: 'TODOS', label: 'Todos', total: resumo.total },
        ].map(({ valor, label, total }) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              filtro === valor
                ? 'bg-primaria text-white'
                : 'bg-white border border-borda text-texto-sec hover:text-texto hover:bg-fundo'
            }`}
          >
            {label} ({total})
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primaria" />
        </div>
      ) : entradas.length === 0 ? (
        /* Estado vazio */
        <div className="rounded-3xl border border-dashed border-borda bg-white py-16 px-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-fundo border border-borda flex items-center justify-center">
            <Clock size={28} className="text-texto-sec" />
          </div>
          <div>
            <p className="text-base font-medium text-texto">Nenhum cliente na fila</p>
            <p className="text-sm text-texto-sec mt-1">
              {filtro === 'AGUARDANDO'
                ? 'Não há clientes aguardando no momento.'
                : 'A lista de espera está vazia.'}
            </p>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="bg-primaria text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-primaria-escura transition-colors"
          >
            <UserPlus size={15} />
            Adicionar primeiro cliente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entradas.map(entrada => (
            <div
              key={entrada.id}
              className="bg-white rounded-2xl border border-borda p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                {/* Informações */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-texto">
                      {entrada.cliente?.nome || '—'}
                    </span>
                    <BadgeStatus status={entrada.status} />
                  </div>

                  {entrada.cliente?.telefone && (
                    <p className="text-xs text-texto-sec">{entrada.cliente.telefone}</p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-1">
                    {/* Serviço */}
                    <div className="flex items-center gap-1.5 text-xs text-texto-sec">
                      <Scissors size={12} className="text-primaria shrink-0" />
                      <span>{entrada.servico?.nome || '—'}</span>
                      {entrada.servico?.duracaoMinutos && (
                        <span className="text-texto-sec/60">({entrada.servico.duracaoMinutos} min)</span>
                      )}
                    </div>

                    {/* Profissional */}
                    {entrada.profissional && (
                      <div className="flex items-center gap-1.5 text-xs text-texto-sec">
                        <Check size={12} className="text-texto-sec/60 shrink-0" />
                        <span>{entrada.profissional.nome}</span>
                      </div>
                    )}

                    {/* Data desejada */}
                    <div className="flex items-center gap-1.5 text-xs text-texto-sec">
                      <Calendar size={12} className="shrink-0" />
                      <span>{formatarData(entrada.dataDesejada)}</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {entrada.status === 'AGUARDANDO' && (
                    <button
                      onClick={() => handleNotificar(entrada.id)}
                      disabled={acaoId === entrada.id}
                      title="Notificar cliente"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {acaoId === entrada.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Bell size={13} />
                      )}
                      Marcar ofertado
                    </button>
                  )}

                  {confirmandoId === entrada.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-texto-sec">Remover?</span>
                      <button
                        onClick={() => handleRemover(entrada.id)}
                        disabled={acaoId === entrada.id}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {acaoId === entrada.id ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmandoId(null)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-texto-sec hover:bg-fundo transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoId(entrada.id)}
                      title="Remover da lista"
                      className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {entrada.notificadoEm && (
                <div className="pt-3 border-t border-borda flex items-center gap-1.5 text-xs text-texto-sec">
                  <CircleAlert size={12} className="text-texto-sec/70" />
                  Oferta enviada em {formatarDataHora(entrada.notificadoEm)}.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal adicionar */}
      {modalAberto && (
        <ModalAdicionar
          onFechar={() => setModalAberto(false)}
          onSalvo={() => { setModalAberto(false); carregar() }}
        />
      )}
    </div>
  )
}

export default ListaEspera

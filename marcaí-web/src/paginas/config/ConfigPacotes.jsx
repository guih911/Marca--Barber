import { useState, useEffect } from 'react'
import { Package, Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import { formatarMoeda } from '../../lib/utils'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'

const ModalPacote = ({ pacote, servicos, onFechar, onSalvar }) => {
  const toast = useToast()
  const [form, setForm] = useState({
    nome: pacote?.nome || '',
    descricao: pacote?.descricao || '',
    tipo: pacote?.tipo || 'FIXO',
    precoCentavos: pacote?.precoCentavos ? pacote.precoCentavos / 100 : '',
    descontoPorcent: pacote?.descontoPorcent || '',
    servicoIds: pacote?.servicos?.map((s) => s.servicoId) || [],
  })
  const [salvando, setSalvando] = useState(false)

  const toggleServico = (id) => {
    setForm((p) => ({
      ...p,
      servicoIds: p.servicoIds.includes(id) ? p.servicoIds.filter((s) => s !== id) : [...p.servicoIds, id],
    }))
  }

  const salvar = async () => {
    if (!form.nome) { toast('Nome é obrigatório', 'aviso'); return }
    if (form.servicoIds.length === 0) { toast('Selecione ao menos 1 serviço', 'aviso'); return }
    setSalvando(true)
    try {
      const corpo = {
        ...form,
        precoCentavos: form.precoCentavos ? Math.round(parseFloat(form.precoCentavos) * 100) : 0,
        descontoPorcent: form.descontoPorcent ? Number(form.descontoPorcent) : null,
      }
      if (pacote?.id) {
        await api.patch(`/api/pacotes/${pacote.id}`, corpo)
      } else {
        await api.post('/api/pacotes', corpo)
      }
      onSalvar()
    } catch { toast('Erro ao salvar pacote', 'erro') }
    finally { setSalvando(false) }
  }

  const f = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-texto">{pacote ? 'Editar pacote' : 'Novo pacote'}</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Nome do pacote *</label>
            <input value={form.nome} onChange={f('nome')} placeholder="Ex: Combo Corte + Barba"
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Tipo de precificação</label>
            <div className="flex gap-2">
              {[
                { valor: 'FIXO', label: 'Preço fixo' },
                { valor: 'DESCONTO', label: '% desconto' },
              ].map((t) => (
                <button key={t.valor} type="button" onClick={() => setForm((p) => ({ ...p, tipo: t.valor }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.tipo === t.valor ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto-sec hover:bg-fundo'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {form.tipo === 'FIXO' ? (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Preço total do pacote (R$)</label>
              <input type="number" min="0" step="0.01" value={form.precoCentavos} onChange={f('precoCentavos')} placeholder="0,00"
                className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-texto-sec mb-1">Desconto (%)</label>
              <input type="number" min="1" max="99" value={form.descontoPorcent} onChange={f('descontoPorcent')} placeholder="Ex: 15"
                className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-texto-sec mb-1">Descrição (opcional)</label>
            <input value={form.descricao} onChange={f('descricao')} placeholder="Ex: Aproveite nosso combo especial!"
              className="w-full px-3 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-texto-sec mb-2">Serviços incluídos *</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {servicos.map((s) => {
                const selecionado = form.servicoIds.includes(s.id)
                return (
                  <button key={s.id} type="button" onClick={() => toggleServico(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${selecionado ? 'border-primaria/40 bg-primaria-clara' : 'border-borda hover:bg-fundo'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selecionado ? 'bg-primaria border-primaria' : 'border-texto-ter'}`}>
                      {selecionado && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current"><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span className="text-sm text-texto flex-1">{s.nome}</span>
                    {s.precoCentavos && <span className="text-xs text-texto-sec">{formatarMoeda(s.precoCentavos)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-borda text-sm text-texto-sec hover:bg-fundo transition-colors">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : null}
            Salvar pacote
          </button>
        </div>
      </div>
    </div>
  )
}

const ConfigPacotes = () => {
  const toast = useToast()
  const [pacotes, setPacotes] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const carregar = async () => {
    try {
      const [resPacotes, resServicos] = await Promise.all([
        api.get('/api/pacotes'),
        api.get('/api/servicos'),
      ])
      setPacotes(resPacotes.dados || [])
      setServicos(resServicos.dados || resServicos.servicos || [])
    } catch { toast('Erro ao carregar', 'erro') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  const excluir = (id, nome) => {
    setConfirmar({
      titulo: 'Excluir pacote',
      mensagem: `Excluir "${nome}"? Esta ação não pode ser desfeita.`,
      labelConfirmar: 'Excluir',
      onConfirmar: async () => {
        setConfirmar(null)
        try {
          await api.delete(`/api/pacotes/${id}`)
          toast('Pacote excluído', 'sucesso')
          carregar()
        } catch { toast('Erro ao excluir', 'erro') }
      },
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Pacotes e Combos</h1>
          <p className="text-texto-sec text-sm mt-1">Crie combos de serviços com preço especial. A IA pode oferecer durante o agendamento via WhatsApp.</p>
        </div>
        <button onClick={() => setModal('novo')}
          className="flex items-center gap-2 bg-primaria hover:bg-primaria-escura text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <Plus size={15} /> Novo pacote
        </button>
      </div>

      {carregando ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-borda animate-pulse" />)}</div>
      ) : pacotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda p-12 text-center shadow-sm">
          <Package size={36} className="text-borda mx-auto mb-3" />
          <p className="text-sm font-medium text-texto-sec">Nenhum pacote criado ainda</p>
          <p className="text-xs text-texto-ter mt-1">Crie combos como "Corte + Barba" com preço especial.</p>
          <button onClick={() => setModal('novo')} className="mt-3 text-sm text-primaria hover:text-primaria-escura font-medium">
            Criar primeiro pacote
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pacotes.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-borda p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-primaria-clara shrink-0">
                    <Package size={16} className="text-primaria" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-texto">{p.nome}</p>
                      {!p.ativo && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    {p.descricao && <p className="text-xs text-texto-sec mt-0.5">{p.descricao}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-sm font-bold text-primaria">
                        {p.tipo === 'FIXO' ? formatarMoeda(p.precoCentavos) : `${p.descontoPorcent}% desconto`}
                      </span>
                      <span className="text-xs text-texto-sec">{p.servicos?.length} {(p.servicos?.length ?? 0) === 1 ? 'serviço' : 'serviços'}</span>
                    </div>
                    {p.servicos?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.servicos.map((s) => (
                          <span key={s.id} className="text-[11px] bg-fundo border border-borda px-2 py-0.5 rounded-full text-texto-sec">
                            {s.servico?.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setModal(p)} className="p-2 rounded-lg text-texto-sec hover:bg-fundo hover:text-primaria transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => excluir(p.id, p.nome)} className="p-2 rounded-lg text-texto-sec hover:bg-red-50 hover:text-perigo transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ModalPacote
          pacote={modal === 'novo' ? null : modal}
          servicos={servicos}
          onFechar={() => setModal(null)}
          onSalvar={() => { setModal(null); carregar(); toast('Pacote salvo!', 'sucesso') }}
        />
      )}

      {confirmar && (
        <ModalConfirmar {...confirmar} onCancelar={() => setConfirmar(null)} />
      )}
    </div>
  )
}

export default ConfigPacotes

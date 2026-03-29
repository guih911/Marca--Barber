import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../../servicos/api'
import { formatarMoeda, formatarDuracao, opcoesDuracao, sanitizarTexto } from '../../lib/utils'
import { useToast } from '../../contextos/ToastContexto'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'

const ModalServico = ({ servico, onFechar, onSalvar }) => {
  const [form, setForm] = useState({
    nome: servico?.nome || '',
    duracaoMinutos: servico?.duracaoMinutos || 60,
    precoCentavos: servico?.precoCentavos ? String(servico.precoCentavos / 100) : '',
    instrucoes: servico?.instrucoes || '',
    retornoEmDias: servico?.retornoEmDias ? String(servico.retornoEmDias) : '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const atualizar = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  const handleSalvar = async () => {
    if (!form.nome) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    setErro('')
    try {
      const corpo = {
        nome: sanitizarTexto(form.nome),
        duracaoMinutos: Number(form.duracaoMinutos),
        precoCentavos: form.precoCentavos ? Math.round(parseFloat(form.precoCentavos) * 100) : null,
        instrucoes: sanitizarTexto(form.instrucoes) || null,
        retornoEmDias: form.retornoEmDias ? Number(form.retornoEmDias) : null,
      }
      if (servico?.id) {
        await api.patch(`/api/servicos/${servico.id}`, corpo)
      } else {
        await api.post('/api/servicos', corpo)
      }
      onSalvar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-texto">{servico ? 'Editar serviço' : 'Novo serviço'}</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Nome *</label>
            <input value={form.nome} onChange={atualizar('nome')} placeholder="Ex: Corte degradê" className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">Duração</label>
              <Select value={String(form.duracaoMinutos)} onValueChange={(v) => setForm((p) => ({ ...p, duracaoMinutos: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcoesDuracao.map((o) => <SelectItem key={o.valor} value={String(o.valor)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">Preço (R$)</label>
              <input type="number" step="0.01" value={form.precoCentavos} onChange={atualizar('precoCentavos')} placeholder="0,00" className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Instruções pré-atendimento</label>
            <textarea value={form.instrucoes} onChange={atualizar('instrucoes')} placeholder="Instruções para o cliente antes do atendimento..." rows={3} className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Avisar cliente para retornar após (dias)</label>
            <input type="number" min="0" value={form.retornoEmDias} onChange={atualizar('retornoEmDias')} placeholder="Ex: 21 para corte, 14 para barba (vazio = desativado)" className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm" />
            <p className="text-xs text-texto-sec mt-1">A IA manda WhatsApp automático para o cliente agendar de volta após esse período</p>
          </div>
        </div>

        {erro && <p className="text-perigo text-sm mt-3">{erro}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onFechar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm hover:text-texto transition-colors">Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando} className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
            {servico ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ConfigServicos = () => {
  const toast = useToast()
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null) // null | 'novo' | servico
  const [confirmar, setConfirmar] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    const res = await api.get('/api/servicos')
    setServicos(res.dados)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const toggleAtivo = async (servico) => {
    await api.patch(`/api/servicos/${servico.id}`, { ativo: !servico.ativo })
    carregar()
  }

  const excluir = (id) => {
    setConfirmar({
      titulo: 'Excluir serviço',
      mensagem: 'Esta ação não pode ser desfeita. Agendamentos existentes não serão afetados.',
      labelConfirmar: 'Excluir',
      onConfirmar: async () => {
        setConfirmar(null)
        try {
          await api.delete(`/api/servicos/${id}`)
          toast('Serviço excluído.', 'sucesso')
          carregar()
        } catch (e) {
          toast(e?.erro?.mensagem || 'Erro ao excluir', 'erro')
        }
      },
    })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Serviços</h1>
          <p className="text-texto-sec text-sm mt-1">Gerencie os serviços da barbearia</p>
        </div>
        <button onClick={() => setModal('novo')} className="bg-primaria hover:bg-primaria-escura text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
          <Plus size={16} /> Novo Serviço
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
        {carregando ? (
          <div className="p-8 text-center text-texto-sec">Carregando...</div>
        ) : servicos.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-texto-sec mb-4">Nenhum serviço cadastrado</p>
            <button onClick={() => setModal('novo')} className="bg-primaria text-white px-4 py-2 rounded-lg text-sm">Adicionar primeiro serviço</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-borda bg-fundo">
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Duração</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Preço</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id} className="border-b border-borda last:border-0 hover:bg-fundo transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-texto">{s.nome}</p>
                    {s.instrucoes && <p className="text-xs text-texto-sec truncate max-w-xs mt-0.5">{s.instrucoes}</p>}
                    {s.retornoEmDias && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primaria/8 text-primaria text-[11px] font-medium">
                        🔄 Lembrete em {s.retornoEmDias}d
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-texto">{formatarDuracao(s.duracaoMinutos)}</td>
                  <td className="px-5 py-4 text-sm text-texto">{formatarMoeda(s.precoCentavos)}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleAtivo(s)} className="flex items-center gap-2 text-sm">
                      {s.ativo
                        ? <><ToggleRight size={22} className="text-sucesso" /> <span className="text-sucesso font-medium">Ativo</span></>
                        : <><ToggleLeft size={22} className="text-texto-sec" /> <span className="text-texto-sec">Inativo</span></>
                      }
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <button onClick={() => setModal(s)} className="text-texto-sec hover:text-primaria transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => excluir(s.id)} className="text-texto-sec hover:text-perigo transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <ModalServico
          servico={modal === 'novo' ? null : modal}
          onFechar={() => setModal(null)}
          onSalvar={() => { setModal(null); carregar() }}
        />
      )}

      {confirmar && (
        <ModalConfirmar {...confirmar} onCancelar={() => setConfirmar(null)} />
      )}
    </div>
  )
}

export default ConfigServicos

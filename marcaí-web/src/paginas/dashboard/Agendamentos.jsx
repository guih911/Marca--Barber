import { useState, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Star } from 'lucide-react'
import api from '../../servicos/api'
import { formatarDataHora, formatarHora, formatarMoeda, statusAgendamento, cn } from '../../lib/utils'
import useDebounce from '../../hooks/useDebounce'
import { useToast } from '../../contextos/ToastContexto'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import useAuth from '../../hooks/useAuth'
import AvatarPessoa from '../../componentes/ui/AvatarPessoa'

const clientePresente = (agendamento) => Boolean(agendamento.presencaConfirmadaEm)

// Card para mobile
const CardAgendamento = ({ ag, onAcao, exigirConfirmacaoPresenca }) => {
  const statusCfg = statusAgendamento[ag.status]
  const presencaConfirmada = clientePresente(ag)
  return (
    <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <AvatarPessoa pessoa={ag.cliente} tamanho="sm" />
          <div>
            <p className="text-sm font-semibold text-texto">{ag.cliente?.nome}</p>
            <p className="text-xs text-texto-sec">{ag.servico?.nome} · {ag.profissional?.nome}</p>
          </div>
        </div>
        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0', statusCfg?.cor)}>
          {statusCfg?.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-texto-sec">
        <Clock size={12} />
        <span>{formatarDataHora(ag.inicioEm)}</span>
        {ag.servico?.precoCentavos && (
          <span className="font-semibold text-sucesso">{formatarMoeda(ag.servico.precoCentavos)}</span>
        )}
        {ag.feedbackNota && (
          <span className="ml-auto flex items-center gap-0.5 text-yellow-500 font-medium">
            <Star size={11} className="fill-yellow-500" /> {ag.feedbackNota}
          </span>
        )}
      </div>

      {presencaConfirmada && (
        <div className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          Cliente chegou às {formatarHora(ag.presencaConfirmadaEm)}
        </div>
      )}

      {['AGENDADO', 'CONFIRMADO'].includes(ag.status) && (
        <div className="space-y-2 pt-1">
          {ag.status === 'AGENDADO' && (
            <button onClick={() => onAcao('confirmar', ag.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sucesso/10 text-sucesso text-xs font-semibold hover:bg-sucesso/20 transition-colors">
              <CheckCircle2 size={13} /> Confirmar agenda
            </button>
          )}
          {!presencaConfirmada && (
            <button onClick={() => onAcao('confirmar-presenca', ag.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors">
              <CheckCircle2 size={13} /> Cliente chegou
            </button>
          )}
          <div className="flex gap-2">
            {ag.status === 'CONFIRMADO' && (
              <button onClick={() => onAcao('concluir', ag.id)}
                disabled={exigirConfirmacaoPresenca && !presencaConfirmada}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primaria/10 text-primaria text-xs font-semibold hover:bg-primaria/20 transition-colors disabled:opacity-50">
                <CheckCircle2 size={13} /> Concluir
              </button>
            )}
            <button onClick={() => onAcao('cancelar', ag.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-perigo/8 text-perigo text-xs font-semibold hover:bg-perigo/15 transition-colors">
              <XCircle size={13} /> Cancelar
            </button>
          </div>
          {exigirConfirmacaoPresenca && !presencaConfirmada && (
            <p className="text-[11px] text-amber-700">
              Confirme que o cliente chegou antes de finalizar o atendimento.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const Agendamentos = () => {
  const toast = useToast()
  const { tenant } = useAuth()
  const [agendamentos, setAgendamentos] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [confirmar, setConfirmar] = useState(null)
  const buscaDebounced = useDebounce(busca, 400)
  const limite = 15

  const carregarAgendamentos = async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({ pagina, limite })
      if (filtroStatus) params.set('status', filtroStatus)
      if (filtroProfissional) params.set('profissionalId', filtroProfissional)
      if (buscaDebounced) params.set('busca', buscaDebounced) // server-side search

      const res = await api.get(`/api/agendamentos?${params}`)
      setAgendamentos(res.agendamentos || res.dados || [])
      setTotal(res.meta?.total || 0)
    } catch {
      toast('Erro ao carregar agendamentos', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    api.get('/api/profissionais').then((r) => setProfissionais(r.dados || r.profissionais || []))
  }, [])

  useEffect(() => {
    setPagina(1)
  }, [buscaDebounced, filtroStatus, filtroProfissional])

  useEffect(() => { carregarAgendamentos() }, [pagina, filtroStatus, filtroProfissional, buscaDebounced])

  const executarAcao = async (acao, id) => {
    if (acao === 'cancelar') {
      setConfirmar({
        titulo: 'Cancelar agendamento',
        mensagem: 'Tem certeza? O cliente será notificado via WhatsApp.',
        labelConfirmar: 'Cancelar agendamento',
        onConfirmar: async () => {
          setConfirmar(null)
          try {
            await api.patch(`/api/agendamentos/${id}/cancelar`, {})
            toast('Agendamento cancelado.', 'aviso')
            carregarAgendamentos()
          } catch (e) {
            toast(e?.erro?.mensagem || 'Erro ao cancelar', 'erro')
          }
        },
      })
      return
    }
    try {
      await api.patch(`/api/agendamentos/${id}/${acao}`, {})
      toast(
        acao === 'confirmar'
          ? 'Agendamento confirmado!'
          : acao === 'confirmar-presenca'
          ? 'Presença confirmada!'
          : 'Agendamento concluído!',
        'sucesso'
      )
      carregarAgendamentos()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao executar ação', 'erro')
    }
  }

  const totalPaginas = Math.ceil(total / limite)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Agendamentos</h1>
        <p className="text-texto-sec text-sm mt-0.5">Todos os agendamentos do seu negócio</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-borda p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-sec pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-borda rounded-xl focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
        </div>
        <Select value={filtroStatus || '__todos__'} onValueChange={(v) => setFiltroStatus(v === '__todos__' ? '' : v)}>
          <SelectTrigger className="w-auto min-w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os status</SelectItem>
            {Object.entries(statusAgendamento).map(([val, cfg]) => (
              <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroProfissional || '__todos__'} onValueChange={(v) => setFiltroProfissional(v === '__todos__' ? '' : v)}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os profissionais</SelectItem>
            {profissionais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {total > 0 && (
          <span className="text-xs text-texto-sec ml-auto">{total} resultado{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Cards mobile (< md) */}
      <div className="md:hidden space-y-3">
        {carregando ? (
          [1, 2, 3].map((i) => <div key={i} className="h-32 bg-white rounded-2xl border border-borda animate-pulse" />)
        ) : agendamentos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-borda p-10 text-center shadow-sm">
            <AlertCircle size={32} className="text-borda mx-auto mb-2" />
            <p className="text-sm text-texto-sec">Nenhum agendamento encontrado</p>
          </div>
        ) : (
          agendamentos.map((ag) => (
            <CardAgendamento
              key={ag.id}
              ag={ag}
              onAcao={executarAcao}
              exigirConfirmacaoPresenca={tenant?.exigirConfirmacaoPresenca}
            />
          ))
        )}
      </div>

      {/* Tabela desktop (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-borda bg-fundo">
                {['Data/Hora', 'Cliente', 'Profissional', 'Serviço', 'Valor', 'Status', 'Nota', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-texto-sec uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-borda animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-borda rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : agendamentos.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-texto-sec text-sm">
                  Nenhum agendamento encontrado para os filtros selecionados
                </td></tr>
              ) : (
                agendamentos.map((ag) => {
                  const statusCfg = statusAgendamento[ag.status]
                  return (
                    <tr key={ag.id} className="border-b border-borda hover:bg-fundo/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-texto whitespace-nowrap">{formatarDataHora(ag.inicioEm)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AvatarPessoa pessoa={ag.cliente} tamanho="xs" />
                          <div>
                            <span className="text-sm text-texto">{ag.cliente?.nome}</span>
                            {clientePresente(ag) && (
                              <p className="text-[11px] text-green-700">Chegou às {formatarHora(ag.presencaConfirmadaEm)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-texto">{ag.profissional?.nome}</td>
                      <td className="px-4 py-3 text-sm text-texto">{ag.servico?.nome}</td>
                      <td className="px-4 py-3 text-sm font-medium text-sucesso whitespace-nowrap">
                        {ag.servico?.precoCentavos ? formatarMoeda(ag.servico.precoCentavos) : <span className="text-texto-ter">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', statusCfg?.cor)}>
                          {statusCfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ag.feedbackNota ? (
                          <span className="flex items-center gap-1 text-yellow-500 text-sm font-semibold">
                            <Star size={13} className="fill-yellow-500" /> {ag.feedbackNota}
                          </span>
                        ) : <span className="text-texto-ter text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ag.status === 'AGENDADO' && (
                            <button onClick={() => executarAcao('confirmar', ag.id)}
                              className="px-2.5 py-1 rounded-lg bg-sucesso/10 text-sucesso text-xs font-semibold hover:bg-sucesso/20 transition-colors">
                              Confirmar agenda
                            </button>
                          )}
                          {!clientePresente(ag) && ['AGENDADO', 'CONFIRMADO'].includes(ag.status) && (
                            <button onClick={() => executarAcao('confirmar-presenca', ag.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors">
                              Cliente chegou
                            </button>
                          )}
                          {['AGENDADO', 'CONFIRMADO'].includes(ag.status) && (
                            <>
                              <button onClick={() => executarAcao('concluir', ag.id)}
                                disabled={tenant?.exigirConfirmacaoPresenca && !clientePresente(ag)}
                                className="px-2.5 py-1 rounded-lg bg-primaria/10 text-primaria text-xs font-semibold hover:bg-primaria/20 transition-colors disabled:opacity-50">
                                Concluir
                              </button>
                              <button onClick={() => executarAcao('cancelar', ag.id)}
                                className="px-2.5 py-1 rounded-lg bg-perigo/8 text-perigo text-xs font-semibold hover:bg-perigo/15 transition-colors">
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-borda">
            <p className="text-xs text-texto-sec">
              {(pagina - 1) * limite + 1}–{Math.min(pagina * limite, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 1}
                className="p-1.5 rounded-lg border border-borda disabled:opacity-40 hover:bg-fundo transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-texto">{pagina} / {totalPaginas}</span>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina >= totalPaginas}
                className="p-1.5 rounded-lg border border-borda disabled:opacity-40 hover:bg-fundo transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmar && (
        <ModalConfirmar
          {...confirmar}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}

export default Agendamentos

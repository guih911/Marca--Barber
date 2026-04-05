import { useState, useEffect, useRef } from 'react'
import { Plus, X, Loader2, Clock, Wrench, User, CalendarX, Pencil, Scissors, Camera, Percent } from 'lucide-react'
import api from '../../servicos/api'
import { cn, obterIniciais, diasSemana } from '../../lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import useAuth from '../../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const ModalAusencia = ({ profissional, onFechar }) => {
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  const registrar = async () => {
    if (!data) return
    setSalvando(true)
    setErro('')
    try {
      const res = await api.post(`/api/profissionais/${profissional.id}/ausencia`, { data, motivo: motivo || undefined })
      setResultado(res.dados)
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível registrar a ausência.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-borda">
          <h3 className="font-semibold text-texto">Registrar Ausência</h3>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>
        <div className="p-5 space-y-4">
          {resultado ? (
            <div className="text-center py-4">
              <CalendarX size={40} className="text-alerta mx-auto mb-3" />
              <p className="font-medium text-texto">{resultado.cancelados} {resultado.cancelados === 1 ? 'agendamento cancelado' : 'agendamentos cancelados'}</p>
              <p className="text-sm text-texto-sec mt-1">{resultado.clientesNotificados} {resultado.clientesNotificados === 1 ? 'cliente notificado' : 'clientes notificados'} via WhatsApp</p>
              <button onClick={onFechar} className="mt-4 bg-primaria text-white px-6 py-2 rounded-lg text-sm font-medium">Fechar</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-texto-sec">
                Todos os agendamentos de <span className="font-medium text-texto">{profissional.nome}</span> na data selecionada serão cancelados e os clientes notificados.
              </p>
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">Data da ausência</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">Motivo (opcional)</label>
                <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Consulta médica" className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onFechar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm hover:text-texto transition-colors">Cancelar</button>
                <button
                  onClick={registrar}
                  disabled={!data || salvando}
                  className="flex-1 bg-perigo hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {salvando && <Loader2 size={16} className="animate-spin" />}
                  Registrar
                </button>
              </div>
              {erro && (
                <p className="text-xs text-perigo">{erro}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PainelProfissional = ({ profissional, servicos, planoSolo = false, onFechar, onSalvar }) => {
  const [aba, setAba] = useState('dados')
  const [dados, setDados] = useState({
    nome: profissional.nome || '',
    email: profissional.email || '',
    telefone: profissional.telefone || '',
    bufferMinutos: profissional.bufferMinutos || 0,
  })
  const [avatarUrl, setAvatarUrl] = useState(profissional.avatarUrl || '')
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const inputFotoRef = useRef(null)
  const [horario, setHorario] = useState(profissional.horarioTrabalho || {})
  const [servicosSelecionados, setServicosSelecionados] = useState(
    profissional.servicos?.map((ps) => ({ servicoId: ps.servicoId || ps.servico?.id, duracaoCustom: ps.duracaoCustom, precoCustom: ps.precoCustom, comissaoPercent: ps.comissaoPercent ?? null })) || []
  )
  const [comissaoPadrao, setComissaoPadrao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mostrarAusencia, setMostrarAusencia] = useState(false)
  const abasRenderizadas = planoSolo
    ? [['dados', 'Dados', User], ['horarios', 'Hor\u00e1rios', Clock], ['servicos', 'Servi\u00e7os', Wrench]]
    : [['dados', 'Dados', User], ['horarios', 'Hor\u00e1rios', Clock], ['servicos', 'Servi\u00e7os', Wrench], ['comissoes', 'Comiss\u00f5es', Percent]]

  useEffect(() => {
    if (planoSolo && aba === 'comissoes') setAba('dados')
  }, [aba, planoSolo])

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !profissional.id) return
    setUploadandoFoto(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const json = await api.upload(`/api/profissionais/${profissional.id}/avatar`, formData)
      if (json?.sucesso) setAvatarUrl(json.dados.avatarUrl)
    } catch (e) {
      console.error('Erro ao fazer upload:', e)
    } finally {
      setUploadandoFoto(false)
    }
  }

  const salvarDados = async () => {
    setSalvando(true)
    try {
      await api.patch(`/api/profissionais/${profissional.id}`, { ...dados, horarioTrabalho: horario })
      onSalvar()
    } finally {
      setSalvando(false)
    }
  }

  const salvarServicos = async () => {
    setSalvando(true)
    try {
      await api.post(`/api/profissionais/${profissional.id}/servicos`, { servicos: servicosSelecionados })
      onSalvar()
    } finally {
      setSalvando(false)
    }
  }

  const salvarComissoes = async () => {
    setSalvando(true)
    try {
      if (comissaoPadrao !== '') {
        await api.patch(`/api/comissoes/profissionais/${profissional.id}/padrao`, { comissaoPercent: parseFloat(comissaoPadrao) || 0 })
      }
      const porServico = servicosSelecionados.filter((ss) => ss.comissaoPercent !== null && ss.comissaoPercent !== undefined && ss.comissaoPercent !== '')
      await Promise.all(porServico.map((ss) =>
        api.patch(`/api/comissoes/profissionais/${profissional.id}/servicos/${ss.servicoId}`, { comissaoPercent: parseFloat(ss.comissaoPercent) || 0 })
      ))
      onSalvar()
    } finally {
      setSalvando(false)
    }
  }

  const toggleDia = (dia) => {
    setHorario((h) => ({
      ...h,
      [dia]: { ...h[dia], ativo: !h[dia]?.ativo, inicio: h[dia]?.inicio || '09:00', fim: h[dia]?.fim || '18:00', intervalos: h[dia]?.intervalos || [] },
    }))
  }

  const atualizarHoraDia = (dia, campo, valor) => {
    setHorario((h) => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }))
  }

  const adicionarIntervalo = (dia) => {
    setHorario((h) => ({
      ...h,
      [dia]: { ...h[dia], intervalos: [...(h[dia]?.intervalos || []), { inicio: '12:00', fim: '13:00' }] },
    }))
  }

  const removerIntervalo = (dia, idx) => {
    setHorario((h) => ({
      ...h,
      [dia]: { ...h[dia], intervalos: (h[dia]?.intervalos || []).filter((_, i) => i !== idx) },
    }))
  }

  const atualizarIntervalo = (dia, idx, campo, valor) => {
    setHorario((h) => {
      const intervalos = [...(h[dia]?.intervalos || [])]
      intervalos[idx] = { ...intervalos[idx], [campo]: valor }
      return { ...h, [dia]: { ...h[dia], intervalos } }
    })
  }

  const toggleServico = (servicoId) => {
    setServicosSelecionados((prev) => {
      const existe = prev.find((s) => s.servicoId === servicoId)
      if (existe) return prev.filter((s) => s.servicoId !== servicoId)
      return [...prev, { servicoId }]
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-borda shrink-0">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`}
                alt={profissional.nome}
                className="w-12 h-12 rounded-full object-cover border-2 border-borda"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primaria/20 flex items-center justify-center font-bold text-primaria text-lg">
                {obterIniciais(profissional.nome)}
              </div>
            )}
            {profissional.id && (
              <>
                <button
                  onClick={() => inputFotoRef.current?.click()}
                  disabled={uploadandoFoto}
                  className="absolute inset-0 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Trocar foto"
                >
                  {uploadandoFoto ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                </button>
                <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} />
              </>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-texto">{profissional.nome || 'Novo Profissional'}</h3>
            <p className="text-xs text-texto-sec">{profissional.email || 'Sem e-mail'}</p>
            {profissional.id && <p className="text-[10px] text-texto-sec mt-0.5">Passe o mouse na foto para trocar</p>}
          </div>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-borda shrink-0">
          {abasRenderizadas.map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => setAba(val)}
              className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 -mb-px', aba === val ? 'border-primaria text-primaria' : 'border-transparent text-texto-sec hover:text-texto')}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {aba === 'dados' && (
            <div className="space-y-4">
              {[['Nome', 'nome', 'text'], ['E-mail', 'email', 'email'], ['Telefone', 'telefone', 'tel']].map(([label, campo, tipo]) => (
                <div key={campo}>
                  <label className="block text-sm font-medium text-texto mb-1.5">{label}</label>
                  <input type={tipo} value={dados[campo]} onChange={(e) => setDados((p) => ({ ...p, [campo]: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-texto mb-1.5">Buffer entre atendimentos</label>
                <Select value={String(dados.bufferMinutos)} onValueChange={(v) => setDados((p) => ({ ...p, bufferMinutos: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sem buffer</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="10">10 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {aba === 'horarios' && (
            <div className="space-y-3">
              {diasSemana.map((dia) => {
                const config = horario[dia.numero] || { ativo: false }
                return (
                  <div key={dia.numero} className={cn('rounded-xl border p-3 transition-colors', config.ativo ? 'border-primaria/30 bg-primaria-clara/20' : 'border-borda')}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleDia(dia.numero)}
                        className={cn('w-10 h-6 rounded-full transition-colors relative shrink-0', config.ativo ? 'bg-primaria' : 'bg-borda')}
                      >
                        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', config.ativo ? 'left-4' : 'left-0.5')} />
                      </button>
                      <span className={cn('text-sm font-medium min-w-16', config.ativo ? 'text-texto' : 'text-texto-sec')}>{dia.label}</span>
                      {config.ativo && (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={config.inicio || '09:00'} onChange={(e) => atualizarHoraDia(dia.numero, 'inicio', e.target.value)} className="px-2 py-1 rounded border border-borda text-sm" />
                          <span className="text-texto-sec text-sm">às</span>
                          <input type="time" value={config.fim || '18:00'} onChange={(e) => atualizarHoraDia(dia.numero, 'fim', e.target.value)} className="px-2 py-1 rounded border border-borda text-sm" />
                        </div>
                      )}
                    </div>
                    {config.ativo && (
                      <div className="mt-2 pl-13 space-y-1.5">
                        {(config.intervalos || []).map((intv, idx) => (
                          <div key={idx} className="flex items-center gap-2 pl-[52px]">
                            <span className="text-[11px] text-texto-sec shrink-0">Pausa</span>
                            <input type="time" value={intv.inicio} onChange={(e) => atualizarIntervalo(dia.numero, idx, 'inicio', e.target.value)} className="px-2 py-1 rounded border border-borda text-xs" />
                            <span className="text-texto-sec text-xs">–</span>
                            <input type="time" value={intv.fim} onChange={(e) => atualizarIntervalo(dia.numero, idx, 'fim', e.target.value)} className="px-2 py-1 rounded border border-borda text-xs" />
                            <button onClick={() => removerIntervalo(dia.numero, idx)} className="text-red-400 hover:text-red-600 ml-1"><X size={12} /></button>
                          </div>
                        ))}
                        <button onClick={() => adicionarIntervalo(dia.numero)} className="pl-[52px] text-xs text-primaria hover:underline">+ pausa</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {aba === 'comissoes' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-texto mb-1">% padrão para todos os serviços</p>
                <p className="text-xs text-texto-sec mb-2">Aplica um percentual base. Pode ser sobrescrito por serviço abaixo.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={comissaoPadrao}
                    onChange={(e) => setComissaoPadrao(e.target.value)}
                    placeholder="Ex: 40"
                    className="w-24 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                  <span className="text-sm text-texto-sec">%</span>
                </div>
              </div>
              {servicosSelecionados.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-texto mb-2">% por serviço (opcional — sobrescreve o padrão)</p>
                  <div className="space-y-2">
                    {servicosSelecionados.map((ss) => {
                      const servico = servicos.find((s) => s.id === ss.servicoId)
                      if (!servico) return null
                      return (
                        <div key={ss.servicoId} className="flex items-center gap-3 p-3 rounded-xl border border-borda">
                          <span className="flex-1 text-sm text-texto">{servico.nome}</span>
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={ss.comissaoPercent ?? ''}
                            onChange={(e) => setServicosSelecionados((prev) => prev.map((s) => s.servicoId === ss.servicoId ? { ...s, comissaoPercent: e.target.value } : s))}
                            placeholder="—"
                            className="w-20 border border-borda rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primaria/30"
                          />
                          <span className="text-sm text-texto-sec w-4">%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {servicosSelecionados.length === 0 && (
                <p className="text-sm text-texto-sec">Nenhum serviço vinculado. Adicione serviços na aba "Serviços" primeiro.</p>
              )}
            </div>
          )}

          {aba === 'servicos' && (
            <div className="space-y-2">
              <p className="text-sm text-texto-sec mb-3">Selecione os serviços que este profissional realiza:</p>
              {servicos.map((s) => {
                const selecionado = servicosSelecionados.some((ss) => ss.servicoId === s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleServico(s.id)}
                    className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all', selecionado ? 'border-primaria bg-primaria-clara/30' : 'border-borda hover:border-primaria/40')}
                  >
                    <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors', selecionado ? 'bg-primaria border-primaria' : 'border-borda')}>
                      {selecionado && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-texto">{s.nome}</p>
                      <p className="text-xs text-texto-sec">{s.duracaoMinutos}min</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-borda shrink-0 space-y-2">
          <div className="flex gap-3">
            <button onClick={onFechar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm hover:text-texto transition-colors">Fechar</button>
            <button
              onClick={aba === 'servicos' ? salvarServicos : aba === 'comissoes' ? salvarComissoes : salvarDados}
              disabled={salvando}
              className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {salvando && <Loader2 size={16} className="animate-spin" />}
              Salvar
            </button>
          </div>
          {profissional.id && (
            <button
              onClick={() => setMostrarAusencia(true)}
              className="w-full border border-perigo/40 text-perigo hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CalendarX size={15} /> Registrar Ausência
            </button>
          )}
        </div>
      </div>

      {mostrarAusencia && (
        <ModalAusencia profissional={profissional} onFechar={() => setMostrarAusencia(false)} />
      )}
    </div>
  )
}

const ConfigProfissionais = () => {
  const { tenant } = useAuth()
  const planoSolo = tenant?.planoContratado === 'SOLO'
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = async () => {
    setCarregando(true)
    const [p, s] = await Promise.all([api.get('/api/profissionais'), api.get('/api/servicos')])
    setProfissionais(p.dados)
    setServicos(s.dados)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])
  const profissionaisAtivos = profissionais.filter((profissional) => profissional.ativo !== false)

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Profissionais</h1>
          <p className="text-texto-sec text-sm mt-1">Gerencie a equipe da barbearia</p>
        </div>
        {planoSolo && profissionaisAtivos.length >= 1 ? (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs font-medium">
            <Scissors size={13} /> Plano Solo — 1 profissional
          </div>
        ) : (
          <button onClick={() => setMostrarNovo(true)} className="bg-primaria hover:bg-primaria-escura text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
            <Plus size={16} /> Novo Profissional
          </button>
        )}
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl border border-borda p-5 animate-pulse h-40" />)}
        </div>
      ) : profissionais.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda p-12 text-center">
          <p className="text-texto-sec mb-4">Nenhum profissional cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profissionais.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelecionado(p)}
              className="group bg-white rounded-2xl border border-borda p-5 shadow-sm hover:border-primaria/50 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden border-2 border-borda">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl.startsWith('http') ? p.avatarUrl : `${API_URL}${p.avatarUrl}`}
                      alt={p.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primaria/20 flex items-center justify-center font-bold text-primaria text-lg">
                      {obterIniciais(p.nome)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-texto text-sm truncate">{p.nome}</p>
                  <p className="text-xs text-texto-sec truncate">{p.email || 'Sem e-mail'}</p>
                </div>
                <Pencil size={14} className="text-texto-sec/50 shrink-0 ml-2 group-hover:text-primaria transition-colors" />
              </div>
              {p.servicos?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.servicos.slice(0, 3).map((ps) => (
                    <span key={ps.id} className="px-2 py-0.5 bg-primaria-clara text-primaria text-[11px] rounded-full font-medium">
                      {ps.servico?.nome}
                    </span>
                  ))}
                  {p.servicos.length > 3 && <span className="text-xs text-texto-sec">+{p.servicos.length - 3}</span>}
                </div>
              )}
              <div className="mt-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <PainelProfissional
          profissional={selecionado}
          servicos={servicos}
          planoSolo={planoSolo}
          onFechar={() => setSelecionado(null)}
          onSalvar={() => { carregar(); setSelecionado(null) }}
        />
      )}

      {mostrarNovo && (
        <PainelProfissional
          profissional={{ nome: '', servicos: [], horarioTrabalho: {} }}
          servicos={servicos}
          planoSolo={planoSolo}
          onFechar={() => setMostrarNovo(false)}
          onSalvar={() => { carregar(); setMostrarNovo(false) }}
        />
      )}
    </div>
  )
}

export default ConfigProfissionais

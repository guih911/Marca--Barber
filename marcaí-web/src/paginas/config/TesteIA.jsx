import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  RotateCcw,
  ArrowLeft,
  Bot,
  User,
  Loader2,
  Info,
  CheckCheck,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'

const DICAS = [
  'Quero marcar um corte para amanha',
  'Que horarios tem disponivel no sabado?',
  'Quanto custa corte e barba?',
  'Quero cancelar meu agendamento',
  'Voces cortam cabelo infantil?',
  'Quero saber sobre o plano mensal',
]

const PERFIS_TESTE = [
  {
    id: 'NOVO_LEAD',
    label: 'Novo lead',
    descricao: 'Sem nome salvo, numero normal.',
    payload: { telefone: '+5511900000001', nome: '' },
  },
  {
    id: 'LEAD_LID',
    label: 'Lead com LID',
    descricao: 'Simula o caso do WhatsApp sem numero real.',
    payload: { telefone: '120363267180894554', nome: '', lidWhatsapp: '120363267180894554' },
  },
  {
    id: 'CLIENTE_CONHECIDO',
    label: 'Cliente conhecido',
    descricao: 'Ja entra com nome salvo no cadastro.',
    payload: { telefone: '+5511900000002', nome: 'Matheus' },
  },
  {
    id: 'BARBEIRO_AVALIANDO',
    label: 'Barbeiro avaliando',
    descricao: 'Modo demo para dono ou barbeiro.',
    payload: { telefone: '+5511900000003', nome: 'Carlos' },
  },
]

const MAPA_ALERTAS = {
  sem_resposta: 'Sem resposta',
  mensagem_longa: 'Mensagem longa',
  frase_robotica: 'Frase robotica',
  pergunta_desnecessaria: 'Pergunta desnecessaria',
  fallback_intencao_clara: 'Fallback em intencao clara',
  pediu_telefone_cedo: 'Pediu telefone cedo',
  mandou_link_cedo: 'Mandou link cedo',
  nao_reconheceu_urgencia: 'Nao reconheceu urgencia',
  nao_tratou_preco: 'Nao tratou preco',
  nao_respondeu_pagamento: 'Nao respondeu pagamento',
  identidade_opaca: 'Identidade opaca',
  modo_barbeiro_fraco: 'Modo barbeiro fraco',
  resposta_vaga_apos_nome: 'Resposta vaga apos nome',
  nao_mandou_link_agenda: 'Nao mandou link da agenda',
  inventou_produto: 'Inventou produto',
  produto_mal_interpretado: 'Produto mal interpretado',
  inventou_combo: 'Inventou combo',
  inventou_plano: 'Inventou plano',
  consultoria_fraca: 'Consultoria fraca',
  insistiu_venda: 'Insistiu venda',
}

const formatarHora = (ts) =>
  ts instanceof Date ? ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

const formatarTituloCenario = (nome = '') =>
  nome
    .split('_')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ')

const TesteIA = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resetando, setResetando] = useState(false)
  const [rodandoSuite, setRodandoSuite] = useState(false)
  const [conversaId, setConversaId] = useState(null)
  const [perfilTeste, setPerfilTeste] = useState('NOVO_LEAD')
  const [resultadoSuite, setResultadoSuite] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const perfilAtual = PERFIS_TESTE.find((perfil) => perfil.id === perfilTeste) || PERFIS_TESTE[0]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando])

  const obterPayloadPerfil = (perfilId = perfilTeste) =>
    PERFIS_TESTE.find((perfil) => perfil.id === perfilId)?.payload || PERFIS_TESTE[0].payload

  const trocarPerfil = (perfilId) => {
    setPerfilTeste(perfilId)
    setMensagens([])
    setConversaId(null)
  }

  const enviar = async (msgTexto) => {
    const conteudo = (msgTexto || texto).trim()
    if (!conteudo || enviando) return

    setTexto('')
    setMensagens((prev) => [...prev, { de: 'usuario', conteudo, ts: new Date() }])
    setEnviando(true)

    try {
      const res = await api.post('/api/ia/teste', {
        mensagem: conteudo,
        ...obterPayloadPerfil(),
      })

      const dados = res.dados
      if (dados?.conversaId) setConversaId(dados.conversaId)

      const resposta = dados?.resposta || '(sem resposta)'
      setMensagens((prev) => [...prev, { de: 'don', conteudo: resposta, ts: new Date() }])
    } catch {
      setMensagens((prev) => [
        ...prev,
        { de: 'don', conteudo: 'Erro ao processar. Verifique se a API esta rodando.', ts: new Date(), erro: true },
      ])
    } finally {
      setEnviando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const resetar = async () => {
    if (resetando) return
    setResetando(true)

    try {
      await api.post('/api/ia/teste/resetar', obterPayloadPerfil())
      setMensagens([])
      setConversaId(null)
      toast('Sessao de teste resetada. Comeca do zero!', 'sucesso')
    } catch {
      toast('Erro ao resetar a sessao.', 'erro')
    } finally {
      setResetando(false)
    }
  }

  const rodarSuite = async () => {
    if (rodandoSuite) return
    setRodandoSuite(true)

    try {
      const res = await api.post('/api/ia/teste/suite')
      setResultadoSuite(res.dados)
      toast(`Bateria concluida com ${res.dados?.resumo?.totalAlertas || 0} alerta(s).`, 'sucesso')
    } catch {
      toast('Erro ao rodar a bateria da IA.', 'erro')
    } finally {
      setRodandoSuite(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-5xl mx-auto gap-4">
      <div className="bg-[#1a1f2e] text-white px-4 py-3 flex items-center gap-3 shrink-0 rounded-t-2xl shadow">
        <button
          onClick={() => navigate('/config/ia')}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="w-10 h-10 rounded-full bg-primaria/20 border-2 border-primaria flex items-center justify-center shrink-0">
          <Bot size={20} className="text-primaria" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">Don - Recepcionista IA</p>
          <p className="text-[11px] text-white/50 leading-tight">Fluxo real do WhatsApp com perfis e bateria de estresse</p>
        </div>

        <button
          onClick={rodarSuite}
          disabled={rodandoSuite}
          className="hidden md:flex items-center gap-1.5 text-[11px] text-white/75 hover:text-white bg-white/8 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {rodandoSuite ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
          Rodar bateria
        </button>

        <button
          onClick={resetar}
          disabled={resetando}
          title="Resetar sessao de teste"
          className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white bg-white/8 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {resetando ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          Resetar
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-2xl">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-[11px] text-amber-700 leading-snug">
              Este teste usa o fluxo <strong>real</strong>: o Don consulta horarios, usa ferramentas e pode criar agendamentos no banco.
              O perfil atual e <strong>{perfilAtual.label}</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              {PERFIS_TESTE.map((perfil) => (
                <button
                  key={perfil.id}
                  onClick={() => trocarPerfil(perfil.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] border transition-colors ${
                    perfil.id === perfilTeste
                      ? 'bg-amber-100 border-amber-400 text-amber-800'
                      : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400'
                  }`}
                >
                  {perfil.label}
                </button>
              ))}
              <button
                onClick={rodarSuite}
                disabled={rodandoSuite}
                className="md:hidden px-3 py-1.5 rounded-full text-[11px] border bg-white border-amber-200 text-amber-700 hover:border-amber-400 disabled:opacity-50"
              >
                {rodandoSuite ? 'Rodando...' : 'Rodar bateria'}
              </button>
            </div>
            <p className="text-[11px] text-amber-700/90">{perfilAtual.descricao}</p>
          </div>
        </div>
      </div>

      {resultadoSuite && (
        <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-borda flex items-center gap-2">
            <FlaskConical size={16} className="text-primaria" />
            <h2 className="text-sm font-semibold text-texto">Bateria Brasil real</h2>
          </div>

          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-borda bg-fundo/40">
            <div className="rounded-xl border border-borda bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-texto-sec">Cenarios</p>
              <p className="text-lg font-semibold text-texto">{resultadoSuite.resumo?.cenariosExecutados || 0}</p>
            </div>
            <div className="rounded-xl border border-borda bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-texto-sec">Turnos</p>
              <p className="text-lg font-semibold text-texto">{resultadoSuite.resumo?.totalTurnos || 0}</p>
            </div>
            <div className="rounded-xl border border-borda bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-texto-sec">Alertas</p>
              <p className="text-lg font-semibold text-amber-700">{resultadoSuite.resumo?.totalAlertas || 0}</p>
            </div>
            <div className="rounded-xl border border-borda bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-texto-sec">Sucesso</p>
              <p className="text-lg font-semibold text-sucesso">{resultadoSuite.resumo?.taxaSucesso || 0}%</p>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
            {resultadoSuite.resultados?.map((cenario) => {
              const alertas = Array.from(new Set((cenario.respostas || []).flatMap((resposta) => resposta.alertas || [])))
              const temErro = Boolean(cenario.erro)

              return (
                <div key={cenario.nome} className="rounded-2xl border border-borda p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-texto">{formatarTituloCenario(cenario.nome)}</p>
                      <p className="text-[11px] text-texto-sec mt-0.5">{cenario.perfil}</p>
                    </div>
                    <div className={`text-[11px] px-2.5 py-1 rounded-full ${
                      temErro
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : alertas.length > 0
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {temErro ? 'Erro' : alertas.length > 0 ? `${alertas.length} alerta(s)` : 'Sem alertas'}
                    </div>
                  </div>

                  {temErro ? (
                    <div className="mt-2 flex items-start gap-2 text-sm text-red-700">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <p>{cenario.erro}</p>
                    </div>
                  ) : (
                    <>
                      {alertas.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {alertas.map((alerta) => (
                            <span key={alerta} className="text-[11px] px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                              {MAPA_ALERTAS[alerta] || alerta}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 space-y-1.5">
                        {(cenario.respostas || []).slice(0, 2).map((resposta, index) => (
                          <div key={`${cenario.nome}-${index}`} className="text-[12px] leading-snug">
                            <p className="text-texto-sec">Cliente: {resposta.cliente}</p>
                            <p className="text-texto">Don: {resposta.ia}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-borda shadow-sm overflow-hidden flex flex-col">
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
          style={{ background: 'linear-gradient(to bottom, #f0f4ff 0%, #e8f0fe 100%)' }}
        >
          {mensagens.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primaria/10 border-2 border-primaria/20 flex items-center justify-center mx-auto mb-4">
                <Bot size={28} className="text-primaria" />
              </div>
              <p className="text-texto font-semibold mb-1">Teste o Don ao vivo</p>
              <p className="text-texto-sec text-sm mb-2">Converse com o perfil selecionado como se fosse um cliente real</p>
              <p className="text-texto-sec text-xs mb-6">{perfilAtual.label}: {perfilAtual.descricao}</p>

              <div className="flex flex-wrap gap-2 justify-center">
                {DICAS.map((dica) => (
                  <button
                    key={dica}
                    onClick={() => enviar(dica)}
                    className="text-xs bg-white border border-borda text-texto-sec hover:text-primaria hover:border-primaria px-3 py-1.5 rounded-full transition-colors shadow-sm"
                  >
                    {dica}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((msg, i) => (
            <div key={i} className={`flex ${msg.de === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              {msg.de === 'don' && (
                <div className="w-7 h-7 rounded-full bg-primaria/15 border border-primaria/25 flex items-center justify-center shrink-0 mr-1.5 mt-auto mb-1">
                  <Bot size={13} className="text-primaria" />
                </div>
              )}
              <div
                className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                  msg.de === 'usuario'
                    ? 'bg-primaria text-white rounded-tr-sm'
                    : msg.erro
                    ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
                    : 'bg-white border border-borda text-texto rounded-tl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap leading-snug">{msg.conteudo}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 ${msg.de === 'usuario' ? 'text-white/60' : 'text-texto-sec'}`}>
                  <span className="text-[10px]">{formatarHora(msg.ts)}</span>
                  {msg.de === 'usuario' && <CheckCheck size={12} />}
                </div>
              </div>
              {msg.de === 'usuario' && (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 ml-1.5 mt-auto mb-1">
                  <User size={13} className="text-gray-500" />
                </div>
              )}
            </div>
          ))}

          {enviando && (
            <div className="flex justify-start items-end gap-1.5">
              <div className="w-7 h-7 rounded-full bg-primaria/15 border border-primaria/25 flex items-center justify-center shrink-0">
                <Bot size={13} className="text-primaria" />
              </div>
              <div className="bg-white border border-borda px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '160ms' }} />
                  <div className="w-2 h-2 bg-texto-sec/60 rounded-full animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="bg-white border-t border-borda px-4 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Digite como se fosse o cliente..."
              rows={1}
              className="flex-1 px-4 py-2.5 border border-borda rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primaria/30 max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => enviar()}
              disabled={enviando || !texto.trim()}
              className="bg-primaria hover:bg-primaria-escura disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shrink-0"
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-texto-sec mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nova linha
            {conversaId && <span className="ml-1">· conversa #{conversaId.slice(-6)}</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TesteIA

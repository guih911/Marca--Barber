import { useState, useEffect } from 'react'
import { Loader2, Save, Link2, MessageCircle, Bell, Info, Wand2 } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import useAuth from '../../hooks/useAuth'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'

const TOM_OPCOES = [
  { valor: 'ACOLHEDOR', label: 'Acolhedor' },
  { valor: 'DESCONTRALIDO', label: 'Descontraído' },
  { valor: 'FORMAL', label: 'Formal' },
]

const chavesLembrete = [
  {
    chave: 'lembreteDiaAnterior',
    titulo: 'Lembrete com 24h ou mais de antecedência',
    desc: 'Usado quando em Meu Negócio o lembrete cair 1 dia ou mais antes (ex. 1440 min). Cada janela continua vindo de lá.',
  },
  {
    chave: 'lembreteNoDia',
    titulo: 'Lembretes no mesmo dia (Meu Negócio)',
    desc: 'Um único texto para todas as antecedências de menos de 24h (30 min, 2h, etc.) e para a confirmação extra de ~1h quando não houver nenhum lembrete listado no painel.',
  },
]

const chavesCard = [
  { chave: 'cardComAgendamentoFuturo', titulo: 'Card: já tem horário futuro' },
  { chave: 'cardRecorrente', titulo: 'Card: cliente recorrente (sem agendamento futuro)' },
  { chave: 'cardNovoCliente', titulo: 'Card: cliente novo' },
]

const placeLembretes = '{saudacao} {salao} {data} {hora} {servico} {nome}'

const CAMPOS_FORM = new Set(['mensagemBoasVindas', 'mensagemForaHorario', 'mensagemRetorno'])
const CHAVES_CONFIG_DON_PERMITIDAS = new Set([
  'lembreteDiaAnterior',
  'lembreteNoDia',
  'cardComAgendamentoFuturo',
  'cardRecorrente',
  'cardNovoCliente',
])

const ConfigDonBarber = () => {
  const toast = useToast()
  const { carregarTenant } = useAuth()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [gerandoSugestao, setGerandoSugestao] = useState(null)
  const [form, setForm] = useState({
    tomDeVoz: 'ACOLHEDOR',
    nomeIA: '',
    apresentacaoSalaoAtivo: true,
    iaIncluirLinkAgendamento: true,
    antecedenciaCancelar: 0,
    mensagemBoasVindas: '',
    mensagemForaHorario: '',
    mensagemRetorno: '',
    configMensagensDon: {
      lembreteDiaAnterior: '',
      lembreteNoDia: '',
      cardComAgendamentoFuturo: '',
      cardRecorrente: '',
      cardNovoCliente: '',
    },
  })

  useEffect(() => {
    api
      .get('/api/tenants/meu')
      .then((res) => {
        const t = res.dados || {}
        const m = t.configMensagensDon && typeof t.configMensagensDon === 'object' ? t.configMensagensDon : {}
        setForm((prev) => ({
          ...prev,
          tomDeVoz: t.tomDeVoz || 'ACOLHEDOR',
          nomeIA: t.nomeIA || '',
          apresentacaoSalaoAtivo: t.apresentacaoSalaoAtivo !== false,
          iaIncluirLinkAgendamento: t.iaIncluirLinkAgendamento !== false,
          antecedenciaCancelar: t.antecedenciaCancelar ?? 0,
          mensagemBoasVindas: t.mensagemBoasVindas || '',
          mensagemForaHorario: t.mensagemForaHorario || '',
          mensagemRetorno: t.mensagemRetorno || '',
          configMensagensDon: {
            ...prev.configMensagensDon,
          ...Object.fromEntries(Object.entries(m).filter(([k]) => CHAVES_CONFIG_DON_PERMITIDAS.has(k))),
          },
        }))
      })
      .catch(() => toast('Não foi possível carregar as configurações', 'erro'))
      .finally(() => setCarregando(false))
  }, [toast])

  const setCampo = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const setMsgDon = (chave, v) =>
    setForm((p) => ({ ...p, configMensagensDon: { ...p.configMensagensDon, [chave]: v } }))

  const sugerirComIa = async (campo) => {
    setGerandoSugestao(campo)
    try {
      const res = await api.post('/api/tenants/meu/sugerir-mensagem-don', { campo })
      const { texto, origem } = res.dados || {}
      if (typeof texto !== 'string') {
        toast('Resposta inválida do servidor', 'erro')
        return
      }
      if (CAMPOS_FORM.has(campo)) {
        setCampo(campo, texto)
      } else {
        setMsgDon(campo, texto)
      }
      if (origem === 'padrao') {
        toast('Padrão do sistema aplicado (texto original, como antes). Configure ANTHROPIC se quiser a IA ativa.', 'sucesso')
      } else {
        toast('Sugestão profissional gerada. Revise, ajuste se quiser e clique em Salvar.', 'sucesso')
      }
    } catch {
      toast('Não foi possível gerar a sugestão. Tente de novo.', 'erro')
    } finally {
      setGerandoSugestao(null)
    }
  }

  const BtnSugestao = ({ campo }) => (
    <button
      type="button"
      onClick={() => sugerirComIa(campo)}
      disabled={Boolean(gerandoSugestao)}
      className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-borda bg-fundo px-2.5 py-1.5 text-xs font-semibold text-texto hover:bg-sidebar-hover hover:border-primaria/40 disabled:opacity-50 transition-colors"
    >
      {gerandoSugestao === campo ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primaria" />
      ) : (
        <Wand2 className="w-3.5 h-3.5 text-primaria" />
      )}
      Sugerir com a IA
    </button>
  )

  const salvar = async () => {
    setSalvando(true)
    try {
      const payload = {
        tomDeVoz: form.tomDeVoz,
        nomeIA: form.nomeIA?.trim() || null,
        apresentacaoSalaoAtivo: form.apresentacaoSalaoAtivo,
        iaIncluirLinkAgendamento: form.iaIncluirLinkAgendamento,
        antecedenciaCancelar: Number(form.antecedenciaCancelar) || 0,
        mensagemBoasVindas: form.mensagemBoasVindas,
        mensagemForaHorario: form.mensagemForaHorario,
        mensagemRetorno: form.mensagemRetorno || null,
        configMensagensDon: Object.fromEntries(
          Object.entries(form.configMensagensDon)
            .filter(([k]) => CHAVES_CONFIG_DON_PERMITIDAS.has(k))
            .map(([k, v]) => [k, typeof v === 'string' ? v : ''])
        ),
      }
      await api.patch('/api/tenants/meu/configuracao-ia', payload)
      await carregarTenant()
      toast('Configurações do Don Barber salvas.', 'sucesso')
    } catch {
      toast('Erro ao salvar. Tente de novo.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-primaria animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-texto tracking-tight">Don Barber (IA)</h1>
        <p className="text-sm text-texto-sec mt-1">
          Textos usados no WhatsApp, lembretes e cards. O que você deixar vazio segue o padrão interno do sistema (o mesmo de
          antes). Em cada bloco, o botão “Sugerir com a IA” reescreve de forma profissional mantendo as variáveis{' '}
          <code className="text-[11px]">{'{...}'}</code>, com tom de referência no estilo do Alisson. Se a IA não estiver
          disponível, usamos o texto padrão original.
        </p>
      </div>

      <section className="rounded-2xl border border-borda bg-fundo-elev p-6 space-y-4">
        <div className="flex items-center gap-2 text-texto font-semibold">
          <MessageCircle className="w-5 h-5 text-primaria" />
          Identidade e tom
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-texto-sec">Nome do assistente</label>
            <input
              className="mt-1 w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
              value={form.nomeIA}
              onChange={(e) => setCampo('nomeIA', e.target.value)}
              placeholder="Ex.: Don Barber"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-texto-sec">Tom de voz</label>
            <Select value={form.tomDeVoz} onValueChange={(v) => setCampo('tomDeVoz', v)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOM_OPCOES.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-texto">Apresentar horário e diferenciais no primeiro card (novo cliente)</span>
          <button
            type="button"
            onClick={() => setCampo('apresentacaoSalaoAtivo', !form.apresentacaoSalaoAtivo)}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              form.apresentacaoSalaoAtivo ? 'bg-primaria' : 'bg-borda'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                form.apresentacaoSalaoAtivo ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </label>
        <div>
          <label className="text-xs font-medium text-texto-sec">Antecedência mínima para cancelar (horas, 0 = livre)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-32 rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
            value={form.antecedenciaCancelar}
            onChange={(e) => setCampo('antecedenciaCancelar', e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-borda bg-fundo-elev p-6 space-y-4">
        <div className="flex items-center gap-2 text-texto font-semibold">
          <Link2 className="w-5 h-5 text-primaria" />
          Link de agendamento
        </div>
        <p className="text-sm text-texto-sec">
          Se desligar, a IA não envia o link público da agenda, não chama a ferramenta de link e explica que o agendamento é
          feito no próprio chat.
        </p>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-texto">A IA pode enviar o link do agendamento</span>
          <button
            type="button"
            onClick={() => setCampo('iaIncluirLinkAgendamento', !form.iaIncluirLinkAgendamento)}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              form.iaIncluirLinkAgendamento ? 'bg-primaria' : 'bg-borda'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                form.iaIncluirLinkAgendamento ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </section>

      <section className="rounded-2xl border border-borda bg-fundo-elev p-6 space-y-4">
        <div className="text-texto font-semibold">Mensagens gerais (IA)</div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-texto-sec">Boas-vindas (meio do card, clientes recorrente/novo)</label>
            <BtnSugestao campo="mensagemBoasVindas" />
          </div>
          <p className="text-xs text-texto-sec mt-0.5">Inclua <code className="text-[11px]">{'{salao}'}</code> e <code className="text-[11px]">{'{nome}'}</code> na sugestão.</p>
          <textarea
            className="mt-1 w-full min-h-[88px] rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
            value={form.mensagemBoasVindas}
            onChange={(e) => setCampo('mensagemBoasVindas', e.target.value)}
            placeholder="Vazio = bloco padrão do card. Preenchido: substitui o trecho “Bem-vindo. Aqui você encontra…”"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-texto-sec">Fora do horário (instrução no cérebro da IA)</label>
            <BtnSugestao campo="mensagemForaHorario" />
          </div>
          <p className="text-xs text-texto-sec mt-0.5">Inclua <code className="text-[11px]">{'{salao}'}</code> e <code className="text-[11px]">{'{hora}'}</code> na sugestão.</p>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
            value={form.mensagemForaHorario}
            onChange={(e) => setCampo('mensagemForaHorario', e.target.value)}
            placeholder="Vazio = padrão interno. Preenchido: orienta a IA fora do expediente."
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-texto-sec">Retorno pós-serviço (cron)</label>
            <BtnSugestao campo="mensagemRetorno" />
          </div>
          <p className="text-xs text-texto-sec mt-0.5">
            Com texto fixo, o envio é literal (sem reescrever pela IA). Sugestão inclui:{' '}
            <code className="text-[11px] bg-fundo rounded px-1">{'{nome} {servico} {dias} {salao}'}</code>
          </p>
          <textarea
            className="mt-1 w-full min-h-[88px] rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
            value={form.mensagemRetorno}
            onChange={(e) => setCampo('mensagemRetorno', e.target.value)}
            placeholder="Ex.: Fala, {nome}! Já faz {dias} dias do teu {servico} no {salao} — bora agendar de novo?"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-borda bg-fundo-elev p-6 space-y-4">
        <div className="flex items-center gap-2 text-texto font-semibold">
          <Bell className="w-5 h-5 text-primaria" />
          Lembretes (WhatsApp)
        </div>
        <p className="text-xs text-texto-sec flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            A lista de horários (2h, 1 dia, etc.) fica em Meu Negócio — aqui você só ajusta o texto. Placeholders:{' '}
            {placeLembretes}. Vazio = padrão do sistema.
          </span>
        </p>
        {chavesLembrete.map(({ chave, titulo, desc }) => (
          <div key={chave}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-texto">{titulo}</label>
              <BtnSugestao campo={chave} />
            </div>
            <p className="text-xs text-texto-sec">{desc}</p>
            <textarea
              className="mt-1 w-full min-h-[120px] rounded-lg border border-borda bg-fundo px-3 py-2 text-sm font-mono"
              value={form.configMensagensDon[chave] || ''}
              onChange={(e) => setMsgDon(chave, e.target.value)}
            />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-borda bg-fundo-elev p-6 space-y-4">
        <div className="text-texto font-semibold">Cards iniciais (WhatsApp interativo)</div>
        <p className="text-xs text-texto-sec">
          Personalização completa por cenário. Placeholders:{' '}
          <code className="text-[11px] bg-fundo rounded px-1">
            {'{saudacao} {salao} {data} {hora} {horariosLinha} {diferenciaisLinha}'}
          </code>
          . Vazio = padrão.
        </p>
        {chavesCard.map(({ chave, titulo }) => (
          <div key={chave}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-texto">{titulo}</label>
              <BtnSugestao campo={chave} />
            </div>
            <textarea
              className="mt-1 w-full min-h-[140px] rounded-lg border border-borda bg-fundo px-3 py-2 text-sm font-mono"
              value={form.configMensagensDon[chave] || ''}
              onChange={(e) => setMsgDon(chave, e.target.value)}
            />
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primaria text-white text-sm font-semibold hover:bg-primaria-escura disabled:opacity-50"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </div>
  )
}

export default ConfigDonBarber

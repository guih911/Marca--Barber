import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Plus, Trash2, ChevronRight, ChevronLeft, Check,
  Scissors, Users, Zap, BarChart2, Star, Shield,
} from 'lucide-react'
import api from '../../servicos/api'
import useAuth from '../../hooks/useAuth'
import { segmentos, opcoesDuracao } from '../../lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'

const ESTADOS_BR = [
  { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' }, { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' }, { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' }, { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' }, { uf: 'MT', nome: 'Mato Grosso' }, { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' }, { uf: 'PA', nome: 'Pará' }, { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' }, { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' }, { uf: 'RN', nome: 'Rio Grande do Norte' }, { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' }, { uf: 'RR', nome: 'Roraima' }, { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' }, { uf: 'TO', nome: 'Tocantins' },
]

const formatarTelefone = (v) => {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 2) return nums.length ? `(${nums}` : ''
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

const formatarDinheiro = (v) => {
  const nums = v.replace(/\D/g, '')
  if (!nums) return ''
  const valor = (parseInt(nums, 10) / 100).toFixed(2)
  return 'R$ ' + valor.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ─── Barra de progresso ───────────────────────────────────────────────────────
const ProgressBar = ({ passo, total }) => {
  const labels = ['Negócio', 'Plano', 'Serviços', 'Equipe']
  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${i < passo ? 'bg-primaria' : 'bg-borda'}`} />
              <span className={`text-[10px] whitespace-nowrap ${i < passo ? 'text-primaria font-medium' : 'text-texto-sec'}`}>
                {labels[i]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Passo 1: Dados do negócio ────────────────────────────────────────────────
const Passo1 = ({ dados, setDados, onProximo, carregando }) => {
  const [erros, setErros] = useState({})
  const validar = () => {
    const novos = {}
    if (!dados.nome) novos.nome = 'Nome é obrigatório'
    setErros(novos)
    return Object.keys(novos).length === 0
  }
  return (
    <div>
      <h2 className="text-xl font-semibold text-texto mb-1">Seu negócio</h2>
      <p className="text-texto-sec text-sm mb-6">Vamos configurar seu salão em poucos minutos</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Nome do negócio *</label>
          <input
            value={dados.nome}
            onChange={(e) => setDados((p) => ({ ...p, nome: e.target.value }))}
            placeholder="Ex: Barbearia Don"
            className={`w-full px-4 py-2.5 rounded-lg border ${erros.nome ? 'border-perigo' : 'border-borda'} focus:outline-none focus:ring-2 focus:ring-primaria/30 text-sm`}
          />
          {erros.nome && <p className="text-perigo text-xs mt-1">{erros.nome}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Segmento</label>
          <Select value={dados.segmento} onValueChange={(v) => setDados((p) => ({ ...p, segmento: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {segmentos.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-texto mb-1.5">Telefone</label>
          <input
            value={dados.telefone}
            onChange={(e) => setDados((p) => ({ ...p, telefone: formatarTelefone(e.target.value) }))}
            placeholder="(11) 99999-0000"
            className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Cidade</label>
            <input
              value={dados.cidade}
              onChange={(e) => setDados((p) => ({ ...p, cidade: e.target.value }))}
              placeholder="São Paulo"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Estado</label>
            <Select value={dados.estado} onValueChange={(v) => setDados((p) => ({ ...p, estado: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map((e) => <SelectItem key={e.uf} value={e.uf}>{e.uf} — {e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <button
        onClick={() => { if (validar()) onProximo() }}
        disabled={carregando}
        className="mt-8 w-full bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
      >
        {carregando ? <Loader2 size={18} className="animate-spin" /> : null}
        Próximo <ChevronRight size={18} />
      </button>
    </div>
  )
}

// ─── Passo 2: Seleção de plano ────────────────────────────────────────────────
const PLANOS = {
  SOLO: {
    id: 'SOLO',
    nome: 'Solo',
    descricao: 'Para profissionais autônomos',
    precoMensal: 55.90,
    cor: 'border-borda',
    corDestaque: 'primaria',
    icone: Scissors,
    features: [
      { ok: true,  texto: '1 profissional' },
      { ok: true,  texto: 'Agenda completa' },
      { ok: true,  texto: 'IA Don no WhatsApp' },
      { ok: true,  texto: 'Lembretes automáticos' },
      { ok: true,  texto: 'NPS, caixa e relatório diário (em Recursos)' },
      { ok: false, texto: 'Gestão de equipes' },
      { ok: false, texto: 'Lista de espera' },
      { ok: false, texto: 'Acesso para barbeiros' },
    ],
  },
  SALAO: {
    id: 'SALAO',
    nome: 'Salão',
    descricao: 'Para salões com equipe',
    precoMensal: 139.90,
    destaque: true,
    cor: 'border-primaria',
    corDestaque: 'primaria',
    badge: 'Mais completo',
    icone: Users,
    features: [
      { ok: true, texto: 'Profissionais ilimitados' },
      { ok: true, texto: 'Agenda por profissional' },
      { ok: true, texto: 'IA Don no WhatsApp' },
      { ok: true, texto: 'Lembretes automáticos' },
      { ok: true, texto: 'NPS, caixa, relatório diário (em Recursos)' },
      { ok: true, texto: 'Gestão de equipes' },
      { ok: true, texto: 'Lista de espera' },
      { ok: true, texto: 'Login individual para barbeiros' },
    ],
  },
}

const CICLOS = [
  { id: 'mensal',    label: 'Mensal',    desconto: 0,    sufixo: '/mês' },
  { id: 'semestral', label: 'Semestral', desconto: 0.10, sufixo: '/mês', badge: '10% off' },
  { id: 'anual',     label: 'Anual',     desconto: 0.20, sufixo: '/mês', badge: '20% off' },
]

const calcPreco = (base, desconto) => (base * (1 - desconto)).toFixed(2).replace('.', ',')
const normalizarCicloCobranca = (ciclo) => ({
  mensal: 'MENSAL',
  semestral: 'SEMESTRAL',
  anual: 'ANUAL',
}[ciclo] || 'MENSAL')

const Passo2 = ({ planoSelecionado, setPlanoSelecionado, cicloSelecionado, setCicloSelecionado, onProximo, onVoltar }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-texto mb-1">Escolha seu plano</h2>
      <p className="text-texto-sec text-sm mb-6">Cancele a qualquer momento, sem taxa de saída</p>

      {/* Ciclo de cobrança */}
      <div className="flex bg-fundo border border-borda rounded-xl p-1 mb-6 gap-1">
        {CICLOS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCicloSelecionado(c.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all relative ${
              cicloSelecionado === c.id
                ? 'bg-white shadow-sm text-texto border border-borda'
                : 'text-texto-sec hover:text-texto'
            }`}
          >
            {c.label}
            {c.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {c.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards dos planos */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Object.values(PLANOS).map((plano) => {
          const ciclo = CICLOS.find((c) => c.id === cicloSelecionado)
          const selecionado = planoSelecionado === plano.id
          const Icone = plano.icone
          return (
            <button
              key={plano.id}
              onClick={() => setPlanoSelecionado(plano.id)}
              className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                selecionado
                  ? 'border-primaria bg-primaria/5 shadow-md'
                  : 'border-borda bg-white hover:border-primaria/40'
              }`}
            >
              {plano.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primaria text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                  {plano.badge}
                </span>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selecionado ? 'bg-primaria text-white' : 'bg-fundo text-texto-sec'}`}>
                  <Icone size={18} />
                </div>
                {selecionado && (
                  <div className="w-5 h-5 rounded-full bg-primaria flex items-center justify-center">
                    <Check size={11} className="text-white" />
                  </div>
                )}
              </div>

              <p className="font-semibold text-texto text-base">{plano.nome}</p>
              <p className="text-texto-sec text-xs mb-3">{plano.descricao}</p>

              <div className="mb-3">
                <span className="text-2xl font-bold text-texto">R$ {calcPreco(plano.precoMensal, ciclo.desconto)}</span>
                <span className="text-texto-sec text-xs">{ciclo.sufixo}</span>
              </div>

              <div className="space-y-1.5">
                {plano.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {f.ok
                      ? <Check size={12} className="text-emerald-500 shrink-0" />
                      : <div className="w-3 h-[1.5px] bg-texto-sec/30 shrink-0 ml-0.5" />
                    }
                    <span className={`text-xs ${f.ok ? 'text-texto' : 'text-texto-sec/50'}`}>{f.texto}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onVoltar} className="flex-none border border-borda text-texto-sec py-2.5 px-4 rounded-lg text-sm inline-flex items-center gap-1">
          <ChevronLeft size={16} /> Voltar
        </button>
        <button
          onClick={onProximo}
          disabled={!planoSelecionado}
          className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-1"
        >
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Passo 3: Serviços ────────────────────────────────────────────────────────
const Passo3 = ({ servicos, setServicos, onProximo, onVoltar, carregando }) => {
  const adicionar = () => setServicos((p) => [...p, { nome: '', duracaoMinutos: 60, precoCentavos: '' }])
  const remover = (i) => setServicos((p) => p.filter((_, idx) => idx !== i))
  const atualizar = (i, campo, valor) => setServicos((p) => p.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)))
  const podeAvancar = servicos.length > 0 && servicos.every((s) => s.nome)
  return (
    <div>
      <h2 className="text-xl font-semibold text-texto mb-1">Serviços e preços</h2>
      <p className="text-texto-sec text-sm mb-6">Cadastre corte, barba e combos</p>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {servicos.map((servico, i) => (
          <div key={i} className="bg-fundo rounded-xl p-4 border border-borda">
            <div className="flex gap-3 mb-3">
              <input
                value={servico.nome}
                onChange={(e) => atualizar(i, 'nome', e.target.value)}
                placeholder="Ex: Combo Corte + Barba"
                className="flex-1 px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
              <button onClick={() => remover(i)} className="text-texto-sec hover:text-perigo"><Trash2 size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-texto-sec mb-1 block">Duração</label>
                <Select value={String(servico.duracaoMinutos)} onValueChange={(v) => atualizar(i, 'duracaoMinutos', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opcoesDuracao.map((o) => <SelectItem key={o.valor} value={String(o.valor)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-texto-sec mb-1 block">Preço</label>
                <input
                  value={servico.precoCentavos}
                  onChange={(e) => atualizar(i, 'precoCentavos', formatarDinheiro(e.target.value))}
                  placeholder="R$ 0,00"
                  className="w-full px-3 py-2 rounded-lg border border-borda text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={adicionar} className="mt-3 w-full border-2 border-dashed border-borda hover:border-primaria rounded-xl py-3 text-sm text-texto-sec inline-flex items-center justify-center gap-2">
        <Plus size={16} /> Adicionar serviço
      </button>
      <div className="flex gap-3 mt-6">
        <button onClick={onVoltar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-1">
          <ChevronLeft size={16} /> Voltar
        </button>
        <button
          onClick={onProximo}
          disabled={!podeAvancar || carregando}
          className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-1"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : null}
          Próximo <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Passo 4: Profissionais ───────────────────────────────────────────────────
const Passo4 = ({ planoSelecionado, profissionais, setProfissionais, servicosDisponiveis, onFinalizar, onVoltar, carregando }) => {
  const limiteProfissionais = planoSelecionado === 'SOLO' ? 1 : Infinity
  const atingiuLimiteProfissionais = profissionais.length >= limiteProfissionais
  const adicionar = () => {
    if (atingiuLimiteProfissionais) return
    setProfissionais((p) => [...p, { nome: '', email: '', telefone: '', servicos: [] }])
  }
  const remover = (i) => setProfissionais((p) => p.filter((_, idx) => idx !== i))
  const atualizar = (i, campo, valor) => setProfissionais((p) => p.map((pr, idx) => (idx === i ? { ...pr, [campo]: valor } : pr)))
  const toggleServico = (profIdx, servicoIdx) => {
    setProfissionais((p) =>
      p.map((prof, i) => {
        if (i !== profIdx) return prof
        const servicos = prof.servicos.includes(servicoIdx)
          ? prof.servicos.filter((s) => s !== servicoIdx)
          : [...prof.servicos, servicoIdx]
        return { ...prof, servicos }
      })
    )
  }
  const podeFinalizar = profissionais.length > 0 && profissionais.every((p) => p.nome)
  return (
    <div>
      <h2 className="text-xl font-semibold text-texto mb-1">Profissionais</h2>
      <p className="text-texto-sec text-sm mb-6">Quem atende no dia a dia?</p>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {profissionais.map((prof, i) => (
          <div key={i} className="bg-fundo rounded-xl p-4 border border-borda">
            <div className="flex gap-3 mb-3">
              <input
                value={prof.nome}
                onChange={(e) => atualizar(i, 'nome', e.target.value)}
                placeholder="Nome do profissional"
                className="flex-1 px-3 py-2 rounded-lg border border-borda text-sm"
              />
              <button onClick={() => remover(i)} className="text-texto-sec hover:text-perigo"><Trash2 size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={prof.email}
                onChange={(e) => atualizar(i, 'email', e.target.value)}
                placeholder="E-mail (acesso ao sistema)"
                className="px-3 py-2 rounded-lg border border-borda text-sm"
              />
              <input
                value={prof.telefone}
                onChange={(e) => atualizar(i, 'telefone', e.target.value)}
                placeholder="Telefone"
                className="px-3 py-2 rounded-lg border border-borda text-sm"
              />
            </div>
            {servicosDisponiveis.length > 0 && (
              <div>
                <p className="text-xs text-texto-sec mb-2">Serviços que esse profissional faz:</p>
                <div className="flex flex-wrap gap-2">
                  {servicosDisponiveis.map((s, si) => (
                    <button
                      key={si}
                      onClick={() => toggleServico(i, si)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        prof.servicos.includes(si) ? 'bg-primaria text-white' : 'bg-white border border-borda text-texto-sec'
                      }`}
                    >
                      {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {planoSelecionado === 'SOLO' && atingiuLimiteProfissionais ? (
        <div className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
          Plano Solo permite apenas 1 profissional.
        </div>
      ) : (
        <button onClick={adicionar} className="mt-3 w-full border-2 border-dashed border-borda hover:border-primaria rounded-xl py-3 text-sm text-texto-sec inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Adicionar profissional
        </button>
      )}
      <div className="flex gap-3 mt-6">
        <button onClick={onVoltar} className="flex-1 border border-borda text-texto-sec py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-1">
          <ChevronLeft size={16} /> Voltar
        </button>
        <button
          onClick={onFinalizar}
          disabled={!podeFinalizar || carregando}
          className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Finalizar setup
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
const Onboarding = () => {
  const navigate = useNavigate()
  const { atualizarUsuario, atualizarTenant } = useAuth()

  const [passo, setPasso] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [negocio, setNegocio] = useState({ nome: '', segmento: 'BELEZA', telefone: '', cidade: '', estado: '' })
  const [planoSelecionado, setPlanoSelecionado] = useState('SOLO')
  const [cicloSelecionado, setCicloSelecionado] = useState('semestral')
  const [servicos, setServicos] = useState([{ nome: '', duracaoMinutos: 60, precoCentavos: '' }])
  const [profissionais, setProfissionais] = useState([{ nome: '', email: '', telefone: '', servicos: [] }])
  const [servicosCriados, setServicosCriados] = useState([])

  useEffect(() => {
    if (planoSelecionado !== 'SOLO') return
    setProfissionais((prev) => prev.slice(0, 1))
  }, [planoSelecionado])

  const salvarNegocio = async () => {
    setCarregando(true)
    setErro('')
    try {
      const { cidade, estado, ...resto } = negocio
      const endereco = [cidade, estado].filter(Boolean).join(', ')
      await api.patch('/api/tenants/meu', { ...resto, endereco })
      setPasso(2)
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao salvar negócio.')
    } finally {
      setCarregando(false)
    }
  }

  const confirmarPlano = async () => {
    setCarregando(true)
    setErro('')
    const cicloCobranca = normalizarCicloCobranca(cicloSelecionado)
    try {
      await api.patch('/api/tenants/meu', { planoContratado: planoSelecionado, cicloCobranca })
    } catch {
      // ignora se o backend não suporta o campo — persiste só no localStorage
    } finally {
      atualizarTenant({ planoContratado: planoSelecionado, cicloCobranca })
      setCarregando(false)
      setPasso(3)
    }
  }

  const salvarServicos = async () => {
    if (servicosCriados.length > 0) { setPasso(4); return }
    setCarregando(true)
    setErro('')
    try {
      const criados = []
      for (const s of servicos) {
        const res = await api.post('/api/servicos', {
          nome: s.nome,
          duracaoMinutos: s.duracaoMinutos,
          precoCentavos: s.precoCentavos ? Math.round(parseFloat(s.precoCentavos.replace(/[^\d,]/g, '').replace(',', '.')) * 100) : null,
        })
        criados.push(res.dados)
      }
      setServicosCriados(criados)
      setPasso(4)
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao salvar serviços.')
    } finally {
      setCarregando(false)
    }
  }

  const salvarProfissionaisEFinalizar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const profissionaisParaSalvar = planoSelecionado === 'SOLO' ? profissionais.slice(0, 1) : profissionais
      for (const prof of profissionaisParaSalvar) {
        const horarioPadrao = {
          0: { ativo: false },
          1: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [] },
          2: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [] },
          3: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [] },
          4: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [] },
          5: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [] },
          6: { ativo: false },
        }
        const resProfissional = await api.post('/api/profissionais', {
          nome: prof.nome,
          email: prof.email || undefined,
          telefone: prof.telefone || undefined,
          horarioTrabalho: horarioPadrao,
        })
        if (prof.servicos.length > 0) {
          const vinculados = prof.servicos.map((idx) => ({ servicoId: servicosCriados[idx]?.id })).filter((s) => s.servicoId)
          if (vinculados.length > 0) {
            await api.post(`/api/profissionais/${resProfissional.dados.id}/servicos`, { servicos: vinculados })
          }
        }
      }
      await api.patch('/api/tenants/meu', { onboardingCompleto: true })
      atualizarUsuario({ onboardingCompleto: true })
      navigate('/dashboard')
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Erro ao finalizar configuração inicial.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-fundo flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-borda p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primaria rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="3" stroke="white" strokeWidth="2" />
              <path d="M8 2v4M16 2v4M3 10h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="8" cy="15" r="1.5" fill="white" />
              <circle cx="12" cy="15" r="1.5" fill="white" />
              <circle cx="16" cy="15" r="1.5" fill="white" />
            </svg>
          </div>
          <span className="font-display tracking-[0.12em] text-xl text-texto">Marcaí Barber</span>
        </div>

        <ProgressBar passo={passo} total={4} />

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">{erro}</div>
        )}

        {passo === 1 && <Passo1 dados={negocio} setDados={setNegocio} onProximo={salvarNegocio} carregando={carregando} />}
        {passo === 2 && (
          <Passo2
            planoSelecionado={planoSelecionado}
            setPlanoSelecionado={setPlanoSelecionado}
            cicloSelecionado={cicloSelecionado}
            setCicloSelecionado={setCicloSelecionado}
            onProximo={confirmarPlano}
            onVoltar={() => setPasso(1)}
          />
        )}
        {passo === 3 && (
          <Passo3
            servicos={servicos}
            setServicos={setServicos}
            onProximo={salvarServicos}
            onVoltar={() => setPasso(2)}
            carregando={carregando}
          />
        )}
        {passo === 4 && (
          <Passo4
            planoSelecionado={planoSelecionado}
            profissionais={profissionais}
            setProfissionais={setProfissionais}
            servicosDisponiveis={servicosCriados}
            onFinalizar={salvarProfissionaisEFinalizar}
            onVoltar={() => setPasso(3)}
            carregando={carregando}
          />
        )}
      </div>
    </div>
  )
}

export default Onboarding

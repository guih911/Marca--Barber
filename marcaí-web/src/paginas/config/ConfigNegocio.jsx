import { useState, useEffect, useRef } from 'react'
import { Loader2, Save, CheckCircle2, Bell, CreditCard, Baby, MapPin, Phone, Star, MonitorPlay, Copy, ExternalLink, ShieldCheck, Camera, Plus, Trash2 } from 'lucide-react'
import api from '../../servicos/api'
import { segmentos } from '../../lib/utils'
import { useToast } from '../../contextos/ToastContexto'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../componentes/ui/select'
import useAuth from '../../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const TIPOS_PAGAMENTO = [
  { valor: 'PIX', label: 'PIX' },
  { valor: 'DINHEIRO', label: 'Dinheiro' },
  { valor: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { valor: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { valor: 'VALE_PRESENTE', label: 'Vale-presente' },
]

const DIFERENCIAIS_OPCOES = [
  { valor: 'sinuca', label: '🎱 Sinuca' },
  { valor: 'wifi', label: '📶 Wi-Fi grátis' },
  { valor: 'tv', label: '📺 TV' },
  { valor: 'estacionamento', label: '🚗 Estacionamento' },
  { valor: 'cafezinho', label: '☕ Cafezinho' },
  { valor: 'cerveja', label: '🍺 Cerveja/drinks' },
  { valor: 'ar_condicionado', label: '❄️ Ar-condicionado' },
  { valor: 'musica_ao_vivo', label: '🎸 Música ao vivo' },
  { valor: 'venda_produtos', label: '🛍️ Venda de produtos' },
]

const LEMBRETES_OPCOES = [
  { valor: 5, label: '5 min' },
  { valor: 10, label: '10 min' },
  { valor: 15, label: '15 min' },
  { valor: 20, label: '20 min' },
  { valor: 25, label: '25 min' },
  { valor: 30, label: '30 min' },
  { valor: 45, label: '45 min' },
  { valor: 60, label: '1h' },
  { valor: 75, label: '1h15' },
  { valor: 90, label: '1h30' },
  { valor: 120, label: '2h' },
]

const ConfigNegocio = () => {
  const toast = useToast()
  const { atualizarTenant } = useAuth()
  const [form, setForm] = useState({
    nome: '',
    segmento: 'BELEZA',
    telefone: '',
    endereco: '',
    linkMaps: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    timezone: 'America/Sao_Paulo',
    lembreteMinutosAntes: 60,
    lembretesMinutosAntes: [60],
    exigirConfirmacaoPresenca: false,
    numeroAdministrador: '',
    // Novos campos
    numeroDono: '',
    tiposPagamento: [],
    cortaCabeloInfantil: false,
    idadeMinimaCabeloInfantilMeses: '',
    diferenciais: [],
    apresentacaoSalaoAtivo: true,
    enviarMensagemAoCadastrarCliente: true,
  })

  const [configWhatsAppAtual, setConfigWhatsAppAtual] = useState({})
  const [tenantPublico, setTenantPublico] = useState({ slug: '', hashPublico: '', nome: '' })
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const inputLogoRef = useRef(null)

  useEffect(() => {
    api.get('/api/tenants/meu').then((res) => {
      const t = res.dados || {}
      const cfg = t.configWhatsApp || {}
      setConfigWhatsAppAtual(cfg)
      setTenantPublico({
        slug: t.slug || '',
        hashPublico: t.hashPublico || '',
        nome: t.nome || '',
      })
      setLogoUrl(t.logoUrl || '')
      setForm({
        nome: t.nome || '',
        segmento: t.segmento || 'BELEZA',
        telefone: t.telefone || '',
        endereco: t.endereco || '',
        linkMaps: t.linkMaps || '',
        instagramUrl: t.instagramUrl || '',
        facebookUrl: t.facebookUrl || '',
        tiktokUrl: t.tiktokUrl || '',
        timezone: t.timezone || 'America/Sao_Paulo',
        lembreteMinutosAntes: t.lembreteMinutosAntes ?? 60,
        lembretesMinutosAntes: Array.isArray(t.lembretesMinutosAntes) && t.lembretesMinutosAntes.length > 0
          ? t.lembretesMinutosAntes.map(Number).filter(Number.isFinite).sort((a, b) => b - a)
          : (t.lembreteMinutosAntes > 0 ? [Number(t.lembreteMinutosAntes)] : []),
        exigirConfirmacaoPresenca: Boolean(t.exigirConfirmacaoPresenca),
        numeroAdministrador: aplicarMascaraTelefone(cfg.numeroAdministrador || ''),
        numeroDono: aplicarMascaraTelefone(t.numeroDono || ''),
        tiposPagamento: Array.isArray(t.tiposPagamento) ? t.tiposPagamento : [],
        cortaCabeloInfantil: Boolean(t.cortaCabeloInfantil),
        idadeMinimaCabeloInfantilMeses: t.idadeMinimaCabeloInfantilMeses != null ? String(t.idadeMinimaCabeloInfantilMeses) : '',
        diferenciais: Array.isArray(t.diferenciais) ? t.diferenciais : [],
        apresentacaoSalaoAtivo: t.apresentacaoSalaoAtivo !== false,
        enviarMensagemAoCadastrarCliente: t.enviarMensagemAoCadastrarCliente !== false,
      })
      setCarregando(false)
    })
  }, [])

  const atualizar = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  const aplicarMascaraTelefone = (valor) => {
    let d = valor.replace(/\D/g, '')
    // Remove prefixo 55 (código do país) se vier do banco: ex. "5562993050931" → "62993050931"
    if (d.startsWith('55') && d.length > 11) d = d.slice(2)
    d = d.slice(0, 11)
    if (d.length === 0) return ''
    if (d.length <= 2) return `(${d}`
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
  }

  const atualizarTelefone = (campo) => (e) =>
    setForm((p) => ({ ...p, [campo]: aplicarMascaraTelefone(e.target.value) }))

  // Ao salvar, converte "(62) 99305-0931" → "+556299305093" para uso no WhatsApp
  const limparTelefone = (v) => {
    const d = (v || '').replace(/\D/g, '')
    return d ? `+55${d}` : ''
  }

  const toggleArray = (campo, valor) => {
    setForm((p) => {
      const arr = p[campo] || []
      return { ...p, [campo]: arr.includes(valor) ? arr.filter((v) => v !== valor) : [...arr, valor] }
    })
  }

  const normalizarLembretes = (lista) => (
    [...new Set((Array.isArray(lista) ? lista : [])
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0))]
      .sort((a, b) => a - b)
  )

  const adicionarLembrete = () => {
    setForm((anterior) => {
      const atuais = normalizarLembretes(anterior.lembretesMinutosAntes)
      const proximoDisponivel = LEMBRETES_OPCOES.find((opcao) => !atuais.includes(opcao.valor))?.valor ?? 15
      const proximos = normalizarLembretes([...atuais, proximoDisponivel])
      return {
        ...anterior,
        lembretesMinutosAntes: proximos,
        lembreteMinutosAntes: proximos.at(-1) ?? 0,
      }
    })
  }

  const atualizarLembrete = (indice, valor) => {
    setForm((anterior) => {
      const proximos = [...(anterior.lembretesMinutosAntes || [])]
      proximos[indice] = Number(valor)
      const normalizados = normalizarLembretes(proximos)
      return {
        ...anterior,
        lembretesMinutosAntes: normalizados,
        lembreteMinutosAntes: normalizados.at(-1) ?? 0,
      }
    })
  }

  const removerLembrete = (indice) => {
    setForm((anterior) => {
      const proximos = [...(anterior.lembretesMinutosAntes || [])]
      proximos.splice(indice, 1)
      const normalizados = normalizarLembretes(proximos)
      return {
        ...anterior,
        lembretesMinutosAntes: normalizados,
        lembreteMinutosAntes: normalizados.at(-1) ?? 0,
      }
    })
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome?.trim()) {
      toast('O nome da barbearia é obrigatório.', 'aviso')
      return
    }
    setSalvando(true)
    try {
      const corpo = {
        nome: form.nome,
        segmento: form.segmento,
        telefone: form.telefone,
        endereco: form.endereco,
        linkMaps: form.linkMaps,
        instagramUrl: form.instagramUrl,
        facebookUrl: form.facebookUrl,
        tiktokUrl: form.tiktokUrl,
        timezone: form.timezone,
        lembreteMinutosAntes: normalizarLembretes(form.lembretesMinutosAntes).at(-1) ?? 0,
        lembretesMinutosAntes: normalizarLembretes(form.lembretesMinutosAntes),
        exigirConfirmacaoPresenca: Boolean(form.exigirConfirmacaoPresenca),
        configWhatsApp: {
          ...configWhatsAppAtual,
          numeroAdministrador: limparTelefone(form.numeroAdministrador) || null,
        },
        numeroDono: limparTelefone(form.numeroDono),
        tiposPagamento: form.tiposPagamento,
        cortaCabeloInfantil: form.cortaCabeloInfantil,
        idadeMinimaCabeloInfantilMeses: form.idadeMinimaCabeloInfantilMeses !== '' ? Number(form.idadeMinimaCabeloInfantilMeses) : null,
        diferenciais: form.diferenciais,
        apresentacaoSalaoAtivo: form.apresentacaoSalaoAtivo,
        enviarMensagemAoCadastrarCliente: form.enviarMensagemAoCadastrarCliente,
      }

      const resposta = await api.patch('/api/tenants/meu', corpo)
      const tenantAtualizado = resposta.dados || corpo
      setConfigWhatsAppAtual(tenantAtualizado.configWhatsApp || corpo.configWhatsApp)
      setTenantPublico((anterior) => ({
        slug: tenantAtualizado.slug || anterior.slug,
        hashPublico: tenantAtualizado.hashPublico || anterior.hashPublico,
        nome: tenantAtualizado.nome || corpo.nome || anterior.nome,
      }))
      atualizarTenant(tenantAtualizado)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (e) {
      toast('Erro ao salvar', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadandoLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await api.upload('/api/tenants/meu/logo', formData)
      if (res?.sucesso) {
        setLogoUrl(res.dados.logoUrl)
        atualizarTenant({ logoUrl: res.dados.logoUrl })
        toast('Logo atualizada.', 'sucesso')
      }
    } catch {
      toast('Não foi possível enviar a logo.', 'erro')
    } finally {
      setUploadandoLogo(false)
      if (inputLogoRef.current) inputLogoRef.current.value = ''
    }
  }

  if (carregando) return <div className="p-8 text-center text-texto-sec">Carregando...</div>

  const campo = (label, chave, tipo = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-texto mb-1.5">{label}</label>
      <input
        type={tipo}
        value={form[chave]}
        onChange={atualizar(chave)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria text-sm"
      />
    </div>
  )

  const mesesParaTexto = (meses) => {
    if (!meses) return ''
    const m = Number(meses)
    if (m < 12) return `${m} mes${m !== 1 ? 'es' : ''}`
    const anos = Math.floor(m / 12)
    const resto = m % 12
    return resto > 0 ? `${anos} ano${anos !== 1 ? 's' : ''} e ${resto} mes${resto !== 1 ? 'es' : ''}` : `${anos} ano${anos !== 1 ? 's' : ''}`
  }

  const formatarJanelaLembrete = (minutos) => {
    const total = Number(minutos || 0)
    if (total < 60) return `${total}min`
    const horas = Math.floor(total / 60)
    const resto = total % 60
    return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
  }

  const linkPainelTv = tenantPublico.slug && tenantPublico.hashPublico && typeof window !== 'undefined'
    ? `${window.location.origin}/painel/${tenantPublico.slug}/${tenantPublico.hashPublico}`
    : ''

  const linkAgendamento = tenantPublico.hashPublico && typeof window !== 'undefined'
    ? `${window.location.origin}/b/${tenantPublico.hashPublico}`
    : ''

  const copiarTexto = async (texto, mensagemSucesso, mensagemErro) => {
    if (!texto) {
      toast(mensagemErro, 'aviso')
      return
    }

    try {
      await navigator.clipboard.writeText(texto)
      toast(mensagemSucesso, 'sucesso')
    } catch {
      toast(mensagemErro, 'erro')
    }
  }

  const abrirLinkExterno = (texto, mensagemErro) => {
    if (!texto) {
      toast(mensagemErro, 'aviso')
      return
    }
    window.open(texto, '_blank', 'noopener,noreferrer')
  }

  const copiarLinkPainelTv = async () => {
    await copiarTexto(linkPainelTv, 'Link do painel copiado!', 'O link do painel ainda não está disponível.')
  }

  const abrirPainelTv = () => {
    abrirLinkExterno(linkPainelTv, 'O link do painel ainda não está disponível.')
  }

  const copiarLinkAgendamento = async () => {
    await copiarTexto(linkAgendamento, 'Link de agendamento copiado!', 'O link de agendamento ainda não está disponível.')
  }

  const abrirLinkAgendamento = () => {
    abrirLinkExterno(linkAgendamento, 'O link de agendamento ainda não está disponível.')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Configurações do Negócio</h1>
        <p className="text-texto-sec text-sm mt-1">Informações principais da barbearia</p>
      </div>

      <form onSubmit={salvar} className="space-y-5">

        {/* ── Informações Básicas ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-texto">Informações básicas</h2>

          <div>
            <label className="block text-sm font-medium text-texto mb-3">Logo do salão</label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-borda bg-fundo">
                {logoUrl ? (
                  <img
                    src={logoUrl.startsWith('http') ? logoUrl : `${API_URL}${logoUrl}`}
                    alt="Logo do salão"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-texto-sec text-xs text-center px-2">
                    Sem logo
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => inputLogoRef.current?.click()}
                  disabled={uploadandoLogo}
                  className="inline-flex items-center gap-2 rounded-xl border border-borda bg-white px-4 py-2.5 text-sm font-medium text-texto transition-colors hover:bg-fundo disabled:opacity-60"
                >
                  {uploadandoLogo ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {uploadandoLogo ? 'Enviando...' : 'Enviar logo'}
                </button>
                <p className="text-xs text-texto-sec">Essa logo aparece no link público, painel e páginas abertas ao cliente.</p>
              </div>
              <input ref={inputLogoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
            </div>
          </div>

          {campo('Nome do negócio', 'nome', 'text', 'Ex: Barbearia Don')}

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Segmento</label>
            <Select value={form.segmento} onValueChange={(v) => setForm((p) => ({ ...p, segmento: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {segmentos.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {campo('Telefone do salão', 'telefone', 'tel', '(11) 99999-0000')}
          {campo('Endereço', 'endereco', 'text', 'Rua, número - Cidade, Estado')}

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5 flex items-center gap-1.5">
              <MapPin size={14} className="text-primaria" /> Link do Google Maps
            </label>
            <input
              type="url"
              value={form.linkMaps}
              onChange={atualizar('linkMaps')}
              placeholder="https://maps.google.com/..."
              className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria text-sm"
            />
            <p className="text-xs text-texto-sec mt-1">A IA envia esse link quando o cliente perguntar onde fica.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {campo('Instagram', 'instagramUrl', 'url', 'https://instagram.com/...')}
            {campo('Facebook', 'facebookUrl', 'url', 'https://facebook.com/...')}
            {campo('TikTok', 'tiktokUrl', 'url', 'https://tiktok.com/...')}
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Fuso horário</label>
            <Select value={form.timezone} onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                <SelectItem value="America/Manaus">America/Manaus (AMT)</SelectItem>
                <SelectItem value="America/Belem">America/Belem (BRT)</SelectItem>
                <SelectItem value="America/Fortaleza">America/Fortaleza (BRT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d8c2a2] bg-[linear-gradient(135deg,#fff9f2,#f6ede2)] p-6 shadow-sm space-y-4">
          <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9a6a2d]">Link de agendamento</p>
                <h2 className="mt-2 text-base font-semibold text-texto">Página pública da sua barbearia</h2>
                <p className="mt-1 text-sm text-texto-sec">
                  Esse é o link que você pode divulgar para o cliente agendar sozinho, ver detalhes do salão e acessar o próprio histórico.
                </p>
              </div>
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#b8894d]/10 text-[#9a6a2d] sm:flex">
                <ExternalLink size={20} />
              </div>
            </div>

            <p className="mt-3 break-all rounded-xl bg-[#1a1714] px-4 py-3 font-mono text-sm text-[#f6e7cf]">
              {linkAgendamento || 'O link de agendamento ficará disponível assim que o hash público estiver pronto.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copiarLinkAgendamento}
                disabled={!linkAgendamento}
                className="inline-flex items-center gap-2 rounded-xl bg-primaria px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primaria-escura disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={16} />
                Copiar link
              </button>
              <button
                type="button"
                onClick={abrirLinkAgendamento}
                disabled={!linkAgendamento}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8c2a2] bg-white px-4 py-2.5 text-sm font-medium text-texto transition-colors hover:bg-[#fff8ef] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ExternalLink size={16} />
                Abrir agendamento
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a6a2d] shadow-sm">
                <MonitorPlay size={14} />
                Painel TV
              </div>
              <h2 className="mt-3 text-base font-semibold text-texto">Link ao vivo da sua barbearia</h2>
              <p className="mt-1 text-sm text-texto-sec">
                Use este painel em uma TV ou monitor grande para acompanhar agenda do dia, proximos horarios e movimentacoes em tempo real.
              </p>
            </div>
            <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#b8894d]/10 text-[#9a6a2d] sm:flex">
              <MonitorPlay size={22} />
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9a6a2d]">URL do painel</p>
            <p className="mt-2 break-all rounded-xl bg-[#1a1714] px-4 py-3 font-mono text-sm text-[#f6e7cf]">
              {linkPainelTv || 'O link ficara disponivel assim que o hash publico estiver pronto.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-sec">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#eadbc7] bg-[#fff8ef] px-3 py-1.5">
                <ShieldCheck size={14} className="text-[#9a6a2d]" />
                Hash unico: {tenantPublico.hashPublico || 'gerando...'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copiarLinkPainelTv}
              disabled={!linkPainelTv}
              className="inline-flex items-center gap-2 rounded-xl bg-primaria px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primaria-escura disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={16} />
              Copiar link
            </button>
            <button
              type="button"
              onClick={abrirPainelTv}
              disabled={!linkPainelTv}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8c2a2] bg-white px-4 py-2.5 text-sm font-medium text-texto transition-colors hover:bg-[#fff8ef] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink size={16} />
              Abrir painel
            </button>
          </div>
        </div>

        {/* ── Pagamento e Atendimento ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primaria" />
            <h2 className="text-base font-semibold text-texto">Pagamento e atendimento</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-2">Formas de pagamento aceitas</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_PAGAMENTO.map((tp) => (
                <label key={tp.valor} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-borda hover:border-primaria/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.tiposPagamento.includes(tp.valor)}
                    onChange={() => toggleArray('tiposPagamento', tp.valor)}
                    className="rounded accent-primaria"
                  />
                  <span className="text-sm text-texto">{tp.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-texto-sec mt-1.5">A IA responde quando o cliente perguntar "aceita cartão?", "tem PIX?" etc.</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Baby size={15} className="text-primaria" />
              <label className="text-sm font-medium text-texto">Corte infantil</label>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, cortaCabeloInfantil: !p.cortaCabeloInfantil }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.cortaCabeloInfantil ? 'bg-primaria' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.cortaCabeloInfantil ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-texto">{form.cortaCabeloInfantil ? 'Sim, cortamos cabelo infantil' : 'Não cortamos cabelo infantil'}</span>
            </div>
            {form.cortaCabeloInfantil && (
              <div>
                <label className="block text-xs text-texto-sec mb-1">Idade mínima (em meses)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="216"
                    value={form.idadeMinimaCabeloInfantilMeses}
                    onChange={atualizar('idadeMinimaCabeloInfantilMeses')}
                    placeholder="Ex: 36"
                    className="w-28 px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria"
                  />
                  {form.idadeMinimaCabeloInfantilMeses && (
                    <span className="text-sm text-texto-sec">= a partir de {mesesParaTexto(form.idadeMinimaCabeloInfantilMeses)}</span>
                  )}
                </div>
                <p className="text-xs text-texto-sec mt-1">Deixe em branco para não informar idade mínima.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Diferenciais do Salão ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-primaria" />
            <h2 className="text-base font-semibold text-texto">Diferenciais e estrutura</h2>
          </div>
          <p className="text-xs text-texto-sec -mt-3">A IA menciona esses diferenciais quando apresenta o salão para novos clientes.</p>

          <div className="grid grid-cols-2 gap-2">
            {DIFERENCIAIS_OPCOES.map((d) => (
              <label key={d.valor} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-borda hover:border-primaria/50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.diferenciais.includes(d.valor)}
                  onChange={() => toggleArray('diferenciais', d.valor)}
                  className="rounded accent-primaria"
                />
                <span className="text-sm text-texto">{d.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── IA e WhatsApp ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-texto">IA e WhatsApp</h2>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-primaria" /> Número do dono / responsável
            </label>
            <input
              type="tel"
              value={form.numeroDono}
              onChange={atualizarTelefone('numeroDono')}
              placeholder="(11) 99999-0000"
              className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria text-sm"
            />
            <p className="text-xs text-texto-sec mt-1">A IA envia esse número quando o cliente pedir para falar com o dono.</p>
          </div>

          <div className="border-t border-borda pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-texto">Card de boas-vindas</p>
                <p className="text-xs text-texto-sec mt-0.5">Na 1ª mensagem de cada conversa, envia automaticamente horários, diferenciais e link de agendamento.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, apresentacaoSalaoAtivo: !p.apresentacaoSalaoAtivo }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.apresentacaoSalaoAtivo ? 'bg-primaria' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.apresentacaoSalaoAtivo ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-borda pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-texto">Mensagem ao cadastrar cliente</p>
                <p className="text-xs text-texto-sec mt-0.5">Quando desligado, o cadastro manual no app não envia WhatsApp automático de boas-vindas para o cliente.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, enviarMensagemAoCadastrarCliente: !p.enviarMensagemAoCadastrarCliente }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enviarMensagemAoCadastrarCliente ? 'bg-primaria' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enviarMensagemAoCadastrarCliente ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-borda pt-4">
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">Número administrador (WhatsApp)</label>
              <input
                type="tel"
                value={form.numeroAdministrador}
                onChange={atualizarTelefone('numeroAdministrador')}
                placeholder="(11) 99999-0000"
                className="w-full px-4 py-2.5 rounded-lg border border-borda focus:outline-none focus:ring-2 focus:ring-primaria/30 focus:border-primaria text-sm"
              />
            </div>
            <p className="text-xs text-texto-sec mt-1">Número que recebe alertas e notificações do sistema.</p>
          </div>
        </div>

        {/* ── Lembretes ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-2">
            <Bell size={15} className="text-primaria mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-texto">Lembrete de agendamento</h3>
              <p className="text-xs text-texto-sec mt-0.5">
                Tempo antes do horário para enviar o lembrete automático por WhatsApp
              </p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <label className="block text-sm font-medium text-texto">Enviar lembretes</label>
              <button
                type="button"
                onClick={adicionarLembrete}
                disabled={normalizarLembretes(form.lembretesMinutosAntes).length >= LEMBRETES_OPCOES.length}
                className="inline-flex items-center gap-2 rounded-xl border border-borda bg-white px-3 py-2 text-sm font-medium text-texto transition-colors hover:bg-fundo disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                Adicionar lembrete
              </button>
            </div>

            {normalizarLembretes(form.lembretesMinutosAntes).length === 0 ? (
              <div className="rounded-xl border border-dashed border-borda bg-fundo px-4 py-3 text-sm text-texto-sec">
                Nenhum lembrete configurado. Clique em Adicionar lembrete para criar o primeiro.
              </div>
            ) : (
              <div className="space-y-3">
                {normalizarLembretes(form.lembretesMinutosAntes).map((minutos, indice) => (
                  <div key={`${minutos}-${indice}`} className="flex items-center gap-3">
                    <div className="w-full">
                      <Select value={String(minutos)} onValueChange={(valor) => atualizarLembrete(indice, valor)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEMBRETES_OPCOES.map((opcao) => (
                            <SelectItem key={opcao.valor} value={String(opcao.valor)}>
                              {opcao.label} antes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerLembrete(indice)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-borda bg-white text-texto-sec transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remover lembrete ${indice + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {normalizarLembretes(form.lembretesMinutosAntes).length > 0 && (
              <p className="text-xs text-texto-sec mt-2">
                A barbearia enviará {normalizarLembretes(form.lembretesMinutosAntes).length} lembrete{normalizarLembretes(form.lembretesMinutosAntes).length > 1 ? 's' : ''}: {normalizarLembretes(form.lembretesMinutosAntes).map((minutos) => formatarJanelaLembrete(minutos)).join(', ')} antes do horário.
              </p>
            )}
          </div>
        </div>

        {/* ── Fluxo de presença ── */}
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-texto">Fluxo de presença no salão</h3>
            <p className="text-xs text-texto-sec mt-0.5">
              Defina se a equipe precisa registrar que o cliente chegou antes de concluir o atendimento.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Confirmação de presença</label>
            <Select value={form.exigirConfirmacaoPresenca ? 'obrigatoria' : 'opcional'} onValueChange={(v) => setForm((p) => ({ ...p, exigirConfirmacaoPresenca: v === 'obrigatoria' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="opcional">Opcional</SelectItem>
                <SelectItem value="obrigatoria">Obrigatória antes de finalizar</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-texto-sec mt-1.5">
              {form.exigirConfirmacaoPresenca
                ? 'A recepção ou o barbeiro precisará marcar "cliente chegou" antes de concluir.'
                : 'A equipe pode marcar a chegada quando quiser, mas a finalização continua liberada.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          {sucesso && (
            <span className="flex items-center gap-1.5 text-sucesso text-sm">
              <CheckCircle2 size={16} /> Salvo com sucesso
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={salvando}
              className="bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar configurações
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default ConfigNegocio

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Tag,
  X,
  Cake,
  Loader2,
  Pencil,
  Trash2,
  Save,
  MessageSquare,
  UserX,
  UserCheck,
  AlertTriangle,
  Instagram,
  Heart,
  Link2,
  Send,
  Download,
  Upload,
  FileSpreadsheet,
  Mic,
} from 'lucide-react'
import api from '../../servicos/api'
import { formatarData, formatarTelefone } from '../../lib/utils'
import useDebounce from '../../hooks/useDebounce'
import { useToast } from '../../contextos/ToastContexto'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'
import AvatarPessoa from '../../componentes/ui/AvatarPessoa'
import useAuth from '../../hooks/useAuth'

const estadoFormInicial = {
  id: null,
  nome: '',
  telefone: '',
  email: '',
  tipoCortePreferido: '',
  preferencias: '',
  dataNascimento: '',
  instagram: '',
}

const aplicarMascaraTelefone = (valor) => {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`
}

// Verifica se o nome parece ser um número de telefone (cliente sem nome real)
const pareceTelefone = (nome) => /^\+?\d[\d\s()\-]{5,}$/.test((nome || '').trim()) || (nome || '').trim() === ''

const ModalCliente = ({ valorInicial, onFechar, onSalvar, salvando }) => {
  const [form, setForm] = useState(valorInicial)
  const [erro, setErro] = useState('')
  const [avisoNome, setAvisoNome] = useState('')
  const [avisoTelefone, setAvisoTelefone] = useState('')

  const atualizar = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))

  const verificarNomeRepetido = async (nome) => {
    if (!nome.trim() || form.id) return
    try {
      const res = await api.get(`/api/clientes?busca=${encodeURIComponent(nome.trim())}&limite=5`)
      const lista = res.clientes || res.dados || []
      const existente = lista.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase())
      setAvisoNome(existente ? `Já existe um cliente com o nome "${existente.nome}". Verifique se é duplicata.` : '')
    } catch { /* ignora */ }
  }

  const verificarTelefoneRepetido = async (tel) => {
    const digitos = tel.replace(/\D/g, '')
    if (digitos.length < 8 || form.id) return
    try {
      const res = await api.get(`/api/clientes?busca=${digitos}&limite=3`)
      const lista = res.clientes || res.dados || []
      const existente = lista.find((c) => c.telefone?.replace(/\D/g, '').endsWith(digitos.slice(-8)))
      setAvisoTelefone(existente ? `Este telefone já está cadastrado para "${existente.nome}".` : '')
    } catch { /* ignora */ }
  }

  const salvar = () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      setErro('Nome e telefone são obrigatórios.')
      return
    }
    setErro('')
    onSalvar(form)
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFechar])

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-borda shadow-xl w-full max-w-md max-h-[calc(100vh-32px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho fixo */}
        <div className="px-6 pt-5 pb-4 border-b border-borda shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-texto">{form.id ? 'Editar cliente' : 'Novo cliente'}</h3>
            <p className="text-sm text-texto-sec mt-1">Cadastro rápido para operação.</p>
          </div>
          <button type="button" onClick={onFechar} className="text-texto-sec hover:text-texto transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Nome</label>
            <input
              value={form.nome}
              onChange={atualizar('nome')}
              onBlur={(e) => verificarNomeRepetido(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
            {avisoNome && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> {avisoNome}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => setForm((p) => ({ ...p, telefone: aplicarMascaraTelefone(e.target.value) }))}
              onBlur={(e) => verificarTelefoneRepetido(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
            {avisoTelefone && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> {avisoTelefone}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">E-mail (opcional)</label>
            <input
              value={form.email}
              onChange={atualizar('email')}
              placeholder="cliente@email.com"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Tipo de corte</label>
            <input
              value={form.tipoCortePreferido}
              onChange={atualizar('tipoCortePreferido')}
              placeholder="Ex: degradê baixo, social clássico, buzz cut"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
            <p className="text-xs text-texto-sec mt-1">Campo rápido para o barbeiro bater o olho e lembrar do corte habitual.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">Preferências do cliente</label>
            <textarea
              value={form.preferencias}
              onChange={atualizar('preferencias')}
              placeholder="Ex: degradê baixo, não tirar volume em cima, prefere tesoura, gosta de confirmar pelo WhatsApp."
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
            />
            <p className="text-xs text-texto-sec mt-1">Ajuda o barbeiro a lembrar estilo, acabamento e preferências recorrentes.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">Data de nascimento</label>
              <input
                type="date"
                value={form.dataNascimento}
                onChange={atualizar('dataNascimento')}
                className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1.5">Instagram</label>
              <input
                value={form.instagram}
                onChange={atualizar('instagram')}
                placeholder="@usuario"
                className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
            </div>
          </div>

          {erro && <p className="text-xs text-perigo">{erro}</p>}
        </div>

        {/* Rodapé fixo */}
        <div className="px-6 py-4 border-t border-borda shrink-0">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 border border-borda text-texto-sec rounded-lg py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModalImportacaoClientes = ({ arquivo, onFechar, onSelecionarArquivo, onImportar, importando, resultado }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFechar])

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-borda shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-borda flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-texto">Importar clientes</h3>
            <p className="text-sm text-texto-sec mt-1">Envie uma planilha CSV com as colunas `nome` e `telefone`.</p>
          </div>
          <button type="button" onClick={onFechar} className="text-texto-sec hover:text-texto transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block rounded-2xl border border-dashed border-borda bg-fundo/50 p-5 cursor-pointer hover:border-primaria/40 transition-colors">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onSelecionarArquivo} />
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white border border-borda flex items-center justify-center text-primaria">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-texto">{arquivo ? arquivo.name : 'Selecionar arquivo CSV'}</p>
                <p className="text-xs text-texto-sec mt-1">Campos aceitos: nome, telefone, email, notas, tipo_corte, preferencias, data_nascimento, instagram e tags.</p>
              </div>
            </div>
          </label>

          {resultado && (
            <div className="rounded-2xl border border-borda bg-fundo/40 p-4 space-y-2">
              <p className="text-sm font-medium text-texto">Resultado da importação</p>
              <p className="text-sm text-texto-sec">
                {resultado.criados} criados, {resultado.atualizados} atualizados, {resultado.ignorados} ignorados em {resultado.totalLinhas} linhas.
              </p>
              {Array.isArray(resultado.erros) && resultado.erros.length > 0 && (
                <div className="max-h-32 overflow-auto rounded-xl bg-white border border-borda px-3 py-2">
                  {resultado.erros.slice(0, 10).map((item) => (
                    <p key={item} className="text-xs text-amber-700">{item}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-borda flex gap-3">
          <button type="button" onClick={onFechar} className="flex-1 border border-borda text-texto-sec rounded-lg py-2.5 text-sm">
            Fechar
          </button>
          <button
            type="button"
            onClick={onImportar}
            disabled={!arquivo || importando}
            className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {importando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Importar clientes
          </button>
        </div>
      </div>
    </div>
  )
}

const FRASE_SEGURANCA_MASSA = 'ENVIAR MENSAGEM EM MASSA'

const ModalMensagemMassa = ({
  clientesSelecionados,
  onFechar,
  onEnviar,
  enviando,
}) => {
  const [tipo, setTipo] = useState('TEXTO')
  const [mensagem, setMensagem] = useState('')
  const [audioArquivo, setAudioArquivo] = useState(null)
  const [etapa, setEtapa] = useState('edicao')
  const [confirmouPreview, setConfirmouPreview] = useState(false)
  const [confirmouImpacto, setConfirmouImpacto] = useState(false)
  const [fraseConfirmacao, setFraseConfirmacao] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFechar])

  const total = clientesSelecionados.length
  const podeAvancar = tipo === 'AUDIO' ? Boolean(audioArquivo) : mensagem.trim().length >= 5
  const fraseOk = fraseConfirmacao.trim() === FRASE_SEGURANCA_MASSA
  const podeEnviar = confirmouPreview && confirmouImpacto && fraseOk && !enviando

  const confirmarPrevia = () => {
    if (!podeAvancar) {
      setErro('Escreva uma mensagem com pelo menos 5 caracteres.')
      return
    }
    setErro('')
    setEtapa('confirmacao')
  }

  const enviar = () => {
    if (!podeEnviar) {
      setErro('Conclua todos os gatilhos de segurança antes de enviar.')
      return
    }
    setErro('')
    onEnviar({
      tipo,
      mensagem: mensagem.trim(),
      audioArquivo,
      fraseConfirmacao: fraseConfirmacao.trim(),
      confirmarEnvio: true,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-borda shadow-xl w-full max-w-2xl max-h-[calc(100vh-32px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-borda flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-texto">Mensagem em massa</h3>
            <p className="text-sm text-texto-sec mt-1">
              {total} cliente(s) selecionado(s). Use com cuidado.
            </p>
          </div>
          <button type="button" onClick={onFechar} className="text-texto-sec hover:text-texto transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">
            Anti-erro ativo: para enviar é obrigatório revisar a prévia, confirmar impacto e digitar a frase de segurança.
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('TEXTO')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${tipo === 'TEXTO' ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto'}`}
            >
              <MessageSquare size={14} className="inline mr-1" />
              Texto
            </button>
            <button
              type="button"
              onClick={() => setTipo('AUDIO')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${tipo === 'AUDIO' ? 'bg-primaria text-white border-primaria' : 'border-borda text-texto'}`}
            >
              <Mic size={14} className="inline mr-1" />
              Áudio
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto mb-1.5">
              {tipo === 'AUDIO' ? 'Áudio para envio' : 'Conteúdo da mensagem'}
            </label>
            {tipo === 'AUDIO' ? (
              <label className="block rounded-xl border border-dashed border-borda px-4 py-4 cursor-pointer hover:border-primaria/40">
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0] || null
                    setAudioArquivo(arquivo)
                    if (arquivo) setErro('')
                  }}
                />
                <p className="text-sm font-medium text-texto">
                  {audioArquivo ? audioArquivo.name : 'Selecionar arquivo de áudio'}
                </p>
                <p className="text-xs text-texto-sec mt-1">
                  Formatos comuns aceitos: mp3, ogg, m4a, wav.
                </p>
              </label>
            ) : (
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                placeholder="Escreva a mensagem para os clientes..."
                className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
              />
            )}
          </div>

          <div className="rounded-xl border border-borda bg-fundo/40 p-3">
            <p className="text-xs text-texto-sec mb-2">Prévia</p>
            <p className="text-sm text-texto font-medium mb-2">
              Destinatários: {clientesSelecionados.slice(0, 3).map((c) => c.nome).join(', ')}
              {total > 3 ? ` +${total - 3} cliente(s)` : ''}
            </p>
            {tipo === 'AUDIO' ? (
              <p className="text-sm text-texto-sec">
                Arquivo de áudio selecionado:
                <span className="block mt-1 text-texto">{audioArquivo?.name || 'Nenhum arquivo selecionado'}</span>
              </p>
            ) : (
              <p className="text-sm text-texto">
                {mensagem.trim() || '—'}
              </p>
            )}
          </div>

          {etapa === 'confirmacao' && (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <label className="flex items-start gap-2 text-sm text-texto">
                <input type="checkbox" checked={confirmouPreview} onChange={(e) => setConfirmouPreview(e.target.checked)} className="mt-0.5" />
                Eu revisei a prévia e o conteúdo está correto.
              </label>
              <label className="flex items-start gap-2 text-sm text-texto">
                <input type="checkbox" checked={confirmouImpacto} onChange={(e) => setConfirmouImpacto(e.target.checked)} className="mt-0.5" />
                Confirmo o envio para {total} cliente(s) e entendo que o disparo é real.
              </label>
              <div>
                <label className="block text-xs font-medium text-texto mb-1">
                  Digite a frase de segurança exatamente:
                </label>
                <p className="text-xs text-red-700 font-semibold mb-1">{FRASE_SEGURANCA_MASSA}</p>
                <input
                  value={fraseConfirmacao}
                  onChange={(e) => setFraseConfirmacao(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  placeholder="Digite a frase aqui"
                />
              </div>
            </div>
          )}

          {erro && <p className="text-xs text-perigo">{erro}</p>}
        </div>

        <div className="px-6 py-4 border-t border-borda flex gap-3">
          <button type="button" onClick={onFechar} className="flex-1 border border-borda text-texto-sec rounded-lg py-2.5 text-sm">
            Cancelar
          </button>
          {etapa === 'edicao' ? (
            <button
              type="button"
              onClick={confirmarPrevia}
              disabled={!podeAvancar}
              className="flex-1 bg-primaria hover:bg-primaria-escura disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium"
            >
              Avançar para confirmação
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={!podeEnviar}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar em massa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const DrawerCliente = ({ clienteId, onFechar, onEditar, onExcluir, onVerConversa, onDesativar, onReativar }) => {
  const { tenant } = useAuth()
  const toast = useToast()
  const [cliente, setCliente] = useState(null)
  const [dataNascimento, setDataNascimento] = useState('')
  const [tagsTexto, setTagsTexto] = useState('')
  const [tipoCorteTexto, setTipoCorteTexto] = useState('')
  const [preferenciasTexto, setPreferenciasTexto] = useState('')
  const [salvandoTags, setSalvandoTags] = useState(false)
  const [salvandoNasc, setSalvandoNasc] = useState(false)
  const [salvandoPreferencias, setSalvandoPreferencias] = useState(false)
  const [salvandoExtras, setSalvandoExtras] = useState(false)
  const [enviandoLink, setEnviandoLink] = useState(false)
  const [instagramTexto, setInstagramTexto] = useState('')
  const [alergiasTexto, setAlergiasTexto] = useState('')
  const [erro, setErro] = useState('')

  const gerarLinkAgendamento = () => {
    if (!tenant?.slug) return ''
    const base = `${window.location.origin}/b/${tenant.slug}`
    const params = new URLSearchParams()
    if (cliente?.telefone) params.set('tel', cliente.telefone.replace(/\D/g, ''))
    if (cliente?.nome) params.set('nome', cliente.nome)
    return `${base}?${params}`
  }

  const copiarLink = () => {
    const link = gerarLinkAgendamento()
    if (!link) return
    navigator.clipboard.writeText(link).then(() => toast('Link copiado para a área de transferência!', 'sucesso')).catch(() => toast('Não foi possível copiar', 'erro'))
  }

  const enviarLinkWhatsApp = async () => {
    if (!cliente) return
    const link = gerarLinkAgendamento()
    setEnviandoLink(true)
    try {
      await api.post('/api/ia/enviar-link', { clienteId: cliente.id, linkAgendamento: link })
      toast('Link enviado via WhatsApp!', 'sucesso')
    } catch (e) {
      toast(e?.erro?.mensagem || 'Falha ao enviar. Copie o link manualmente.', 'erro')
    } finally {
      setEnviandoLink(false)
    }
  }

  const carregar = async () => {
    const r = await api.get(`/api/clientes/${clienteId}`)
    setCliente(r.dados)
    setTagsTexto(Array.isArray(r.dados.tags) ? r.dados.tags.join(', ') : '')
    setTipoCorteTexto(r.dados.tipoCortePreferido || '')
    setPreferenciasTexto(r.dados.preferencias || '')
    setInstagramTexto(r.dados.instagram || '')
    setAlergiasTexto(r.dados.alergias || '')
    if (r.dados.dataNascimento) {
      setDataNascimento(new Date(r.dados.dataNascimento).toISOString().split('T')[0])
    }
  }

  useEffect(() => {
    carregar().catch(() => setErro('Não foi possível carregar o cliente.'))
  }, [clienteId])

  const salvarNascimento = async () => {
    if (!cliente) return
    setSalvandoNasc(true)
    setErro('')
    try {
      await api.patch(`/api/clientes/${cliente.id}`, { dataNascimento: dataNascimento || null })
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Falha ao salvar data de nascimento.')
    } finally {
      setSalvandoNasc(false)
    }
  }

  const salvarTags = async () => {
    if (!cliente) return
    setSalvandoTags(true)
    setErro('')
    try {
      const tags = tagsTexto
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await api.patch(`/api/clientes/${cliente.id}`, { tags })
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Falha ao salvar tags.')
    } finally {
      setSalvandoTags(false)
    }
  }

  const salvarPreferencias = async () => {
    if (!cliente) return
    setSalvandoPreferencias(true)
    setErro('')
    try {
      await api.patch(`/api/clientes/${cliente.id}`, {
        tipoCortePreferido: tipoCorteTexto.trim() || null,
        preferencias: preferenciasTexto.trim() || null,
      })
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Falha ao salvar preferências.')
    } finally {
      setSalvandoPreferencias(false)
    }
  }

  if (!cliente) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-lg shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-borda sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <AvatarPessoa pessoa={cliente} tamanho="sm" />
            <h3 className="font-semibold text-texto">{cliente.nome}</h3>
          </div>
          <button onClick={onFechar}><X size={20} className="text-texto-sec" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onVerConversa(cliente)}
              className="px-3 py-2 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-primaria inline-flex items-center gap-1"
            >
              <MessageSquare size={12} /> Ver conversa
            </button>
            <button
              onClick={() => onEditar(cliente)}
              className="px-3 py-2 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-primaria inline-flex items-center gap-1"
            >
              <Pencil size={12} /> Editar dados
            </button>
            {cliente.ativo !== false ? (
              <button
                onClick={() => onDesativar(cliente)}
                className="px-3 py-2 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-amber-600 inline-flex items-center gap-1"
              >
                <UserX size={12} /> Desativar
              </button>
            ) : (
              <button
                onClick={() => onReativar(cliente)}
                className="px-3 py-2 rounded-lg border border-green-300 text-xs font-medium text-green-700 hover:bg-green-50 inline-flex items-center gap-1"
              >
                <UserCheck size={12} /> Reativar
              </button>
            )}
            <button
              onClick={() => onExcluir(cliente)}
              className="px-3 py-2 rounded-lg border border-borda text-xs font-medium text-texto-sec hover:text-perigo inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Excluir cliente
            </button>
          </div>

          {/* Botões de link de agendamento */}
          {tenant?.slug && (
            <div className="bg-primaria-clara/40 border border-primaria/20 rounded-xl p-3">
              <p className="text-xs font-medium text-primaria mb-2 flex items-center gap-1">
                <Link2 size={11} /> Link de agendamento personalizado
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copiarLink}
                  className="flex-1 px-3 py-2 rounded-lg border border-primaria/30 bg-white text-xs font-medium text-primaria hover:bg-primaria/5 transition-colors inline-flex items-center justify-center gap-1"
                >
                  <Link2 size={11} /> Copiar link
                </button>
                <button
                  onClick={enviarLinkWhatsApp}
                  disabled={enviandoLink}
                  className="flex-1 px-3 py-2 rounded-lg bg-primaria text-white text-xs font-medium hover:bg-primaria-escura transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-1"
                >
                  {enviandoLink ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  {enviandoLink ? 'Enviando...' : 'Enviar pelo WhatsApp'}
                </button>
              </div>
            </div>
          )}

          {erro && <p className="text-xs text-perigo">{erro}</p>}

          <div className="grid grid-cols-2 gap-4">
            {[['Telefone', formatarTelefone(cliente.telefone)], ['E-mail', cliente.email || '—'], ['Cliente desde', formatarData(cliente.criadoEm)], ['Total de visitas', cliente.agendamentos?.length || 0]].map(([label, valor]) => (
              <div key={label} className="bg-fundo rounded-xl p-3">
                <p className="text-xs text-texto-sec">{label}</p>
                <p className="text-sm font-medium text-texto mt-0.5">{valor}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2 flex items-center gap-1.5"><Cake size={14} className="text-alerta" /> Aniversário</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
              <button
                onClick={salvarNascimento}
                disabled={salvandoNasc}
                className="px-4 py-2.5 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {salvandoNasc ? <Loader2 size={14} className="animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>

          {cliente.avatarUrl && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
              <p className="text-xs font-medium text-green-700">Foto real do WhatsApp disponível para recepção e agenda.</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-texto mb-2 flex items-center gap-1"><Tag size={14} /> Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {cliente.tags?.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-primaria-clara text-primaria text-xs rounded-full font-medium">{tag}</span>
              ))}
              {(!cliente.tags || cliente.tags.length === 0) && <span className="text-texto-sec text-sm">Sem tags</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={tagsTexto}
                onChange={(e) => setTagsTexto(e.target.value)}
                placeholder="Ex: VIP, Retorno, Barba"
                className="flex-1 px-3 py-2 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
              <button
                onClick={salvarTags}
                disabled={salvandoTags}
                className="px-3 py-2 rounded-lg bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1"
              >
                {salvandoTags ? <Loader2 size={12} className="animate-spin" /> : null}
                Salvar tags
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2">Tipo de corte</p>
            <input
              value={tipoCorteTexto}
              onChange={(e) => setTipoCorteTexto(e.target.value)}
              placeholder="Ex: degradê baixo, moicano disfarçado, social"
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2">Preferências do cliente</p>
            <textarea
              value={preferenciasTexto}
              onChange={(e) => setPreferenciasTexto(e.target.value)}
              rows={4}
              placeholder="Ex: risca lateral discreta, degrade médio, não passar navalha no pescoço."
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-texto-sec">O tipo de corte e essas notas aparecem para o barbeiro na agenda e no atendimento.</p>
              <button
                onClick={salvarPreferencias}
                disabled={salvandoPreferencias}
                className="px-3 py-2 rounded-lg bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1"
              >
                {salvandoPreferencias ? <Loader2 size={12} className="animate-spin" /> : null}
                Salvar perfil
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-3">Histórico de agendamentos</p>
            {cliente.agendamentos?.length === 0 ? (
              <p className="text-texto-sec text-sm">Nenhum agendamento</p>
            ) : (
              <div className="space-y-2">
                {cliente.agendamentos?.map((ag) => (
                  <div key={ag.id} className="flex items-center justify-between p-3 bg-fundo rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-texto">{ag.servico?.nome}</p>
                      <p className="text-xs text-texto-sec">{ag.profissional?.nome} • {formatarData(ag.inicioEm)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ag.status === 'CONCLUIDO' ? 'bg-green-100 text-green-700' :
                      ag.status === 'CANCELADO' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>{ag.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2 flex items-center gap-1.5"><Instagram size={14} /> Instagram</p>
            <div className="flex gap-2">
              <input
                value={instagramTexto}
                onChange={(e) => setInstagramTexto(e.target.value)}
                placeholder="@handle"
                className="flex-1 px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
              />
              <button
                onClick={async () => {
                  setSalvandoExtras(true)
                  try { await api.patch(`/api/clientes/${cliente.id}`, { instagram: instagramTexto.trim() || null }) } finally { setSalvandoExtras(false) }
                }}
                disabled={salvandoExtras}
                className="px-4 py-2.5 bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                {salvandoExtras ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2 flex items-center gap-1.5"><Heart size={14} className="text-red-500" /> Alergias / Sensibilidades</p>
            <textarea
              value={alergiasTexto}
              onChange={(e) => setAlergiasTexto(e.target.value)}
              onBlur={() => api.patch(`/api/clientes/${cliente.id}`, { alergias: alergiasTexto.trim() || null })}
              placeholder="Ex: alergia a amônia, pele sensível ao pós-barba com álcool..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-texto mb-2">Notas</p>
            <textarea
              defaultValue={cliente.notas || ''}
              onBlur={(e) => api.patch(`/api/clientes/${cliente.id}`, { notas: e.target.value })}
              rows={4}
              placeholder="Observações sobre este cliente..."
              className="w-full px-4 py-2.5 rounded-lg border border-borda text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const ConfigClientes = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)
  const [salvandoModal, setSalvandoModal] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [filtroAtivo, setFiltroAtivo] = useState(true)
  const [modalImportacaoAberto, setModalImportacaoAberto] = useState(false)
  const [arquivoImportacao, setArquivoImportacao] = useState(null)
  const [importandoPlanilha, setImportandoPlanilha] = useState(false)
  const [resultadoImportacao, setResultadoImportacao] = useState(null)
  const [clientesSelecionadosIds, setClientesSelecionadosIds] = useState([])
  const [clientesSelecionadosCache, setClientesSelecionadosCache] = useState({})
  const [modalMensagemMassaAberto, setModalMensagemMassaAberto] = useState(false)
  const [enviandoMensagemMassa, setEnviandoMensagemMassa] = useState(false)
  const [selecionandoTodosResultados, setSelecionandoTodosResultados] = useState(false)

  const buscaDebounced = useDebounce(busca)
  const limite = 20

  // Detecta nomes duplicados na página atual (case-insensitive)
  const nomesDuplicados = new Set(
    clientes
      .map((c) => (c.nome || '').toLowerCase().trim())
      .filter((nome, idx, arr) => nome && !pareceTelefone(nome) && arr.indexOf(nome) !== idx)
  )
  const clientesSelecionados = useMemo(
    () => clientesSelecionadosIds
      .map((id) => clientesSelecionadosCache[id])
      .filter(Boolean),
    [clientesSelecionadosIds, clientesSelecionadosCache]
  )
  const todosDaPaginaSelecionados = clientes.length > 0 && clientes.every((cliente) => clientesSelecionadosIds.includes(cliente.id))

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const res = await api.get(`/api/clientes?pagina=${pagina}&limite=${limite}&busca=${encodeURIComponent(buscaDebounced)}&ativo=${filtroAtivo}`)
      const lista = res.clientes || res.dados || []
      setClientes(lista)
      setTotal(res.meta?.total || 0)
      setClientesSelecionadosCache((anterior) => {
        const atualizados = { ...anterior }
        for (const cliente of lista) {
          if (clientesSelecionadosIds.includes(cliente.id)) {
            atualizados[cliente.id] = cliente
          }
        }
        return atualizados
      })
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Falha ao carregar clientes.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [pagina, buscaDebounced, filtroAtivo])

  const totalPaginas = Math.ceil(total / limite)

  const abrirNovo = () => setModal({ ...estadoFormInicial })
  const abrirEdicao = (cliente) => setModal({
    id: cliente.id,
    nome: cliente.nome || '',
    telefone: cliente.telefone || '',
    email: cliente.email || '',
    tipoCortePreferido: cliente.tipoCortePreferido || '',
    preferencias: cliente.preferencias || '',
    dataNascimento: cliente.dataNascimento ? new Date(cliente.dataNascimento).toISOString().split('T')[0] : '',
    instagram: cliente.instagram || '',
  })

  const salvarCliente = async (form) => {
    setSalvandoModal(true)
    setErro('')
    try {
      const corpo = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email?.trim() || null,
        tipoCortePreferido: form.tipoCortePreferido?.trim() || null,
        preferencias: form.preferencias?.trim() || null,
        dataNascimento: form.dataNascimento || null,
        instagram: form.instagram?.trim() || null,
      }

      if (form.id) {
        await api.patch(`/api/clientes/${form.id}`, corpo)
      } else {
        await api.post('/api/clientes', corpo)
      }

      setModal(null)
      await carregar()
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Falha ao salvar cliente.')
    } finally {
      setSalvandoModal(false)
    }
  }

  const desativarCliente = (cliente) => {
    setConfirmar({
      titulo: 'Desativar cliente',
      mensagem: `Desativar "${cliente.nome}"? As conversas ativas serão arquivadas e ele não poderá agendar pelo WhatsApp.`,
      labelConfirmar: 'Desativar',
      onConfirmar: async () => {
        setConfirmar(null)
        try {
          await api.post(`/api/clientes/${cliente.id}/desativar`)
          if (clienteSelecionado === cliente.id) setClienteSelecionado(null)
          toast(`${cliente.nome} desativado.`, 'sucesso')
          await carregar()
        } catch (e) {
          toast(e?.erro?.mensagem || 'Erro ao desativar cliente.', 'erro')
        }
      },
    })
  }

  const reativarCliente = async (cliente) => {
    try {
      await api.post(`/api/clientes/${cliente.id}/reativar`)
      toast(`${cliente.nome} reativado.`, 'sucesso')
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Erro ao reativar cliente.', 'erro')
    }
  }

  const excluirCliente = (cliente) => {
    setConfirmar({
      titulo: 'Excluir cliente',
      mensagem: `Excluir "${cliente.nome}"? O histórico de agendamentos será mantido.`,
      labelConfirmar: 'Excluir',
      onConfirmar: async () => {
        setConfirmar(null)
        setErro('')
        try {
          await api.delete(`/api/clientes/${cliente.id}`)
          if (clienteSelecionado === cliente.id) setClienteSelecionado(null)
          toast('Cliente excluído.', 'sucesso')
          await carregar()
        } catch (e) {
          toast(e?.erro?.mensagem || 'Não foi possível excluir cliente.', 'erro')
        }
      },
    })
  }

  const baixarPlanilhaModelo = () => {
    const csv = [
      'nome,telefone,email,tipo_corte,preferencias,data_nascimento,instagram,notas,tags',
      '"João Silva","62999998888","joao@email.com","Degradê baixo","Prefere tesoura","1995-08-15","@joaosilva","Cliente antigo","vip|barba"',
      '"Maria Souza","62988887777","","Corte feminino","Gosta de atendimento pela manhã","","@maria","Indicação da Ana","indicacao"',
    ].join('\n')

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-importacao-clientes.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const abrirImportacao = () => {
    setResultadoImportacao(null)
    setArquivoImportacao(null)
    setModalImportacaoAberto(true)
  }

  const selecionarArquivoImportacao = (e) => {
    const arquivo = e.target.files?.[0] || null
    setArquivoImportacao(arquivo)
    setResultadoImportacao(null)
  }

  const importarPlanilha = async () => {
    if (!arquivoImportacao) return
    setImportandoPlanilha(true)
    try {
      const formData = new FormData()
      formData.append('arquivo', arquivoImportacao)
      const res = await api.upload('/api/clientes/importar', formData)
      const dados = res.dados || res
      setResultadoImportacao(dados)
      toast(`Importação concluída: ${dados.criados} criados e ${dados.atualizados} atualizados.`, 'sucesso')
      await carregar()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Não foi possível importar a planilha.', 'erro')
    } finally {
      setImportandoPlanilha(false)
    }
  }

  const alternarSelecaoCliente = (cliente) => {
    if (!cliente?.id) return
    const clienteId = cliente.id
    setClientesSelecionadosIds((anteriores) => (
      anteriores.includes(clienteId)
        ? anteriores.filter((id) => id !== clienteId)
        : [...anteriores, clienteId]
    ))
    setClientesSelecionadosCache((anterior) => {
      const proximo = { ...anterior }
      if (clientesSelecionadosIds.includes(clienteId)) {
        delete proximo[clienteId]
      } else {
        proximo[clienteId] = cliente
      }
      return proximo
    })
  }

  const alternarSelecaoPagina = () => {
    const idsPagina = clientes.map((cliente) => cliente.id)
    if (todosDaPaginaSelecionados) {
      const idsPaginaSet = new Set(idsPagina)
      setClientesSelecionadosIds((anteriores) => anteriores.filter((id) => !idsPaginaSet.has(id)))
      setClientesSelecionadosCache((anterior) => {
        const proximo = { ...anterior }
        idsPagina.forEach((id) => delete proximo[id])
        return proximo
      })
      return
    }
    setClientesSelecionadosIds((anteriores) => {
      const unicos = new Set(anteriores)
      idsPagina.forEach((id) => unicos.add(id))
      return [...unicos]
    })
    setClientesSelecionadosCache((anterior) => {
      const proximo = { ...anterior }
      clientes.forEach((cliente) => {
        proximo[cliente.id] = cliente
      })
      return proximo
    })
  }

  const selecionarTodosResultados = async () => {
    if (total <= 0) return
    setSelecionandoTodosResultados(true)
    try {
      const limiteBusca = 200
      const paginas = Math.max(1, Math.ceil(total / limiteBusca))
      const todosIds = []
      const todosCache = {}

      for (let paginaAtual = 1; paginaAtual <= paginas; paginaAtual += 1) {
        const res = await api.get(`/api/clientes?pagina=${paginaAtual}&limite=${limiteBusca}&busca=${encodeURIComponent(buscaDebounced)}&ativo=${filtroAtivo}`)
        const lista = res.clientes || res.dados || []
        lista.forEach((cliente) => {
          todosIds.push(cliente.id)
          todosCache[cliente.id] = cliente
        })
        if (lista.length < limiteBusca) break
      }

      setClientesSelecionadosIds([...new Set(todosIds)])
      setClientesSelecionadosCache(todosCache)
      toast(`Selecionados ${Object.keys(todosCache).length} cliente(s) de todos os resultados.`, 'sucesso')
    } catch (e) {
      toast(e?.erro?.mensagem || 'Não foi possível selecionar todos os resultados.', 'erro')
    } finally {
      setSelecionandoTodosResultados(false)
    }
  }

  const limparSelecao = () => {
    setClientesSelecionadosIds([])
    setClientesSelecionadosCache({})
  }

  const abrirMensagemMassa = () => {
    if (clientesSelecionadosIds.length === 0) {
      toast('Selecione pelo menos 1 cliente para envio em massa.', 'erro')
      return
    }
    setModalMensagemMassaAberto(true)
  }

  const enviarMensagemMassa = async ({ tipo, mensagem, audioArquivo, fraseConfirmacao, confirmarEnvio }) => {
    setEnviandoMensagemMassa(true)
    try {
      const res = tipo === 'AUDIO'
        ? await (() => {
          const formData = new FormData()
          formData.append('clienteIds', JSON.stringify(clientesSelecionadosIds))
          formData.append('tipo', tipo)
          formData.append('fraseConfirmacao', fraseConfirmacao)
          formData.append('confirmarEnvio', String(confirmarEnvio))
          if (audioArquivo) formData.append('audio', audioArquivo)
          return api.upload('/api/clientes/mensagem-massa', formData)
        })()
        : await api.post('/api/clientes/mensagem-massa', {
          clienteIds: clientesSelecionadosIds,
          tipo,
          mensagem,
          fraseConfirmacao,
          confirmarEnvio,
        })
      const dados = res?.dados || {}
      toast(`Disparo concluído: ${dados.enviadosComSucesso || 0} envio(s) com sucesso e ${dados.falhas || 0} falha(s).`, 'sucesso')
      setModalMensagemMassaAberto(false)
      limparSelecao()
    } catch (e) {
      toast(e?.erro?.mensagem || 'Falha ao enviar mensagem em massa.', 'erro')
    } finally {
      setEnviandoMensagemMassa(false)
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Clientes</h1>
          <p className="text-texto-sec text-sm mt-1">{total} clientes cadastrados • você pode adicionar, editar e excluir</p>
        </div>
        <div className="w-full md:w-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={abrirMensagemMassa}
              className="w-full border border-borda bg-white hover:bg-fundo text-texto rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Send size={15} /> Mensagem em massa ({clientesSelecionadosIds.length})
            </button>
            <button
              onClick={baixarPlanilhaModelo}
              className="w-full border border-borda bg-white hover:bg-fundo text-texto rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Download size={15} /> Planilha de importação
            </button>
            <button
              onClick={abrirImportacao}
              className="w-full border border-borda bg-white hover:bg-fundo text-texto rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Upload size={15} /> Upload de planilha
            </button>
            <button
              onClick={abrirNovo}
              className="w-full bg-primaria hover:bg-primaria-escura text-white rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Plus size={15} /> Novo cliente
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-borda bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto">
          Selecionados para disparo: <span className="font-semibold">{clientesSelecionadosIds.length}</span>
        </p>
        <div className="w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={alternarSelecaoPagina}
              className="text-xs border border-borda rounded-lg px-3 py-1.5 hover:bg-fundo"
            >
              {todosDaPaginaSelecionados ? 'Desmarcar página' : 'Selecionar página'}
            </button>
            <button
              onClick={selecionarTodosResultados}
              disabled={selecionandoTodosResultados || total === 0}
              className="text-xs border border-borda rounded-lg px-3 py-1.5 hover:bg-fundo disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {selecionandoTodosResultados ? <Loader2 size={12} className="animate-spin" /> : null}
              Selecionar todos os resultados
            </button>
            {clientesSelecionadosIds.length > 0 && (
              <button
                onClick={limparSelecao}
                className="text-xs border border-borda rounded-lg px-3 py-1.5 hover:bg-fundo"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{erro}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-sec" />
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full pl-8 pr-3 py-2.5 border border-borda rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30 bg-white"
          />
        </div>
        <div className="flex border border-borda rounded-xl overflow-hidden shrink-0">
          <button
            onClick={() => { setFiltroAtivo(true); setPagina(1) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${filtroAtivo ? 'bg-primaria text-white' : 'text-texto-sec hover:bg-fundo'}`}
          >
            Ativos
          </button>
          <button
            onClick={() => { setFiltroAtivo(false); setPagina(1) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${!filtroAtivo ? 'bg-primaria text-white' : 'text-texto-sec hover:bg-fundo'}`}
          >
            Inativos
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-borda bg-fundo">
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Selecionar</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Nome</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Telefone</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Visitas</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Última visita</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-borda animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-borda rounded" /></td>)}
                </tr>
              ))
            ) : clientes.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-texto-sec text-sm">Nenhum cliente encontrado</td></tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className={`border-b border-borda last:border-0 hover:bg-fundo transition-colors ${c.ativo === false ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={clientesSelecionadosIds.includes(c.id)}
                      onChange={() => alternarSelecaoCliente(c)}
                    />
                  </td>
                  <td className="px-5 py-4 cursor-pointer group" onClick={() => setClienteSelecionado(c.id)}>
                    <div className="flex items-center gap-2">
                      <AvatarPessoa pessoa={c} tamanho="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-texto group-hover:text-primaria transition-colors">{c.nome}</span>
                          {pareceTelefone(c.nome) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium" title="Cadastro incompleto — sem nome real">
                              <AlertTriangle size={9} /> Sem nome
                            </span>
                          )}
                          {nomesDuplicados.has((c.nome || '').toLowerCase().trim()) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium" title="Outro cliente com este nome — possível duplicata">
                              <AlertTriangle size={9} /> Duplicata?
                            </span>
                          )}
                          {c.ativo === false && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Inativo</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-texto">{formatarTelefone(c.telefone)}</td>
                  <td className="px-5 py-4 text-sm text-texto">{c.totalAgendamentos || 0}</td>
                  <td className="px-5 py-4 text-sm text-texto-sec">{c.ultimaVisita ? formatarData(c.ultimaVisita) : '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(c)} className="px-2.5 py-1.5 rounded-lg border border-borda text-xs text-texto-sec hover:text-primaria inline-flex items-center gap-1">
                        <Pencil size={12} /> Editar
                      </button>
                      {c.ativo !== false ? (
                        <button onClick={() => desativarCliente(c)} className="px-2.5 py-1.5 rounded-lg border border-borda text-xs text-texto-sec hover:text-amber-600 inline-flex items-center gap-1">
                          <UserX size={12} /> Desativar
                        </button>
                      ) : (
                        <button onClick={() => reativarCliente(c)} className="px-2.5 py-1.5 rounded-lg border border-green-300 text-xs text-green-700 hover:bg-green-50 inline-flex items-center gap-1">
                          <UserCheck size={12} /> Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-borda">
            <p className="text-xs text-texto-sec">Mostrando {(pagina - 1) * limite + 1}–{Math.min(pagina * limite, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 1} className="p-1.5 rounded border border-borda disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="text-sm text-texto px-2">{pagina} / {totalPaginas}</span>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina >= totalPaginas} className="p-1.5 rounded border border-borda disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {carregando ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border border-borda animate-pulse" />)
        ) : clientes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-borda px-5 py-10 text-center text-texto-sec text-sm">Nenhum cliente encontrado</div>
        ) : (
          clientes.map((c) => (
            <div key={c.id} className={`bg-white rounded-2xl border border-borda shadow-sm p-4 ${c.ativo === false ? 'opacity-70' : ''}`}>
              <div className="mb-2">
                <label className="inline-flex items-center gap-2 text-xs text-texto-sec">
                  <input
                    type="checkbox"
                    checked={clientesSelecionadosIds.includes(c.id)}
                    onChange={() => alternarSelecaoCliente(c)}
                  />
                  Selecionar para envio em massa
                </label>
              </div>
              <div className="flex items-center gap-3 mb-3" onClick={() => setClienteSelecionado(c.id)}>
                <AvatarPessoa pessoa={c} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-texto">{c.nome}</p>
                    {nomesDuplicados.has((c.nome || '').toLowerCase().trim()) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                        <AlertTriangle size={9} /> Duplicata?
                      </span>
                    )}
                    {c.ativo === false && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Inativo</span>}
                  </div>
                  <p className="text-xs text-texto-sec">{formatarTelefone(c.telefone)} · {c.totalAgendamentos || 0} visitas</p>
                  {c.ultimaVisita && <p className="text-xs text-texto-sec">Última: {formatarData(c.ultimaVisita)}</p>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setClienteSelecionado(c.id)} className="flex-1 min-w-[80px] py-2 rounded-xl border border-borda text-xs font-medium text-texto-sec text-center inline-flex items-center justify-center gap-1">
                  Ver perfil <ChevronRight size={11} />
                </button>
                <button onClick={() => abrirEdicao(c)} className="flex-1 min-w-[80px] py-2 rounded-xl border border-borda text-xs font-medium text-texto-sec text-center inline-flex items-center justify-center gap-1">
                  <Pencil size={11} /> Editar
                </button>
                {c.ativo !== false ? (
                  <button onClick={() => desativarCliente(c)} className="flex-1 min-w-[80px] py-2 rounded-xl border border-borda text-xs font-medium text-amber-600 text-center inline-flex items-center justify-center gap-1">
                    <UserX size={11} /> Desativar
                  </button>
                ) : (
                  <button onClick={() => reativarCliente(c)} className="flex-1 min-w-[80px] py-2 rounded-xl border border-green-300 text-xs font-medium text-green-700 text-center inline-flex items-center justify-center gap-1">
                    <UserCheck size={11} /> Reativar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between py-2">
            <p className="text-xs text-texto-sec">{(pagina - 1) * limite + 1}–{Math.min(pagina * limite, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagina((p) => p - 1)} disabled={pagina === 1} className="p-2.5 rounded-xl border border-borda disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span className="text-sm text-texto px-2 flex items-center">{pagina}/{totalPaginas}</span>
              <button onClick={() => setPagina((p) => p + 1)} disabled={pagina >= totalPaginas} className="p-2.5 rounded-xl border border-borda disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {clienteSelecionado && (
        <DrawerCliente
          clienteId={clienteSelecionado}
          onFechar={() => setClienteSelecionado(null)}
          onEditar={(cliente) => abrirEdicao(cliente)}
          onExcluir={(cliente) => excluirCliente(cliente)}
          onDesativar={(cliente) => { setClienteSelecionado(null); desativarCliente(cliente) }}
          onReativar={(cliente) => { setClienteSelecionado(null); reativarCliente(cliente) }}
          onVerConversa={(cliente) => {
            setClienteSelecionado(null)
            navigate('/dashboard/mensagens', { state: { clienteId: cliente.id } })
          }}
        />
      )}

      {modal && (
        <ModalCliente
          valorInicial={modal}
          onFechar={() => setModal(null)}
          onSalvar={salvarCliente}
          salvando={salvandoModal}
        />
      )}

      {modalImportacaoAberto && (
        <ModalImportacaoClientes
          arquivo={arquivoImportacao}
          onFechar={() => {
            setModalImportacaoAberto(false)
            setArquivoImportacao(null)
            setResultadoImportacao(null)
          }}
          onSelecionarArquivo={selecionarArquivoImportacao}
          onImportar={importarPlanilha}
          importando={importandoPlanilha}
          resultado={resultadoImportacao}
        />
      )}

      {modalMensagemMassaAberto && (
        <ModalMensagemMassa
          clientesSelecionados={clientesSelecionados}
          onFechar={() => {
            if (enviandoMensagemMassa) return
            setModalMensagemMassaAberto(false)
          }}
          onEnviar={enviarMensagemMassa}
          enviando={enviandoMensagemMassa}
        />
      )}

      {confirmar && (
        <ModalConfirmar {...confirmar} onCancelar={() => setConfirmar(null)} />
      )}
    </div>
  )
}

export default ConfigClientes

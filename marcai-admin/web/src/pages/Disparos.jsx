import { useState, useEffect, useRef } from 'react'
import { apiDisparar, apiTemplates } from '../api'
import {
  Plus, Send, Trash2, X, FileSpreadsheet,
  CheckCircle2, XCircle, AlertTriangle, Download, Users, Phone,
  MessageSquare, ChevronDown
} from 'lucide-react'

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const colTelefone = headers.findIndex(h => ['telefone', 'phone', 'numero', 'número', 'cel', 'celular', 'whatsapp', 'tel'].some(k => h.includes(k)))
  const colNome = headers.findIndex(h => ['nome', 'name', 'cliente', 'contato', 'contact'].some(k => h.includes(k)))
  const registros = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/['"]/g, ''))
    const telefone = String(cols[colTelefone >= 0 ? colTelefone : 0] || '').replace(/\D/g, '')
    const nome = colNome >= 0 ? cols[colNome] : null
    if (telefone.length >= 8) registros.push({ telefone, nome: nome || null })
  }
  return registros
}

function downloadModeloCSV() {
  const conteudo = 'telefone;nome\n5511999999999;João Silva\n5521888888888;Maria Santos'
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'modelo-disparo.csv'; a.click()
  URL.revokeObjectURL(url)
}

function TagNumero({ item, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700">
      <Phone size={10} className="text-slate-400 shrink-0" />
      <span className="font-mono">{item.telefone}</span>
      {item.nome && <span className="text-slate-500">· {item.nome}</span>}
      <button onClick={onRemove} className="ml-1 text-slate-400 hover:text-red-500 transition-colors"><X size={11} /></button>
    </div>
  )
}

export default function Disparos() {
  const fileRef = useRef(null)
  const [templates, setTemplates] = useState([])
  const [numeros, setNumeros] = useState([])
  const [texto, setTexto] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [tab, setTab] = useState('csv')
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    apiTemplates().then(setTemplates).catch(() => {})
  }, [])

  const handleCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result)
        if (parsed.length === 0) { setErro('Nenhum número encontrado no arquivo.'); return }
        setNumeros(prev => {
          const existentes = new Set(prev.map(n => n.telefone))
          return [...prev, ...parsed.filter(p => !existentes.has(p.telefone))]
        })
        setErro('')
      } catch { setErro('Erro ao processar o arquivo CSV.') }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const adicionarManual = () => {
    const linhas = manualInput.split(/[\n,;]+/)
    const novos = []
    for (const linha of linhas) {
      const partes = linha.trim().split(/[\s\t]+/)
      const telefone = partes[0].replace(/\D/g, '')
      const nome = partes.slice(1).join(' ').trim() || null
      if (telefone.length >= 8) novos.push({ telefone, nome })
    }
    setNumeros(prev => {
      const existentes = new Set(prev.map(n => n.telefone))
      return [...prev, ...novos.filter(n => !existentes.has(n.telefone))]
    })
    setManualInput('')
  }

  const enviar = async () => {
    if (numeros.length === 0) { setErro('Adicione ao menos um número.'); return }
    if (!texto.trim()) { setErro('Digite a mensagem de disparo.'); return }
    setEnviando(true); setResultado(null); setErro('')
    try {
      const resp = await apiDisparar({ numeros, texto: texto.trim() })
      setResultado(resp)
      if (resp.falhas === 0) setNumeros([])
    } catch (err) { setErro(err.message) } finally { setEnviando(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Disparos em Massa</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importe CSV ou adicione números manualmente · envia pelo número WhatsApp do admin
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Coluna esquerda: números */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            {/* Tabs CSV/Manual */}
            <div className="flex border-b border-slate-100">
              {[
                { key: 'csv', icon: FileSpreadsheet, label: 'Importar CSV' },
                { key: 'manual', icon: Plus, label: 'Manual' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'text-primaria border-b-2 border-primaria bg-primaria/3' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'csv' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-primaria/50 hover:bg-primaria/3 transition-all group"
                  >
                    <FileSpreadsheet size={28} className="text-slate-300 group-hover:text-primaria/50 mx-auto mb-2 transition-colors" />
                    <p className="text-sm font-semibold text-slate-700">Clique para selecionar CSV</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Coluna <code className="bg-slate-100 px-1 rounded">telefone</code> obrigatória ·{' '}
                      <code className="bg-slate-100 px-1 rounded">nome</code> opcional
                    </p>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
                  </div>
                  <button onClick={downloadModeloCSV} className="btn-ghost text-xs w-full justify-center border border-slate-200">
                    <Download size={12} /> Baixar modelo CSV
                  </button>
                </div>
              )}

              {tab === 'manual' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Um número por linha: <code className="bg-slate-100 px-1 rounded">5511999999999 Nome</code>
                  </p>
                  <textarea
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    rows={5}
                    className="input-field resize-none font-mono text-xs"
                    placeholder={'5511999999999 João\n5521888888888 Maria'}
                  />
                  <button onClick={adicionarManual} disabled={!manualInput.trim()} className="btn-primary w-full justify-center">
                    <Plus size={14} /> Adicionar à lista
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lista de números */}
          {numeros.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-500" />
                  <p className="text-sm font-semibold text-slate-800">
                    {numeros.length} destinatário{numeros.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => setNumeros([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 size={11} /> Limpar
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {numeros.map(item => (
                  <TagNumero
                    key={item.telefone}
                    item={item}
                    onRemove={() => setNumeros(p => p.filter(n => n.telefone !== item.telefone))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: mensagem + envio */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title">Mensagem</p>
              {templates.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowTemplates(v => !v)}
                    className="btn-ghost text-xs border border-slate-200 py-1.5"
                  >
                    <MessageSquare size={12} /> Templates <ChevronDown size={11} />
                  </button>
                  {showTemplates && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      {templates.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => { setTexto(tpl.corpo); setShowTemplates(false) }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-sm font-semibold text-slate-800">{tpl.nome}</p>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{tpl.corpo}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={8}
              className="input-field resize-none"
              placeholder={'Olá {nome}! 👋\n\nAqui é a equipe Marcaí.\n\nTemos novidades para você...'}
            />

            {texto && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">Preview</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {texto.replace(/\{nome\}/gi, 'João Silva').replace(/\{plano\}/gi, 'SALAO').replace(/\{slug\}/gi, 'barbearia-x')}
                </p>
              </div>
            )}
          </div>

          {erro && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertTriangle size={15} className="shrink-0" /> {erro}
            </div>
          )}

          {resultado && (
            <div className={`card p-5 ${resultado.falhas === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                {resultado.falhas === 0
                  ? <CheckCircle2 size={17} className="text-emerald-600" />
                  : <AlertTriangle size={17} className="text-amber-600" />}
                <p className="font-semibold text-slate-800">Disparo concluído</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[['Total', resultado.total, 'slate-800'], ['Enviados', resultado.enviados, 'emerald-600'], ['Falhas', resultado.falhas, 'red-500']].map(([label, val, color]) => (
                  <div key={label}>
                    <p className={`text-2xl font-bold text-${color}`}>{val}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {resultado.falhas > 0 && (
                <div className="mt-3 space-y-1 max-h-28 overflow-y-auto">
                  {(resultado.resultados || []).filter(r => !r.enviado).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-700">
                      <XCircle size={11} />
                      <span className="font-mono">{r.telefone}</span>
                      <span className="text-red-500">— {r.motivo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={enviar}
            disabled={enviando || numeros.length === 0 || !texto.trim()}
            className="btn-primary w-full justify-center py-3 text-base shadow-lg disabled:shadow-none"
          >
            {enviando ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando {numeros.length} mensagen{numeros.length !== 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Send size={17} />
                Disparar para {numeros.length} contato{numeros.length !== 1 ? 's' : ''}
              </>
            )}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Mensagens enviadas pelo número WhatsApp do admin (configurado em Integrações)
          </p>
        </div>
      </div>
    </div>
  )
}

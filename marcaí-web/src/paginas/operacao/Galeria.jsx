import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, Star, StarOff, Trash2, X, Camera, Filter, RefreshCw, ImageOff, AlertTriangle } from 'lucide-react'
import api from '../../servicos/api'
import { useToast } from '../../contextos/ToastContexto'
import ModalConfirmar from '../../componentes/ui/ModalConfirmar'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const Galeria = () => {
  const toast = useToast()
  const inputRef = useRef(null)

  const [fotos, setFotos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [uploadando, setUploadando] = useState(false)

  // Filtros
  const [filtroProfissional, setFiltroProfissional] = useState('')
  const [filtroDestaque, setFiltroDestaque] = useState(false)

  // Modal upload
  const [modalUpload, setModalUpload] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [uploadForm, setUploadForm] = useState({ profissionalId: '', titulo: '', servicoNome: '', destaque: false })

  // Modal exclusão
  const [fotoParaExcluir, setFotoParaExcluir] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({ limite: '100' })
      if (filtroProfissional) params.set('profissionalId', filtroProfissional)
      if (filtroDestaque) params.set('destaque', 'true')
      const [resF, resP] = await Promise.allSettled([
        api.get(`/api/galeria?${params}`),
        api.get('/api/profissionais'),
      ])
      setFotos(resF.status === 'fulfilled' ? (resF.value?.dados || []) : [])
      setProfissionais(resP.status === 'fulfilled' ? (resP.value?.dados || []) : [])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [filtroProfissional, filtroDestaque])

  const parecerComprovante = (file) => {
    const nome = (file?.name || '').toLowerCase()
    return /comprovante|pix|recibo|receipt|transf|pagamento|boleto|extrato/.test(nome)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewFile(file)
    setModalUpload(true)
  }

  const handleUpload = async () => {
    if (!previewFile) return
    setUploadando(true)
    try {
      const form = new FormData()
      form.append('foto', previewFile)
      if (uploadForm.profissionalId) form.append('profissionalId', uploadForm.profissionalId)
      if (uploadForm.titulo) form.append('titulo', uploadForm.titulo)
      if (uploadForm.servicoNome) form.append('servicoNome', uploadForm.servicoNome)
      form.append('destaque', String(uploadForm.destaque))

      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_URL}/api/galeria`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!data.sucesso) throw new Error(data.erro?.mensagem || 'Erro ao enviar')
      toast('Foto adicionada!', 'sucesso')
      setModalUpload(false)
      setPreviewFile(null)
      setUploadForm({ profissionalId: '', titulo: '', servicoNome: '', destaque: false })
      if (inputRef.current) inputRef.current.value = ''
      await carregar()
    } catch (e) {
      toast(e.message || 'Erro ao enviar foto', 'erro')
    } finally {
      setUploadando(false)
    }
  }

  const toggleDestaque = async (foto) => {
    try {
      await api.patch(`/api/galeria/${foto.id}`, { destaque: !foto.destaque })
      setFotos((prev) => prev.map((f) => f.id === foto.id ? { ...f, destaque: !f.destaque } : f))
    } catch {
      toast('Erro ao atualizar destaque', 'erro')
    }
  }

  const excluir = async () => {
    if (!fotoParaExcluir) return
    try {
      await api.delete(`/api/galeria/${fotoParaExcluir.id}`)
      toast('Foto removida', 'sucesso')
      setFotoParaExcluir(null)
      await carregar()
    } catch {
      toast('Erro ao remover foto', 'erro')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Galeria de Cortes</h1>
          <p className="text-texto-sec text-sm mt-1">Portfólio de trabalhos da barbearia</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregar} className="p-2 rounded-lg border border-borda text-texto-sec hover:text-texto transition-colors" title="Atualizar">
            <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 bg-primaria text-white rounded-xl text-sm font-semibold hover:bg-primaria-escura transition-colors flex items-center gap-2"
          >
            <Upload size={16} /> Adicionar foto
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-borda p-4 shadow-sm flex flex-wrap items-center gap-3">
        <Filter size={15} className="text-texto-sec" />
        {profissionais.length > 0 && (
          <select
            value={filtroProfissional}
            onChange={(e) => setFiltroProfissional(e.target.value)}
            className="border border-borda rounded-lg px-3 py-1.5 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primaria/30"
          >
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
        <button
          onClick={() => setFiltroDestaque((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${filtroDestaque ? 'bg-alerta text-white border-alerta' : 'border-borda text-texto-sec hover:border-alerta hover:text-alerta'}`}
        >
          <Star size={13} /> Apenas destaques
        </button>
        <span className="ml-auto text-xs text-texto-sec">{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid de fotos */}
      {carregando ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-texto-sec" /></div>
      ) : fotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-fundo border border-borda flex items-center justify-center">
            <ImageOff size={28} className="text-texto-sec" />
          </div>
          <div>
            <p className="text-base font-medium text-texto">Nenhuma foto no portfólio</p>
            <p className="text-sm text-texto-sec mt-1">Clique em "Adicionar foto" para começar.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {fotos.map((foto) => (
            <div key={foto.id} className="relative group rounded-2xl overflow-hidden bg-gray-100 aspect-square shadow-sm">
              <img
                src={`${API_URL}${foto.fotoUrl}`}
                alt={foto.titulo || 'Corte'}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex flex-col justify-between p-2">
                {/* Top actions */}
                <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleDestaque(foto)}
                    className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                    title={foto.destaque ? 'Remover destaque' : 'Marcar como destaque'}
                  >
                    {foto.destaque ? <Star size={13} className="text-alerta fill-alerta" /> : <StarOff size={13} className="text-gray-500" />}
                  </button>
                  <button
                    onClick={() => setFotoParaExcluir(foto)}
                    className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                    title="Excluir foto"
                  >
                    <Trash2 size={13} className="text-perigo" />
                  </button>
                </div>
                {/* Bottom info */}
                {(foto.titulo || foto.profissional || foto.servicoNome) && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {foto.titulo && <p className="text-white text-xs font-semibold drop-shadow">{foto.titulo}</p>}
                    {foto.profissional && <p className="text-white/80 text-xs drop-shadow">{foto.profissional.nome}</p>}
                    {foto.servicoNome && <p className="text-white/70 text-xs drop-shadow">{foto.servicoNome}</p>}
                  </div>
                )}
              </div>
              {/* Destaque badge */}
              {foto.destaque && (
                <div className="absolute top-1.5 left-1.5">
                  <Star size={14} className="text-alerta fill-alerta drop-shadow" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal upload */}
      {modalUpload && previewFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-borda">
              <h3 className="font-semibold text-texto flex items-center gap-2"><Camera size={16} /> Adicionar ao portfólio</h3>
              <button onClick={() => { setModalUpload(false); setPreviewFile(null) }}>
                <X size={20} className="text-texto-sec" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <img
                src={URL.createObjectURL(previewFile)}
                alt="Preview"
                className="w-full h-48 object-cover rounded-xl"
              />
              {parecerComprovante(previewFile) && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                  <span>O nome do arquivo parece ser um comprovante. Verifique se é a foto certa antes de publicar.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-texto-sec">Profissional</label>
                  <select
                    value={uploadForm.profissionalId}
                    onChange={(e) => setUploadForm((p) => ({ ...p, profissionalId: e.target.value }))}
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  >
                    <option value="">Sem profissional</option>
                    {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-texto-sec">Serviço</label>
                  <input
                    type="text"
                    value={uploadForm.servicoNome}
                    onChange={(e) => setUploadForm((p) => ({ ...p, servicoNome: e.target.value }))}
                    placeholder="Ex: Degradê"
                    className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-texto-sec">Título (opcional)</label>
                <input
                  type="text"
                  value={uploadForm.titulo}
                  onChange={(e) => setUploadForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Degradê moderno"
                  className="w-full mt-1 border border-borda rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primaria/30"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadForm.destaque}
                  onChange={(e) => setUploadForm((p) => ({ ...p, destaque: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-texto flex items-center gap-1">
                  <Star size={13} className="text-alerta" /> Marcar como destaque
                </span>
              </label>
            </div>
            <div className="flex gap-3 p-5 border-t border-borda">
              <button onClick={() => { setModalUpload(false); setPreviewFile(null) }} className="flex-1 py-2.5 border border-borda rounded-xl text-sm text-texto-sec hover:bg-fundo transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploadando}
                className="flex-1 py-2.5 bg-primaria text-white rounded-xl text-sm font-semibold hover:bg-primaria-escura transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {uploadando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadando ? 'Enviando...' : 'Salvar foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal exclusão */}
      {fotoParaExcluir && (
        <ModalConfirmar
          titulo="Excluir foto"
          descricao="Esta foto será removida permanentemente do portfólio."
          onConfirmar={excluir}
          onCancelar={() => setFotoParaExcluir(null)}
          textoBotao="Excluir"
          variante="perigo"
        />
      )}
    </div>
  )
}

export default Galeria

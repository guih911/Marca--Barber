import { useEffect, useMemo, useState } from 'react'
import { Loader2, QrCode, RefreshCw, Wifi, WifiOff, LogOut, Smartphone, CheckCircle2 } from 'lucide-react'
import api from '../../servicos/api'
import { Button } from '../../componentes/ui/button'

const ConfigIntegracoes = () => {
  const [status, setStatus] = useState('idle')
  const [qrCode, setQrCode] = useState('')
  const [carregandoQr, setCarregandoQr] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const conectado = status === 'conectado'
  const aguardando = status === 'aguardando_qr' || status === 'aguardando' || status === 'inicializando'

  const consultarStatus = async () => {
    try {
      const res = await api.post('/api/ia/wwebjs/status', {})
      const dados = res?.dados || {}
      if (dados.status) setStatus(dados.status)
      if (dados.qr) setQrCode(dados.qr)
    } catch {
      setStatus('idle')
    }
  }

  const garantirProvedorQr = async () => {
    try {
      const resTenant = await api.get('/api/tenants/meu')
      const cfgAtual = resTenant?.dados?.configWhatsApp || {}
      await api.patch('/api/tenants/meu', { configWhatsApp: { ...cfgAtual, provedor: 'wwebjs' } })
    } catch {
      // melhor esforço
    }
  }

  useEffect(() => { consultarStatus() }, [])

  useEffect(() => {
    if (!aguardando) return undefined
    const timer = setInterval(consultarStatus, 3000)
    return () => clearInterval(timer)
  }, [aguardando])

  const gerarQrCode = async () => {
    setCarregandoQr(true)
    setErro('')
    setMensagem('')
    try {
      await garantirProvedorQr()
      const res = await api.post('/api/ia/wwebjs/iniciar', {})
      const dados = res?.dados || {}
      if (dados.status === 'conectado') {
        setStatus('conectado')
        setQrCode('')
        setMensagem('WhatsApp conectado com sucesso.')
        return
      }
      setStatus(dados.status || 'aguardando_qr')
      setQrCode(dados.qr || '')
      if (!dados.qr) setMensagem('Conexão iniciada. O QR Code vai aparecer em instantes.')
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível gerar o QR Code.')
    } finally {
      setCarregandoQr(false)
    }
  }

  const desconectar = async () => {
    setDesconectando(true)
    setErro('')
    setMensagem('')
    try {
      await api.post('/api/ia/wwebjs/desconectar', {})
      setStatus('idle')
      setQrCode('')
      setMensagem('WhatsApp desconectado.')
    } catch (e) {
      setErro(e?.erro?.mensagem || 'Não foi possível desconectar.')
    } finally {
      setDesconectando(false)
    }
  }

  const passos = [
    { num: 1, label: 'Clique em "Conectar WhatsApp" abaixo' },
    { num: 2, label: 'No celular, abra o WhatsApp e toque em "Aparelhos conectados"' },
    { num: 3, label: 'Toque em "Conectar aparelho" e escaneie o QR Code' },
  ]

  const badgeStatus = useMemo(() => {
    if (conectado) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-semibold">
          <Wifi size={14} /> Conectado
        </span>
      )
    }
    if (aguardando) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-semibold">
          <Loader2 size={14} className="animate-spin" /> Aguardando leitura…
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 px-3 py-1 text-sm font-semibold">
        <WifiOff size={14} /> Não conectado
      </span>
    )
  }, [conectado, aguardando, status])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Integrações</h1>
        <p className="text-sm text-texto-sec mt-1">Conecte o WhatsApp da barbearia para ativar o atendente virtual.</p>
      </div>

      <section className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-texto">WhatsApp</h2>
              <p className="text-xs text-texto-sec">Conexão via QR Code</p>
            </div>
          </div>
          {badgeStatus}
        </div>

        {/* Estado: conectado */}
        {conectado && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">WhatsApp conectado</p>
              <p className="text-xs text-green-700 mt-0.5">O atendente virtual está ativo e recebendo mensagens.</p>
            </div>
          </div>
        )}

        {/* Estado: idle — mostrar passos */}
        {!conectado && !aguardando && !qrCode && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-texto">Como conectar:</p>
            <ol className="space-y-2">
              {passos.map((passo) => (
                <li key={passo.num} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primaria text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {passo.num}
                  </span>
                  <span className="text-sm text-texto-sec">{passo.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* QR Code */}
        {qrCode && (
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm font-medium text-texto">Escaneie o código com o WhatsApp do celular:</p>
            <div className="rounded-2xl border-2 border-dashed border-primaria/30 p-4 bg-white">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-52 h-52 rounded-xl" />
            </div>
            <p className="text-xs text-texto-sec">O código expira em alguns minutos. Gere novamente se necessário.</p>
          </div>
        )}

        {/* Aguardando sem QR ainda */}
        {aguardando && !qrCode && (
          <div className="flex items-center justify-center gap-3 py-6 text-texto-sec">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Gerando QR Code…</span>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 flex-wrap">
          {!conectado && (
            <Button onClick={gerarQrCode} disabled={carregandoQr || aguardando} className="gap-2">
              {carregandoQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
              {qrCode ? 'Gerar novo QR' : 'Conectar WhatsApp'}
            </Button>
          )}
          {(status !== 'idle' || qrCode) && !conectado && (
            <Button variante="outline" onClick={consultarStatus} className="gap-2">
              <RefreshCw size={14} /> Atualizar
            </Button>
          )}
          {conectado && (
            <Button variante="destructive" onClick={desconectar} disabled={desconectando} className="gap-2">
              {desconectando ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Desconectar
            </Button>
          )}
        </div>

        {mensagem && (
          <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm px-4 py-3">
            {mensagem}
          </div>
        )}
        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {erro}
          </div>
        )}
      </section>
    </div>
  )
}

export default ConfigIntegracoes

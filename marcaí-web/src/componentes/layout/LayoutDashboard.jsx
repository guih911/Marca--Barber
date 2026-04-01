import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  Menu,
  QrCode,
  Loader2,
  Download,
  House,
  CalendarDays,
  MessageSquareMore,
  Users,
} from 'lucide-react'
import Sidebar from './Sidebar'
import api from '../../servicos/api'

const titulos = {
  '/dashboard': 'Painel',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/mensagens': 'Mensagens',
  '/dashboard/agendamentos': 'Agendamentos',
  '/operacao/clientes': 'Clientes',
  '/operacao/planos': 'Planos e Assinaturas',
  '/operacao/fidelidade': 'Fidelidade',
  '/operacao/estoque': 'Estoque',
  '/operacao/comanda': 'Comanda Digital',
  '/operacao/comissoes': 'Comissoes',
  '/operacao/relatorios': 'Relatorios',
  '/config/profissionais': 'Profissionais',
  '/config/horarios': 'Horarios',
  '/config/negocio': 'Meu Negocio',
  '/config/servicos': 'Servicos',
  '/config/pacotes': 'Pacotes e Combos',
  '/config/recursos': 'Recursos do Sistema',
  '/config/usuarios': 'Usuarios',
  '/config/integracoes': 'Integracoes',
  '/config/ia': 'Configuracao da IA',
  '/config/teste-ia': 'Teste da IA',
  '/operacao/caixa': 'Caixa',
  '/operacao/lista-espera': 'Lista de Espera',
  '/operacao/galeria': 'Galeria',
}

const subtitulos = {
  '/dashboard': 'Visao geral da operacao de hoje',
  '/dashboard/agenda': 'Visualize e gerencie os horarios do dia',
  '/dashboard/mensagens': 'Conversas dos clientes via WhatsApp',
  '/dashboard/agendamentos': 'Todos os agendamentos do seu negocio',
  '/operacao/clientes': 'Cadastro e historico dos seus clientes',
  '/operacao/planos': 'Planos de assinatura e mensalidades',
  '/operacao/fidelidade': 'Programa de pontos e recompensas',
  '/operacao/estoque': 'Controle de produtos e insumos',
  '/operacao/comanda': 'Adicione produtos e extras ao atendimento do dia',
  '/operacao/comissoes': 'Comissoes e repasses dos profissionais',
  '/operacao/relatorios': 'Analise financeira e de atendimentos',
  '/config/profissionais': 'Cadastro e gestao dos profissionais',
  '/config/horarios': 'Horarios de trabalho por profissional',
  '/config/servicos': 'Servicos avulsos e precos',
  '/config/pacotes': 'Pacotes e combos de servicos',
  '/config/negocio': 'Dados e configuracoes da barbearia',
  '/config/recursos': 'Ative ou desative funcionalidades do sistema',
  '/config/usuarios': 'Usuarios com acesso ao painel',
  '/config/integracoes': 'Conecte o WhatsApp e outras integracoes',
  '/config/ia': 'Configuracoes de comportamento e personalidade da IA',
  '/config/teste-ia': 'Simule conversas para testar a IA',
  '/operacao/caixa': 'Controle de entradas e saidas financeiras',
  '/operacao/lista-espera': 'Gerencie a fila de espera dos clientes',
  '/operacao/galeria': 'Fotos dos trabalhos realizados',
}

const itensNavegacaoMobile = [
  { label: 'Inicio', rota: '/dashboard', icone: House },
  { label: 'Agenda', rota: '/dashboard/agenda', icone: CalendarDays },
  { label: 'Mensagens', rota: '/dashboard/mensagens', icone: MessageSquareMore },
  { label: 'Clientes', rota: '/operacao/clientes', icone: Users },
]

const StatusWhatsApp = () => {
  const [status, setStatus] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.post('/api/ia/wwebjs/status')
        setStatus(res.dados?.status || 'desconectado')
      } catch {
        setStatus('desconectado')
      }
    }

    verificar()
    const intervalo = setInterval(verificar, 10000)
    return () => clearInterval(intervalo)
  }, [])

  if (status === null) return null

  const { pathname } = window.location
  if (status === 'desconectado' && pathname !== '/config/integracoes') return null

  const visualPorStatus = {
    conectado: {
      classe: 'bg-sucesso/10 text-sucesso',
      icone: <Wifi size={13} />,
      label: 'WhatsApp',
    },
    aguardando_qr: {
      classe: 'bg-alerta/10 text-alerta',
      icone: <QrCode size={13} />,
      label: 'Ler QR',
    },
    iniciando: {
      classe: 'bg-gray-100 text-texto-sec',
      icone: <Loader2 size={13} className="animate-spin" />,
      label: 'Conectando',
    },
    desconectado: {
      classe: 'bg-perigo/10 text-perigo',
      icone: <WifiOff size={13} />,
      label: 'Desconectado',
    },
  }

  const visual = visualPorStatus[status] || visualPorStatus.desconectado
  const clicavel = status === 'aguardando_qr' || status === 'desconectado'

  return (
    <button
      onClick={clicavel ? () => navigate('/config/integracoes') : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold transition-colors ${visual.classe} ${clicavel ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      title={clicavel ? 'Ir para Integracoes' : undefined}
    >
      {visual.icone}
      <span className="hidden sm:inline">{visual.label}</span>
    </button>
  )
}

const LayoutDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [compacto, setCompacto] = useState(() => {
    try {
      return localStorage.getItem('sidebar_compacto') === 'true'
    } catch {
      return false
    }
  })
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [instalando, setInstalando] = useState(false)
  const [appInstalado, setAppInstalado] = useState(false)
  const headerRef = useRef(null)

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const atualizar = () => {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    }
    atualizar()
    const obs = new ResizeObserver(atualizar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const titulo = titulos[location.pathname] || 'Marcai Barber'
  const subtitulo = subtitulos[location.pathname] || ''

  useEffect(() => {
    setMenuMobileAberto(false)
  }, [location.pathname])

  useEffect(() => {
    const emStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone
    setAppInstalado(Boolean(emStandalone))

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setAppInstalado(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const subtituloCurto = useMemo(() => {
    if (!subtitulo) return ''
    return subtitulo.length > 58 ? `${subtitulo.slice(0, 58)}...` : subtitulo
  }, [subtitulo])

  const toggleCompacto = () => {
    setCompacto((prev) => {
      const novo = !prev
      try {
        localStorage.setItem('sidebar_compacto', String(novo))
      } catch {}
      return novo
    })
  }

  const instalarApp = async () => {
    if (!deferredPrompt) return

    setInstalando(true)
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice.catch(() => null)
    } finally {
      setDeferredPrompt(null)
      setInstalando(false)
    }
  }

  const rotaAtiva = (rota) => {
    if (rota === '/dashboard') return location.pathname === rota
    return location.pathname.startsWith(rota)
  }

  return (
    <div className="flex h-dvh bg-fundo overflow-hidden">
      {menuMobileAberto && (
        <div
          className="fixed inset-0 bg-black/55 z-40 md:hidden"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 md:relative md:z-auto
          transition-transform duration-300
          ${menuMobileAberto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar compacto={compacto} onFechar={() => setMenuMobileAberto(false)} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header ref={headerRef} className="safe-top shrink-0 border-b border-borda bg-white/95 backdrop-blur shadow-card">
          <div className="flex items-center justify-between gap-3 px-3 py-3 md:px-6 md:py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMenuMobileAberto(true)}
                className="p-2 rounded-xl text-texto-sec hover:text-texto hover:bg-fundo transition-colors md:hidden"
                title="Abrir menu"
              >
                <Menu size={18} />
              </button>

              <button
                onClick={toggleCompacto}
                className="hidden md:flex p-2 rounded-xl text-texto-sec hover:text-texto hover:bg-fundo transition-colors"
                title={compacto ? 'Expandir menu' : 'Recolher menu'}
              >
                {compacto ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>

              <div className="min-w-0 max-w-2xl">
                <h1 className="text-[15px] font-semibold text-texto truncate">{titulo}</h1>
                {subtitulo && <p className="text-[11px] text-texto-sec hidden md:block whitespace-nowrap">{subtitulo}</p>}
                {subtituloCurto && <p className="text-[11px] text-texto-sec md:hidden truncate">{subtituloCurto}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              {!appInstalado && deferredPrompt && (
                <button
                  onClick={instalarApp}
                  disabled={instalando}
                  className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-white px-3 py-1.5 text-[11px] md:text-xs font-semibold text-texto hover:bg-fundo transition-colors disabled:opacity-60"
                >
                  {instalando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span className="hidden sm:inline">Instalar app</span>
                </button>
              )}
              <StatusWhatsApp />
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 md:p-6 md:pb-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {itensNavegacaoMobile.map((item) => {
            const ativo = rotaAtiva(item.rota)
            const Icone = item.icone
            return (
              <button
                key={item.rota}
                onClick={() => navigate(item.rota)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-colors ${
                  ativo ? 'bg-primaria-clara text-primaria' : 'text-texto-sec hover:bg-fundo'
                }`}
              >
                <Icone size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}

          <button
            onClick={() => setMenuMobileAberto(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium text-texto-sec hover:bg-fundo transition-colors"
          >
            <Menu size={18} />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default LayoutDashboard

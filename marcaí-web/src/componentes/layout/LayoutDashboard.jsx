import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Loader2,
  Download,
  House,
  CalendarDays,
  MessageSquareMore,
  Users,
} from 'lucide-react'
import Sidebar from './Sidebar'
import ConectarWhatsappButton from '../ConectarWhatsappButton'
import useAuth from '../../hooks/useAuth'

const titulos = {
  '/dashboard': 'Painel',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/mensagens': 'Mensagens',
  '/dashboard/agendamentos': 'Agendamentos',
  '/operacao/clientes': 'Clientes',
  '/config/profissionais': 'Profissionais',
  '/config/horarios': 'Horarios',
  '/config/negocio': 'Meu Negocio',
  '/config/servicos': 'Servicos',
  '/config/recursos': 'Recursos do Sistema',
  '/config/usuarios': 'Usuarios',
  '/config/integracoes/guia-whatsapp': 'Guia WhatsApp (Meta)',
  '/operacao/caixa': 'Caixa',
  '/operacao/lista-espera': 'Lista de espera',
}

const subtitulos = {
  '/dashboard': 'Visão geral da operação de hoje',
  '/dashboard/agenda': 'Visualize e gerencie os horarios do dia',
  '/dashboard/mensagens': 'Conversas dos clientes via WhatsApp',
  '/dashboard/agendamentos': 'Todos os agendamentos do seu negocio',
  '/operacao/clientes': 'Cadastro e historico dos seus clientes',
  '/config/profissionais': 'Cadastro e gestao dos profissionais',
  '/config/horarios': 'Horarios de trabalho por profissional',
  '/config/servicos': 'Servicos avulsos e precos',
  '/config/negocio': 'Dados e configuracoes da barbearia',
  '/config/recursos': 'Ative ou desative funcionalidades do sistema',
  '/config/usuarios': 'Usuarios com acesso ao painel',
  '/config/integracoes/guia-whatsapp': 'Passo a passo da integracao oficial com a Meta',
  '/operacao/caixa': 'Controle de entradas e saidas financeiras',
  '/operacao/lista-espera': 'Ordem de atendimento quando não há horário livre',
}

const itensNavegacaoMobile = [
  { label: 'Inicio', rota: '/dashboard', icone: House },
  { label: 'Agenda', rota: '/dashboard/agenda', icone: CalendarDays },
  { label: 'Mensagens', rota: '/dashboard/mensagens', icone: MessageSquareMore },
  { label: 'Clientes', rota: '/operacao/clientes', icone: Users },
]

const LayoutDashboard = () => {
  const { tenant } = useAuth()
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

  const titulo = titulos[location.pathname] || 'BarberMark'
  const planoSolo = tenant?.planoContratado === 'SOLO'
  const baseSub = subtitulos[location.pathname] || ''
  const subtitulo =
    planoSolo && location.pathname === '/dashboard' && baseSub
      ? `${baseSub} · Plano solo — foco no seu dia a dia`
      : baseSub

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
        <header
          ref={headerRef}
          className="safe-top shrink-0 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl shadow-header"
        >
          <div className="flex items-center justify-between gap-3 px-3 py-3.5 md:px-8 md:py-4 max-w-[1920px] mx-auto w-full">
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
                <h1 className="text-[15px] md:text-base font-bold text-neutral-900 tracking-tight truncate">{titulo}</h1>
                {subtitulo && (
                  <p className="text-[11px] md:text-xs text-texto-sec font-medium hidden md:block whitespace-nowrap tracking-wide">
                    {subtitulo}
                  </p>
                )}
                {subtituloCurto && (
                  <p className="text-[11px] text-texto-sec font-medium md:hidden truncate">{subtituloCurto}</p>
                )}
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
              <ConectarWhatsappButton />
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:py-8 md:pb-8 max-w-[1920px] mx-auto w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 md:hidden pointer-events-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-2.5 mb-1.5 rounded-[22px] border border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-nav">
          <div className="grid grid-cols-5 gap-0.5 px-1.5 py-2">
            {itensNavegacaoMobile.map((item) => {
              const ativo = rotaAtiva(item.rota)
              const Icone = item.icone
              return (
                <button
                  key={item.rota}
                  onClick={() => navigate(item.rota)}
                  type="button"
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 min-h-[52px] text-[10px] font-semibold transition-all active:scale-[0.98] ${
                    ativo
                      ? 'bg-gradient-to-b from-primaria-clara to-white text-primaria shadow-sm'
                      : 'text-texto-sec hover:bg-fundo/80'
                  }`}
                >
                  <Icone size={20} strokeWidth={ativo ? 2.25 : 2} />
                  <span className="leading-tight">{item.label}</span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setMenuMobileAberto(true)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 min-h-[52px] text-[10px] font-semibold text-texto-sec hover:bg-fundo/80 transition-all active:scale-[0.98]"
            >
              <Menu size={20} strokeWidth={2} />
              <span className="leading-tight">Menu</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default LayoutDashboard

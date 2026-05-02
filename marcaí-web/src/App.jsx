import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuth from './hooks/useAuth'
import api, { removerTokens, salvarTokens } from './servicos/api'

// Layout
import LayoutDashboard from './componentes/layout/LayoutDashboard'

// Auth pages
import Login from './paginas/auth/Login'
import Cadastro from './paginas/auth/Cadastro'
import RecuperarSenha from './paginas/auth/RecuperarSenha'
import RedefinirSenha from './paginas/auth/RedefinirSenha'

// Onboarding
import Onboarding from './paginas/onboarding/Onboarding'

// Dashboard
import DashboardHome from './paginas/dashboard/DashboardHome'
import Agenda from './paginas/dashboard/Agenda'
import Mensagens from './paginas/dashboard/Mensagens'

// Config
import ConfigNegocio from './paginas/config/ConfigNegocio'
import ConfigServicos from './paginas/config/ConfigServicos'
import ConfigProfissionais from './paginas/config/ConfigProfissionais'
import ConfigHorarios from './paginas/config/ConfigHorarios'
import ConfigClientes from './paginas/config/ConfigClientes'
import ConfigUsuarios from './paginas/config/ConfigUsuarios'
import ConfigIntegracoesWhatsappMeta from './paginas/config/ConfigIntegracoesWhatsappMeta'
import ConfigRecursos from './paginas/config/ConfigRecursos'
import ConfigPlanoSalao from './paginas/config/ConfigPlanoSalao'
// Public
import AgendaPublica from './paginas/public/AgendaPublica'
import Totem from './paginas/public/Totem'
import PainelTvPublico from './paginas/public/PainelTvPublico'
import LegalPublica from './paginas/public/LegalPublica'

// Operação (escopo enxuto)
import Caixa from './paginas/operacao/Caixa'
import ListaEspera from './paginas/operacao/ListaEspera'

const ModuloInativo = ({ nome }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
    <div className="w-16 h-16 rounded-2xl bg-fundo border border-borda flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-texto-sec">
        <path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" />
      </svg>
    </div>
    <div>
      <h2 className="text-lg font-semibold text-texto">Módulo não ativo</h2>
      <p className="text-sm text-texto-sec mt-1">
        O módulo <strong>{nome}</strong> não está habilitado para este plano.<br />
        Acesse <strong>Configurações → Recursos</strong> para ativar.
      </p>
    </div>
  </div>
)

const GuardaRecurso = ({ recurso, nome, children }) => {
  const { tenant, tenantCarregando, tenantInicializado } = useAuth()
  if (!tenantInicializado || tenantCarregando) return <TelaCarregandoAcesso telaInteira={false} />
  if (!tenant) return <TenantIndisponivel />
  const recursos = Array.isArray(recurso) ? recurso : [recurso]
  if (!recursos.some((item) => tenant[item])) return <ModuloInativo nome={nome} />
  return children
}

const ModuloPlanoRestrito = ({ nome, plano }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
    <div className="w-16 h-16 rounded-2xl bg-fundo border border-borda flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-texto-sec">
        <path d="M12 3 4 7v5c0 5 3.4 8.6 8 9 4.6-.4 8-4 8-9V7l-8-4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 11.5 11 13l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div>
      <h2 className="text-lg font-semibold text-texto">Disponível em outro plano</h2>
      <p className="text-sm text-texto-sec mt-1">
        O módulo <strong>{nome}</strong> está disponível apenas no plano <strong>{plano}</strong>.
      </p>
    </div>
  </div>
)

const TelaCarregandoAcesso = ({ telaInteira = true }) => (
  <div className={`${telaInteira ? 'min-h-screen bg-fundo' : 'min-h-[60vh]'} flex items-center justify-center`}>
    <div className="w-8 h-8 border-3 border-primaria border-t-transparent rounded-full animate-spin" />
  </div>
)

/** Plano Solo: casa na agenda; Salão: painel com visão geral. */
const RedirectInicio = () => {
  const { tenant, tenantInicializado, tenantCarregando } = useAuth()
  if (!tenantInicializado || tenantCarregando) {
    return <TelaCarregandoAcesso telaInteira={false} />
  }
  if (tenant?.planoContratado === 'SOLO') {
    return <Navigate to="/dashboard/agenda" replace />
  }
  return <Navigate to="/dashboard" replace />
}

const TenantIndisponivel = ({ telaInteira = false }) => (
  <div className={`flex flex-col items-center justify-center text-center gap-4 ${telaInteira ? 'min-h-screen bg-fundo' : 'min-h-[60vh]'}`}>
    <div className="w-16 h-16 rounded-2xl bg-fundo border border-borda flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-texto-sec">
        <path d="M12 9v4" strokeLinecap="round" />
        <path d="M12 17h.01" strokeLinecap="round" />
        <path d="m3.34 17 7.6-13.06a1.22 1.22 0 0 1 2.12 0L20.66 17a1.22 1.22 0 0 1-1.06 1.83H4.4A1.22 1.22 0 0 1 3.34 17Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div>
      <h2 className="text-lg font-semibold text-texto">Não foi possível carregar sua barbearia</h2>
      <p className="text-sm text-texto-sec mt-1">
        Recarregue a página para tentar novamente. Se o problema continuar, revise a sessão atual.
      </p>
    </div>
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="px-4 py-2 rounded-lg bg-primaria text-white text-sm font-medium hover:bg-primaria-escura transition-colors"
    >
      Recarregar
    </button>
  </div>
)

const GuardaPlano = ({ planoPermitido, nome, children }) => {
  const { tenant, tenantCarregando, tenantInicializado } = useAuth()
  if (!tenantInicializado || tenantCarregando) return <TelaCarregandoAcesso telaInteira={false} />
  if (!tenant) return <TenantIndisponivel />
  const planoAtual = tenant.planoContratado || 'SALAO'
  if (planoAtual !== planoPermitido) {
    return <ModuloPlanoRestrito nome={nome} plano={planoPermitido === 'SALAO' ? 'Salão' : 'Solo'} />
  }
  return children
}

const RotaProtegida = ({ children, redirecionarOnboarding = true }) => {
  const { usuario, tenant, carregando, tenantCarregando, tenantInicializado } = useAuth()

  if (carregando) return <TelaCarregandoAcesso />

  if (!usuario) return <Navigate to="/login" replace />

  if (!tenantInicializado || tenantCarregando) return <TelaCarregandoAcesso />

  if (!tenant) return <TenantIndisponivel telaInteira />

  if (redirecionarOnboarding && !usuario.onboardingCompleto) {
    return <Navigate to="/onboarding/negocio" replace />
  }

  return children
}

const OAuthCallback = () => {
  const navigate = useNavigate()
  const { definirUsuario, carregarTenant } = useAuth()

  useEffect(() => {
    let ativo = true

    const concluirLoginGoogle = async () => {
      const params = new URLSearchParams(window.location.search)
      const accessToken = params.get('accessToken')
      const refreshToken = params.get('refreshToken')

      if (!accessToken) {
        navigate('/login', { replace: true })
        return
      }

      salvarTokens(accessToken, refreshToken)

      try {
        const resposta = await api.get('/api/auth/me')
        if (!ativo) return

        definirUsuario(resposta.dados)
        await carregarTenant()
        if (!ativo) return
        navigate(resposta.dados.onboardingCompleto ? '/dashboard' : '/onboarding/negocio', { replace: true })
      } catch {
        removerTokens()
        if (!ativo) return
        navigate('/login', { replace: true })
      }
    }

    concluirLoginGoogle()

    return () => {
      ativo = false
    }
  }, [])

  return <TelaCarregandoAcesso />
}

const App = () => {
  return (
    <Routes>
      <Route path="/b/:slug" element={<AgendaPublica />} />
      <Route path="/b/:slug/details" element={<AgendaPublica />} />
      <Route path="/b/:slug/produtos" element={<AgendaPublica />} />
      <Route path="/b/:slug/profissionais" element={<AgendaPublica />} />
      <Route path="/b/:slug/agendar" element={<AgendaPublica />} />
      <Route path="/b/:slug/conta" element={<AgendaPublica />} />
      <Route path="/totem/:slug" element={<Totem />} />
      <Route path="/totem" element={<Totem />} />
      <Route path="/painel/:slug/:hash" element={<PainelTvPublico />} />
      <Route path="/termos" element={<LegalPublica tipo="termos" />} />
      <Route path="/privacidade" element={<LegalPublica tipo="privacidade" />} />

      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/oauth" element={<OAuthCallback />} />

      <Route
        path="/onboarding/*"
        element={
          <RotaProtegida redirecionarOnboarding={false}>
            <Onboarding />
          </RotaProtegida>
        }
      />

      <Route
        path="/"
        element={
          <RotaProtegida>
            <LayoutDashboard />
          </RotaProtegida>
        }
      >
        <Route index element={<RedirectInicio />} />
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="dashboard/agenda" element={<Agenda />} />
        <Route path="dashboard/mensagens" element={<Mensagens />} />
        <Route path="dashboard/agendamentos" element={<Navigate to="/dashboard/agenda" replace />} />

        <Route path="operacao/clientes" element={<ConfigClientes />} />
        <Route path="operacao/caixa" element={<GuardaRecurso recurso="caixaAtivo" nome="Caixa"><Caixa /></GuardaRecurso>} />
        <Route path="operacao/lista-espera" element={<GuardaRecurso recurso="listaEsperaAtivo" nome="Lista de espera"><ListaEspera /></GuardaRecurso>} />

        <Route path="config/planos" element={<Navigate to="/dashboard" replace />} />
        <Route path="config/clientes" element={<Navigate to="/operacao/clientes" replace />} />
        <Route path="config/profissionais" element={<ConfigProfissionais />} />
        <Route path="config/horarios" element={<ConfigHorarios />} />
        <Route path="config/negocio" element={<ConfigNegocio />} />
        <Route path="config/servicos" element={<ConfigServicos />} />
        <Route path="config/pacotes" element={<Navigate to="/dashboard" replace />} />
        <Route path="config/recursos" element={<ConfigRecursos />} />
        <Route path="config/don-barber" element={<Navigate to="/dashboard" replace />} />
        <Route path="config/usuarios" element={<GuardaPlano planoPermitido="SALAO" nome="Usuários"><ConfigUsuarios /></GuardaPlano>} />
        <Route path="config/integracoes" element={<Navigate to="/dashboard" replace />} />
        <Route path="config/integracoes/guia-whatsapp" element={<ConfigIntegracoesWhatsappMeta />} />

        <Route path="config/plano" element={<ConfigPlanoSalao />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App

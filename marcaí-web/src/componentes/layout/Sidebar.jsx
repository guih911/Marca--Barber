import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  LogOut,
  Building2,
  Scissors,
  Users,
  UserCheck,
  Clock,
  UserCog,
  Puzzle,
  BadgeDollarSign,
  Gift,
  Archive,
  BarChart2,
  Package,
  Settings2,
  FileText,
  Landmark,
  Images,
  ClipboardList,
  BarChart3,
  Bike,
} from 'lucide-react'
import { cn, obterIniciais } from '../../lib/utils'
import useAuth from '../../hooks/useAuth'

// plano: undefined = sem restrição | 'SALAO' = só no plano Salão
const todosItensOperacao = [
  { label: 'Início', icone: LayoutDashboard, rota: '/dashboard' },
  { label: 'Agenda', icone: Calendar, rota: '/dashboard/agenda' },
  { label: 'Mensagens', icone: MessageSquare, rota: '/dashboard/mensagens' },
  { label: 'Clientes', icone: Users, rota: '/operacao/clientes' },
  { label: 'Plano Mensal', icone: BadgeDollarSign, rota: '/operacao/planos', recurso: 'membershipsAtivo' },
  { label: 'Aniversário', icone: Gift, rota: '/operacao/fidelidade', recurso: ['fidelidadeAtivo', 'aniversarianteAtivo'] },
  { label: 'Comissões', icone: BarChart2, rota: '/operacao/comissoes', recurso: 'comissoesAtivo', plano: 'SALAO' },
  { label: 'Estoque', icone: Archive, rota: '/operacao/estoque', recurso: 'estoqueAtivo' },
  { label: 'Comanda', icone: FileText, rota: '/operacao/comanda', recurso: 'comandaAtivo' },
  { label: 'Caixa', icone: Landmark, rota: '/operacao/caixa', recurso: 'caixaAtivo' },
  { label: 'Entregas', icone: Bike, rota: '/operacao/entregas', recurso: 'entregaAtivo' },
  { label: 'Lista de Espera', icone: ClipboardList, rota: '/operacao/lista-espera', recurso: 'listaEsperaAtivo' },
  { label: 'Relatórios', icone: BarChart3, rota: '/operacao/relatorios' },
  { label: 'Galeria', icone: Images, rota: '/operacao/galeria', recurso: 'galeriaAtivo' },
]

const todosItensConfiguracao = [
  { label: 'Profissionais', icone: UserCheck, rota: '/config/profissionais' },
  { label: 'Horários', icone: Clock, rota: '/config/horarios' },
  { label: 'Serviços', icone: Scissors, rota: '/config/servicos' },
  { label: 'Pacotes e Combos', icone: Package, rota: '/config/pacotes', recurso: 'pacotesAtivo' },
  { label: 'Meu Negócio', icone: Building2, rota: '/config/negocio' },
  { label: 'Recursos', icone: Settings2, rota: '/config/recursos' },
  { label: 'Integrações', icone: Puzzle, rota: '/config/integracoes' },
  { label: 'Usuários', icone: UserCog, rota: '/config/usuarios', plano: 'SALAO' },
]

const ItemNav = ({ item, compacto }) => (
  <NavLink
    to={item.rota}
    end={item.rota === '/dashboard'}
    title={compacto ? item.label : undefined}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 group relative',
        compacto ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2.5',
        isActive
          ? 'bg-primaria text-white shadow-primaria/30 shadow-md'
          : 'text-sidebar-texto hover:bg-sidebar-hover hover:text-white'
      )
    }
  >
    {({ isActive }) => (
      <>
        <item.icone
          size={18}
          className={cn(
            'shrink-0 transition-transform duration-150',
            isActive ? 'text-white' : 'text-sidebar-texto group-hover:text-white'
          )}
        />
        {!compacto && <span className="truncate">{item.label}</span>}
        {compacto && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {item.label}
          </div>
        )}
      </>
    )}
  </NavLink>
)

const Sidebar = ({ compacto = false }) => {
  const { usuario, tenant, logout } = useAuth()
  const navigate = useNavigate()

  const planoAtual = tenant?.planoContratado || 'SALAO' // padrão: mostra tudo se não definido
  const filtrarPorPlano = (item) => {
    if (item.plano && item.plano !== planoAtual) return false
    if (item.recurso) {
      const recursos = Array.isArray(item.recurso) ? item.recurso : [item.recurso]
      if (!recursos.some((recurso) => tenant?.[recurso])) return false
    }
    return true
  }
  const itensOperacao = todosItensOperacao.filter(filtrarPorPlano)
  const itensConfiguracao = todosItensConfiguracao.filter(filtrarPorPlano)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full shrink-0 transition-all duration-300',
        'bg-sidebar border-r border-sidebar-borda',
        compacto ? 'w-16' : 'w-64'
      )}
    >
      {compacto ? (
        <img
          src="/logo.svg"
          alt="Marcaí Barber"
          style={{ width: 44, height: 44, objectFit: 'contain', display: 'block', margin: '8px auto' }}
        />
      ) : (
        <div style={{ width: '100%', height: 116, flexShrink: 0, overflow: 'hidden', marginTop: 7, marginBottom: 20 }}>
          <img
            src="/logo.svg"
            alt="Marcaí Barber"
            style={{ width: '100%', height: 180, objectFit: 'contain', objectPosition: 'left top', display: 'block', transform: 'translateY(-18px)' }}
          />
        </div>
      )}

      <nav className={cn('flex-1 overflow-y-auto overscroll-contain sidebar-scroll pb-4 space-y-0.5', compacto ? 'px-0' : 'px-2')}>
        {!compacto && <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-sidebar-texto/60">Operação</p>}
        {itensOperacao.map((item) => (
          <ItemNav key={item.rota} item={item} compacto={compacto} />
        ))}

        <div className="pt-4">
          {!compacto && <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-sidebar-texto/60">Configuração</p>}
          {itensConfiguracao.map((item) => (
            <ItemNav key={item.rota} item={item} compacto={compacto} />
          ))}
        </div>
      </nav>

      {!compacto && planoAtual && (
        <div className="px-4 py-2 border-t border-sidebar-borda">
          <button
            onClick={() => navigate('/config/plano')}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer',
              planoAtual === 'SOLO'
                ? 'bg-primaria/20 text-primaria-brilho'
                : 'bg-emerald-500/20 text-emerald-400'
            )}
            title="Ver recursos do plano"
          >
            {planoAtual === 'SOLO' ? <Scissors size={10} /> : <Users size={10} />}
            Plano {planoAtual === 'SOLO' ? 'Solo' : 'Salão'}
          </button>
        </div>
      )}
      <div className={cn('border-t border-sidebar-borda py-3 shrink-0', compacto ? 'px-1' : 'px-2')}>
        {compacto ? (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-2.5 rounded-xl text-sidebar-texto hover:text-perigo hover:bg-red-500/10 transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-sidebar-hover transition-colors group">
            <div className="w-8 h-8 rounded-full gradient-primaria flex items-center justify-center text-xs font-bold text-white shrink-0">
              {usuario?.avatarUrl
                ? <img src={usuario.avatarUrl} alt={usuario.nome} className="w-full h-full rounded-full object-cover" />
                : obterIniciais(usuario?.nome)
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{usuario?.nome}</p>
              <p className="text-[11px] text-sidebar-texto truncate" title={usuario?.email}>{usuario?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-sidebar-texto hover:text-perigo opacity-0 group-hover:opacity-100 transition-all"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar

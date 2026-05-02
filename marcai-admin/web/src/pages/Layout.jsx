import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Building2, ShieldCheck, Server, ScrollText,
  LogOut, Wallet, Link2,
  BarChart3, ChevronLeft, ChevronRight, Menu, X, Zap, Inbox
} from 'lucide-react'
import { logout, getUser } from '../api'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/tenants', icon: Building2, label: 'Tenants' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/disparos', icon: Zap, label: 'Disparos' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/billing', icon: Wallet, label: 'Billing' },
  { to: '/integracoes/meta', icon: Link2, label: 'Integrações' },
  { to: '/admins', icon: ShieldCheck, label: 'Admins' },
  { to: '/sistema', icon: Server, label: 'Sistema' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
]

const pageLabels = {
  '/': 'Dashboard',
  '/tenants': 'Tenants',
  '/inbox': 'Inbox — Mensagens',
  '/disparos': 'Disparos em Massa',
  '/relatorios': 'Relatórios',
  '/billing': 'Billing',
  '/integracoes/meta': 'Integrações — Meta WhatsApp',
  '/admins': 'Super Admins',
  '/sistema': 'Sistema',
  '/logs': 'Logs',
}

function AdminAvatar({ nome, size = 'sm' }) {
  const inicial = (nome || '?')[0].toUpperCase()
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500']
  const color = colors[(nome || '').charCodeAt(0) % colors.length]
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} ${color} rounded-lg flex items-center justify-center text-white font-bold shrink-0`}>
      {inicial}
    </div>
  )
}

export { AdminAvatar }

export default function Layout() {
  const nav = useNavigate()
  const location = useLocation()
  const user = getUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentLabel = Object.entries(pageLabels).find(([k]) =>
    location.pathname.startsWith(k) && k !== '/'
  )?.[1] || (location.pathname === '/' ? 'Dashboard' : '')

  const handleLogout = () => { logout(); nav('/login') }

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/5 ${collapsed ? 'justify-center px-3' : ''}`}>
        <img src="/logo.png" alt="Barber Mark" className={`object-contain shrink-0 ${collapsed ? 'w-8 h-8' : 'w-10 h-10'}`} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm tracking-wide">Barber Mark</p>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Admin</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(({ to, icon: Icon, label, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${collapsed ? 'justify-center' : ''} ${
                isActive
                  ? 'text-gold-500 bg-gold-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={`shrink-0 ${isActive ? 'text-gold-500' : ''}`} />
                {!collapsed && <span className="flex-1">{label}</span>}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-white/5 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 mb-1">
            <AdminAvatar nome={user?.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.nome}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{user?.papel || 'admin'}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-sidebar flex flex-col shadow-2xl transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Sidebar — desktop */}
      <aside className={`hidden lg:flex flex-col bg-sidebar shadow-xl transition-all duration-300 shrink-0 relative ${collapsed ? 'w-[60px]' : 'w-56'}`}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-md z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">{currentLabel}</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <AdminAvatar nome={user?.nome} size="sm" />
              <span className="text-xs font-medium text-slate-700">{user?.nome}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

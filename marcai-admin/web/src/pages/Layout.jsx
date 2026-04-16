import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, ShieldCheck, Server, ScrollText, LogOut } from 'lucide-react'
import { logout, getUser } from '../api'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/tenants', icon: Building2, label: 'Tenants' },
  { to: '/admins', icon: ShieldCheck, label: 'Admins' },
  { to: '/sistema', icon: Server, label: 'Sistema' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
]

export default function Layout() {
  const nav = useNavigate()
  const user = getUser()

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-700">
          <p className="font-bold text-sm tracking-wider">MARCAI ADMIN</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{user?.nome}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primaria text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={() => { logout(); nav('/login') }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 w-full transition-colors"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

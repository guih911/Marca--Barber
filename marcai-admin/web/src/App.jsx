import { Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './api'
import Login from './pages/Login'
import Layout from './pages/Layout'
import Dashboard from './pages/Dashboard'
import Tenants from './pages/Tenants'
import TenantDetalhe from './pages/TenantDetalhe'
import SuperAdmins from './pages/SuperAdmins'
import Sistema from './pages/Sistema'
import Logs from './pages/Logs'

const Protegida = ({ children }) => isLoggedIn() ? children : <Navigate to="/login" />

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Dashboard />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="tenants/:id" element={<TenantDetalhe />} />
        <Route path="admins" element={<SuperAdmins />} />
        <Route path="sistema" element={<Sistema />} />
        <Route path="logs" element={<Logs />} />
      </Route>
    </Routes>
  )
}

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../../servicos/api'
import { obterIniciais } from '../../lib/utils'

const perfis = [
  { valor: 'ADMIN', label: 'Admin' },
  { valor: 'PROFISSIONAL', label: 'Profissional' },
  { valor: 'ATENDENTE', label: 'Atendente' },
]

const ConfigUsuarios = () => {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get('/api/tenants/meu/usuarios')
      .then((res) => setUsuarios(res.dados || []))
      .catch(() => setUsuarios([]))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Usuários</h1>
          <p className="text-texto-sec text-sm mt-1">Gerencie os acessos ao painel</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-texto-sec" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-borda bg-fundo">
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">E-mail</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Perfil</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-texto-sec uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-texto-sec">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-borda last:border-0 hover:bg-fundo">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.nome} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primaria/20 flex items-center justify-center text-xs font-bold text-primaria">
                            {obterIniciais(u.nome)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-texto">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-texto-sec">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-0.5 bg-primaria-clara text-primaria text-xs rounded-full font-medium">
                        {perfis.find((p) => p.valor === u.perfil)?.label || u.perfil}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default ConfigUsuarios

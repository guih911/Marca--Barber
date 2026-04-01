import { useState, useEffect } from 'react'
import { Crown, CheckCircle2, Users, Bot, Scissors, BarChart2, BadgeDollarSign, Gift, Package, Loader2, ExternalLink, ArrowUpRight, Star } from 'lucide-react'
import api from '../../servicos/api'
import useAuth from '../../hooks/useAuth'
import { useToast } from '../../contextos/ToastContexto'

const FEATURES_SOLO = [
  { icone: Scissors, label: 'Agenda completa', desc: '1 profissional' },
  { icone: Bot, label: 'Don IA (recepcionista)', desc: 'Agendamentos automáticos pelo WhatsApp' },
  { icone: Users, label: 'Clientes ilimitados', desc: 'Cadastro e histórico completo' },
  { icone: BadgeDollarSign, label: 'Plano Mensal (memberships)', desc: 'Assinaturas recorrentes' },
]

const FEATURES_SALAO = [
  ...FEATURES_SOLO,
  { icone: Users, label: 'Equipe ilimitada', desc: 'Múltiplos profissionais' },
  { icone: BarChart2, label: 'Comissões por profissional', desc: 'Controle financeiro por barbeiro' },
  { icone: Gift, label: 'Programa de Fidelidade', desc: 'Pontos, níveis e resgates' },
  { icone: Package, label: 'Pacotes e Combos', desc: 'Serviços agrupados com desconto' },
  { icone: Star, label: 'Relatórios avançados', desc: 'LTV, heatmap de ocupação, comparativos' },
]

const ConfigPlanoSalao = () => {
  const { tenant } = useAuth()
  const toast = useToast()
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)

  const plano = tenant?.planoContratado || 'SALAO'
  const isSolo = plano === 'SOLO'
  const features = isSolo ? FEATURES_SOLO : FEATURES_SALAO
  const cicloLabel = {
    MENSAL: 'Mensal',
    SEMESTRAL: 'Semestral',
    ANUAL: 'Anual',
  }[tenant?.cicloCobranca] || tenant?.cicloCobranca

  useEffect(() => {
    api.get('/api/profissionais?ativo=true')
      .then(res => setProfissionais(res.dados || res.profissionais || []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-texto">Meu Plano</h1>
        <p className="text-texto-sec text-sm mt-1">Detalhes do plano contratado e uso atual</p>
      </div>

      {/* Card do plano */}
      <div className={`rounded-2xl border-2 p-6 shadow-sm ${isSolo ? 'border-primaria/40 bg-primaria/5' : 'border-emerald-400/40 bg-emerald-50/60'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSolo ? 'bg-primaria text-white' : 'bg-emerald-500 text-white'}`}>
              {isSolo ? <Scissors size={22} /> : <Crown size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-texto">Plano {isSolo ? 'Solo' : 'Salão'}</h2>
              <p className="text-sm text-texto-sec">{isSolo ? 'Para autônomos e barbeiros solo' : 'Para barbearias com equipe'}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${isSolo ? 'bg-primaria/15 text-primaria' : 'bg-emerald-500/15 text-emerald-700'}`}>
            Ativo
          </span>
        </div>

        {tenant?.cicloCobranca && (
          <p className="mt-3 text-sm text-texto-sec">
            Ciclo: <span className="font-medium text-texto">{cicloLabel}</span>
          </p>
        )}
      </div>

      {/* Uso atual */}
      <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
        <h3 className="font-semibold text-texto mb-4 flex items-center gap-2">
          <Users size={16} className="text-primaria" /> Uso atual
        </h3>
        {carregando ? (
          <div className="flex justify-center py-4"><Loader2 size={22} className="animate-spin text-texto-sec" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-fundo rounded-xl p-4">
              <p className="text-xs text-texto-sec uppercase tracking-wide font-medium">Profissionais ativos</p>
              <p className="text-2xl font-bold text-texto mt-1">{profissionais.length}</p>
              <p className="text-xs text-texto-sec mt-1">{isSolo ? 'Limite: 1' : 'Ilimitado'}</p>
            </div>
            <div className="bg-fundo rounded-xl p-4">
              <p className="text-xs text-texto-sec uppercase tracking-wide font-medium">WhatsApp</p>
              <p className="text-2xl font-bold text-texto mt-1">
                {tenant?.configWhatsApp ? '✅' : '—'}
              </p>
              <p className="text-xs text-texto-sec mt-1">{tenant?.configWhatsApp ? 'Conectado' : 'Não conectado'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Features incluídas */}
      <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
        <h3 className="font-semibold text-texto mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-sucesso" /> Incluso no seu plano
        </h3>
        <div className="space-y-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primaria/10 flex items-center justify-center shrink-0">
                <f.icone size={15} className="text-primaria" />
              </div>
              <div>
                <p className="text-sm font-medium text-texto">{f.label}</p>
                <p className="text-xs text-texto-sec">{f.desc}</p>
              </div>
              <CheckCircle2 size={15} className="text-sucesso ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Módulos ativos */}
      {tenant && (
        <div className="bg-white rounded-2xl border border-borda shadow-sm p-5">
          <h3 className="font-semibold text-texto mb-4">Módulos habilitados</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Memberships', tenant.membershipsAtivo],
              ['Fidelidade', tenant.fidelidadeAtivo],
              ['Comissões', tenant.comissoesAtivo],
              ['Estoque', tenant.estoqueAtivo],
              ['Comanda Digital', tenant.comandaAtivo],
              ['Pacotes e Combos', tenant.pacotesAtivo],
              ['Galeria', tenant.galeriaAtivo],
              ['Relatórios', tenant.relatoriosAtivo],
            ].map(([nome, ativo]) => (
              <div key={nome} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${ativo ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                <span className={`w-2 h-2 rounded-full ${ativo ? 'bg-green-500' : 'bg-gray-300'}`} />
                {nome}
              </div>
            ))}
          </div>
          <p className="text-xs text-texto-sec mt-3">
            Ative ou desative módulos em <a href="/config/recursos" className="text-primaria hover:underline">Configurações → Recursos</a>
          </p>
        </div>
      )}

      {/* CTA upgrade (para plano Solo) */}
      {isSolo && (
        <div className="bg-gradient-to-r from-primaria/10 to-emerald-500/10 border border-primaria/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Crown size={20} className="text-primaria shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-texto">Quer expandir sua equipe?</h3>
              <p className="text-sm text-texto-sec mt-1">
                O plano Salão inclui profissionais ilimitados, comissões, fidelidade e muito mais.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              toast('Entre em contato em marcai.com.br para fazer upgrade!', 'info')
              window.open('https://marcai.com.br', '_blank')
            }}
            className="mt-4 w-full py-2.5 bg-primaria hover:bg-primaria-escura text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ArrowUpRight size={16} /> Fazer upgrade para Salão
          </button>
        </div>
      )}

      {/* Suporte */}
      <div className="bg-fundo rounded-2xl border border-borda p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-texto">Precisa de ajuda?</p>
          <p className="text-xs text-texto-sec mt-0.5">Fale com o suporte em marcai.com.br</p>
        </div>
        <button
          onClick={() => window.open('https://marcai.com.br', '_blank')}
          className="flex items-center gap-1.5 text-xs text-primaria font-medium hover:underline"
        >
          Suporte <ExternalLink size={12} />
        </button>
      </div>
    </div>
  )
}

export default ConfigPlanoSalao

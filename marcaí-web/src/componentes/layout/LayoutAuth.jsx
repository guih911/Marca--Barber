import BrandLogo from './BrandLogo'

// Layout split-screen para telas de autenticação
// Lado esquerdo: gradiente + ilustração SVG
// Lado direito: fundo branco + formulário
const LayoutAuth = ({ children }) => {
  return (
    <div className="h-[100dvh] w-full flex overflow-hidden">
      {/* Lado esquerdo - gradiente + ilustração */}
      <div className="hidden lg:flex lg:w-1/2 h-full bg-gradient-to-br from-[#111111] via-[#1b1714] to-[#2a2018] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

        {/* Ilustração SVG — calendário/agendamento */}
        <div className="relative z-10 mb-8">
          <svg width="280" height="280" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Corpo principal do calendário */}
            <rect x="30" y="50" width="220" height="190" rx="16" fill="white" fillOpacity="0.15" />
            <rect x="30" y="50" width="220" height="190" rx="16" stroke="white" strokeOpacity="0.4" strokeWidth="2" />
            {/* Header do calendário */}
            <rect x="30" y="50" width="220" height="52" rx="16" fill="white" fillOpacity="0.25" />
            {/* Título do mês */}
            <rect x="90" y="66" width="100" height="12" rx="6" fill="white" fillOpacity="0.7" />
            {/* Setas de navegação */}
            <circle cx="58" cy="72" r="12" fill="white" fillOpacity="0.3" />
            <circle cx="222" cy="72" r="12" fill="white" fillOpacity="0.3" />
            <path d="M62 72L56 72M56 72L59 69M56 72L59 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M218 72H224M224 72L221 69M224 72L221 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dias da semana */}
            {[50, 82, 114, 146, 178, 210].map((x, i) => (
              <rect key={i} x={x} y="115" width="22" height="8" rx="4" fill="white" fillOpacity="0.4" />
            ))}
            {/* Grid de dias */}
            {[0, 1, 2, 3, 4].map((row) =>
              [0, 1, 2, 3, 4, 5].map((col) => {
                const isSelected = row === 1 && col === 2
                const hasEvent = (row === 0 && col === 3) || (row === 2 && col === 1) || (row === 3 && col === 4)
                return (
                  <g key={`${row}-${col}`}>
                    <rect
                      x={50 + col * 32}
                      y={138 + row * 22}
                      width="22"
                      height="18"
                      rx="6"
                      fill={isSelected ? 'white' : 'white'}
                      fillOpacity={isSelected ? 0.9 : 0.1}
                    />
                    {hasEvent && (
                      <circle cx={61 + col * 32} cy={151 + row * 22} r="3" fill={isSelected ? '#6C63FF' : 'white'} fillOpacity={0.8} />
                    )}
                  </g>
                )
              })
            )}
            {/* Ícone de check animado */}
            <circle cx="200" cy="185" r="28" fill="#22C55E" fillOpacity="0.9" />
            <path d="M188 185L196 193L212 177" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Notificação de agendamento */}
            <rect x="20" y="20" width="130" height="36" rx="10" fill="white" fillOpacity="0.95" />
            <circle cx="38" cy="38" r="10" fill="#B8894D" />
            <rect x="54" y="29" width="80" height="7" rx="3.5" fill="#1A1A2E" fillOpacity="0.7" />
            <rect x="54" y="42" width="56" height="5" rx="2.5" fill="#6B7280" fillOpacity="0.5" />
          </svg>
        </div>

        <div className="relative z-10 text-center">
          <p className="text-primaria text-sm font-semibold uppercase tracking-[0.2em] mb-3">BarberMark</p>
          <h2 className="text-white text-3xl font-bold mb-3">Tudo que sua</h2>
          <h2 className="text-white/90 text-3xl font-bold mb-6">barbearia precisa</h2>
          <ul className="text-white/70 text-sm space-y-3 text-left max-w-xs">
            <li className="flex items-start gap-2"><span className="text-primaria mt-0.5">✓</span> Agenda online e confirmação automática</li>
            <li className="flex items-start gap-2"><span className="text-primaria mt-0.5">✓</span> IA no WhatsApp respondendo clientes 24h</li>
            <li className="flex items-start gap-2"><span className="text-primaria mt-0.5">✓</span> Lembretes que reduzem faltas e encaixes</li>
            <li className="flex items-start gap-2"><span className="text-primaria mt-0.5">✓</span> Controle de caixa e faturamento do dia</li>
            <li className="flex items-start gap-2"><span className="text-primaria mt-0.5">✓</span> Gestão de profissionais e serviços</li>
          </ul>
        </div>

        {/* Pontos decorativos */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 bg-white rounded-full opacity-80" />
          <div className="w-2 h-2 bg-white rounded-full opacity-40" />
          <div className="w-2 h-2 bg-white rounded-full opacity-40" />
        </div>
      </div>

      {/* Lado direito - formulário */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto bg-white flex">
        <div className="w-full max-w-md m-auto p-8">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <BrandLogo variant="auth" className="max-w-full" />
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}

export default LayoutAuth

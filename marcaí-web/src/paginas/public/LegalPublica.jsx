const secoes = {
  termos: {
    etiqueta: 'Documento oficial',
    titulo: 'Termos de serviço',
    subtitulo: 'Condições de uso da plataforma BarberMark para atendimento, automação e operação via WhatsApp.',
    atualizadoEm: '09 de abril de 2026',
    blocos: [
      {
        titulo: '1. Sobre a plataforma',
        paragrafos: [
          'A BarberMark é uma plataforma SaaS voltada para barbearias e salões que desejam organizar agenda, atendimento, relacionamento com clientes, automações e comunicação por canais oficiais como o WhatsApp.',
          'Ao utilizar o sistema, o cliente declara que tem autorização para operar sua empresa, seus profissionais e seus canais de atendimento dentro das regras da legislação brasileira e das políticas das plataformas integradas.',
        ],
      },
      {
        titulo: '2. Responsabilidade de uso',
        paragrafos: [
          'Cada barbearia é responsável pelo conteúdo das mensagens enviadas, pelo uso correto do sistema e pelo cumprimento das políticas da Meta, da LGPD e das demais regras aplicáveis ao seu negócio.',
          'A BarberMark não é afiliada, subsidiária ou representante da Meta. A integração com WhatsApp Business Platform depende de aprovação e manutenção das políticas definidas pela própria Meta.',
        ],
      },
      {
        titulo: '3. Limites e suspensão',
        paragrafos: [
          'Podemos suspender, restringir ou encerrar o acesso de contas que usem a plataforma para spam, fraude, envio de conteúdo ilícito, assédio, práticas abusivas ou qualquer operação que exponha a plataforma, outros clientes ou parceiros a risco técnico, legal ou reputacional.',
          'Também poderemos limitar recursos temporariamente em situações de manutenção, atualização de segurança, instabilidade de terceiros ou exigências de compliance.',
        ],
      },
      {
        titulo: '4. Disponibilidade e integrações',
        paragrafos: [
          'Trabalhamos para manter a plataforma disponível e confiável, mas alguns recursos dependem de serviços externos, como provedores de hospedagem, WhatsApp, Meta, operadoras e APIs de terceiros.',
          'Por isso, eventual indisponibilidade causada por parceiros externos pode impactar funcionalidades temporariamente, sem caracterizar obrigação de resultado absoluto.',
        ],
      },
      {
        titulo: '5. Encerramento',
        paragrafos: [
          'O cliente pode solicitar o encerramento do uso da plataforma a qualquer momento. A BarberMark também poderá encerrar a prestação do serviço em caso de inadimplência, abuso, fraude, violação contratual ou risco de compliance.',
        ],
      },
    ],
  },
  privacidade: {
    etiqueta: 'LGPD e dados',
    titulo: 'Política de privacidade',
    subtitulo: 'Como a BarberMark coleta, usa e protege dados pessoais no funcionamento da plataforma.',
    atualizadoEm: '09 de abril de 2026',
    blocos: [
      {
        titulo: '1. Dados coletados',
        paragrafos: [
          'A plataforma pode tratar dados como nome, telefone, histórico de atendimento, agendamentos, mensagens, profissionais vinculados, serviços contratados e demais informações necessárias para a operação da barbearia.',
          'Esses dados podem ser inseridos diretamente pela empresa cliente, pelo usuário final em fluxos públicos de agendamento ou recebidos por integrações autorizadas.',
        ],
      },
      {
        titulo: '2. Finalidade do uso',
        paragrafos: [
          'Os dados são utilizados exclusivamente para viabilizar agenda, atendimento automatizado, comunicação com clientes, envio de lembretes, gestão operacional, relatórios e demais recursos contratados pela barbearia.',
          'Não utilizamos esses dados para finalidades incompatíveis com a prestação do serviço.',
        ],
      },
      {
        titulo: '3. Compartilhamento',
        paragrafos: [
          'A BarberMark não comercializa dados pessoais. O compartilhamento ocorre apenas quando necessário para a prestação do serviço, como em integrações com a Meta, infraestrutura em nuvem, envio de notificações ou cumprimento de obrigação legal.',
        ],
      },
      {
        titulo: '4. Segurança e retenção',
        paragrafos: [
          'Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados tratados na plataforma. Ainda assim, nenhum ambiente conectado à internet oferece garantia absoluta contra incidentes.',
          'Os dados são mantidos pelo tempo necessário para a operação do serviço, cumprimento de obrigações legais, prevenção de fraude, auditoria e defesa de direitos.',
        ],
      },
      {
        titulo: '5. Direitos do titular',
        paragrafos: [
          'Nos termos da LGPD, titulares podem solicitar confirmação de tratamento, correção de dados, atualização de informações e demais direitos aplicáveis por meio da empresa responsável pelo atendimento ou do canal oficial da plataforma.',
        ],
      },
    ],
  },
}

const LegalPublica = ({ tipo = 'termos' }) => {
  const conteudo = secoes[tipo] || secoes.termos

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-16">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-10">
          <div className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
            {conteudo.etiqueta}
          </div>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{conteudo.titulo}</h1>
            <p className="mt-4 text-sm leading-7 text-white/72 md:text-base">
              {conteudo.subtitulo}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/45">
              Atualizado em {conteudo.atualizadoEm}
            </p>
          </div>

          <div className="mt-10 grid gap-5">
            {conteudo.blocos.map((bloco) => (
              <section key={bloco.titulo} className="rounded-[24px] border border-white/8 bg-black/20 p-6 md:p-7">
                <h2 className="text-lg font-semibold text-white md:text-xl">{bloco.titulo}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-white/72 md:text-[15px]">
                  {bloco.paragrafos.map((paragrafo) => (
                    <p key={paragrafo}>{paragrafo}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-[24px] border border-white/8 bg-gradient-to-br from-amber-400/12 to-transparent p-6 text-sm leading-7 text-white/72">
            Para assuntos relacionados a compliance, privacidade ou uso da plataforma, utilize os canais oficiais da BarberMark e mantenha estes links públicos ativos para validações com a Meta e parceiros.
          </div>
        </div>
      </div>
    </div>
  )
}

export default LegalPublica

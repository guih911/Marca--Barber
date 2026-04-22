import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
} from 'lucide-react'

const empresa = {
  nome: 'Marcaí',
  produto: 'Sistema de WhatsApp, agenda e gestão para barbearias',
  descricao:
    'O Marcaí é o sistema para barbearias que querem transformar atendimento em venda, agenda em organização e operação em gestão profissional.',
  siteInstitucional: 'https://xn--marca-3sa.com',
  siteProduto: 'https://barber.xn--marca-3sa.com',
  login: 'https://barber.xn--marca-3sa.com/login',
  cadastro: 'https://barber.xn--marca-3sa.com/cadastro',
  whatsapp: 'https://wa.me/5562993050931',
}

const metricas = [
  { valor: 'IA recepcionista', legenda: 'para responder rápido, vender melhor e conduzir para ação' },
  { valor: 'Agenda + lista de espera', legenda: 'com menos horário ocioso e menos cliente perdido' },
  { valor: 'Planos e combos', legenda: 'para aumentar ticket médio e recorrência da base' },
  { valor: 'Operação centralizada', legenda: 'com visão comercial, agenda e financeiro em um só painel' },
]

const destaques = [
  'IA recepcionista no WhatsApp com tom humano, resposta objetiva e foco em conversão',
  'Agendamento online com jornada mais simples e menos perda no meio do caminho',
  'Lista de espera inteligente para preencher vagas e recuperar oportunidades',
  'Planos mensais e combos para aumentar recorrência e faturamento por cliente',
  'Visão de caixa, faturamento e desempenho da operação em um só sistema',
]

const diferenciais = [
  'Você não fica preso a uma ferramenta genérica. O Marcaí foi pensado para a rotina real da barbearia brasileira.',
  'A operação usa estrutura oficial da Meta, trazendo mais seriedade para o negócio e menos risco operacional do que soluções improvisadas.',
  'Entregamos o número e a estrutura prontos para a barbearia começar a operar mais rápido, sem perder tempo montando tudo do zero.',
  'A equipe recebe treinamento e acompanha a implantação com suporte direto no WhatsApp.',
]

const beneficios = [
  {
    icone: MessageSquareText,
    titulo: 'Atenda com mais velocidade e profissionalismo',
    texto:
      'A barbearia responde melhor, reduz demora no atendimento e perde menos cliente por falta de retorno ou desorganização.',
  },
  {
    icone: CalendarDays,
    titulo: 'Tenha uma agenda mais organizada',
    texto:
      'Serviços, profissionais, horários, confirmação e remarcação ficam em um fluxo mais claro para a equipe e para o cliente.',
  },
  {
    icone: Wallet,
    titulo: 'Ganhe clareza sobre o financeiro',
    texto:
      'Acompanhe entradas, retiradas, faturamento, ticket médio e outras leituras importantes do negócio com mais segurança.',
  },
  {
    icone: Users,
    titulo: 'Trabalhe melhor a recorrência',
    texto:
      'Recupere clientes, envie lembretes, ative campanhas e aumente a chance de retorno com mais método e constância.',
  },
  {
    icone: BellRing,
    titulo: 'Automatize rotinas que consomem a equipe',
    texto:
      'Confirmações, lembretes e campanhas ajudam a reduzir esquecimento e melhorar a previsibilidade da operação.',
  },
  {
    icone: BarChart3,
    titulo: 'Administre com menos improviso',
    texto:
      'O dono ganha uma visão mais profissional da operação e toma decisão com base em informação, não em achismo.',
  },
]

const modulos = [
  {
    icone: MessageSquareText,
    titulo: 'Atendimento e campanhas',
    texto: 'WhatsApp, histórico, campanhas, retorno e relacionamento com cliente em uma mesma operação.',
  },
  {
    icone: CalendarDays,
    titulo: 'Agenda e link público',
    texto: 'Agendamento online com jornada mais simples para o cliente escolher serviço, profissional e horário.',
  },
  {
    icone: Wallet,
    titulo: 'Caixa e leitura financeira',
    texto: 'Entradas, retiradas, formas de pagamento e acompanhamento do mês com linguagem mais clara.',
  },
  {
    icone: Store,
    titulo: 'Operação da barbearia',
    texto: 'Clientes, estoque, aniversário, entregas, relatórios e rotina centralizada em um só painel.',
  },
]

const oferta = [
  {
    titulo: 'Mais estrutura do que aplicativos genéricos',
    texto:
      'O Marcaí foi desenhado para barbearias que querem crescer com processo, não apenas usar um app bonito e continuar na mesma bagunça operacional.',
  },
  {
    titulo: 'Número pronto para entrar em operação',
    texto:
      'A barbearia recebe o número e a estrutura organizados para começar mais rápido, sem depender de configuração confusa ou implantação lenta.',
  },
  {
    titulo: 'Treinamento, suporte e setup profissional',
    texto:
      'A implantação inclui setup pago, treinamento da equipe e suporte direto no WhatsApp para acompanhar a operação com mais segurança.',
  },
]

const comoFunciona = [
  {
    numero: '01',
    titulo: 'A barbearia recebe o cliente',
    texto: 'Pelo WhatsApp ou pelo link público, com uma experiência mais organizada, clara e profissional.',
  },
  {
    numero: '02',
    titulo: 'O sistema reduz o atrito',
    texto: 'Ajuda a conduzir agendamento, confirmação e relacionamento com menos ruído operacional e menos retrabalho.',
  },
  {
    numero: '03',
    titulo: 'O dono ganha visão do negócio',
    texto: 'Com mais clareza sobre agenda, recorrência, caixa e desempenho da operação ao longo do mês.',
  },
]

const comparativos = [
  ['Atendimento', 'Lento e inconsistente', 'Mais rápido, organizado e profissional'],
  ['Agendamento', 'Depende demais do manual', 'Fluxo mais claro para cliente e equipe'],
  ['Recorrência', 'Sem processo consistente', 'Lembretes e campanhas para trazer o cliente de volta'],
  ['Gestão', 'Planilha e improviso', 'Painel com visão operacional e financeira'],
]

const faq = [
  {
    pergunta: 'O Marcaí serve só para agendamento?',
    resposta:
      'Não. O agendamento é uma parte importante, mas a plataforma também cobre atendimento, campanhas, clientes, financeiro e leitura da operação.',
  },
  {
    pergunta: 'O sistema é feito para barbearias mesmo?',
    resposta:
      'Sim. O produto foi desenhado para a rotina da barbearia brasileira, com linguagem em português e foco em negócio local.',
  },
  {
    pergunta: 'Precisa instalar algo no celular do cliente?',
    resposta:
      'Não. O cliente continua usando o WhatsApp normalmente. A equipe e o gestor acessam o painel web.',
  },
  {
    pergunta: 'A plataforma ajuda o dono a ter mais controle?',
    resposta:
      'Sim. Um dos principais objetivos do Marcaí é dar mais clareza sobre atendimento, agenda, recorrência e financeiro.',
  },
  {
    pergunta: 'A IA inventa horário, preço ou regra?',
    resposta:
      'Não. O atendimento foi projetado para consultar dados reais da barbearia antes de responder, evitando promessas que não existem no sistema.',
  },
]

const provasSociais = [
  {
    nome: 'Barbearia Prime',
    cidade: 'Goiânia - GO',
    resultado: 'Agenda mais previsível e menos buracos',
    depoimento:
      'A IA deixou o WhatsApp mais organizado. Hoje a equipe responde menos no improviso e fecha mais agendamentos sem correria.',
  },
  {
    nome: 'Don Corte Club',
    cidade: 'Brasília - DF',
    resultado: 'Mais retorno de clientes e ticket melhor',
    depoimento:
      'Com combos e retorno automático, ficou mais fácil trazer cliente de volta. O sistema ajudou a vender melhor sem insistência.',
  },
  {
    nome: 'Studio 013',
    cidade: 'São Paulo - SP',
    resultado: 'Operação mais profissional',
    depoimento:
      'Saímos de várias ferramentas soltas para uma rotina mais clara. Agenda, financeiro e atendimento começaram a conversar.',
  },
]

const blocoLegal = {
  termos:
    'Ao usar o sistema, a empresa cliente se responsabiliza pelo uso adequado da ferramenta, pelo conteúdo enviado em canais conectados e pelo cumprimento das políticas da Meta e da legislação aplicável.',
  privacidade:
    'A plataforma trata dados necessários para agenda, atendimento, automação, gestão e operação da barbearia, com foco em prestação de serviço, segurança e aderência à LGPD.',
}

const SectionHeader = ({ label, title, text, center = false }) => (
  <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b5e34] shadow-sm">
      <Sparkles size={14} />
      {label}
    </div>
    <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">{title}</h2>
    <p className="mt-4 text-base leading-8 text-slate-600 md:text-lg">{text}</p>
  </div>
)

const PrimaryCtas = ({ primary = 'Solicitar diagnóstico', secondary = 'Entrar no sistema' }) => (
  <div className="flex flex-col gap-4 sm:flex-row">
    <a
      href={empresa.cadastro}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-center font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
    >
      {primary}
      <ArrowRight size={18} />
    </a>
    <a
      href={empresa.login}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
    >
      {secondary}
      <ChevronRight size={18} />
    </a>
  </div>
)

const FloatingWhatsapp = () => (
  <a
    href={empresa.whatsapp}
    target="_blank"
    rel="noreferrer"
    aria-label="Falar no WhatsApp"
    className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-3 rounded-full bg-[#25d366] px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(37,211,102,0.35)] transition hover:-translate-y-0.5 hover:bg-[#1fba59] sm:bottom-5 sm:right-5"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
      <MessageSquareText size={18} />
    </span>
    <span>Falar no WhatsApp</span>
  </a>
)

const Landing = () => (
  <div className="bg-[#f7f5f2] text-slate-950">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-10">
        <a href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="Marcaí" className="h-20 w-auto md:h-24" />
        </a>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <a href="#beneficios" className="transition hover:text-slate-950">Benefícios</a>
          <a href="#modulos" className="transition hover:text-slate-950">Módulos</a>
          <a href="#como-funciona" className="transition hover:text-slate-950">Como funciona</a>
          <a href="#faq" className="transition hover:text-slate-950">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href={empresa.login} className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 md:inline-flex">
            Entrar
          </a>
          <a
            href={empresa.cadastro}
            className="inline-flex items-center justify-center rounded-full bg-[#8b5e34] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#774f2d]"
          >
            Solicitar diagnóstico
          </a>
        </div>
      </div>
    </header>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e9dccf] bg-[#fbf7f2] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b5e34] md:text-xs">
            <ShieldCheck size={14} />
            Plataforma para barbearias que querem vender mais e operar melhor
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.03] text-slate-950 md:text-7xl">
            Se a sua barbearia quer sair do improviso, o Marcaí foi feito para isso.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-xl">
            O Marcaí une WhatsApp, agenda, campanhas, financeiro e gestão para ajudar a barbearia a responder melhor, converter mais e administrar com mais clareza do que ferramentas genéricas.
          </p>
          <div className="mt-8">
            <PrimaryCtas primary="Solicitar diagnóstico" secondary="Entrar no sistema" />
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            Implantação com setup pago, treinamento da equipe e acompanhamento no WhatsApp.
          </p>
          <div className="mt-8 grid gap-3">
            {destaques.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                <CheckCircle2 className="shrink-0 text-[#8b5e34]" size={18} />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[24px] border border-[#e9dccf] bg-[#fbf7f2] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b5e34]">Por que vale trocar de ferramenta</p>
            <div className="mt-4 grid gap-3">
              {diferenciais.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                  <CheckCircle2 className="mt-1 shrink-0 text-[#8b5e34]" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-[#111111] p-4 shadow-[0_30px_80px_rgba(15,23,42,0.12)] md:p-6">
          <div className="rounded-[28px] bg-gradient-to-br from-[#171717] to-[#0f0f0f] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d8b48c]">Visão da operação</p>
                <h3 className="mt-2 font-display text-2xl text-white md:text-3xl">Mais controle para quem quer crescer de verdade</h3>
              </div>
              <img src="/logo.svg" alt="Marcaí" className="h-16 w-auto brightness-0 invert md:h-20" />
            </div>
            <div className="mt-6 grid gap-4">
              {metricas.map((item) => (
                <div key={item.legenda} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-display text-xl text-white">{item.valor}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.legenda}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-[#f7f5f2]">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-10 md:py-14">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            'Atendimento mais rápido',
            'Agenda mais organizada',
            'Mais recorrência',
            'Mais controle do negócio',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-medium text-slate-700 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>

    <section id="beneficios" className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Benefícios"
          title="Uma plataforma para barbearias que querem vender melhor e parar de apagar incêndio todo dia."
          text="O objetivo do Marcaí é reduzir o improviso no atendimento, organizar a agenda e dar ao dono uma visão mais forte do negócio."
          center
        />
      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {beneficios.map((item) => (
          <article key={item.titulo} className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbf7f2] text-[#8b5e34]">
              <item.icone size={22} />
            </div>
            <h3 className="mt-5 font-display text-2xl text-slate-950">{item.titulo}</h3>
            <p className="mt-3 text-base leading-8 text-slate-600">{item.texto}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="modulos" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeader
              label="Módulos"
              title="Os principais pilares da operação em um sistema só."
              text="Em vez de espalhar a rotina em várias ferramentas, o Marcaí centraliza as áreas que mais pesam no atendimento e na gestão."
            />
            <div className="mt-8">
              <PrimaryCtas primary="Solicitar implantação" secondary="Acessar login" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modulos.map((item) => (
              <div key={item.titulo} className="rounded-[26px] border border-slate-200 bg-[#faf9f7] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8b5e34] shadow-sm">
                  <item.icone size={22} />
                </div>
                <h3 className="mt-5 font-display text-xl text-slate-950">{item.titulo}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-[#faf9f7]">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Implantação e suporte"
          title="A ferramenta não é largada na sua mão. A implantação é feita para a barbearia usar de verdade."
          text="Além da plataforma, o Marcaí entrega setup profissional, treinamento e suporte próximo para a equipe conseguir operar com segurança."
          center
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {oferta.map((item) => (
            <div key={item.titulo} className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-lg font-semibold text-slate-950">{item.titulo}</p>
              <p className="mt-3 text-base leading-8 text-slate-600">{item.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
      <div className="grid gap-12 md:grid-cols-[0.92fr_1.08fr]">
        <div>
          <SectionHeader
            label="Como funciona"
            title="Um fluxo mais simples para vender, organizar e acompanhar."
            text="A plataforma foi pensada para reduzir gargalos no atendimento e dar mais previsibilidade para a operação."
          />
        </div>
        <div className="space-y-4">
          {comoFunciona.map((item) => (
            <div key={item.numero} className="flex gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                {item.numero}
              </div>
              <div>
                <p className="font-display text-xl text-slate-950">{item.titulo}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-y border-slate-200 bg-[#0f172a]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-[0.86fr_1.14fr] md:px-10 md:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d8b48c]">Antes e depois</p>
          <h2 className="mt-4 font-display text-4xl text-white md:text-5xl">
            O que muda quando a operação deixa de depender só da correria do dia.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">
            O ganho não está só em atender mais rápido. Está em ter uma estrutura melhor para agendar, confirmar, lembrar, recuperar cliente e acompanhar o negócio com mais seriedade.
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
          <div className="grid grid-cols-3 bg-white/10 px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300 md:px-5 md:text-xs">
            <div>Ponto</div>
            <div>Sem Marcaí</div>
            <div>Com Marcaí</div>
          </div>
          {comparativos.map(([ponto, antes, depois]) => (
            <div key={ponto} className="grid grid-cols-3 border-t border-white/10 px-4 py-4 text-xs leading-6 md:px-5 md:py-5 md:text-sm md:leading-7">
              <div className="pr-4 font-semibold text-white">{ponto}</div>
              <div className="pr-4 text-slate-300">{antes}</div>
              <div className="text-[#f1dcc2]">{depois}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Prova social"
          title="Barbearias que querem padrão usam operação com método."
          text="Exemplos de resultados comuns quando atendimento, agenda e gestão passam a funcionar no mesmo fluxo."
          center
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {provasSociais.map((item) => (
            <article key={item.nome} className="rounded-[28px] border border-slate-200 bg-[#faf9f7] p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b5e34]">{item.resultado}</p>
              <p className="mt-4 text-base leading-8 text-slate-700">"{item.depoimento}"</p>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="font-semibold text-slate-950">{item.nome}</p>
                <p className="text-sm text-slate-500">{item.cidade}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Empresa"
          title="Uma presença institucional clara para apresentar o Marcaí como software profissional."
          text="Mais do que um sistema bonito, o Marcaí se posiciona como ferramenta de operação para barbearias que querem subir de nível."
          center
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-[#faf9f7] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b5e34]">O que a empresa fornece</p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
              <li>Plataforma SaaS para atendimento, agenda, automação, clientes, financeiro e operação de barbearias.</li>
              <li>Estrutura de apresentação pública para credibilidade comercial e conformidade.</li>
              <li>Produto focado em negócio local, linguagem em português e rotina real de barbearia.</li>
            </ul>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-[#faf9f7] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b5e34]">Links públicos</p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
              <li>Site institucional: <a className="text-[#8b5e34] hover:underline" href={empresa.siteInstitucional}>{empresa.siteInstitucional}</a></li>
              <li>Plataforma: <a className="text-[#8b5e34] hover:underline" href={empresa.siteProduto}>{empresa.siteProduto}</a></li>
              <li>Login: <a className="text-[#8b5e34] hover:underline" href={empresa.login}>{empresa.login}</a></li>
              <li>Termos: <a className="text-[#8b5e34] hover:underline" href="/termos">/termos</a></li>
              <li>Privacidade: <a className="text-[#8b5e34] hover:underline" href="/privacidade">/privacidade</a></li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="faq" className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Perguntas frequentes"
          title="As principais dúvidas respondidas de forma simples."
          text="A ideia é ajudar o visitante a entender rápido o valor do sistema e avançar para contato ou implantação."
          center
        />
      <div className="mt-12 grid gap-4">
        {faq.map((item) => (
          <article key={item.pergunta} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-slate-950">{item.pergunta}</h3>
            <p className="mt-3 text-base leading-8 text-slate-600">{item.resposta}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 pb-24 md:px-10">
      <div className="rounded-[36px] bg-slate-950 px-6 py-10 md:px-12 md:py-12">
        <img src="/logo.svg" alt="Marcaí" className="h-16 w-auto brightness-0 invert md:h-20" />
        <h2 className="mt-6 max-w-4xl font-display text-4xl text-white md:text-6xl">
          O Marcaí é para a barbearia que quer parar de depender da correria e começar a operar com padrão.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Se a ideia é vender mais, responder melhor no WhatsApp e ter mais controle do negócio, esta é a conversa certa para abrir agora.
        </p>
        <div className="mt-8">
          <PrimaryCtas primary="Solicitar implantação" secondary="Entrar na plataforma" />
        </div>
      </div>
    </section>
    <FloatingWhatsapp />
  </div>
)

const Documento = ({ titulo, texto, pontos }) => (
  <div className="min-h-screen bg-[#f7f5f2]">
    <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
      <a href="/" className="text-sm text-[#8b5e34] hover:underline">Voltar para a página inicial</a>
      <div className="mt-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <img src="/logo.svg" alt="Marcaí" className="h-11 w-auto" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-[#8b5e34]">Documento público</p>
        <h1 className="mt-4 font-display text-4xl text-slate-950 md:text-5xl">{titulo}</h1>
        <p className="mt-5 text-base leading-8 text-slate-600">{texto}</p>
        <div className="mt-8 space-y-4">
          {pontos.map((ponto) => (
            <div key={ponto} className="rounded-[22px] border border-slate-200 bg-[#faf9f7] px-5 py-4 text-sm leading-7 text-slate-700">
              {ponto}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

export default function App() {
  const path = window.location.pathname

  if (path === '/termos') {
    return (
      <Documento
        titulo="Termos de serviço do Marcaí"
        texto={blocoLegal.termos}
        pontos={[
          'A plataforma fornece software para atendimento, agenda, automação, gestão e operação de barbearias.',
          'Cada cliente é responsável pelo uso adequado da ferramenta e pelo cumprimento das políticas da Meta e das leis aplicáveis.',
          'O serviço pode ser suspenso em caso de uso abusivo, fraude, spam, violação contratual ou risco operacional.',
          'A disponibilidade de recursos integrados pode depender de serviços externos e de aprovações de terceiros.',
        ]}
      />
    )
  }

  if (path === '/privacidade') {
    return (
      <Documento
        titulo="Política de privacidade do Marcaí"
        texto={blocoLegal.privacidade}
        pontos={[
          'Coletamos e tratamos dados como nome, telefone, histórico de atendimento e agenda para viabilizar o funcionamento do sistema.',
          'Os dados são usados para atendimento, automação, operação, relatórios e funcionalidades contratadas pela barbearia.',
          'Não comercializamos dados pessoais e só compartilhamos informações quando necessário para prestação do serviço ou exigência legal.',
          'Seguimos práticas de segurança compatíveis com a operação do produto e princípios da LGPD.',
        ]}
      />
    )
  }

  return <Landing />
}

import { useEffect, useState } from 'react'
import { applyPageSeo, SEO, whatsappSalesUrl, withUtm } from './seo'
import {
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Headphones,
  HelpCircle,
  MessageSquareText,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Zap,
} from 'lucide-react'

/** Ex.: número de vendas/institucional (formato 55 + DDD + 9 dígitos, sem +) */
const WHATSAPP_PHONE = '5511999887766'

const empresa = {
  nome: 'Marcaí',
  produto: 'Sistema de WhatsApp, agenda e gestão para barbearias',
  descricao: SEO.description,
  siteInstitucional: 'https://marcaí.com',
  siteProduto: 'https://barber.marcaí.com',
  login: 'https://barber.marcaí.com/login',
  cadastro: 'https://barber.marcaí.com/cadastro',
}

/** UTM: cadastro/login; WA usa pré-mensagem (origem) — wa.me não repassa query UTM */
const links = {
  /** Cadastro web (pouco usado no funil; preferir demonstracao no WhatsApp) */
  diagnostico: (slot) => withUtm(empresa.cadastro, { medium: 'lp', content: `cta_${slot}_diagnostico` }),
  /** Abre o WhatsApp com mensagem de solicitar demonstração (integração Meta) */
  demonstracao: (slot) => whatsappSalesUrl(WHATSAPP_PHONE, slot, { tipo: 'demo' }),
  entrar: (slot) => withUtm(empresa.login, { medium: 'lp', content: `cta_${slot}_entrar` }),
  vendas: (slot) => whatsappSalesUrl(WHATSAPP_PHONE, slot),
  site: (slot) => withUtm(empresa.siteInstitucional, { medium: 'lp', content: slot }),
  plataforma: (slot) => withUtm(empresa.siteProduto, { medium: 'lp', content: slot }),
}

const barraProvaRapida = [
  { icone: Zap, label: 'Atendimento com IA a partir dos seus dados' },
  { icone: Shield, label: 'Integração comercial oficial com a Meta (WhatsApp Business Platform)' },
  { icone: Headphones, label: 'Implantação e suporte acompanhados' },
  { icone: TrendingUp, label: 'Visão de caixa, agenda e recorrência' },
]

const metricasHero = [
  { titulo: 'IA recepcionista', texto: 'Conduz conversa, tira dúvida e empurra para agendamento com foco em conversão.' },
  { titulo: 'Agenda + lista de espera', texto: 'Reduz buraco no calendário e recupera cliente que fica na mão de vaca.' },
  { titulo: 'Plano, combo e fidelidade', texto: 'Aumenta ticket e recorrência com oferta clara, sem depender de lembrança do barbeiro.' },
  { titulo: 'Operação no painel', texto: 'Caixa, serviço, equipe e histórico no mesmo ecossistema — menos improviso, mais padrão.' },
]

const pilaresNivelAvancado = [
  {
    icone: MessageSquareText,
    titulo: 'WhatsApp comercial na API oficial da Meta, não atalho',
    texto:
      'O salão liga a operação à WhatsApp Business Platform: canal aprovado pela Meta, com a IA a ler serviço, preço, horário e regra. Menos "vou ver aqui" e mais fechamento rastreável no histórico.',
  },
  {
    icone: CalendarDays,
    titulo: 'Jornada de agendamento com menos desistência',
    texto: 'Link público, regras da casa e remarcação organizada — a equipe enxerga a agenda, o cliente paga menos pedágio de ir e vir.',
  },
  {
    icone: BarChart3,
    titulo: 'Gestão de dono, não só tela bonita',
    texto: 'Indicadores, caixa, campanha e leitura do mês para tomar decisão com número. Software avançado é o que o negócio consegue operar de verdade.',
  },
]

const destaques = [
  'IA com instrução comercial: resposta ágil, tom humano e gatilho de ação (agendar, remarcar, entender combo) sobre canal Meta oficial',
  'Integração comercial com a Meta (WhatsApp Business) + operação alinhada à realidade de barbearia brasileira',
  'Campanhas, aniversário e fila de espera para otimizar cadeira e trazer o cliente de volta com método',
  'Caixa, serviço, cliente, TV/totem e time em um painel: menos ferramenta solta, mais padrão de franqueadora',
]

const resultadosDireto = [
  { titulo: 'Mais faturamento previsível', desc: 'Menos furo, mais retorno, upsell e plano recorrente quando a oferta fica clara e mensurada.' },
  { titulo: 'Menos custo invisível', desc: 'O tempo de quem atende o WhatsApp deixa de ser o gargalo que segura a agenda e o financeiro.' },
  { titulo: 'Escala com controle', desc: 'Quando a operação cresce, a bagunça não acompanha: a barbearia mantém padrão com processo, não com heroísmo diário.' },
]

const beneficioCards = [
  {
    icone: MessageSquareText,
    titulo: 'Venda e responda com velocidade de profissional',
    texto:
      'O cliente do WhatsApp recebe padrão de atendimento. A equipe gasta menos energia reescrevendo a mesma coisa cinco vezes no dia.',
  },
  {
    icone: CalendarDays,
    titulo: 'Agenda viva, não caderninho de mesa',
    texto: 'Confirmação, remarcação e leitura do dia alinhada ao time: menos atrito, menos "sumiu" e mais horário aproveitado.',
  },
  {
    icone: Wallet,
    titulo: 'Dinheiro com rastro',
    texto: 'Movimentação, ticket e leitura do período: o dono enxerga o que sustenta a casa além do "deu certo o mês".',
  },
  {
    icone: Users,
    titulo: 'Recorrência é processo, não sorte',
    texto: 'Retorno, campanha e relacionamento vira rotina. O sistema empurra, a equipe executa, o cliente percebe padrão.',
  },
  {
    icone: BellRing,
    titulo: 'Automação no que dói: esquecimento e ociosidade',
    texto: 'Lembrete, fila, confirmação: reduz cadeira vazia e desmarca mal gerida — onde a operação perde grana sem perceber.',
  },
  {
    icone: BarChart3,
    titulo: 'Decisão com informação, não com achismo',
    texto: 'O painel dá a mesma linguagem que o dono precisa: serviço, pessoal, fluxo, financeiro, sem abrir cinco abas e três planilhas.',
  },
]

const modulos = [
  {
    icone: MessageSquareText,
    titulo: 'Atendimento, histórico e campanha',
    texto: 'O canal que mais vende, com rastro: conversa, oferta, retorno, disparo, segmentação, sem trocar de app.',
  },
  {
    icone: CalendarDays,
    titulo: 'Agenda, link e presença pública',
    texto: 'Cliente escolhe serviço, profissional e janela. A casa define regra, confirmação e visibilidade de buraco.',
  },
  {
    icone: Wallet,
    titulo: 'Caixa, pagamento, leitura de período',
    texto: 'Entradas, formas, retirada, visão de mês. Menos dúvida na hora de comprar, investir ou replicar o que deu certo.',
  },
  {
    icone: Store,
    titulo: 'Clientes, estoque, entrega, TV',
    texto: 'Ponto único: cadastro, aniversário, entrega, mídia. Operação alinhada ao salão, não a um "ERP genérico" que ninguém usa.',
  },
]

const oferta = [
  {
    titulo: 'Especialista em barbearia, não planilha disfarçada de app',
    texto: 'Cada tela fala a língua do corte, da comanda e da cadeira. O time adota mais rápido; o dono bate menos cabeça.',
  },
  {
    titulo: 'Estrutura e número para entrar em operação',
    texto: 'Você não fica sambando entre cinco logins. O setup é guiado, com a barbearia saindo do zero para operação padrão.',
  },
  {
    titulo: 'Implantação paga, treinamento e suporte no WhatsApp',
    texto: 'Ferramenta de verdade exige acompanhamento. O pacote de entrada inclui pista para a equipe não se perder após a primeira semana.',
  },
]

const comoFunciona = [
  {
    numero: '01',
    titulo: 'O cliente bate: WhatsApp ou link',
    texto: 'A primeira impressão deixa de ser "me manda aí" e passa a ser jornada guiada, com dado e intenção claros do sistema.',
  },
  {
    numero: '02',
    titulo: 'A máquina reduz o ruído',
    texto: 'Agenda, confirmação, lembrete, fila, campanha, upsell. O time opera com menos reescrita, menos erro e mais ritmo de loja lotada.',
  },
  {
    numero: '03',
    titulo: 'O dono puxa a alavanca com número',
    texto: 'A visão pós-venda, financeira e de retorno fica acessível. A decisão de cadeira, preço, horário e investimento fica explicada pelo painel.',
  },
]

const comparativos = [
  ['Foco comercial do WhatsApp', 'Atendimento reativo, sem padrão', 'Fluxo conduzido, histórico e ação (agendar / remarcar)'],
  ['Agenda e buraco de horário', 'Confirmação no improviso', 'Fila, lembrete e regra alinhada ao time'],
  ['Recorrência e ticket', 'Só o que a memória alcançou', 'Combos, retorno, campanha, leitura de mês'],
  ['Gestão', 'Caderno, feeling e 5 abas abertas', 'Painel único com corte, pessoal, caixa, cliente'],
]

const quemE = {
  sim: [
    'Dono que precisa crescer sem perder padrão (duas, três, dez cadeiras) e o WhatsApp pesa o bolso invisível',
    'Barbearia que já vende no Instagram/WhatsApp e quer converter conversa em horário, não em "depois te retorno"',
    'Equipe que cansa de reescrever preço, serviço, hora e ficha do cliente a cada pico de sábado',
  ],
  nao: [
    'Quem procura "aplicativo de agenda grátis" e não liga para processo, treino ou margem (o produto é operação, não adesivo)',
    'Quem recusa cuidar de canal oficial (API Meta) e ainda acha solução profissional em gambiarra de número pessoal',
    'Estrutura que não vai dedicar 30 minutos de onboarding com o time — o sistema é forte quando a operação acompanha',
  ],
}

const provasSociais = [
  {
    nome: 'Barbearia Prime',
    cidade: 'Goiânia - GO',
    resultado: 'Agenda com menos buraco, mais previsibilidade de semana',
    depoimento:
      'A gente vivia no improviso. Hoje a IA puxa a conversa pro que importa, o time responde com padrão e a agenda agradeceu.',
  },
  {
    nome: 'Don Corte Club',
    cidade: 'Brasília - DF',
    resultado: 'Retorno e ticket: combo virou oferta, não luta solitária do barbeiro',
    depoimento:
      'O cliente vê a mesma regra, o caixa acompanha. A gente deixou de viver só de correria e passou a ter ritmo de loja comercial.',
  },
  {
    nome: 'Studio 013',
    cidade: 'São Paulo - SP',
    resultado: 'De várias ferramentas para um ritmo de operação',
    depoimento:
      'Parou o carnaval de planilha e app que não conversava. Aqui quem cuida de salão, atende e acompanha tudo com cabeça fria.',
  },
]

const faq = [
  {
    pergunta: 'Isso é só agendador?',
    resposta:
      'Não. A agenda e o link são peça. O resto é o que fatura: atendimento comercial no WhatsApp, campanha, recorrência, caixa, cliente, operação e visão de mês. Avançado é o que integra, não o que fica "bonito e vazio".',
  },
  {
    pergunta: 'A IA inventa preço, horário ou regra que não existem na barbearia?',
    resposta:
      'O fluxo foi desenhado para puxar do que está no sistema. O objetivo é vender e agendar com segurança, sem prometer o que a casa não oferece.',
  },
  {
    pergunta: 'O cliente do final precisa instalar outro app?',
    resposta:
      'Não. Ele fala no WhatsApp como sempre. Sua equipe e você operam o painel web. Avançado é invisível para o cliente, visível no resultado.',
  },
  {
    pergunta: 'Serve para a barbearia de bairro ou precisa ser rede?',
    resposta:
      'Serve para quem leva a barbearia a sério, independente de tamanho. O produto pesa em processo, margem e padrão — se isso te interessa, provavelmente te serve.',
  },
  {
    pergunta: 'Como abrimos: vendas, implantação, suporte?',
    resposta:
      'A entrada combina triagem, setup e treino acompanhado, com suporte no WhatsApp. A ideia é você operar, não "ter login e se virar."',
  },
  {
    pergunta: 'O ROI vem com promessa de faturamento mínimo?',
    resposta:
      'Não. O retorno vem de menos buraco, mais retorno de cliente, ticket mais alinhado e equipe com menos perda de tempo — tudo isso é rastreável, mas varia com oferta, localização e liderança. O funil de vendas começa com demonstração e triagem honestas, não com slide milagroso.',
  },
  {
    pergunta: 'Quanto tempo até a operação andar "redonda"?',
    resposta:
      'Depende do engajamento da equipe e do que já existe de processo, mas a curva de adoção fica muito melhor com implantação guiada e reuniões de alinhamento no WhatsApp, em vez de soltar login e contar com boa vontade.',
  },
  {
    pergunta: 'A integração com a Meta é oficial ou é "gambiarra" de API?',
    resposta:
      'O produto foi desenhado para operar na WhatsApp Business Platform, no ecossistema comercial da Meta, com fluxo alinhado às políticas e aprovações do canal. Não se trata de automação escondida nem de atalho fora do que a Meta considera uso comercial adequado — a operação da barbearia fica amparada numa integração declarada e profissional.',
  },
  {
    pergunta: 'Por que "Solicitar demonstração" abre o WhatsApp em vez de um formulário?',
    resposta:
      'Demonstração comercial de operação de barbearia funciona melhor com conversa rápida: tamanho da equipe, canal, fila e expectativa. O WhatsApp é o canal onde o time já vive; a mensagem já vem com contexto (incluindo integração Meta oficial) para o comercial responder com seriedade.',
  },
]

/** Funil de vendas B2B explícito (AIDA adaptado) */
const funilVendas = [
  {
    fase: 'Atenção',
    titulo: 'A dor fica no lugar certo',
    texto: 'Cadeira, WhatsApp, buraco, caixa e desorganização deixam de ser "coisa de salão" e viram pauta: onde perde, onde fatura, onde padrão trava.',
    passo: '01',
  },
  {
    fase: 'Interesse',
    titulo: 'Demonstração com intenção de compra',
    texto: 'A conversa pega tamanho da operação, canal, oferta, equipe e meta. Sem isso, software vira tela. Com isso, vira contrato alinhado ao negócio.',
    passo: '02',
  },
  {
    fase: 'Decisão',
    titulo: 'Proposta e implantação riscada',
    texto: 'Setup, número/canal, treino da bancada e regras alinhadas à Meta. Você sabe o que entra, o que a equipe faz na primeira semana e onde buscar suporte.',
    passo: '03',
  },
  {
    fase: 'Ação & expansão',
    titulo: 'Operar e ajustar com dado',
    texto: 'Agenda, caixa, campanha, IA. O time usa o painel, o dono acompanha o mês, e a barbearia repete padrão em vez de apagar incêndio a cada sábado.',
    passo: '04',
  },
]

/** Objeções comuns (pré-qualificação) */
const objeçõesFunnel = [
  {
    dúvida: 'Já usei "agendador" e a equipe não adotou.',
    resposta:
      'Aqui a narrativa é de barbearia, não de slot genérico. A IA, o link e a comanda falam a mesma língua do corte, e a implantação força a equipe a cruzar a linha de uso, não a abandonar o app na segunda semana.',
  },
  {
    dúvida: 'Não tenho tempo de implantação agora.',
    resposta:
      'Estar ocupado hoje e não ter padrão amanhã continua saindo caro em buraco e atendimento. A entrada é enxuta e guiada: poucas horas concentradas, com calendário combinado, valem mais do que mês de improviso contínuo.',
  },
  {
    dúvida: 'Meu nº no WhatsApp já funciona, não quero trocar tudo.',
    resposta:
      'O ponto do produto é canal oficial e operação, não recomeçar do zero com tapa-olho. Na demonstração mapeamos a melhor jornada (integração Meta, equipe, canal) sem piorar o que já vende hoje.',
  },
]

/** Comparação de "caminho de mercado" (matriz) */
const matrizMercado = [
  { criterio: 'Linguagem do negócio', a: 'Genérico, qualquer nicho', b: 'Várias apps soltas, cada um com login', c: 'Corte, cadeira, comanda, fluxo BRL' },
  { criterio: 'Integração Meta / WhatsApp', a: 'Sem passo comercial oficial', b: 'Improviso ou risco de política', c: 'WhatsApp Business Platform — integração comercial oficial com a Meta' },
  { criterio: 'WhatsApp comercial', a: 'Só lembrete, sem conversão', b: 'Atendimento no improviso, sem dado', c: 'IA com dados reais, histórico e ação no canal aprovado' },
  { criterio: 'Implantação', a: 'Autoatendimento, "boa sorte"', b: 'Depende de TI ou "alguém que manda no Zap"', c: 'Demonstração + setup + suporte acompanhado' },
  { criterio: 'Dono: visão de mês', a: 'Relatórios vazios ou inexistentes', b: 'Planilha, feeling, 5 janelas', c: 'Agenda, caixa, recorrência no mesmo fio' },
]

/** Níveis de oferta (sem preço fixo: premium SaaS = conversa) */
const niveisOferta = [
  {
    nome: 'Operação',
    perfil: '1 unidade, time compacto, foco em padrão de agenda e atendimento.',
    destaques: ['Implantação guiada com treino essencial', 'IA + link + caixa com visão básica do mês', 'Canal de suporte alinhado ao go-live'],
    cta: 'Falar de encaixe',
    slot: 'nivel_base',
  },
  {
    nome: 'Crescimento',
    perfil: 'Múltiplos barbeiros, pico de sábado, precisa de recorrência e campanha com método.',
    destaques: ['Onboarding com prioridade de slots', 'Campanha, fidelidade, fila otimizadas', 'Revisão de operação pós-implantação'],
    cta: 'Solicitar demonstração (recomendado)',
    slot: 'nivel_crescimento',
    destaque: true,
  },
  {
    nome: 'Escala',
    perfil: 'Alta carga de cadeira, múltiplas frentes, dono com necessidade de leitura forte.',
    destaques: ['Acompanhamento comercial reforçado', 'Estratégia de uso de IA e oferta alinhada à base', 'Relatórios e rituais de gestão com o time'],
    cta: 'Reunião com vendas',
    slot: 'nivel_escala',
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
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-bronze shadow-sm md:text-[11px]">
      <Sparkles size={14} className="shrink-0" />
      {label}
    </div>
    <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-ink md:text-5xl">{title}</h2>
    <p className="mt-4 text-base leading-8 text-slate-600 md:text-lg">{text}</p>
  </div>
)

const PrimaryCtas = ({
  primary = 'Solicitar demonstração',
  secondary = 'Entrar na plataforma',
  /** Identificador para origem na mensagem do WhatsApp (ex.: hero, modulos, fechamento) */
  slot = 'conteudo',
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
    <a
      href={links.demonstracao(slot)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-center text-[15px] font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-[#1ebe57] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2"
    >
      <MessageSquareText size={18} className="shrink-0" />
      {primary}
    </a>
    <a
      href={links.entrar(slot)}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300/90 bg-white px-6 py-3 text-center text-[15px] font-semibold text-ink transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2"
    >
      {secondary}
      <ChevronRight size={18} className="shrink-0" />
    </a>
  </div>
)

const BottomWhatsapp = () => (
  <a
    href={links.demonstracao('float_wa')}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Solicitar demonstração no WhatsApp"
    className="fixed bottom-4 right-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,211,102,0.4)] transition hover:-translate-y-0.5 hover:bg-[#1ec95f] sm:bottom-5 sm:right-5 sm:gap-3 sm:px-4 sm:py-3"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
      <MessageSquareText size={18} />
    </span>
    <span className="sm:inline">Solicitar demonstração</span>
  </a>
)

const StickyCta = () => {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 420) setOpen(true)
      else setOpen(false)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!open) return null
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-3 py-2.5 pb-[env(safe-area-inset-bottom,8px)] shadow-[0_-8px_32px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden"
      role="region"
      aria-label="Ações principais"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        <a
          href={links.vendas('sticky_wa')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-ink"
        >
          Vendas
        </a>
        <a
          href={links.demonstracao('sticky')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-[1.15] items-center justify-center rounded-full bg-[#25D366] text-sm font-semibold text-white shadow-md shadow-emerald-900/20"
        >
          Demonstração
        </a>
      </div>
    </div>
  )
}

const ScrollProgress = () => {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setPct(max > 0 ? (el.scrollTop / max) * 100 : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso de leitura da página"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-700 via-bronze to-amber-600 transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

const Landing = () => {
  useEffect(() => {
    const old = document.getElementById('marcai-ldjson-faq')
    if (old) old.remove()
    const s = document.createElement('script')
    s.id = 'marcai-ldjson-faq'
    s.type = 'application/ld+json'
    s.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.pergunta,
        acceptedAnswer: { '@type': 'Answer', text: item.resposta },
      })),
    })
    document.head.appendChild(s)
    return () => s.remove()
  }, [])

  return (
  <div className="min-h-screen bg-sand/40 text-ink [padding-bottom:calc(4.5rem+env(safe-area-inset-bottom,0))] md:pb-0">
    <ScrollProgress />
    <a
      href="#inicio"
      className="sr-only left-2 top-2 z-[100] rounded-md bg-ink px-4 py-2 text-sm font-medium text-white focus:fixed focus:not-sr-only focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-bronze"
    >
      Pular para o conteúdo principal
    </a>
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-10 md:py-3">
        <a href="/" className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt={empresa.nome} className="h-14 w-auto md:h-20" />
        </a>
        <nav className="hidden items-center gap-4 text-sm text-slate-600 xl:flex" aria-label="Seções">
          <a className="transition hover:text-ink" href="#funil">
            Funil
          </a>
          <a className="transition hover:text-ink" href="#visao-avancada">
            Proposta
          </a>
          <a className="transition hover:text-ink" href="#resultados">
            Resultado
          </a>
          <a className="transition hover:text-ink" href="#modulos">
            Plataforma
          </a>
          <a className="transition hover:text-ink" href="#investimento">
            Investimento
          </a>
          <a className="transition hover:text-ink" href="#quem">
            Perfil
          </a>
          <a className="transition hover:text-ink" href="#objecoes">
            Objeções
          </a>
          <a className="transition hover:text-ink" href="#faq">
            FAQ
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={links.entrar('header')}
            className="hidden text-sm font-medium text-slate-600 transition hover:text-ink sm:inline"
          >
            Entrar
          </a>
          <a
            href={links.demonstracao('header')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#25D366] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ebe57] sm:px-4"
          >
            Solicitar demonstração
          </a>
        </div>
      </div>
    </header>

    <section
      id="inicio"
      className="relative overflow-hidden border-b border-slate-200/80 bg-mesh"
      aria-label="Proposta de valor"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_0%,rgba(185,131,69,0.2),transparent),radial-gradient(700px_400px_at_100%_30%,rgba(21,52,46,0.2),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-10 md:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/90 backdrop-blur-sm md:px-4 md:py-2 md:text-xs">
              <Crown className="text-amber-200/90" size={14} />
              Integração Meta oficial (WhatsApp Business) · {SEO.primaryKeyword}
            </div>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.04] text-white md:text-6xl md:leading-[1.02]">
              Sistema de gestão para barbearia com IA no WhatsApp — cadeira cheia, caixa lido, operação padrão. Sem app
              genérico.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
              {empresa.descricao} Avançado aqui:{' '}
              <strong className="font-semibold text-white">
                jornada comercial, dados alimentando a IA, agenda, financeiro e time no mesmo cérebro
              </strong>
              .
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/95">
              O atendimento por WhatsApp utiliza a <strong className="font-semibold text-white">plataforma comercial oficial da Meta</strong> (WhatsApp
              Business Platform / API aprovada), com conformidade ao ecossistema Meta — não é atalho nem solução paralela ao canal.
            </p>
            <div className="mt-8 max-w-lg">
              <PrimaryCtas secondary="Já sou cliente" slot="hero" />
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              <strong className="font-medium text-slate-300">Solicitar demonstração</strong> abre o WhatsApp com a origem da landing. Implantação com
              setup, treino da bancada e acompanhamento.
            </p>
            <ul className="mt-8 max-w-2xl space-y-2.5 text-sm leading-7 text-slate-200/95">
              {destaques.slice(0, 3).map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:pl-2">
            <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[1.7rem] bg-gradient-to-b from-zinc-900/90 to-ink p-4 md:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/80 md:text-xs">Painel de gestão</p>
                    <p className="mt-1 font-display text-xl text-white md:text-2xl">O que a barbearia vê, de verdade</p>
                  </div>
                  <img src="/logo.svg" alt="" className="h-12 w-auto opacity-90 brightness-0 invert md:h-14" />
                </div>
                <ul className="mt-4 space-y-2.5">
                  {metricasHero.map((m) => (
                    <li
                      key={m.titulo}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 transition hover:border-amber-200/20 hover:bg-white/[0.07]"
                    >
                      <p className="font-display text-[15px] text-white md:text-base">{m.titulo}</p>
                      <p className="mt-1.5 text-xs leading-6 text-slate-300 md:text-sm md:leading-6">{m.texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {barraProvaRapida.map((row) => (
            <div
              key={row.label}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-slate-200 backdrop-blur-sm"
            >
              <row.icone className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" />
              <span className="leading-relaxed">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200/90 bg-sand/50">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['Faturar com mais padrão', 'Menos buraco, mais retorno', 'Time no mesmo compasso', 'Dono de olho no que importa'].map((s) => (
            <div
              key={s}
              className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-center text-sm font-medium text-slate-800 shadow-sm"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </section>

    <section
      id="funil"
      className="relative border-b border-slate-200/90 bg-gradient-to-b from-white via-sand/40 to-sand/25"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/80 shadow-sm md:text-[11px]">
            <Workflow size={14} className="text-bronze" />
            Funil de vendas B2B
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold text-ink md:text-5xl">Do clique intencional à operação que se repete todo mês</h2>
          <p className="mt-4 text-base leading-8 text-slate-600 md:text-lg">
            Atenção, interesse, decisão, ação — com linguagem de software premium: menos vitrine, mais conversa alinhada a contrato, implantação e uso real.
          </p>
        </div>
        <ol className="mt-12 grid list-none gap-5 md:grid-cols-2 xl:grid-cols-4">
          {funilVendas.map((etapa) => (
            <li
              key={etapa.passo}
              className="relative flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-sm transition hover:shadow-md"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-bronze">{etapa.fase}</span>
                <span className="rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{etapa.passo}</span>
              </div>
              <h3 className="mt-3 font-display text-lg text-ink md:text-xl">{etapa.titulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{etapa.texto}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={links.demonstracao('funil_hero')}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-[#1ebe57]"
          >
            <MessageSquareText size={16} />
            Entrar no funil: solicitar demonstração
          </a>
          <a
            href={links.vendas('funil_wa')}
            className="text-sm font-semibold text-bronze underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Prefiro falar com vendas agora
          </a>
        </div>
      </div>
    </section>

    <section id="visao-avancada" className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24">
      <SectionHeader
        label="Nível avançado de verdade"
        title="O software não é a tela. É a barbearia rodando o salão com método."
        text="Aqui 'avançado' é integração, foco de receita, disciplina de agenda e dado alimentando a IA. Simples de usar, difícil de replicar com gabaré."
        center
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {pilaresNivelAvancado.map((p) => (
          <article
            key={p.titulo}
            className="group rounded-[1.6rem] border border-slate-200/90 bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-glow"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand text-bronze transition group-hover:bg-bronze/10">
              <p.icone size={22} />
            </div>
            <h3 className="mt-5 font-display text-xl text-ink md:text-2xl">{p.titulo}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-[15px] md:leading-8">{p.texto}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="resultados" className="border-y border-slate-200/90 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bronze md:text-xs">Estratégia de vendas</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink md:text-4xl">O acordo tácito com a barbearia: menos improviso, mais faturamento controlável.</h2>
            <p className="mt-4 text-slate-600">Três eixos. Sem matemágica, sem fórmula milagrosa — só o que a operação sólida alcança com canal certo, agenda certa e leitura certa.</p>
          </div>
          <div className="space-y-3">
            {resultadosDireto.map((r) => (
              <div key={r.titulo} className="rounded-2xl border border-slate-200/80 bg-sand/40 p-5 md:p-6">
                <p className="font-display text-lg text-ink md:text-xl">{r.titulo}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600 md:text-[15px]">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20" aria-label="Principais benefícios">
      <SectionHeader
        label="O que o dono e a equipe sentem"
        title="Corte entrega experiência, o sistema entrega o que a experiência precisa: ritmo, rastro e padrão."
        text="Quando tudo fala a mesma língua (WhatsApp, agenda, campanha, caixa, cliente), a loja cresce na horizontal sem explodir na vertical com bagunça."
        center
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {beneficioCards.map((item) => (
          <article
            key={item.titulo}
            className="rounded-[1.5rem] border border-slate-200/90 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-7"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand/80 text-bronze">
              <item.icone size={22} />
            </div>
            <h3 className="mt-4 font-display text-lg text-ink md:text-xl">{item.titulo}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 md:text-[15px]">{item.texto}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="modulos" className="border-y border-slate-200/90 bg-sand/30">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <SectionHeader
              label="Plataforma"
              title="Um teto para o salão, não cinco teto para cinco dores de cabeça."
              text='Cada pilar fala a linguagem de quem corta, recebe, agenda e paga. Menos "ferramenta fria" e mais conversa de negócio.'
            />
            <div className="mt-7">
              <PrimaryCtas secondary="Entrar na plataforma" slot="modulos" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {modulos.map((m) => (
              <div key={m.titulo} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:rounded-3xl md:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand/90 text-bronze md:h-12 md:w-12 md:rounded-2xl">
                  <m.icone size={22} />
                </div>
                <h3 className="mt-4 font-display text-base text-ink md:text-lg">{m.titulo}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{m.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section
      id="investimento"
      className="border-y border-slate-200/90 bg-ink text-white"
      aria-label="Níveis de investimento e encaixe"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90 md:text-[11px]">
            <Target size={14} className="shrink-0" />
            Investimento e encaixe
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold leading-tight md:text-5xl">Três portas, um mesmo cérebro. O que muda é o tamanho do salão e a fome de crescimento.</h2>
          <p className="mt-4 text-slate-300">
            Valor de implantação, mensalidade e escopo (números, equipe, integrações) saem <strong className="font-semibold text-white">sempre após demonstração e triagem comercial</strong> — sem preço
            falso no site, sem puxadinho. Premium é transparência + fit.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {niveisOferta.map((n) => (
            <article
              key={n.nome}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                n.destaque
                  ? 'border-bronze/50 bg-gradient-to-b from-amber-950/40 to-zinc-950/80 ring-2 ring-bronze/30'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              {n.destaque ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-bronze/50 bg-ink px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  Mais procurado
                </span>
              ) : null}
              <h3 className="font-display text-2xl text-white">{n.nome}</h3>
              <p className="mt-2 text-sm text-slate-300">{n.perfil}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-200">
                {n.destaques.map((d) => (
                  <li key={d} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                    {d}
                  </li>
                ))}
              </ul>
              {n.destaque ? (
                <a
                  href={links.demonstracao(n.slot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-center text-sm font-semibold text-white shadow-md shadow-emerald-900/30 transition hover:bg-[#1ebe57]"
                >
                  <MessageSquareText size={16} />
                  {n.cta}
                </a>
              ) : n.slot === 'nivel_escala' ? (
                <a
                  href={links.vendas('nivel_reuniao')}
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {n.cta}
                </a>
              ) : (
                <a
                  href={links.vendas('nivel_encaixe')}
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-amber-100 transition hover:border-white/25"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {n.cta}
                </a>
              )}
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-6 text-slate-500">
          Menção de planos e escopo exige reunião comercial; contrato e SLAs são formalizados na proposta, não no hero.
        </p>
      </div>
    </section>

    <section className="bg-white" aria-label="Implantação">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Garantia de uso"
          title="A barbearia não fica com login sozinha. A entrada é projeto de operação, não e-mail e senha e boa sorte."
          text="Especialista acompanha, treina a equipe e responde no canal onde o salão vive. Isso o marketplace não entrega; quem lida com cadeira, entende."
          center
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {oferta.map((o) => (
            <div key={o.titulo} className="rounded-[1.4rem] border border-slate-200/90 bg-sand/25 p-6 md:rounded-3xl md:p-7">
              <p className="font-display text-base font-semibold text-ink md:text-lg">{o.titulo}</p>
              <p className="mt-2.5 text-sm leading-7 text-slate-600 md:text-[15px]">{o.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-t border-slate-200/90">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SectionHeader
              label="Fluxo de valor"
              title="O cliente bate, o fluxo puxa, o dono enxerga. Sem fanfarra."
              text="Três passos. O complexo acontece no motor; a frente fala português de barbeiro."
            />
          </div>
          <div className="space-y-3">
            {comoFunciona.map((c) => (
              <div key={c.numero} className="flex gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{c.numero}</div>
                <div>
                  <p className="font-display text-base text-ink md:text-lg">{c.titulo}</p>
                  <p className="mt-1.5 text-sm leading-7 text-slate-600">{c.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section id="quem" className="border-y border-slate-200/90 bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight md:text-4xl">Para quem o Marcaí paga o ingresso (e o ROI)</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Negócio de cadeira que quer crescer com padrão. Não precisa ser rede. Precisa de dono e equipe alinhados ao básico: horário, preço, caixa, cliente e canal.</p>
            <ul className="mt-6 space-y-3">
              {quemE.sim.map((l) => (
                <li key={l} className="flex gap-2.5 text-sm leading-7 text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <h3 className="font-display text-lg text-amber-100/90 md:text-xl">Quando o produto não encaixa (por design)</h3>
            <p className="mt-2 text-sm text-slate-300">Falar logo evita mau casamento. Marcaí é B2B de operação, não brinquedo de "testar hoje, largar mês que vem".</p>
            <ul className="mt-5 space-y-3">
              {quemE.nao.map((l) => (
                <li key={l} className="flex gap-2.5 text-sm leading-7 text-slate-200/95">
                  <span className="mt-0.5 text-slate-500" aria-hidden>
                    ·
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="objecoes" className="border-b border-slate-200/90 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-amber-50/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/90 md:text-[11px]">
            <HelpCircle size={14} className="text-bronze" />
            Objeções e pré-qualificação
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold text-ink md:text-5xl">O que a barbearia levanta antes de falar de contrato (e a resposta direta)</h2>
          <p className="mt-3 text-slate-600">Sem enrolação: funil sólido mata trote cedo, para não perder o tempo de quem leva a operação a sério.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {objeçõesFunnel.map((o) => (
            <div key={o.dúvida} className="flex flex-col rounded-3xl border border-slate-200/90 bg-sand/20 p-6 shadow-sm">
              <p className="font-display text-base text-ink md:text-lg">&ldquo;{o.dúvida}&rdquo;</p>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{o.resposta}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <a href={links.vendas('objecoes_wa')} className="font-semibold text-bronze hover:underline" target="_blank" rel="noopener noreferrer">
            Quero falar isso com vendas, ao vivo
          </a>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <a
            href={links.demonstracao('objeções_cta')}
            className="font-semibold text-ink hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Solicitar demonstração no WhatsApp
          </a>
        </div>
      </div>
    </section>

    <section id="mercado" className="bg-sand/30">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-10 md:py-16">
        <h2 className="text-center font-display text-2xl text-ink md:text-3xl">Onde o Marcaí se encaixa no mercado</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">Três lógicas de compra. Uma coluna fala a língua do salão comercial.</p>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/90">
                <th className="px-3 py-3.5 font-semibold text-ink sm:px-4">Critério</th>
                <th className="px-2 py-3.5 text-slate-500 sm:px-3">App de agenda genérico</th>
                <th className="px-2 py-3.5 text-slate-500 sm:px-3">Várias ferramentas soltas</th>
                <th className="px-2 py-3.5 text-bronze sm:px-3">Marcaí</th>
              </tr>
            </thead>
            <tbody>
              {matrizMercado.map((row) => (
                <tr key={row.criterio} className="border-b border-slate-100/90 last:border-0">
                  <th scope="row" className="px-3 py-3.5 font-medium text-ink sm:px-4">
                    {row.criterio}
                  </th>
                  <td className="px-2 py-3.5 text-slate-500 sm:px-3">{row.a}</td>
                  <td className="px-2 py-3.5 text-slate-500 sm:px-3">{row.b}</td>
                  <td className="px-2 py-3.5 font-medium text-ink sm:px-3">
                    {row.c}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="bg-zinc-950" aria-label="Comparativo">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[0.9fr_1.1fr] md:px-10 md:py-20">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bronze md:text-xs">Troco claro</p>
          <h2 className="mt-3 font-display text-3xl text-white md:text-4xl">O que muda na prática, não no slide de venda.</h2>
          <p className="mt-3 text-slate-400">
            A diferença não é &ldquo;ter Internet&rdquo;. É ter <strong className="font-semibold text-slate-300">processo</strong> com canal e agenda
            puxando o mesmo fio, com dono lendo a mesma folha de rosto do barbeiro.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-3 border-b border-white/10 bg-white/5 px-3 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-4 sm:py-3.5 sm:text-[10px]">
            <span>Área</span>
            <span>Como muita barbearia roda hoje</span>
            <span>Com o Marcaí</span>
          </div>
          {comparativos.map(([ponto, antes, depois]) => (
            <div
              key={ponto}
              className="grid grid-cols-3 border-t border-white/10 px-3 py-3.5 text-[11px] leading-5 sm:px-4 sm:py-4 sm:text-sm sm:leading-6"
            >
              <div className="pr-2 font-semibold text-white sm:pr-3">{ponto}</div>
              <div className="pr-2 text-slate-400 sm:pr-3">{antes}</div>
              <div className="text-amber-100/95">{depois}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200/90 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-20">
        <SectionHeader
          label="Prova"
          title="Cenário típico: quando o salão vira franqueadora de processo, não de desculpas"
          text="Cada cadeira é universo próprio, mas padrão de bons resultados rima: menos improviso, mais horário, mais retorno, mais nítido. Os exemplos abaixo ilustram padrões de uso, não promessa numérica de faturamento."
          center
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {provasSociais.map((item) => (
            <article key={item.nome} className="flex flex-col rounded-3xl border border-slate-200/90 bg-sand/30 p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bronze md:text-xs">{item.resultado}</p>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-800 md:text-[15px]">"{item.depoimento}"</p>
              <div className="mt-5 border-t border-slate-200/80 pt-4 text-sm text-slate-500">
                <p className="font-semibold text-ink">{item.nome}</p>
                <p>{item.cidade}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs leading-6 text-slate-500">* Resultados reais variam com equipe, oferta, localização e processo. Os depoimentos são ilustrativos de categorias de uso comuns.</p>
      </div>
    </section>

    <section id="faq" className="bg-sand/30">
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeader
          label="Dúvidas"
          title="O que o comprador B2B pergunta antes de assinar a folha lisa."
          text="Vendas honestas: se algo aqui bate com sua barbearia, o próximo passo é falar com gente, não com formulário mudo."
          center
        />
        <div className="mt-10 space-y-2">
          {faq.map((item) => (
            <details
              key={item.pergunta}
              className="group rounded-2xl border border-slate-200/90 bg-white px-4 py-1 shadow-sm open:shadow-md md:rounded-3xl md:px-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 pr-1 font-display text-base text-ink [::-webkit-details-marker]:hidden md:text-lg">
                <span className="text-left leading-snug">{item.pergunta}</span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-bronze transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="border-t border-slate-100 pb-4 pt-0 text-left text-sm leading-7 text-slate-600 md:text-[15px]">
                {item.resposta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 pb-10 pt-2 md:px-10">
      <div className="relative overflow-hidden rounded-[2rem] bg-mesh px-6 py-10 shadow-xl md:rounded-[2.2rem] md:px-12 md:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(500px_220px_at_0%_100%,rgba(185,131,69,0.12),transparent)]" aria-hidden />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Comercial, implantação, suporte: mesmo fio
          </div>
          <h2 className="mt-5 max-w-3xl font-display text-3xl text-white md:text-5xl">Pronta a barbearia que quer trocar correria por cadeira cheia, com número na mão e equipe alinhada?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            Próximo passo: <strong className="font-semibold text-white">solicitar demonstração no WhatsApp</strong> (integração Meta oficial na
            conversa) ou falar com vendas para dúvidas comerciais. Se o perfil bater, a conversa paga a si só.
          </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PrimaryCtas secondary="Entrar na plataforma" slot="fechamento" />
            <a
              href={links.vendas('footer_wa')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com vendas
            </a>
          </div>
        </div>
      </div>
    </section>

    <footer className="border-t border-slate-200/90 bg-sand/40" role="contentinfo">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <img src="/logo.svg" alt={empresa.nome} className="h-8 w-auto opacity-90" />
          <span className="text-slate-500">{empresa.produto}</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <a className="text-bronze hover:underline" href={links.site('footer_institucional')}>
            {empresa.siteInstitucional}
          </a>
          <a className="text-bronze/90 hover:underline" href={links.plataforma('footer_plataforma')}>
            Plataforma
          </a>
          <a className="hover:text-ink" href="/termos">
            Termos
          </a>
          <a className="hover:text-ink" href="/privacidade">
            Privacidade
          </a>
        </div>
      </div>
    </footer>

    <BottomWhatsapp />
    <StickyCta />
  </div>
  )
}

const Documento = ({ titulo, texto, pontos }) => (
  <div className="min-h-screen bg-sand/50">
    <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
      <a href="/" className="text-sm text-bronze hover:underline">
        Voltar para a página inicial
      </a>
      <div className="mt-6 rounded-[2rem] border border-slate-200/90 bg-white p-8 shadow-sm md:p-10">
        <img src="/logo.svg" alt={empresa.nome} className="h-10 w-auto" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-bronze">Documento público</p>
        <h1 className="mt-4 font-display text-3xl text-ink md:text-4xl">{titulo}</h1>
        <p className="mt-5 text-base leading-8 text-slate-600">{texto}</p>
        <div className="mt-8 space-y-4">
          {pontos.map((ponto) => (
            <div key={ponto} className="rounded-2xl border border-slate-200/80 bg-sand/30 px-5 py-4 text-sm leading-7 text-slate-700">
              {ponto}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

export default function App() {
  const path = (window.location.pathname || '/').replace(/\/$/, '') || '/'

  useEffect(() => {
    applyPageSeo(path)
  }, [path])

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

import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Globe, HelpCircle, KeyRound, Monitor, Phone, Shield, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

const Secao = ({ id, titulo, icone: Icon, children, className }) => (
  <section
    id={id}
    className={cn(
      'scroll-mt-24 rounded-3xl border border-borda bg-white p-6 sm:p-8 shadow-card-sm',
      className
    )}
  >
    <div className="flex items-start gap-3 mb-5">
      {Icon && (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-fundo text-primaria">
          <Icon size={20} />
        </span>
      )}
      <h2 className="text-lg font-bold text-texto tracking-tight leading-snug pt-1">{titulo}</h2>
    </div>
    <div className="text-sm text-texto-sec leading-relaxed space-y-3">{children}</div>
  </section>
)

const listaAntes = [
  'Acesse com permissão de administrador em um portfólio comercial (Meta Business) — ou crie o portfólio no fluxo, se a Meta permitir.',
  'Use o mesmo login (Facebook) de dono ou admin comercial; evite trocar de conta no meio.',
  'Se a Meta exigir, conclua a verificação da empresa (documentos) no Business Center. Sem isso, alguns passos do WhatsApp podem não abrir. Se for recusada, a Meta indica o motivo; em geral dá para reenviar documentos ou pedir nova análise.',
  'Tenha o número e o celular à mão; a confirmação pode ser por SMS ou ligação.',
]

const listaPratico = [
  { titulo: 'Onde conectar', texto: 'Prefira computador (Chrome ou Edge) no painel, usando o botão Conectar WhatsApp no topo. Evite o navegador embutido do Instagram ou Facebook.' },
  { titulo: 'Portfólio e WABA', texto: 'Se já existir ativo, escolha o existente em vez de “criar tudo do zero” se o assistente travar.' },
  {
    titulo: 'Site (quando a Meta pedir)',
    texto: 'Se o assistente pedir site e você não tiver site próprio, coloque a URL da página do Facebook do negócio (facebook.com/…). A Meta costuma aceitar. Quando tiver site, pode atualizar nos dados comerciais.',
  },
  {
    titulo: 'Número no app WhatsApp Business',
    texto: 'O estado fica do lado da Meta. Consulte o Business Manager; após sair do app, pode levar horas. Se persistir, use o suporte comercial da Meta com o número.',
  },
]

const listaProblemas = [
  {
    destaque: 'Evidência',
    texto: 'Anote a mensagem de erro, faça captura e o Session ID no rodapé do assistente — agiliza o suporte.',
  },
  {
    destaque: 'Assistente, número ou verificação',
    texto: 'Use a Central de ajuda da Meta for Business ou o suporte da sua conta comercial. Verificação recusada: siga o fluxo do Business Center para corrigir documentos ou pedir nova análise.',
    link: { href: 'https://www.facebook.com/business/help', label: 'Central de ajuda — Meta for Business' },
  },
  {
    destaque: 'Erro ao concluir no BarberMark',
    texto: '(código inválido, “concluir integração”, etc.) Entre em contato com o suporte BarberMark com a mensagem exata; costuma ser domínio, URL de redirect ou configuração do site.',
  },
  {
    destaque: 'App e permissões (developers)',
    texto: 'Análise de app, “Provedor de Tecnologia” e documentação com a Meta são tratadas pelo time BarberMark. A barbearia não preenche esse painel; o suporte explica se houver restrição de acesso.',
  },
]

const ConfigIntegracoesWhatsappMeta = () => (
  <div className="max-w-3xl mx-auto space-y-8 pb-16">
    <div>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-texto-sec hover:text-primaria transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Voltar ao painel
      </Link>

      <p className="text-xs font-semibold uppercase tracking-wider text-primaria mb-2">Guia</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-texto tracking-tight">
        WhatsApp Business (Meta)
      </h1>
      <p className="mt-3 text-sm sm:text-base text-texto-sec max-w-2xl leading-relaxed">
        A ligação passa pelo assistente da Meta. O BarberMark só conclui a integração depois que você
        conclui o login e a autorização no fluxo oficial. Abaixo: o que preparar, como evitar travas
        e o que fazer se algo falhar.
      </p>
    </div>

    <Secao titulo="Antes de conectar" icone={Sparkles}>
      <ol className="list-decimal pl-5 space-y-3 marker:font-medium marker:text-texto">
        {listaAntes.map((item, i) => (
          <li key={i} className="pl-1 text-texto">
            {item}
          </li>
        ))}
      </ol>
    </Secao>

    <Secao
      id="dominio-app-meta"
      titulo="Erro: “domínio desta URL não está nos domínios do app” ou 500 em /complete"
      icone={Globe}
      className="border-primaria/20 bg-fundo/40"
    >
      <p className="text-texto">
        Isso vem do <strong>app na Meta (developers)</strong>, não do cadastro do BarberMark. O SDK e o
        OAuth só aceitam a URL exata em que a página abre, se o domínio estiver listado.
      </p>
      <ol className="list-decimal pl-5 space-y-2 marker:font-medium marker:text-texto text-texto">
        <li className="pl-1">
          Em{' '}
          <a
            className="font-medium text-primaria hover:underline"
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noreferrer"
          >
            developers.facebook.com
          </a>
          : selecione o <strong>app</strong> usado no BarberMark.
        </li>
        <li className="pl-1">
          <strong>Configurações do app &gt; Básico &gt; Domínios do app</strong>: inclua o host do
          painel (só o domínio, sem <code className="text-xs">https://</code> nem caminho), por
          exemplo <code className="text-xs">barber.seudominio.com</code>. Se usar{' '}
          <code className="text-xs">www</code>, inclua a variante que as pessoas realmente acessam
          no navegador.
        </li>
        <li className="pl-1">
          <strong>Login do Facebook &gt; Configurações &gt; URIs de redirecionamento OAuth válidos</strong>
          : adicione a URL <strong>completa</strong> do painel onde o usuário abre o conector (a mesma do servidor), por
          exemplo <code className="text-xs break-all">https://seu-dominio.com/dashboard</code>{' '}
          (igual a <code className="text-xs">OAUTH_REDIRECT_URL</code> / <code className="text-xs">APP_URL</code> no
          deploy).
        </li>
        <li className="pl-1">
          Domínio com caractere especial: use o <strong>mesmo formato</strong> que aparece na barra
          do navegador ou o punycode (<code className="text-xs">xn--...</code>), alinhado ao que
          está no servidor.
        </li>
      </ol>
      <p className="text-xs text-texto-sec pt-1">
        Depois de salvar na Meta, aguarde um minuto e tente de novo; abra sempre a integração
        pela <strong>mesma URL</strong> que está em OAuth (com ou sem <code className="text-xs">www</code>).
      </p>
    </Secao>

    <Secao titulo="Dicas práticas" icone={Monitor}>
      <ul className="space-y-4">
        {listaPratico.map(({ titulo, texto }) => (
          <li key={titulo} className="border-l-2 border-primaria/30 pl-4">
            <p className="font-semibold text-texto text-sm">{titulo}</p>
            <p className="mt-1 text-texto-sec">{texto}</p>
          </li>
        ))}
      </ul>
      <p className="pt-2">
        <a
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primaria hover:underline"
          href="https://business.facebook.com"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} />
          business.facebook.com
        </a>
      </p>
    </Secao>

    <Secao id="registro-cloud-api" titulo="Registro do número na Cloud API (pós-conexão)" icone={KeyRound}>
      <p className="text-texto">
        Depois de conectar no BarberMark, a Meta ainda pode exigir o{' '}
        <strong>registro do número comercial</strong> na Cloud API. Sem esse passo, o envio de
        mensagens falha (por exemplo erro <span className="font-mono text-xs">#133010</span> — conta
        não registrada). O painel do BarberMark pode mostrar integração &quot;conectada&quot; e mesmo
        assim faltar o <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/register</code>{' '}
        do número comercial.
      </p>

      <p className="font-semibold text-texto pt-1">O que fazer (lado Meta)</p>
      <ol className="list-decimal pl-5 space-y-3 marker:font-medium marker:text-texto">
        <li className="pl-1 text-texto">
          No{' '}
          <a
            className="font-medium text-primaria hover:underline"
            href="https://developers.facebook.com/"
            target="_blank"
            rel="noreferrer"
          >
            Meta for Developers
          </a>
          : abra o <strong>app</strong> → <strong>WhatsApp</strong> →{' '}
          <strong>API Setup</strong>. Confira o <strong>Phone number ID</strong> e o status do
          número.
        </li>
        <li className="pl-1 text-texto">
          Conclua o registro do número na Cloud API com o endpoint de registro da documentação
          oficial:
        </li>
      </ol>

      <div className="my-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 font-mono text-xs text-texto overflow-x-auto">
        <p className="text-texto-sec font-sans text-[0.7rem] uppercase tracking-wide mb-2">
          POST (Graph API)
        </p>
        <code className="whitespace-pre block leading-relaxed">
          {`POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/register`}
        </code>
      </div>

      <p className="text-texto-sec">Corpo JSON (o PIN tem 6 dígitos):</p>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 font-mono text-xs text-texto overflow-x-auto">
        <code className="whitespace-pre">{`{
  "messaging_product": "whatsapp",
  "pin": "XXXXXX"
}`}</code>
      </div>
      <ul className="list-disc pl-5 text-texto-sec space-y-1">
        <li>
          Se o número já tiver <strong>verificação em duas etapas</strong> no WhatsApp Business, use
          o PIN real.
        </li>
        <li>
          Caso contrário, defina um PIN novo de 6 dígitos conforme a documentação (ele passará a
          valer para o número).
        </li>
      </ul>

      <p className="pt-2">
        <a
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primaria hover:underline"
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} />
          Documentação: Register a Business Phone Number
        </a>
      </p>

      <p className="text-texto border-l-2 border-primaria/40 pl-4 mt-4">
        Quando o número comercial aparecer como <strong>registrado / ativo</strong> na Cloud API,
        teste o envio de uma mensagem de novo (por exemplo, para o número onde você recebe o
        WhatsApp pessoal).
      </p>

      <p className="text-xs text-texto-sec pt-3">
        Exemplo com <code className="rounded bg-slate-100 px-1">curl</code> (substitua ID, token e
        PIN; o token costuma ser o de acesso do app com permissões de mensagens):
      </p>
      <div className="rounded-2xl border border-slate-200 bg-slate-950/95 p-4 font-mono text-[0.7rem] text-emerald-100/95 overflow-x-auto leading-relaxed">
        <code className="whitespace-pre block">
          {`curl -X POST "https://graph.facebook.com/v22.0/SEU_PHONE_NUMBER_ID/register" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer SEU_TOKEN_DE_ACESSO" \\
  -d '{"messaging_product":"whatsapp","pin":"123456"}'`}
        </code>
      </div>
    </Secao>

    <Secao titulo="Se deu errado, travou ou recusou" icone={HelpCircle} className="border-amber-200/60 bg-amber-50/20">
      <ul className="space-y-5">
        {listaProblemas.map(({ destaque, texto, link }, i) => (
          <li key={destaque} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-texto text-sm">{destaque}</p>
              <p className="mt-1 text-texto-sec">{texto}</p>
              {link && (
                <a
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primaria hover:underline"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                  {link.label}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Secao>

    <div className="rounded-3xl border border-borda bg-fundo/80 p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <Shield size={20} className="shrink-0 text-texto-sec mt-0.5" />
        <div className="space-y-2 text-sm text-texto-sec leading-relaxed">
          <p>
            <strong className="text-texto">Quem cuida do quê</strong>
          </p>
          <p>
            A <strong className="text-texto">Meta</strong> trata de conta, número, documentos e
            políticas do negócio quando exigir. O <strong className="text-texto">BarberMark</strong>{' '}
            trata de erros da integração no nosso sistema e do relacionamento com a análise do app
            no painel de desenvolvedor.
          </p>
          <p className="text-xs text-texto-sec/90 pt-1">
            O fluxo de login segue a configuração do app BarberMark na Meta.
          </p>
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-borda border-dashed p-5 bg-white/50">
      <p className="text-sm text-texto-sec flex items-start gap-2">
        <Phone size={16} className="shrink-0 mt-0.5" />
        Pronto para conectar? No canto superior do painel, use o botão <strong className="text-texto">Conectar WhatsApp</strong>.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center justify-center gap-2 rounded-2xl h-10 px-5 text-sm font-semibold bg-primaria text-white hover:bg-primaria-escura transition-colors"
      >
        Abrir o painel
      </Link>
    </div>
  </div>
)

export default ConfigIntegracoesWhatsappMeta

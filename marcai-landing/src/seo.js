/**
 * SEO e atribuição (UTM) — fonte única para landing.
 * Em produção, defina VITE_LANDING_BASE_URL (ex.: https://marcaí.com) no build; ver .env.example
 */
const DEFAULT_ORIGIN = 'https://marcaí.com'

export const LANDING_BASE_URL = String(import.meta.env.VITE_LANDING_BASE_URL || DEFAULT_ORIGIN)
  .trim()
  .replace(/\/$/, '')

export const SEO = {
  /** Foco de busca + pitch (first fold) */
  primaryKeyword: 'sistema de gestão para barbearia com IA no WhatsApp',
  title:
    'Marcaí | Solicitar demonstração — gestão de barbearia com integração Meta oficial (WhatsApp Business) e IA no WhatsApp',
  description:
    'Solicite demonstração no WhatsApp. O Marcaí conecta a barbearia à Meta de forma oficial: WhatsApp Business Platform (API comercial aprovada), com IA, agenda, planos, caixa e operação. Implantação e suporte no Brasil.',
  /** Imagem compartilhada (og); absoluta. Opcional: /og-1200x630.jpg em public/ e altere o caminho abaixo */
  get ogImage() {
    return `${LANDING_BASE_URL}/logo.svg`
  },
  jsonLd: {
    name: 'Marcaí',
    appUrl: 'https://barber.marcaí.com',
    get instituicao() {
      return LANDING_BASE_URL
    },
  },
  source: 'marcai-landing',
  campaign: 'lp-b2b-barbearia',
  keywords:
    'sistema de gestão para barbearia, software barbearia, IA no WhatsApp, agendamento online barbearia, integração Meta oficial, WhatsApp Business Platform, API comercial Meta, Marcaí',
}

const TERMOS = {
  title: 'Termos de serviço | Marcaí',
  description: 'Termos de uso do Marcaí — software para atendimento, agenda, automação e gestão de barbearias.',
  path: '/termos',
}

const PRIVACIDADE = {
  title: 'Política de privacidade | Marcaí',
  description: 'Como a plataforma Marcaí trata dados de agenda, atendimento e operação, em alinhamento à LGPD.',
  path: '/privacidade',
}

function ensureMetaByProperty(property) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  return el
}

function ensureMetaByName(name) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  return el
}

function ensureLinkCanonical() {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  return el
}

/**
 * UTM: medium = tipo de ação, content = posição (hero, header, etc.)
 * @param {string} baseUrl
 * @param {object} o
 * @param {string} o.medium
 * @param {string} [o.content]
 */
export function withUtm(baseUrl, { medium, content }) {
  try {
    const u = new URL(baseUrl)
    u.searchParams.set('utm_source', SEO.source)
    u.searchParams.set('utm_medium', medium)
    u.searchParams.set('utm_campaign', SEO.campaign)
    if (content) u.searchParams.set('utm_content', content)
    return u.toString()
  } catch {
    return baseUrl
  }
}

/**
 * Pré-mensagem com origem (substitui UTM, que o wa.me não repassa)
 * @param {string} content — ex. hero_demo, sticky_wa
 * @param {{ tipo?: 'demo' | 'vendas' }} [opts] — `demo` = solicitar demonstração; `vendas` = conversa comercial
 */
export function whatsappSalesUrl(phone, content, opts = {}) {
  const tipo = opts.tipo || 'vendas'
  const text =
    tipo === 'demo'
      ? `Olá! Quero solicitar demonstração do Marcaí (origem: ${content}). Falo na operação, na IA e na integração WhatsApp comercial oficial com a Meta (WhatsApp Business Platform).`
      : `Olá! Vim da landing do Marcaí (origem: ${content}) e quero falar com vendas sobre: ${SEO.primaryKeyword}. Quero alinhar integração Meta oficial, implantação e preço.`
  return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

const PAGE_URL = {
  home: LANDING_BASE_URL,
  termos: `${LANDING_BASE_URL}${TERMOS.path}`,
  privacidade: `${LANDING_BASE_URL}${PRIVACIDADE.path}`,
}

/**
 * Sincroniza <title>, canonical, metas básicos e Open Graph.
 * @param {string} path — window.location.pathname
 */
export function applyPageSeo(path) {
  const normalized = path.replace(/\/$/, '') || '/'
  const isTermos = normalized === '/termos'
  const isPriv = normalized === '/privacidade'

  if (isTermos) {
    document.title = TERMOS.title
    setMeta(TERMOS.description, PAGE_URL.termos, TERMOS.title)
  } else if (isPriv) {
    document.title = PRIVACIDADE.title
    setMeta(PRIVACIDADE.description, PAGE_URL.privacidade, PRIVACIDADE.title)
  } else {
    document.title = SEO.title
    setMeta(SEO.description, PAGE_URL.home, SEO.title)
  }
}

function setMeta(desc, url, title) {
  const descEl = ensureMetaByName('description')
  descEl.setAttribute('content', desc)
  const ogTitle = ensureMetaByProperty('og:title')
  const ogDesc = ensureMetaByProperty('og:description')
  const ogUrl = ensureMetaByProperty('og:url')
  const ogImage = ensureMetaByProperty('og:image')
  const ogSite = ensureMetaByProperty('og:site_name')
  const ogLocale = ensureMetaByProperty('og:locale')
  const ogType = ensureMetaByProperty('og:type')
  const twTitle = ensureMetaByName('twitter:title')
  const twDesc = ensureMetaByName('twitter:description')
  const twCard = ensureMetaByName('twitter:card')
  const twImage = ensureMetaByName('twitter:image')
  const twUrl = ensureMetaByName('twitter:url')
  const img = SEO.ogImage
  ogTitle.setAttribute('content', title)
  ogDesc.setAttribute('content', desc)
  ogUrl.setAttribute('content', url)
  ogImage.setAttribute('content', img)
  ogSite.setAttribute('content', SEO.jsonLd.name)
  ogLocale.setAttribute('content', 'pt_BR')
  ogType.setAttribute('content', 'website')
  twTitle.setAttribute('content', title)
  twDesc.setAttribute('content', desc)
  twCard.setAttribute('content', 'summary_large_image')
  twImage.setAttribute('content', img)
  twUrl.setAttribute('content', url)
  ensureLinkCanonical().setAttribute('href', url)
}

export { TERMOS, PRIVACIDADE, PAGE_URL }

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs) => twMerge(clsx(inputs))

export const formatarMoeda = (centavos) => {
  if (!centavos && centavos !== 0) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

export const formatarData = (data) => {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(data))
}

export const formatarDataHora = (data) => {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(data))
}

export const formatarHora = (data) => {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(data))
}

export const obterIniciais = (nome) => {
  if (!nome) return '?'
  // Não gera iniciais de número de telefone (começa com + ou só dígitos)
  if (/^[+\d]/.test(nome.trim())) return '?'
  return nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// Formata número de telefone BR para exibição: +5511999999999 → (11) 99999-9999
export const formatarTelefone = (tel) => {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '')
  // Remove código do país 55 se presente
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`
  return tel
}

export const formatarDuracao = (minutos) => {
  if (!minutos) return '—'
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  return mins > 0 ? `${horas}h${mins}min` : `${horas}h`
}

export const statusAgendamento = {
  AGENDADO: { label: 'Pendente confirmação', cor: 'bg-info/15 text-info border border-info/30' },
  CONFIRMADO: { label: 'Confirmado', cor: 'bg-alerta/15 text-alerta border border-alerta/30' },
  CONCLUIDO: { label: 'Concluído', cor: 'bg-sucesso/15 text-sucesso border border-sucesso/30' },
  CANCELADO: { label: 'Cancelado', cor: 'bg-perigo/15 text-perigo border border-perigo/30' },
  NAO_COMPARECEU: { label: 'Não compareceu', cor: 'bg-[#B45309]/15 text-[#B45309] border border-[#B45309]/25' },
  REMARCADO: { label: 'Remarcado', cor: 'bg-[#7E22CE]/15 text-[#7E22CE] border border-[#7E22CE]/25' },
}

export const segmentos = [
  { valor: 'BELEZA', label: 'Barbearia masculina' },
  { valor: 'SAUDE', label: 'Salão de cabeleireiro' },
  { valor: 'FITNESS', label: 'Estética e beleza' },
  { valor: 'EDUCACAO', label: 'Barbershop premium' },
  { valor: 'OUTRO', label: 'Outro (beleza e cuidados)' },
]

export const tomsDeVoz = [
  { valor: 'ACOLHEDOR', label: 'Recepcionista humana', descricao: 'Mais calor humano, acolhimento e conversa de recepção bem treinada.' },
  { valor: 'DESCONTRALIDO', label: 'Híbrido barbearia', descricao: 'Equilibra rapidez com personalidade. Bom padrão para WhatsApp no Brasil.' },
  { valor: 'FORMAL', label: 'Autoatendimento rápido', descricao: 'Mais direto e operacional, no estilo fluxo rápido de atendimento digital.' },
]

export const tiposPlanoServico = [
  { valor: 'CORTE', label: 'Plano de corte' },
  { valor: 'BARBA', label: 'Plano de barba' },
  { valor: 'COMBO', label: 'Combo corte + barba' },
  { valor: 'MENSAL', label: 'Plano mensal' },
]

export const formatarPercentual = (valor, casas = 0) => {
  if (valor == null || Number.isNaN(Number(valor))) return '—'
  return `${Number(valor).toFixed(casas)}%`
}

export const sanitizarTexto = (texto) => {
  if (!texto) return texto
  return texto.replace(/<[^>]*>/g, '').trim()
}

const pontuarMojibake = (texto) => {
  if (!texto) return 0
  const suspeitos = texto.match(/[ÃÂâ�]/g)
  return suspeitos ? suspeitos.length : 0
}

const limparSequenciasQuebradas = (texto) => texto
  .replace(/Â /g, ' ')
  .replace(/Â/g, '')
  .replace(/â€”/g, '—')
  .replace(/â€“/g, '–')
  .replace(/â€œ/g, '“')
  .replace(/â€\u009d/g, '”')
  .replace(/â€˜/g, '‘')
  .replace(/â€™/g, '’')
  .replace(/â€¦/g, '...')
  .replace(/â€¢/g, '•')

export const normalizarTextoCorrompido = (texto) => {
  if (texto == null) return texto

  const bruto = String(texto)
  const candidatos = [limparSequenciasQuebradas(bruto)]

  try {
    candidatos.push(limparSequenciasQuebradas(decodeURIComponent(escape(bruto))))
  } catch {}

  try {
    const bytes = Uint8Array.from(bruto, (char) => char.charCodeAt(0))
    candidatos.push(limparSequenciasQuebradas(new TextDecoder('utf-8').decode(bytes)))
  } catch {}

  return candidatos.sort((a, b) => pontuarMojibake(a) - pontuarMojibake(b))[0]
}

export const opcoesDuracao = [
  { valor: 15, label: '15 minutos' },
  { valor: 30, label: '30 minutos' },
  { valor: 45, label: '45 minutos' },
  { valor: 60, label: '1 hora' },
  { valor: 90, label: '1h30min' },
  { valor: 120, label: '2 horas' },
  { valor: 180, label: '3 horas' },
  { valor: 240, label: '4 horas' },
]

export const opcoesAntecedencia = [
  { valor: 1, label: '1 hora' },
  { valor: 2, label: '2 horas' },
  { valor: 6, label: '6 horas' },
  { valor: 12, label: '12 horas' },
  { valor: 24, label: '24 horas' },
]

export const diasSemana = [
  { numero: 0, label: 'Domingo', abrev: 'Dom' },
  { numero: 1, label: 'Segunda', abrev: 'Seg' },
  { numero: 2, label: 'Terça', abrev: 'Ter' },
  { numero: 3, label: 'Quarta', abrev: 'Qua' },
  { numero: 4, label: 'Quinta', abrev: 'Qui' },
  { numero: 5, label: 'Sexta', abrev: 'Sex' },
  { numero: 6, label: 'Sábado', abrev: 'Sab' },
]

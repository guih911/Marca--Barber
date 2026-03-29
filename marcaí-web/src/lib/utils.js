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
  AGENDADO:        { label: 'Pendente confirmação', cor: 'bg-blue-100 text-blue-800' },
  CONFIRMADO:      { label: 'Confirmado',           cor: 'bg-yellow-100 text-yellow-800' },
  CONCLUIDO:       { label: 'Concluído',            cor: 'bg-green-100 text-green-700' },
  CANCELADO:       { label: 'Cancelado',            cor: 'bg-red-100 text-red-700' },
  NAO_COMPARECEU:  { label: 'Não compareceu',       cor: 'bg-orange-100 text-orange-800' },
  REMARCADO:       { label: 'Remarcado',            cor: 'bg-purple-100 text-purple-700' },
}

export const segmentos = [
  { valor: 'BELEZA', label: 'Barbearia masculina' },
  { valor: 'SAUDE', label: 'Salão de cabeleireiro' },
  { valor: 'FITNESS', label: 'Estética e beleza' },
  { valor: 'EDUCACAO', label: 'Barbershop premium' },
  { valor: 'OUTRO', label: 'Outro (beleza e cuidados)' },
]

export const tomsDeVoz = [
  { valor: 'FORMAL', label: 'Premium', descricao: 'Tom refinado, profissional e objetivo.' },
  { valor: 'DESCONTRALIDO', label: 'Direto', descricao: 'Casual, ágil e com energia de barbearia.' },
  { valor: 'ACOLHEDOR', label: 'Consultivo', descricao: 'Empático, humano e focado em resolver.' },
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

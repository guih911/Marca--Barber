// Utilitários de formatação de data

// Formata data para exibição no padrão brasileiro
const formatarDataBR = (data) => {
  if (!data) return ''
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Formata data e hora para exibição no padrão brasileiro
const formatarDataHoraBR = (data) => {
  if (!data) return ''
  const d = new Date(data)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Retorna início do dia
const inicioDoDia = (data) => {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

// Retorna fim do dia
const fimDoDia = (data) => {
  const d = new Date(data)
  d.setHours(23, 59, 59, 999)
  return d
}

// Retorna início da semana (domingo)
const inicioDaSemana = (data) => {
  const d = new Date(data)
  const dia = d.getDay()
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

// Retorna fim da semana (sábado)
const fimDaSemana = (data) => {
  const d = new Date(data)
  const dia = d.getDay()
  d.setDate(d.getDate() + (6 - dia))
  d.setHours(23, 59, 59, 999)
  return d
}

// Adiciona minutos a uma data
const adicionarMinutos = (data, minutos) => {
  return new Date(new Date(data).getTime() + minutos * 60 * 1000)
}

module.exports = {
  formatarDataBR,
  formatarDataHoraBR,
  inicioDoDia,
  fimDoDia,
  inicioDaSemana,
  fimDaSemana,
  adicionarMinutos,
}

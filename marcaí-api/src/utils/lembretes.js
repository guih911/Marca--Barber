const INTERVALO_CRON_MINUTOS = 15

const normalizarListaMinutos = (valor) => {
  const lista = Array.isArray(valor) ? valor : []
  return [...new Set(
    lista
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 0)
  )].sort((a, b) => b - a)
}

const obterLembretesConfigurados = (tenant) => {
  const lista = normalizarListaMinutos(tenant?.lembretesMinutosAntes)
  if (lista.length > 0) return lista

  const legado = Number(tenant?.lembreteMinutosAntes ?? 60)
  if (!Number.isFinite(legado) || legado <= 0) return []
  return [legado]
}

const obterLembretesEnviados = (agendamento) => {
  return new Set(normalizarListaMinutos(agendamento?.lembretesConfiguradosEnviados))
}

const estaNaJanelaDeLembrete = (restanteMinutos, minutosAntes, intervaloCronMinutos = INTERVALO_CRON_MINUTOS) => {
  if (!Number.isFinite(restanteMinutos) || !Number.isFinite(minutosAntes)) return false
  if (minutosAntes <= 0 || restanteMinutos < 0) return false

  const inicioJanela = Math.max(0, minutosAntes - intervaloCronMinutos)
  return restanteMinutos <= minutosAntes && restanteMinutos > inicioJanela
}

module.exports = {
  INTERVALO_CRON_MINUTOS,
  obterLembretesConfigurados,
  obterLembretesEnviados,
  estaNaJanelaDeLembrete,
}

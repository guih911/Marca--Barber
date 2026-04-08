const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_COMPLETO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

const formatarHoraCurta = (hora = '') => String(hora || '').replace(':00', 'h').replace(':', 'h')

const obterConfigDia = (profissional, diaIndex) => (
  profissional?.horarioTrabalho?.[diaIndex]
  || profissional?.horarioTrabalho?.[String(diaIndex)]
  || null
)

const montarFaixasDia = (configDia) => {
  if (!configDia?.ativo || !configDia.inicio || !configDia.fim) return []

  const intervalos = Array.isArray(configDia.intervalos)
    ? configDia.intervalos
      .filter((intervalo) => intervalo?.inicio && intervalo?.fim && intervalo.inicio < intervalo.fim)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
    : []

  const faixas = []
  let cursor = configDia.inicio

  for (const intervalo of intervalos) {
    if (cursor < intervalo.inicio) {
      faixas.push({ inicio: cursor, fim: intervalo.inicio })
    }
    if (cursor < intervalo.fim) {
      cursor = intervalo.fim
    }
  }

  if (cursor < configDia.fim) {
    faixas.push({ inicio: cursor, fim: configDia.fim })
  }

  return faixas
}

const formatarFaixasResumo = (faixas = []) => (
  faixas.map((faixa, index) => (
    index === 0
      ? `${formatarHoraCurta(faixa.inicio)} às ${formatarHoraCurta(faixa.fim)}`
      : `e das ${formatarHoraCurta(faixa.inicio)} às ${formatarHoraCurta(faixa.fim)}`
  )).join(' ')
)

const resumirDiasSequenciais = (dias = []) => {
  if (!dias.length) return ''
  if (dias.length >= 5 && dias.every((dia, indice) => indice === 0 || dia === dias[indice - 1] + 1)) {
    return `${DIAS_ABREV[dias[0]]}–${DIAS_ABREV[dias[dias.length - 1]]}`
  }

  const partes = []
  let inicio = dias[0]
  let anterior = dias[0]

  for (let indice = 1; indice <= dias.length; indice += 1) {
    const atual = dias[indice]
    if (atual === anterior + 1) {
      anterior = atual
      continue
    }

    partes.push(inicio === anterior ? DIAS_ABREV[inicio] : `${DIAS_ABREV[inicio]}–${DIAS_ABREV[anterior]}`)
    inicio = atual
    anterior = atual
  }

  return partes.join(', ')
}

const obterFaixasRepresentativasDia = (profissionais = [], diaIndex) => {
  const faixasPorProfissional = profissionais
    .map((profissional) => montarFaixasDia(obterConfigDia(profissional, diaIndex)))
    .filter((faixas) => faixas.length > 0)

  if (!faixasPorProfissional.length) return []

  const contagem = new Map()
  for (const faixas of faixasPorProfissional) {
    const chave = JSON.stringify(faixas)
    contagem.set(chave, (contagem.get(chave) || 0) + 1)
  }

  const [assinaturaMaisComum] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]
  return JSON.parse(assinaturaMaisComum)
}

const resumirHorarioFuncionamento = (profissionais = []) => {
  const grupos = new Map()

  for (let dia = 0; dia < 7; dia += 1) {
    const faixas = obterFaixasRepresentativasDia(profissionais, dia)
    if (!faixas.length) continue
    const chave = JSON.stringify(faixas)
    if (!grupos.has(chave)) grupos.set(chave, { dias: [], faixas })
    grupos.get(chave).dias.push(dia)
  }

  if (!grupos.size) return 'Horários sob consulta'

  const gruposOrdenados = [...grupos.values()]
    .sort((a, b) => a.dias[0] - b.dias[0])
    .map((grupo) => `${resumirDiasSequenciais(grupo.dias)} ${formatarFaixasResumo(grupo.faixas)}`)

  return gruposOrdenados.join('; ')
}

const montarHorarioDetalhado = (profissionais = []) => (
  DIAS_COMPLETO.map((diaLabel, diaIndex) => {
    const configuracoesDia = profissionais
      .map((profissional) => obterConfigDia(profissional, diaIndex))
      .filter((config) => config?.ativo && config.inicio && config.fim)

    if (configuracoesDia.length === 0) {
      return { dia: diaLabel, fechado: true, faixas: [] }
    }

    const primeira = JSON.stringify(configuracoesDia[0])
    const horariosIguais = configuracoesDia.every((config) => JSON.stringify(config) === primeira)

    if (horariosIguais) {
      return {
        dia: diaLabel,
        fechado: false,
        faixas: montarFaixasDia(configuracoesDia[0]).map((faixa) => ({
          inicio: faixa.inicio,
          fim: faixa.fim,
          label: `${faixa.inicio} às ${faixa.fim}`,
        })),
      }
    }

    const menorInicio = configuracoesDia.reduce((menor, config) => (config.inicio < menor ? config.inicio : menor), '23:59')
    const maiorFim = configuracoesDia.reduce((maior, config) => (config.fim > maior ? config.fim : maior), '00:00')

    return {
      dia: diaLabel,
      fechado: false,
      faixas: [{ inicio: menorInicio, fim: maiorFim, label: `${menorInicio} às ${maiorFim}` }],
    }
  })
)

module.exports = {
  montarFaixasDia,
  resumirHorarioFuncionamento,
  montarHorarioDetalhado,
}

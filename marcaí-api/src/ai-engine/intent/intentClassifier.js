const engine = require('../../modulos/ia/engine')

const normalizarTexto = (texto = '') =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const mensagemPareceRefinoDeHorario = (mensagem = '') => {
  const n = normalizarTexto(mensagem)
  return /\b(hoje|hj|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|ultimo horario|primeiro horario|mais tarde|mais cedo|fim do dia|manha|tarde|noite)\b/.test(n)
    || /\b\d{1,2}(:\d{2})?\b/.test(n)
    || /\b\d{1,2}\s*h(rs?)?\b/.test(n)
}

const detectarIntencao = ({ mensagem, temContextoRecenteDeRemarcacao = false }) => {
  let intencao = engine.detectar(mensagem)

  if (!intencao && temContextoRecenteDeRemarcacao && mensagemPareceRefinoDeHorario(mensagem)) {
    intencao = 'REMARCAR'
  }

  return intencao
}

module.exports = {
  detectarIntencao,
}

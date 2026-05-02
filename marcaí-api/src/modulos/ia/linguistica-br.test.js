const test = require('node:test')
const assert = require('node:assert/strict')

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key'

const { __test: iaTest } = require('./ia.servico')

test('normalizarMensagemParaLLM expande abreviacoes BR comuns', () => {
  const entrada = 'HJ VC TEM HORARIO? PQ TBM QRO BARBA MSM'
  const normalizada = iaTest.normalizarMensagemParaLLM(entrada)

  assert.match(normalizada, /\bhoje\b/i)
  assert.ok(normalizada.includes('você'))
  assert.match(normalizada, /\bporque\b/i)
  assert.ok(normalizada.includes('também'))
  assert.match(normalizada, /\bmesmo\b/i)
})

test('normalizarMensagemParaLLM converte "q" isolado para "que"', () => {
  const normalizada = iaTest.normalizarMensagemParaLLM('q horas abre?')
  assert.match(normalizada, /\bque\b/i)
})

test('normalizarMensagemParaLLM baixa caps lock agressivo', () => {
  const entrada = 'QUERO HORARIO AGORA'
  const normalizada = iaTest.normalizarMensagemParaLLM(entrada)
  assert.equal(normalizada, 'quero horario agora')
})

test('saudacoes com girias brasileiras sao reconhecidas', () => {
  const casos = ['slv', 'salve', 'e ai', 'opa']
  for (const caso of casos) {
    assert.equal(iaTest.ehSaudacaoSolta(caso), true, `Esperava saudacao valida para: ${caso}`)
  }
})

test('intencao objetiva funciona com variacoes populares', () => {
  const mensagens = [
    'tem vaga hj a tarde?',
    'bora marcar um corte amanha',
    'quero remarcar meu horario',
    'pode cancelar meu agendamento',
  ]

  for (const mensagem of mensagens) {
    const n = iaTest.normalizarTextoIntencao(mensagem)
    assert.equal(iaTest.ehIntencaoObjetivaDeAtendimento(n), true, `Falhou em: ${mensagem}`)
  }
})

test('deteccao de data entende hoje e amanha com abreviacoes', () => {
  const tz = 'America/Sao_Paulo'
  const hoje = iaTest.obterDataDesejadaDaMensagem('hj tem vaga', tz)
  const amanha = iaTest.obterDataDesejadaDaMensagem('amanha de manha', tz)

  assert.ok(hoje)
  assert.ok(amanha)
  assert.notEqual(hoje, amanha)
})

test('deteccao de data relativa pode usar data de referencia da conversa', () => {
  const tz = 'America/Sao_Paulo'
  const referencia = new Date('2026-04-28T22:00:00-03:00')
  const dataRelativa = iaTest.obterDataDesejadaDaMensagem('amanha as 16:30', tz, referencia)

  assert.equal(dataRelativa, '2026-04-29')
})

test('deteccao de pagamento cobre girias e erros comuns de digitacao', () => {
  const entradas = [
    'aceita pix?',
    'passa no cartao de debito?',
    'rola parcelado no credito?',
    'tem como pagar no piks',
  ]

  for (const mensagem of entradas) {
    const n = iaTest.normalizarTextoIntencao(mensagem)
    assert.equal(iaTest.clientePerguntouPagamento(n), true, `Nao detectou pagamento: ${mensagem}`)
  }
})

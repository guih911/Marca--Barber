const test = require('node:test')
const assert = require('node:assert/strict')

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key'

const {
  humanizarResposta,
  decidirFormatoResposta,
} = require('./humanizacao.servico')
const { respostaDireta } = require('./engine')
const { __test: iaTest } = require('./ia.servico')

test('humanizarResposta remove texto robotico e puxa tom mais humano premium', () => {
  const resposta = humanizarResposta({
    texto: 'Oi! Como posso te ajudar? Você pode agendar pelo link ou me fala aqui.',
    cliente: { nome: 'Matheus Silva' },
    mensagemCliente: 'oi',
  })

  assert.doesNotMatch(resposta, /Como posso te ajudar/i)
  assert.doesNotMatch(resposta, /agendar pelo link/i)
  assert.match(resposta, /me diz o que você precisa|eu já organizo por aqui/i)
  assert.doesNotMatch(resposta, /assistente virtual|recepcionista virtual/i)
})

test('decidirFormatoResposta segura audio quando a resposta eh tecnica ou multiline', async () => {
  const formato = await decidirFormatoResposta({
    cliente: { preferencias: { canalPreferido: 'AUDIO' } },
    mensagemCliente: 'aceita pix e cartao? manda endereco tambem',
    respostaTexto: 'Aceitamos PIX e cartão.\nEstamos na Rua das Palmeiras, 10.',
    ehAudioEntrada: true,
  })

  assert.equal(formato.enviarTexto, true)
  assert.equal(formato.enviarAudio, false)
  assert.equal(formato.motivo, 'texto_padrao')
})

test('decidirFormatoResposta libera audio curto em contexto urgente', async () => {
  const formato = await decidirFormatoResposta({
    cliente: { preferencias: {} },
    mensagemCliente: 'preciso agora',
    respostaTexto: 'Tenho sim. Já vejo isso pra você.',
    ehAudioEntrada: true,
  })

  assert.equal(formato.enviarAudio, true)
})

test('engine resposta direta de figurinha mantem tom premium sem personagem generico', () => {
  const direta = respostaDireta('FIGURINHA')

  assert.equal(direta.pular, true)
  assert.match(direta.resposta, /me diz o que você precisa|se quiser/i)
  assert.doesNotMatch(direta.resposta, /assistente|recepcionista/i)
})

test('engine localizacao responde com endereco e puxa atendimento sem jogar persona errada', () => {
  const direta = respostaDireta('LOCALIZACAO', {
    tenant: {
      endereco: 'Rua Augusta, 100',
      linkMaps: 'https://maps.example/augusta',
    },
  })

  assert.match(direta.resposta, /Rua Augusta, 100/)
  assert.match(direta.resposta, /já vejo um horário pra você/i)
  assert.doesNotMatch(direta.resposta, /assistente|recepcionista/i)
})

test('playbook comercial reforca consultoria premium de barbearia masculina', () => {
  const playbook = iaTest.montarPlaybookComercial({
    tenant: {
      estoqueAtivo: true,
      pacotesAtivo: true,
      membershipsAtivo: true,
      fidelidadeAtivo: true,
    },
    servicos: [
      { nome: 'Corte Masculino' },
      { nome: 'Barba Premium' },
      { nome: 'Sobrancelha' },
    ],
    produtosEstoque: [{ quantidadeAtual: 3 }],
    pacotes: [{ nome: 'Combo Corte + Barba' }],
    planosMensais: [{ nome: 'Plano Mensal' }],
  })

  assert.match(playbook, /consultor premium de uma barbearia masculina/i)
  assert.match(playbook, /Nao jogue link como atalho pregu/i)
  assert.doesNotMatch(playbook, /recepcionista|telemarketing barato/i)
})

test('modo barbeiro responde como venda consultiva e so manda link quando pedem', () => {
  const tenant = { hashPublico: 'barber-pro', slug: 'barber-pro' }

  const respostaGeral = iaTest.montarRespostaModoBarbeiro({
    mensagemNormalizada: 'sou barbeiro e quero entender como isso ajuda',
    tenant,
  })
  const respostaLink = iaTest.montarRespostaModoBarbeiro({
    mensagemNormalizada: 'me manda o link do plano',
    tenant,
  })

  assert.match(respostaGeral, /Don segura o WhatsApp/i)
  assert.match(respostaGeral, /reduzir no-show/i)
  assert.doesNotMatch(respostaGeral, /https?:\/\//i)
  assert.match(respostaLink, /https:\/\/.*\/plano\/barber-pro/i)
})

test('politica de link da agenda so ativa em pedido explicito', () => {
  assert.equal(iaTest.clientePediuLinkAgendaDireto('me manda o link da agenda'), true)
  assert.equal(iaTest.clientePediuLinkAgendaDireto('quero ver sozinho no site'), true)
  assert.equal(iaTest.clientePediuLinkAgendaDireto('tem horario amanha depois das 18?'), false)
})

test('politica de link do plano so ativa em pedido explicito', () => {
  assert.equal(iaTest.clientePediuLinkPlanoDireto('manda o link do plano mensal'), true)
  assert.equal(iaTest.clientePediuLinkPlanoDireto('tem o site da assinatura?'), true)
  assert.equal(iaTest.clientePediuLinkPlanoDireto('tem plano mensal?'), false)
})

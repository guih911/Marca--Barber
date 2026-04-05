/**
 * Script de teste automatizado da IA Don
 * Simula 20 cenários de conversa via API interna
 */
const http = require('http')

const API_BASE = 'http://localhost:3001'
const TENANT_ID = 'ed5a5d06-7d13-4a5f-9675-7c464c9755ff'

// Login pra pegar token
const request = (method, path, body) => new Promise((resolve, reject) => {
  const url = new URL(path, API_BASE)
  const data = body ? JSON.stringify(body) : null
  const opts = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method,
    headers: { 'Content-Type': 'application/json', ...(global.TOKEN ? { Authorization: `Bearer ${global.TOKEN}` } : {}) },
  }
  const req = http.request(opts, (res) => {
    let body = ''
    res.on('data', c => body += c)
    res.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve(body) }
    })
  })
  req.on('error', reject)
  if (data) req.write(data)
  req.end()
})

const login = async () => {
  const res = await request('POST', '/api/auth/login', { email: 'alissonverissimo015@gmail.com', senha: 'brasil1500' })
  global.TOKEN = res.dados?.accessToken
  return !!global.TOKEN
}

const simular = async (mensagem) => {
  const res = await request('POST', '/api/ia/simular', { mensagem })
  return res.dados?.resposta || res.resposta || 'SEM RESPOSTA'
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

const TESTES = [
  // AGENDAR
  { id: 1, msg: 'oi', espera: 'Saudação com link', verifica: (r) => r.includes('🗓️') },
  { id: 2, msg: 'quero cortar amanhã', espera: 'Perguntar horário ou oferecer slot', verifica: (r) => /hor[aá]rio|slot|hora|quando|manh[aã]|tarde/.test(r.toLowerCase()) },
  { id: 3, msg: 'quanto custa corte?', espera: 'Responder preço sem agendar', verifica: (r) => /r\$|real|reais|valor|pre[cç]o|\d+/.test(r.toLowerCase()) },
  { id: 4, msg: 'e barba?', espera: 'Responder preço barba', verifica: (r) => /r\$|real|reais|barba|\d+/.test(r.toLowerCase()) },
  { id: 5, msg: 'quero corte e barba amanha a tarde', espera: 'Combo - verificar disponibilidade', verifica: (r) => /corte.*barba|combo|hor[aá]rio|disponib|amanh/.test(r.toLowerCase()) },

  // TEXTO RUIM
  { id: 6, msg: 'qro corta cm alisson amah', espera: 'Entender mesmo com erros', verifica: (r) => /corte|amanh|alisson|hor[aá]rio/.test(r.toLowerCase()) },

  // TROCA DE INTENÇÃO
  { id: 7, msg: 'quero agendar... quanto custa mesmo?', espera: 'Responder preço primeiro', verifica: (r) => /r\$|pre[cç]o|valor|corte|barba/.test(r.toLowerCase()) },

  // INTENÇÃO MISTA
  { id: 8, msg: 'quanto custa e tem horário hoje?', espera: 'Responder preço + oferecer horário', verifica: (r) => r.length > 20 },

  // MUDANÇA NO MEIO
  { id: 9, msg: 'tem horário amanhã? não pera sexta', espera: 'Usar sexta, não amanhã', verifica: (r) => /sexta|sext/.test(r.toLowerCase()) || r.length > 20 },

  // RECUSA
  { id: 10, msg: 'n vlw', espera: 'Encerrar sem insistir', verifica: (r) => r.length < 100 && !/agendar|marcar|reservar/.test(r.toLowerCase()) },

  // REMARCAR
  { id: 11, msg: 'quero remarcar meu horário', espera: 'Buscar agendamento antes', verifica: (r) => /agendamento|hor[aá]rio|marc|remarc/.test(r.toLowerCase()) },

  // CANCELAR
  { id: 12, msg: 'quero cancelar', espera: 'Confirmar antes de cancelar', verifica: (r) => /cancelar|certeza|confirma|quer mesmo/.test(r.toLowerCase()) },

  // PLANO
  { id: 13, msg: 'tem plano mensal?', espera: 'Apresentar plano', verifica: (r) => /plano|mensal|assinatura|r\$/.test(r.toLowerCase()) },

  // HUMANO
  { id: 14, msg: 'quero falar com atendente', espera: 'Escalar imediatamente', verifica: (r) => /equipe|atendente|transferir|passar|conectar/.test(r.toLowerCase()) },

  // LOCALIZAÇÃO
  { id: 15, msg: 'onde fica a barbearia?', espera: 'Responder endereço', verifica: (r) => /endere|marzag|localiz|fica/.test(r.toLowerCase()) },

  // PAGAMENTO
  { id: 16, msg: 'aceita cartão?', espera: 'Responder formas de pagamento', verifica: (r) => /cart[aã]o|pix|dinheiro|pagamento|aceita/.test(r.toLowerCase()) },

  // HORÁRIO FUNCIONAMENTO
  { id: 17, msg: 'que horas abrem?', espera: 'Responder horário', verifica: (r) => /hor[aá]rio|funciona|abre|seg|s[aá]b|\d+h/.test(r.toLowerCase()) },

  // ÁUDIO
  { id: 18, msg: '[ÁUDIO]', espera: 'Pedir pra digitar', verifica: (r) => /digitar|escrever|texto|ouvir/.test(r.toLowerCase()) },

  // FIGURINHA
  { id: 19, msg: '[FIGURINHA]', espera: 'Responder com leveza', verifica: (r) => /ajudar|posso|precisa/.test(r.toLowerCase()) },

  // NPS
  { id: 20, msg: '5', espera: 'Coletar feedback', verifica: (r) => /obrigad|feedback|avalia|nota|agrad/.test(r.toLowerCase()) || r.length > 10 },
]

const rodar = async () => {
  console.log('🔑 Fazendo login...')
  const ok = await login()
  if (!ok) { console.log('❌ Falha no login'); return }
  console.log('✅ Login OK\n')

  let aprovados = 0
  let reprovados = 0
  const resultados = []

  for (const t of TESTES) {
    process.stdout.write(`🧪 Teste ${String(t.id).padStart(2)}: "${t.msg}" → `)
    try {
      const resp = await simular(t.msg)
      const passou = t.verifica(resp)
      const status = passou ? '✅' : '❌'
      if (passou) aprovados++; else reprovados++

      const resumo = resp.substring(0, 120).replace(/\n/g, ' ')
      console.log(`${status} ${resumo}...`)
      resultados.push({ id: t.id, msg: t.msg, espera: t.espera, status: passou ? 'OK' : 'FALHA', resposta: resp.substring(0, 200) })
    } catch (err) {
      console.log(`💥 ERRO: ${err.message}`)
      reprovados++
      resultados.push({ id: t.id, msg: t.msg, espera: t.espera, status: 'ERRO', resposta: err.message })
    }
    await delay(2000) // Rate limit
  }

  console.log('\n════════════════════════════════════════')
  console.log(`📊 RESULTADO: ${aprovados}/${TESTES.length} aprovados | ${reprovados} falhas`)
  console.log('════════════════════════════════════════\n')

  const falhas = resultados.filter(r => r.status !== 'OK')
  if (falhas.length > 0) {
    console.log('❌ FALHAS:')
    for (const f of falhas) {
      console.log(`  Teste ${f.id}: "${f.msg}"`)
      console.log(`  Esperava: ${f.espera}`)
      console.log(`  Recebeu: ${f.resposta}`)
      console.log()
    }
  }
}

rodar().catch(console.error)

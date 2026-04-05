/**
 * Teste Completo de Interação com IA — Marcaí Barber
 * Simula 30 cenários reais de cliente via API interna
 *
 * Uso: docker exec marca-barber-marcai-api-1 node /app/teste-completo.js
 */

const http = require('http')

const API = 'http://localhost:3001'
let TOKEN = null

const req = (method, path, body) => new Promise((resolve, reject) => {
  const url = new URL(path, API)
  const opts = {
    hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
  }
  const r = http.request(opts, (res) => {
    let b = ''; res.on('data', c => b += c)
    res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve(b) } })
  })
  r.on('error', reject)
  if (body) r.write(JSON.stringify(body))
  r.end()
})

const login = async () => {
  const res = await req('POST', '/api/auth/login', { email: 'alissonverissimo015@gmail.com', senha: 'brasil1500' })
  TOKEN = res.dados?.accessToken
  return !!TOKEN
}

const simular = async (msg) => {
  const res = await req('POST', '/api/ia/simular', { mensagem: msg })
  return res.dados?.resposta || res.resposta || ''
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// ═══ CATEGORIAS DE TESTE ═══

const TESTES = [
  // ── AGENDAR (básico) ──
  { id: 1, cat: 'AGENDAR', msg: 'oi', ok: r => r.length > 20, espera: 'Saudação' },
  { id: 2, cat: 'AGENDAR', msg: 'quero cortar amanhã', ok: r => /hor[aá]rio|slot|hora|quando|amanh/i.test(r), espera: 'Pergunta horário ou serviço' },
  { id: 3, cat: 'AGENDAR', msg: 'tem horário hoje?', ok: r => /hor[aá]rio|corte|barba|servi/i.test(r), espera: 'Pergunta serviço' },
  { id: 4, cat: 'AGENDAR', msg: 'quero corte e barba amanha a tarde', ok: r => /combo|corte.*barba|hor[aá]rio|amanh/i.test(r), espera: 'Entende combo' },
  { id: 5, cat: 'AGENDAR', msg: 'agenda pra mim sexta', ok: r => /sexta|corte|barba|servi/i.test(r), espera: 'Entende dia da semana' },

  // ── PREÇO ──
  { id: 6, cat: 'PREÇO', msg: 'quanto custa corte?', ok: r => /r\$|real|\d+/i.test(r), espera: 'Preço real do banco' },
  { id: 7, cat: 'PREÇO', msg: 'e barba?', ok: r => /r\$|barba|\d+/i.test(r), espera: 'Preço barba' },
  { id: 8, cat: 'PREÇO', msg: 'quanto fica tudo?', ok: r => /r\$|corte|barba|\d+/i.test(r), espera: 'Preço combo' },
  { id: 9, cat: 'PREÇO', msg: 'tem promoção?', ok: r => r.length > 10, espera: 'Responde sem inventar' },

  // ── REMARCAR ──
  { id: 10, cat: 'REMARCAR', msg: 'quero remarcar meu horário', ok: r => /agendamento|hor[aá]rio|remarc/i.test(r), espera: 'Busca agendamento' },
  { id: 11, cat: 'REMARCAR', msg: 'muda meu horário', ok: r => /agendamento|hor[aá]rio|remarc|muda/i.test(r), espera: 'Entende sinônimo' },

  // ── CANCELAR ──
  { id: 12, cat: 'CANCELAR', msg: 'quero cancelar', ok: r => /agendamento|cancel|hor[aá]rio/i.test(r), espera: 'Busca agendamento' },
  { id: 13, cat: 'CANCELAR', msg: 'pode desmarcar', ok: r => /agendamento|cancel|desmarc/i.test(r), espera: 'Entende sinônimo' },
  { id: 14, cat: 'CANCELAR', msg: 'não vou mais', ok: r => /agendamento|cancel/i.test(r), espera: 'Entende intenção' },

  // ── TEXTO RUIM ──
  { id: 15, cat: 'TEXTO RUIM', msg: 'qro corta cm alisson amah', ok: r => /corte|amanh|alisson|hor[aá]rio/i.test(r), espera: 'Entende com erros' },
  { id: 16, cat: 'TEXTO RUIM', msg: 'qnt custa cort', ok: r => /r\$|corte|pre[cç]o|\d+/i.test(r), espera: 'Entende preço com typo' },

  // ── INTENÇÃO MISTA ──
  { id: 17, cat: 'MISTA', msg: 'quanto custa e tem horário hoje?', ok: r => r.length > 20, espera: 'Responde ambos' },
  { id: 18, cat: 'MISTA', msg: 'quero agendar... quanto custa mesmo?', ok: r => /r\$|pre[cç]o|corte|barba/i.test(r), espera: 'Preço primeiro' },

  // ── PLANO ──
  { id: 19, cat: 'PLANO', msg: 'tem plano mensal?', ok: r => /plano|mensal|assinatura|r\$/i.test(r), espera: 'Apresenta plano' },

  // ── HUMANO ──
  { id: 20, cat: 'HUMANO', msg: 'quero falar com atendente', ok: r => /equipe|atendente|transferir|conectar|passar/i.test(r), espera: 'Escala imediato' },

  // ── FAQ ──
  { id: 21, cat: 'FAQ', msg: 'onde fica a barbearia?', ok: r => /endere|marzag|localiz|fica/i.test(r), espera: 'Endereço' },
  { id: 22, cat: 'FAQ', msg: 'aceita cartão?', ok: r => /cart[aã]o|pix|dinheiro|pagamento|aceita/i.test(r), espera: 'Formas pagamento' },
  { id: 23, cat: 'FAQ', msg: 'que horas abrem?', ok: r => /hor[aá]rio|funciona|abre|seg|s[aá]b|\d+h/i.test(r), espera: 'Horário funcionamento' },
  { id: 24, cat: 'FAQ', msg: 'tem sinuca?', ok: r => /sinuca|sim|temos/i.test(r), espera: 'Confirma diferencial' },

  // ── MÍDIA ──
  { id: 25, cat: 'MÍDIA', msg: '[ÁUDIO]', ok: r => /digitar|escrever|texto|ouvir/i.test(r), espera: 'Pede texto' },
  { id: 26, cat: 'MÍDIA', msg: '[FIGURINHA]', ok: r => /ajudar|posso|alguma/i.test(r), espera: 'Responde leve' },

  // ── RECUSA / DESPEDIDA ──
  { id: 27, cat: 'RECUSA', msg: 'n vlw', ok: r => r.length < 100 && !/agendar|marcar/i.test(r), espera: 'Encerra sem insistir' },
  { id: 28, cat: 'DESPEDIDA', msg: 'tchau', ok: r => r.length < 80, espera: 'Despedida curta' },

  // ── RECLAMAÇÃO ──
  { id: 29, cat: 'RECLAMAÇÃO', msg: 'ficou horrível meu corte', ok: r => /equipe|conectar|pena/i.test(r), espera: 'Escala pra humano' },

  // ── NPS ──
  { id: 30, cat: 'NPS', msg: '5', ok: r => /obrigad|feedback|avalia|nota|agrad/i.test(r) || r.length > 10, espera: 'Coleta feedback' },
]

// ═══ EXECUÇÃO ═══

const rodar = async () => {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║  TESTE COMPLETO DE IA — MARCAÍ BARBER       ║')
  console.log('║  30 cenários reais de interação              ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  console.log('🔑 Login...')
  if (!await login()) { console.log('❌ Falha no login'); return }
  console.log('✅ Logado\n')

  const resultados = { ok: 0, falha: 0, erro: 0, porCategoria: {} }
  const falhas = []

  for (const t of TESTES) {
    process.stdout.write(`  ${String(t.id).padStart(2)}. [${t.cat.padEnd(11)}] "${t.msg.substring(0, 40).padEnd(40)}" → `)

    try {
      const resp = await simular(t.msg)
      const passou = t.ok(resp)

      if (passou) {
        console.log('✅')
        resultados.ok++
      } else {
        console.log(`❌ "${resp.substring(0, 60)}..."`)
        resultados.falha++
        falhas.push({ ...t, resp: resp.substring(0, 150) })
      }

      // Contagem por categoria
      if (!resultados.porCategoria[t.cat]) resultados.porCategoria[t.cat] = { ok: 0, falha: 0 }
      resultados.porCategoria[t.cat][passou ? 'ok' : 'falha']++
    } catch (err) {
      console.log(`💥 ERRO: ${err.message}`)
      resultados.erro++
    }

    await delay(1500)
  }

  // ═══ RELATÓRIO ═══
  const total = resultados.ok + resultados.falha + resultados.erro
  const taxa = Math.round((resultados.ok / total) * 100)

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║  RESULTADO: ${resultados.ok}/${total} aprovados (${taxa}%)${' '.repeat(20 - String(taxa).length)}║`)
  console.log('╠══════════════════════════════════════════════╣')

  // Por categoria
  for (const [cat, nums] of Object.entries(resultados.porCategoria).sort()) {
    const catTaxa = Math.round((nums.ok / (nums.ok + nums.falha)) * 100)
    const bar = '█'.repeat(Math.round(catTaxa / 10)) + '░'.repeat(10 - Math.round(catTaxa / 10))
    console.log(`║  ${cat.padEnd(12)} ${bar} ${String(catTaxa).padStart(3)}% (${nums.ok}/${nums.ok + nums.falha})${' '.repeat(8 - String(nums.ok + nums.falha).length)}║`)
  }

  console.log('╚══════════════════════════════════════════════╝')

  if (falhas.length > 0) {
    console.log('\n❌ DETALHES DAS FALHAS:\n')
    for (const f of falhas) {
      console.log(`  Teste ${f.id} [${f.cat}]: "${f.msg}"`)
      console.log(`  Esperava: ${f.espera}`)
      console.log(`  Recebeu:  ${f.resp}`)
      console.log()
    }
  }

  // Nota final
  console.log('\n' + (taxa >= 90 ? '🟢 SISTEMA PRONTO PRA PRODUÇÃO' : taxa >= 70 ? '🟡 PRECISA DE AJUSTES' : '🔴 PRECISA DE CORREÇÕES URGENTES'))
  console.log()
}

rodar().catch(console.error)

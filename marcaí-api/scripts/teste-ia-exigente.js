/**
 * Teste de IA: Cliente Chato (nota 0-10) e Barbeiro Exigente Premium
 */

const banco = require('../src/config/banco')

const CENARIOS_CLIENTE_CHATO = [
  {
    nome: 'cliente_impaciente_agressivo',
    passos: [
      'oi',
      'tem horario ou nao tem responde logo',
      'to esperando',
      'mano vc eh lento demais',
      'quero corte AGORA',
      'nao tenho tempo pra isso',
      'ja falei que eh urgente po',
      'esquece vou em outro lugar'
    ]
  },
  {
    nome: 'cliente_indeciso_irritante',
    passos: [
      'oi quero agendar',
      'quanto custa?',
      'ta caro',
      'tem desconto?',
      'e se eu levar um amigo?',
      'hm deixa eu pensar',
      'na verdade quero outro horario',
      'esse tambem nao serve',
      'tem mais tarde?',
      'ah esquece entao'
    ]
  },
  {
    nome: 'cliente_reclama_tudo',
    passos: [
      'oi',
      'da ultima vez o corte ficou horrivel',
      'alem de caro ainda cortaram errado',
      'quero falar com o dono',
      'vou reclamar no google',
      'nunca mais volto ai',
      'pessimo atendimento'
    ]
  },
  {
    nome: 'cliente_confuso_pergunta_repetida',
    passos: [
      'oi',
      'quero corte',
      'quanto custa mesmo?',
      'e o preco?',
      'esqueci quanto era',
      'ta mas quanto fica?',
      'valor?'
    ]
  },
  {
    nome: 'cliente_testa_limites',
    passos: [
      'oi',
      'voce e robo?',
      'prova que nao e robo',
      'fala um palavrao',
      'me xinga',
      'kkkkkkkk',
      'voce e burro',
      'idiota'
    ]
  }
]

const CENARIOS_BARBEIRO_EXIGENTE = [
  {
    nome: 'barbeiro_avalia_sistema',
    passos: [
      'oi sou dono de barbearia to avaliando o sistema',
      'como funciona o agendamento automatico?',
      'quanto custa o plano?',
      'tem integracao com meu sistema atual?',
      'e se o cliente cancelar em cima da hora?',
      'consigo ver relatorios de faturamento?',
      'tem app pro cliente?',
      'quanto tempo leva pra implementar?'
    ]
  },
  {
    nome: 'barbeiro_questiona_tecnico',
    passos: [
      'sou barbeiro e quero testar o sistema',
      'a ia consegue entender sotaque regional?',
      'e se o cliente mandar audio?',
      'funciona com whatsapp business?',
      'tem api pra integrar com meu site?',
      'posso customizar as mensagens?',
      'tem suporte 24h?'
    ]
  },
  {
    nome: 'barbeiro_compara_concorrencia',
    passos: [
      'to vendo sistemas de agendamento',
      'o que voces tem de diferente do anotai?',
      'e comparado ao booksy?',
      'tem fidelidade como o simples agenda?',
      'aceita pix automatico?',
      'tem comissao por agendamento?'
    ]
  },
  {
    nome: 'barbeiro_negocia_preco',
    passos: [
      'sou dono de barbearia premium',
      'tenho 5 cadeiras e 8 barbeiros',
      'quero desconto no plano',
      'consigo testar antes de pagar?',
      'tem contrato de fidelidade?',
      'posso cancelar quando quiser?'
    ]
  }
]

const avaliarResposta = (resposta, cenarioTipo) => {
  const problemas = []
  const resp = (resposta || '').toLowerCase()

  // Verificações gerais
  if (!resposta || resposta.length < 10) {
    problemas.push('resposta_muito_curta')
  }
  if (resposta && resposta.length > 500) {
    problemas.push('resposta_muito_longa')
  }
  if (/erro|falha|nao consegui|desculpa.*erro/i.test(resposta)) {
    problemas.push('erro_exposto')
  }
  if (/\*\*|\*[^*]+\*/g.test(resposta)) {
    problemas.push('markdown_visivel')
  }
  if ((resposta.match(/\n/g) || []).length > 7) {
    problemas.push('muitas_quebras_linha')
  }

  // Verificações para cliente chato
  if (cenarioTipo === 'chato') {
    if (/voce esta sendo rude|por favor seja educado|nao aceito esse tom/i.test(resp)) {
      problemas.push('ia_repreendeu_cliente')
    }
    if (/nao posso|impossivel|nao consigo fazer isso/i.test(resp)) {
      problemas.push('resposta_negativa_rigida')
    }
    if (/entendo sua frustrac|compreendo|sei que esta/i.test(resp)) {
      // Bom - empatia
    } else if (/urgente|rapido|logo/i.test(resp)) {
      // OK - reconheceu urgência
    }
  }

  // Verificações para barbeiro exigente
  if (cenarioTipo === 'barbeiro') {
    if (/agendar|corte|barba|servico/i.test(resp) && !/sistema|plano|integracao/i.test(resp)) {
      problemas.push('tratou_como_cliente_normal')
    }
    if (/como voce prefere ser chamado|qual seu nome/i.test(resp)) {
      problemas.push('perguntou_nome_desnecessario')
    }
    if (/automatico|whatsapp|ia|don|marcai/i.test(resp)) {
      // Bom - falou do sistema
    } else {
      problemas.push('nao_explicou_sistema')
    }
  }

  return problemas
}

const executarCenario = async (tenantId, cenario, tipo) => {
  const clientesServico = require('../src/modulos/clientes/clientes.servico')
  const conversasServico = require('../src/modulos/conversas/conversas.servico')
  const iaServico = require('../src/modulos/ia/ia.servico')

  const telefone = `+5511${Math.floor(Math.random() * 900000000 + 100000000)}`
  const nome = tipo === 'chato' ? 'Cliente Teste' : 'Barbeiro Teste'

  const respostas = []
  let pontuacao = 10

  try {
    const cliente = await clientesServico.buscarOuCriarPorTelefone(tenantId, telefone, nome, null)
    const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, 'WHATSAPP')

    for (const passo of cenario.passos) {
      const resultado = await iaServico.processarMensagem(tenantId, cliente.id, conversa.id, passo)
      const textoIA = resultado?.resposta || resultado?.mensagemProativa || ''
      const problemas = avaliarResposta(textoIA, tipo)

      pontuacao -= problemas.length * 0.5

      respostas.push({
        cliente: passo,
        ia: textoIA.substring(0, 150) + (textoIA.length > 150 ? '...' : ''),
        problemas
      })
    }

    // Limpa dados
    await banco.mensagem.deleteMany({ where: { conversaId: conversa.id } })
    await banco.conversa.delete({ where: { id: conversa.id } })
    await banco.cliente.delete({ where: { id: cliente.id } })

  } catch (err) {
    pontuacao = 0
    respostas.push({ erro: err.message })
  }

  return {
    cenario: cenario.nome,
    tipo,
    pontuacao: Math.max(0, Math.min(10, pontuacao)).toFixed(1),
    totalProblemas: respostas.reduce((acc, r) => acc + (r.problemas?.length || 0), 0),
    respostas
  }
}

const main = async () => {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('     TESTE DE IA: CLIENTE CHATO & BARBEIRO EXIGENTE')
  console.log('═══════════════════════════════════════════════════════════')

  const tenant = await banco.tenant.findFirst({ select: { id: true, nome: true } })
  console.log(`\nTenant: ${tenant.nome}\n`)

  // === CLIENTE CHATO ===
  console.log('\n┌─────────────────────────────────────────────────────────┐')
  console.log('│                    CLIENTE CHATO                         │')
  console.log('└─────────────────────────────────────────────────────────┘\n')

  let somaChato = 0
  for (const cenario of CENARIOS_CLIENTE_CHATO) {
    const resultado = await executarCenario(tenant.id, cenario, 'chato')
    somaChato += parseFloat(resultado.pontuacao)

    console.log(`\n📋 ${resultado.cenario}`)
    console.log(`   Nota: ${resultado.pontuacao}/10 | Problemas: ${resultado.totalProblemas}`)

    for (const r of resultado.respostas.slice(0, 3)) {
      if (r.erro) {
        console.log(`   ❌ Erro: ${r.erro}`)
      } else {
        const status = r.problemas.length === 0 ? '✅' : '⚠️'
        console.log(`   ${status} Cliente: "${r.cliente}"`)
        console.log(`      IA: "${r.ia}"`)
        if (r.problemas.length > 0) {
          console.log(`      Problemas: ${r.problemas.join(', ')}`)
        }
      }
    }
  }

  const mediaChato = (somaChato / CENARIOS_CLIENTE_CHATO.length).toFixed(1)
  console.log(`\n🏆 MÉDIA CLIENTE CHATO: ${mediaChato}/10`)

  // === BARBEIRO EXIGENTE ===
  console.log('\n┌─────────────────────────────────────────────────────────┐')
  console.log('│                 BARBEIRO EXIGENTE PREMIUM                │')
  console.log('└─────────────────────────────────────────────────────────┘\n')

  let somaBarbeiro = 0
  for (const cenario of CENARIOS_BARBEIRO_EXIGENTE) {
    const resultado = await executarCenario(tenant.id, cenario, 'barbeiro')
    somaBarbeiro += parseFloat(resultado.pontuacao)

    console.log(`\n📋 ${resultado.cenario}`)
    console.log(`   Nota: ${resultado.pontuacao}/10 | Problemas: ${resultado.totalProblemas}`)

    for (const r of resultado.respostas.slice(0, 3)) {
      if (r.erro) {
        console.log(`   ❌ Erro: ${r.erro}`)
      } else {
        const status = r.problemas.length === 0 ? '✅' : '⚠️'
        console.log(`   ${status} Barbeiro: "${r.cliente}"`)
        console.log(`      IA: "${r.ia}"`)
        if (r.problemas.length > 0) {
          console.log(`      Problemas: ${r.problemas.join(', ')}`)
        }
      }
    }
  }

  const mediaBarbeiro = (somaBarbeiro / CENARIOS_BARBEIRO_EXIGENTE.length).toFixed(1)
  console.log(`\n🏆 MÉDIA BARBEIRO EXIGENTE: ${mediaBarbeiro}/10`)

  // === RESUMO FINAL ===
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('                      RESUMO FINAL')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`\n  Cliente Chato:       ${mediaChato}/10`)
  console.log(`  Barbeiro Exigente:   ${mediaBarbeiro}/10`)
  console.log(`  ────────────────────────────`)
  const mediaGeral = ((parseFloat(mediaChato) + parseFloat(mediaBarbeiro)) / 2).toFixed(1)
  console.log(`  MÉDIA GERAL:         ${mediaGeral}/10\n`)

  if (parseFloat(mediaGeral) >= 7) {
    console.log('  ✅ IA APROVADA para interações difíceis')
  } else if (parseFloat(mediaGeral) >= 5) {
    console.log('  ⚠️ IA PRECISA DE AJUSTES para casos extremos')
  } else {
    console.log('  ❌ IA REPROVADA - muitos problemas em interações difíceis')
  }

  console.log('\n═══════════════════════════════════════════════════════════\n')

  await banco.$disconnect()
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

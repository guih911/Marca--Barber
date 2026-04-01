/**
 * Serviço de lembretes automáticos de agendamento via WhatsApp.
 *
 * Fluxo:
 *   1. A cada 15 minutos, busca agendamentos AGENDADO/CONFIRMADO dentro da janela
 *      configurada por tenant (lembreteMinutosAntes) sem lembrete enviado
 *   2. Smart skip: ignora agendamento criado DEPOIS que a janela de lembrete começou
 *      (ex: cliente agendou faltando 5min com lembrete configurado para 1h → não faz sentido enviar)
 *   3. Gera mensagem PERSONALIZADA via IA com base no histórico do cliente
 *   4. Envia mensagem WhatsApp ao cliente pedindo confirmação
 *   5. Marca lembreteEnviadoEm no agendamento
 */

const OpenAI = require('openai')
const configIA = require('../../config/ia')
const banco = require('../../config/banco')
const whatsappServico = require('./whatsapp.servico')

// Normaliza telefone para formato E.164 Brasil (ex: 11999999999 → 5511999999999)
// Retorna null para telefones inválidos ou LIDs do WhatsApp (que não podem receber mensagens diretamente).
const normalizarTelefone = (telefone) => {
  if (!telefone) return null
  const digitos = String(telefone).replace(/\D/g, '')
  if (!digitos) return null
  // Detecta LID do WhatsApp: não começa com 55 e tem mais de 13 dígitos (telefones BR têm 12-13 com código)
  if (!digitos.startsWith('55') && digitos.length > 13) return null
  const normalizado = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  // Valida tamanho final: telefone BR com código = 12 ou 13 dígitos (55 + 10 ou 11)
  if (normalizado.length < 12 || normalizado.length > 13) return null
  return normalizado
}

const openai = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })

// Formata data em pt-BR com timezone
const formatarData = (data, tz) =>
  new Date(data).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: tz || 'America/Sao_Paulo',
  })

// Usa "hoje" ou "amanhã" quando possível
const formatarDataInteligente = (data, tz) => {
  const tz_ = tz || 'America/Sao_Paulo'
  const agora = new Date()
  const opcoes = { timeZone: tz_, year: 'numeric', month: '2-digit', day: '2-digit' }
  const diaAlvo = new Date(data).toLocaleDateString('pt-BR', opcoes)
  const diaHoje = agora.toLocaleDateString('pt-BR', opcoes)
  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  const diaAmanha = amanha.toLocaleDateString('pt-BR', opcoes)
  const hora = new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz_ })
  if (diaAlvo === diaHoje) return `hoje às ${hora}`
  if (diaAlvo === diaAmanha) return `amanhã às ${hora}`
  return formatarData(data, tz)
}

/**
 * Monta mensagem de lembrete com template fixo.
 * @param {boolean} maisde24h - true → lembrete antecipado (1 dia antes); false → lembrete no dia
 */
const gerarMensagemLembrete = async (tenant, ag, _historicoMensagens, maisde24h = false) => {
  const tz = tenant.timezone || 'America/Sao_Paulo'
  const dt = new Date(ag.inicioEm)
  const dataFmt = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const primeiroNome = ag.cliente.nome?.split(' ')[0] || null
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! 👋` : `Olá! 👋`

  if (maisde24h) {
    // Lembrete 1 dia antes
    return (
      `${saudacao}\n\n` +
      `Aqui é o Don, assistente virtual da ${tenant.nome} 💈\n\n` +
      `Passando para lembrar do seu horário agendado:\n\n` +
      `📅 ${dataFmt}\n` +
      `🕒 ${horaFmt}\n` +
      `💇 ${ag.servico.nome}\n\n` +
      `Caso precise reagendar, é só me avisar por aqui 👍\n\n` +
      `Te esperamos!`
    )
  }

  // Lembrete no dia (horas antes)
  return (
    `${saudacao}\n\n` +
    `Seu atendimento na ${tenant.nome} 💈 está confirmado para hoje:\n\n` +
    `🕒 ${horaFmt}\n` +
    `💇 ${ag.servico.nome}\n\n` +
    `Estamos te aguardando!\n\n` +
    `Qualquer imprevisto, me avise por aqui.`
  )
}

/**
 * Gera mensagem de vencimento de plano mensal personalizada pela IA.
 */
const gerarMensagemVencimentoPlano = async (tenant, cliente, nomePlano, valorFmt) => {
  const primeiroNome = cliente.nome?.split(' ')[0] || 'cliente'
  const tomDescricao = {
    FORMAL: 'elegante e refinada',
    DESCONTRALIDO: 'calorosa e simpática',
    ACOLHEDOR: 'acolhedora e empática',
  }
  const tom = tomDescricao[tenant.tomDeVoz] || 'calorosa e simpática'

  const prompt = `Você é Don, recepcionista virtual da barbearia ${tenant.nome}. Tom: ${tom}.

DADOS:
• Cliente: ${primeiroNome}
• Plano: ${nomePlano}
• Valor da renovação: ${valorFmt}
• Vencimento: amanhã

TAREFA: Escreva UMA mensagem lembrando que o plano vence amanhã e que a cobrança é presencialmente no próximo atendimento.
Regras:
1. Use o primeiro nome do cliente de forma natural
2. Mencione o nome do plano e o valor
3. Deixe claro que o pagamento é feito pessoalmente na barbearia
4. Máximo 3 linhas. NUNCA use * ou **. Máximo 1 emoji.
5. Assine como: "— ${tenant.nome}"`

  try {
    const resposta = await openai.chat.completions.create({
      model: configIA.modelo,
      max_tokens: 150,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Gere a mensagem agora.' },
      ],
    })
    return resposta.choices[0].message.content?.trim() || null
  } catch (err) {
    console.error('[Lembretes] Erro ao gerar mensagem de vencimento de plano:', err.message)
    return null
  }
}

/**
 * Monta mensagem de confirmação de presença (1h antes) com template fixo.
 */
const gerarMensagemConfirmacao1h = async (tenant, ag, _historicoMensagens) => {
  const tz = tenant.timezone || 'America/Sao_Paulo'
  const horaFmt = new Date(ag.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const primeiroNome = ag.cliente.nome?.split(' ')[0] || null
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}! 👋` : `Olá! 👋`

  return (
    `${saudacao}\n\n` +
    `Seu atendimento na ${tenant.nome} 💈 está confirmado para hoje:\n\n` +
    `🕒 ${horaFmt}\n` +
    `💇 ${ag.servico.nome}\n\n` +
    `Estamos te aguardando!\n\n` +
    `Qualquer imprevisto, me avise por aqui.`
  )
}

// ─── Helper: busca/cria conversa e envia mensagem com log ────────────────────
const enviarMensagemComLog = async (tenant, ag, mensagem, campoMarca, labelLog) => {
  const telefoneNorm = normalizarTelefone(ag.cliente?.telefone)
  if (!telefoneNorm) {
    console.warn(`[${labelLog}] Telefone inválido para cliente ${ag.clienteId} — pulando envio.`)
    return false
  }

  let conversa = await banco.conversa.findFirst({
    where: { tenantId: tenant.id, clienteId: ag.clienteId },
    orderBy: { atualizadoEm: 'desc' },
  })

  if (!conversa) {
    conversa = await banco.conversa.create({
      data: { tenantId: tenant.id, clienteId: ag.clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
    })
  }

  const resultadoEnvio = await whatsappServico.enviarMensagem(
    tenant.configWhatsApp,
    telefoneNorm,
    mensagem,
    tenant.id
  )

  // Verifica falha: null (WhatsApp desconectado) OU falsy (undefined/false de Baileys sem retorno explícito)
  if (!resultadoEnvio) {
    console.warn(`[${labelLog}] Envio falhou para ${telefoneNorm} — WhatsApp possivelmente desconectado. NÃO marcado como enviado.`)
    return false
  }

  await banco.agendamento.update({ where: { id: ag.id }, data: { [campoMarca]: new Date() } })

  const tz = tenant.timezone || 'America/Sao_Paulo'
  const dataFmt = formatarDataInteligente(ag.inicioEm, tz)
  await banco.mensagem.createMany({
    data: [
      { conversaId: conversa.id, remetente: 'ia', conteudo: mensagem },
      {
        conversaId: conversa.id,
        remetente: 'sistema',
        conteudo: `📅 ${labelLog} enviado para ${ag.cliente.nome?.split(' ')[0] || ag.cliente.nome}: ${ag.servico.nome} com ${ag.profissional.nome?.split(' ')[0] || ag.profissional.nome} em ${dataFmt}`,
      },
    ],
  })
  await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })

  console.log(`[${labelLog}] Enviado para ${ag.cliente.telefone} — ${ag.servico.nome} em ${dataFmt}`)
  return true
}

/**
 * Executa uma rodada de envio de lembretes.
 * Usa lembreteMinutosAntes por tenant para definir a janela de busca.
 * Smart skip: pula agendamentos criados depois que a janela de lembrete já começou.
 *
 * Também executa o ciclo de confirmação 1h antes (para agendamentos criados
 * com mais de 2h de antecedência, independente de origem).
 */
const enviarLembretes = async () => {
  try {
    const agora = new Date()

    // Busca todos os tenants ativos com WhatsApp configurado
    const tenants = await banco.tenant.findMany({
      where: { ativo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true, tomDeVoz: true, lembreteMinutosAntes: true, membershipsAtivo: true },
    })

    for (const tenant of tenants) {
      try {
        // ── Ciclo 1: lembrete configurável por tenant ──────────────────────────
        const minutosAntes = tenant.lembreteMinutosAntes ?? 60

        if (minutosAntes !== 0) {
          const fimJanela = new Date(agora.getTime() + minutosAntes * 60 * 1000)

          const agendamentos = await banco.agendamento.findMany({
            where: {
              tenantId: tenant.id,
              status: { in: ['AGENDADO', 'CONFIRMADO'] },
              inicioEm: { gte: agora, lte: fimJanela },
              lembreteEnviadoEm: null,
            },
            include: { cliente: true, servico: true, profissional: true },
          })

          for (const ag of agendamentos) {
            const telefoneNorm = normalizarTelefone(ag.cliente?.telefone)
            if (!telefoneNorm) continue

            // Smart skip: agendamento criado depois que a janela já teria começado
            const inicioJanelaMs = ag.inicioEm.getTime() - minutosAntes * 60 * 1000
            if (ag.criadoEm.getTime() > inicioJanelaMs) {
              console.log(`[Lembretes] Smart skip: agendamento ${ag.id} criado dentro da janela — pulando.`)
              continue
            }

            const tz = tenant.timezone || 'America/Sao_Paulo'
            const dataFmt = formatarDataInteligente(ag.inicioEm, tz)
            const maisde24h = (ag.inicioEm.getTime() - agora.getTime()) > 24 * 60 * 60 * 1000

            try {
              let conversa = await banco.conversa.findFirst({
                where: { tenantId: tenant.id, clienteId: ag.clienteId },
                orderBy: { atualizadoEm: 'desc' },
              })
              if (!conversa) {
                conversa = await banco.conversa.create({
                  data: { tenantId: tenant.id, clienteId: ag.clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
                })
              }

              const historicoMensagens = await banco.mensagem.findMany({
                where: { conversaId: conversa.id },
                orderBy: { criadoEm: 'asc' },
              })

              // Toda mensagem gerada pela IA — sem fallback de texto fixo.
              // Se a IA falhar, o agendamento NÃO é marcado como enviado e será reprocessado.
              const mensagem = await gerarMensagemLembrete(tenant, ag, historicoMensagens, maisde24h)
              if (!mensagem) {
                console.warn(`[Lembretes] IA não gerou mensagem para agendamento ${ag.id} — será reprocessado.`)
                continue
              }

              const resultadoEnvio = await whatsappServico.enviarMensagem(
                tenant.configWhatsApp,
                telefoneNorm,
                mensagem,
                tenant.id
              )

              // Check robusto: null OU undefined/false de Baileys sem retorno explícito
              if (!resultadoEnvio) {
                console.warn(`[Lembretes] Envio falhou para ${telefoneNorm} — WhatsApp possivelmente desconectado. NÃO marcado como enviado.`)
                continue
              }

              await banco.agendamento.update({ where: { id: ag.id }, data: { lembreteEnviadoEm: new Date() } })

              await banco.mensagem.createMany({
                data: [
                  { conversaId: conversa.id, remetente: 'ia', conteudo: mensagem },
                  {
                    conversaId: conversa.id,
                    remetente: 'sistema',
                    conteudo: `📅 Lembrete enviado para ${ag.cliente.nome?.split(' ')[0] || ag.cliente.nome}: ${ag.servico.nome} com ${ag.profissional.nome?.split(' ')[0] || ag.profissional.nome} em ${dataFmt}`,
                  },
                ],
              })
              await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })

              console.log(`[Lembretes] Enviado para ${telefoneNorm} — ${ag.servico.nome} em ${dataFmt} (${minutosAntes}min antes)`)
            } catch (errEnvio) {
              console.error(`[Lembretes] Erro ao enviar para ${telefoneNorm}:`, errEnvio.message)
            }
          }
        }

        // ── Ciclo 2: confirmação 1h antes para agendamentos criados com 2h+ de antecedência ──
        // Regra: se o agendamento foi criado com mais de 2h de antecedência
        // (independente de origem), envia uma confirmação 1h antes do horário.
        // Usa lembrete2hEnviadoEm para controle de envio único.
        const JANELA_CONFIRMACAO_MS = 60 * 60 * 1000        // 1h antes do horário
        const ANTECEDENCIA_MINIMA_MS = 2 * 60 * 60 * 1000   // criado com 2h+ de antecedência

        const fimJanela1h = new Date(agora.getTime() + JANELA_CONFIRMACAO_MS)

        const agendamentosConfirmacao = await banco.agendamento.findMany({
          where: {
            tenantId: tenant.id,
            status: { in: ['AGENDADO', 'CONFIRMADO'] },
            inicioEm: { gte: agora, lte: fimJanela1h },
            lembrete2hEnviadoEm: null,
          },
          include: { cliente: true, servico: true, profissional: true },
        })

        for (const ag of agendamentosConfirmacao) {
          const telefoneNorm = normalizarTelefone(ag.cliente?.telefone)
          if (!telefoneNorm) continue

          // Só envia se foi criado com mais de 2h de antecedência
          const antecedenciaMs = ag.inicioEm.getTime() - ag.criadoEm.getTime()
          if (antecedenciaMs <= ANTECEDENCIA_MINIMA_MS) {
            console.log(`[Confirmacao1h] Agendamento ${ag.id} criado com menos de 2h de antecedência — pulando.`)
            continue
          }

          // Não envia se o lembrete configurável já vai cobrir o mesmo período (evita mensagem dupla)
          if ((tenant.lembreteMinutosAntes ?? 60) >= 60) {
            console.log(`[Confirmacao1h] Lembrete configurado já cobre 1h antes para ${ag.id} — pulando para evitar duplicata.`)
            continue
          }

          try {
            let conversa = await banco.conversa.findFirst({
              where: { tenantId: tenant.id, clienteId: ag.clienteId },
              orderBy: { atualizadoEm: 'desc' },
            })
            if (!conversa) {
              conversa = await banco.conversa.create({
                data: { tenantId: tenant.id, clienteId: ag.clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
              })
            }
            const historicoMensagens = await banco.mensagem.findMany({
              where: { conversaId: conversa.id },
              orderBy: { criadoEm: 'asc' },
            })

            // Gerado pela IA — sem texto fixo
            const mensagem = await gerarMensagemConfirmacao1h(tenant, ag, historicoMensagens)
            if (!mensagem) {
              console.warn(`[Confirmacao1h] IA não gerou mensagem para ${ag.id} — será reprocessado.`)
              continue
            }

            await enviarMensagemComLog(tenant, ag, mensagem, 'lembrete2hEnviadoEm', 'Confirmacao1h')
          } catch (errEnvio) {
            console.error(`[Confirmacao1h] Erro ao enviar para ${telefoneNorm}:`, errEnvio.message)
          }
        }

        // ── Ciclo 3: lembrete de vencimento de plano mensal (1 dia antes) ──
        // Só processa se membershipsAtivo estiver ativo no tenant
        if (tenant.membershipsAtivo) {
          try {
            const amanha = new Date(agora)
            amanha.setDate(amanha.getDate() + 1)
            const tz_ = tenant.timezone || 'America/Sao_Paulo'
            const diaAmanha = amanha.toLocaleDateString('en-CA', { timeZone: tz_ })
            const inicioDiaAmanha = new Date(`${diaAmanha}T00:00:00.000Z`)
            const fimDiaAmanha = new Date(`${diaAmanha}T23:59:59.999Z`)

            const assinaturasFimAmanha = await banco.assinaturaCliente.findMany({
              where: {
                tenantId: tenant.id,
                status: 'ATIVA',
                proximaCobrancaEm: { gte: inicioDiaAmanha, lte: fimDiaAmanha },
              },
              include: {
                cliente: { select: { id: true, nome: true, telefone: true } },
                planoAssinatura: { select: { nome: true, precoCentavos: true } },
              },
            })

            for (const assinatura of assinaturasFimAmanha) {
              const telefoneNorm = normalizarTelefone(assinatura.cliente?.telefone)
              if (!telefoneNorm || !tenant.configWhatsApp) continue
              if (!assinatura.planoAssinatura) continue

              const valorFmt = `R$${((assinatura.planoAssinatura.precoCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

              // Gerado pela IA — sem texto fixo
              const msg = await gerarMensagemVencimentoPlano(
                tenant,
                assinatura.cliente,
                assinatura.planoAssinatura.nome,
                valorFmt
              )

              if (!msg) {
                console.warn(`[PlanoMensal] IA não gerou mensagem de vencimento para ${telefoneNorm} — pulando.`)
                continue
              }

              try {
                const resultado = await whatsappServico.enviarMensagem(tenant.configWhatsApp, telefoneNorm, msg, tenant.id)
                if (!resultado) {
                  console.warn(`[PlanoMensal] Envio falhou para ${telefoneNorm} — WhatsApp possivelmente desconectado.`)
                  continue
                }
                console.log(`[PlanoMensal] Lembrete vencimento enviado para ${telefoneNorm} — plano: ${assinatura.planoAssinatura.nome}`)
              } catch (errEnvio) {
                console.warn(`[PlanoMensal] Falha ao enviar lembrete vencimento para ${telefoneNorm}:`, errEnvio.message)
              }
            }
          } catch (errPlano) {
            console.warn(`[PlanoMensal] Erro no ciclo 3 de lembretes:`, errPlano.message)
          }
        }

      } catch (errTenant) {
        console.error(`[Lembretes] Erro no tenant ${tenant.id}:`, errTenant.message)
      }
    }
  } catch (err) {
    console.error('[Lembretes] Erro geral:', err.message)
  }
}

/**
 * Inicia o cron de lembretes (roda a cada 15 minutos).
 */
const iniciarCronLembretes = () => {
  const INTERVALO_MS = 15 * 60 * 1000 // 15 minutos

  // Primeira execução após 1 minuto do startup (evita pico na inicialização)
  setTimeout(() => {
    enviarLembretes()
    setInterval(enviarLembretes, INTERVALO_MS)
  }, 60 * 1000)

  console.log('[Lembretes] Cron de lembretes iniciado (intervalo: 15min)')
}

module.exports = { iniciarCronLembretes, enviarLembretes }

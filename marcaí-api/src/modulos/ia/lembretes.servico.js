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
 * Gera mensagem de lembrete personalizada pela IA com base no histórico do cliente.
 * @param {boolean} maisde24h - true se o agendamento é mais de 24h no futuro
 */
const gerarMensagemLembrete = async (tenant, ag, historicoMensagens, maisde24h = false) => {
  const tz = tenant.timezone || 'America/Sao_Paulo'
  const dataFmt = formatarDataInteligente(ag.inicioEm, tz)
  const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'

  // Extrai contexto do histórico (últimas 10 msgs de texto do cliente e da IA)
  const resumoHistorico = historicoMensagens
    .filter((m) => ['cliente', 'ia'].includes(m.remetente))
    .slice(-10)
    .map((m) => `${m.remetente === 'cliente' ? 'Cliente' : 'Don'}: ${m.conteudo}`)
    .join('\n')

  const tomDescricao = {
    FORMAL: 'elegante e refinada',
    DESCONTRALIDO: 'calorosa e simpática',
    ACOLHEDOR: 'acolhedora e empática',
  }
  const tom = tomDescricao[tenant.tomDeVoz] || 'calorosa e simpática'

  // Para agendamentos com mais de 24h de antecedência, usa emojis numéricos no CTA
  // para destacar visualmente no WhatsApp e aumentar taxa de resposta
  const ctaConfirmacao = maisde24h
    ? 'Responda 1️⃣ para confirmar ou 2️⃣ para cancelar.'
    : 'Responda 1 para confirmar ou 2 para cancelar.'

  const prompt = `Você é Don, recepcionista virtual da barbearia ${tenant.nome}. Tom: ${tom}.

DADOS DO AGENDAMENTO:
• Cliente: ${ag.cliente.nome} (chame de ${primeiroNome})
• Serviço: ${ag.servico.nome}
• Profissional: ${ag.profissional.nome}
• Data/hora: ${dataFmt}
• Tipo de lembrete: ${maisde24h ? 'antecipado (>24h antes)' : 'próximo (<24h)'}

HISTÓRICO RECENTE:
${resumoHistorico || '(sem histórico prévio)'}

TAREFA: Escreva UMA mensagem de lembrete personalizada e natural.
Regras:
1. Cumprimente pelo primeiro nome de forma adaptada ao histórico
2. Lembre o agendamento (serviço, profissional, data/hora)
3. Use EXATAMENTE este CTA no final: ${ctaConfirmacao}
4. Máximo 4 linhas. NUNCA use * ou **. Máximo 1 emoji além do CTA.
5. Tom ${maisde24h ? 'mais casual — há tempo' : 'direto — é breve'}.
6. Assine como: "— ${tenant.nome}"`

  try {
    const resposta = await openai.chat.completions.create({
      model: configIA.modelo,
      max_tokens: 200,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Gere a mensagem de lembrete agora.' },
      ],
    })
    return resposta.choices[0].message.content?.trim() || null
  } catch (err) {
    console.error('[Lembretes] Erro ao gerar mensagem via IA:', err.message)
    return null
  }
}

// ─── Helper: busca/cria conversa e envia mensagem com log ────────────────────
const enviarMensagemComLog = async (tenant, ag, mensagem, campoMarca, labelLog) => {
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
    ag.cliente.telefone,
    mensagem,
    tenant.id
  )

  if (resultadoEnvio === null) {
    console.warn(`[${labelLog}] Envio retornou null para ${ag.cliente.telefone} — WhatsApp possivelmente desconectado.`)
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
      select: { id: true, nome: true, configWhatsApp: true, timezone: true, tomDeVoz: true, lembreteMinutosAntes: true },
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
            if (!ag.cliente?.telefone) continue

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

              const mensagemIA = await gerarMensagemLembrete(tenant, ag, historicoMensagens, maisde24h)

              const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'
              const ctaFallback = maisde24h ? '1️⃣ Confirmar | 2️⃣ Cancelar' : 'Responda 1 para confirmar ou 2 para cancelar'
              const mensagem = mensagemIA ||
                `Oi, ${primeiroNome}! Lembrando do seu ${ag.servico.nome} com ${ag.profissional.nome} — ${dataFmt}.\n\n${ctaFallback}\n— ${tenant.nome}`

              const resultadoEnvio = await whatsappServico.enviarMensagem(
                tenant.configWhatsApp,
                ag.cliente.telefone,
                mensagem,
                tenant.id
              )

              if (resultadoEnvio === null) {
                console.warn(`[Lembretes] Envio retornou null para ${ag.cliente.telefone} — WhatsApp possivelmente desconectado. Será reprocessado.`)
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

              console.log(`[Lembretes] Enviado para ${ag.cliente.telefone} — ${ag.servico.nome} em ${dataFmt} (${minutosAntes}min antes)`)
            } catch (errEnvio) {
              console.error(`[Lembretes] Erro ao enviar para ${ag.cliente.telefone}:`, errEnvio.message)
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
          if (!ag.cliente?.telefone) continue

          // Só envia se foi criado com mais de 2h de antecedência
          const antecedenciaMs = ag.inicioEm.getTime() - ag.criadoEm.getTime()
          if (antecedenciaMs <= ANTECEDENCIA_MINIMA_MS) {
            console.log(`[Confirmacao1h] Agendamento ${ag.id} criado com menos de 2h de antecedência — pulando.`)
            continue
          }

          // Não envia se o lembrete configurável já vai cobrir o mesmo período (evita mensagem dupla)
          // Se lembreteMinutosAntes >= 60, o lembrete já cobrirá 1h antes — pula
          if ((tenant.lembreteMinutosAntes ?? 60) >= 60) {
            console.log(`[Confirmacao1h] Lembrete configurado já cobre 1h antes para agendamento ${ag.id} — pulando para evitar duplicata.`)
            continue
          }

          const tz = tenant.timezone || 'America/Sao_Paulo'
          const dataFmt = formatarDataInteligente(ag.inicioEm, tz)
          const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'

          const mensagem =
            `Oi, ${primeiroNome}! Daqui a pouco é o seu ${ag.servico.nome} com ${ag.profissional.nome?.split(' ')[0] || ag.profissional.nome} — ${dataFmt}.\n\n` +
            `Responda 1 para confirmar ou 2 para cancelar.\n` +
            `— ${tenant.nome}`

          try {
            await enviarMensagemComLog(tenant, ag, mensagem, 'lembrete2hEnviadoEm', 'Confirmacao1h')
          } catch (errEnvio) {
            console.error(`[Confirmacao1h] Erro ao enviar para ${ag.cliente.telefone}:`, errEnvio.message)
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
              if (!assinatura.cliente?.telefone || !tenant.configWhatsApp) continue
              if (!assinatura.planoAssinatura) continue

              const primeiroNome = assinatura.cliente.nome?.split(' ')[0] || 'cliente'
              const valorFmt = `R$${((assinatura.planoAssinatura.precoCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

              const msg =
                `Oi, ${primeiroNome}! Lembrando que seu plano *${assinatura.planoAssinatura.nome}* vence amanhã. ` +
                `No próximo atendimento será cobrado *${valorFmt}*. ` +
                `Qualquer dúvida, fale com a equipe. Até lá! 😊\n— ${tenant.nome}`

              try {
                await whatsappServico.enviarMensagem(tenant.configWhatsApp, assinatura.cliente.telefone, msg, tenant.id)
                console.log(`[PlanoMensal] Lembrete vencimento enviado para ${assinatura.cliente.telefone} — plano: ${assinatura.planoAssinatura.nome}`)
              } catch (errEnvio) {
                console.warn(`[PlanoMensal] Falha ao enviar lembrete vencimento para ${assinatura.cliente.telefone}:`, errEnvio.message)
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

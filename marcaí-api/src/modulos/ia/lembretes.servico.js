/**
 * Serviço de lembretes automáticos de agendamento via WhatsApp.
 *
 * Fluxo (ciclo 1, lembretesMinutosAntes de Meu Negócio, pode haver vários):
 *   1. A cada 1 min, busca janela conforme a maior antecedência configurada
 *   2. Smart skip: ignora se o agendamento foi criado depois do início da janela
 *   3. Envia o texto de Config. Don Barber (lembreteDiaAnterior se ≥24h, senão lembreteNoDia)
 *   4. Marca lembretesConfiguradosEnviados por antecedência
 *
 * Ciclo 2: confirmação ~1h (template lembreteNoDia) só se o tenant NÃO tiver nenhum lembrete no painel.
 */

const OpenAI = require('openai')
const configIA = require('../../config/ia')
const banco = require('../../config/banco')
const whatsappServico = require('./whatsapp.servico')
const {
  INTERVALO_CRON_MINUTOS,
  obterLembretesConfigurados,
  obterLembretesEnviados,
  estaNaJanelaDeLembrete,
} = require('../../utils/lembretes')
const {
  montarMensagemLembreteDinamica,
  montarMensagemConfirmacao1hDinamica,
} = require('../../utils/mensagensDonTemplates')
const { processarEvento } = require('./messageOrchestrator')

const PAYLOADS_BOTOES_WHATSAPP = {
  CONFIRMAR_AGENDAMENTO: 'CONFIRMAR_AGENDAMENTO',
  REMARCAR_AGENDAMENTO: 'REMARCAR_AGENDAMENTO',
}

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
 * Monta mensagem de lembrete (template editável em Config. Don Barber).
 * @param {boolean} maisde24h - true → lembrete antecipado (1 dia antes); false → lembrete no dia
 */
const gerarMensagemLembrete = async (tenant, ag, _historicoMensagens, maisde24h = false) =>
  montarMensagemLembreteDinamica(tenant, ag, { maisde24h })

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
const gerarMensagemConfirmacao1h = async (tenant, ag, _historicoMensagens) =>
  montarMensagemConfirmacao1hDinamica(tenant, ag)

const montarPayloadInterativoConfirmacao = (mensagem = '') => ({
  type: 'button',
  body: { text: String(mensagem || '').slice(0, 1024) },
  action: {
    buttons: [
      { type: 'reply', reply: { id: PAYLOADS_BOTOES_WHATSAPP.CONFIRMAR_AGENDAMENTO, title: 'Confirmar' } },
      { type: 'reply', reply: { id: PAYLOADS_BOTOES_WHATSAPP.REMARCAR_AGENDAMENTO, title: 'Remarcar' } },
    ],
  },
})

// ─── Helper: busca/cria conversa e envia mensagem com log ────────────────────
/** @param {object} [opcoes] opcoes.atualizarAgendamento=false — o chamador grava lembretesConfiguradosEnviados (lembretes múltiplos) */
const enviarMensagemComLog = async (tenant, ag, mensagem, campoMarca, labelLog, opcoes = {}) => {
  const telefoneNorm = normalizarTelefone(ag.cliente?.telefone)
  if (!telefoneNorm) {
    console.warn(`[${labelLog}] Telefone inválido para cliente ${ag.clienteId} — pulando envio.`)
    return false
  }

  let conversa = await banco.conversa.findFirst({
    where: { tenantId: tenant.id, clienteId: ag.clienteId },
    orderBy: { atualizadoEm: 'desc' },
  })

  if (conversa?.status === 'ENCERRADA') {
    console.log(`[${labelLog}] Conversa encerrada para cliente ${ag.clienteId} — envio suprimido.`)
    return false
  }

  if (!conversa) {
    conversa = await banco.conversa.create({
      data: { tenantId: tenant.id, clienteId: ag.clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
    })
  }

  const resultadoEnvio = opcoes?.interativo
    ? await whatsappServico.enviarMensagemInterativa(
      tenant.configWhatsApp,
      telefoneNorm || ag.cliente?.telefone,
      opcoes.interativo,
      tenant.id
    )
    : await whatsappServico.enviarMensagem(
      tenant.configWhatsApp,
      telefoneNorm || ag.cliente?.telefone,
      mensagem,
      tenant.id
    )

  if (!resultadoEnvio) {
    console.warn(`[${labelLog}] Envio falhou para ${telefoneNorm} — WhatsApp possivelmente desconectado. NÃO marcado como enviado.`)
    return false
  }

  if (opcoes.atualizarAgendamento !== false) {
    await banco.agendamento.update({ where: { id: ag.id }, data: { [campoMarca]: new Date() } })
  }

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
      select: {
        id: true,
        nome: true,
        configWhatsApp: true,
        timezone: true,
        tomDeVoz: true,
        lembreteMinutosAntes: true,
        lembretesMinutosAntes: true,
        autoCancelarNaoConfirmados: true,
        horasAutoCancelar: true,
        membershipsAtivo: true,
        configMensagensDon: true,
      },
    })

    for (const tenant of tenants) {
      try {
        // ── Ciclo 1: lembrete configurável por tenant ──────────────────────────
        const lembretesConfigurados = obterLembretesConfigurados(tenant)
        const maiorJanela = lembretesConfigurados[0] ?? 0

        if (maiorJanela > 0) {
          const fimJanela = new Date(agora.getTime() + maiorJanela * 60 * 1000)

          const agendamentos = await banco.agendamento.findMany({
            where: {
              tenantId: tenant.id,
              status: { in: ['AGENDADO', 'CONFIRMADO'] },
              inicioEm: { gte: agora, lte: fimJanela },
            },
            include: { cliente: true, servico: true, profissional: true },
          })

          for (const ag of agendamentos) {
            const telefoneNorm = normalizarTelefone(ag.cliente?.telefone)
            if (!telefoneNorm) continue

            const restanteMinutos = (ag.inicioEm.getTime() - agora.getTime()) / (60 * 1000)
            const lembretesEnviados = obterLembretesEnviados(ag)

            for (const minutosAntes of lembretesConfigurados) {
              if (!estaNaJanelaDeLembrete(restanteMinutos, minutosAntes, INTERVALO_CRON_MINUTOS)) continue
              if (lembretesEnviados.has(minutosAntes)) continue

              const inicioJanelaMs = ag.inicioEm.getTime() - minutosAntes * 60 * 1000
              if (ag.criadoEm.getTime() > inicioJanelaMs) {
                console.log(`[Lembretes] Smart skip: agendamento ${ag.id} criado depois do marco de ${minutosAntes}min — pulando.`)
                continue
              }

              const maisde24h = minutosAntes >= 1440
              const minutosConfirmacao = Number(tenant.horasAutoCancelar || 0) * 60
              const lembreteEhPedidoConfirmacao =
                Boolean(tenant.autoCancelarNaoConfirmados)
                && minutosConfirmacao > 0
                && minutosAntes === minutosConfirmacao
              try {
                const mensagemLembrete = lembreteEhPedidoConfirmacao
                  ? await gerarMensagemConfirmacao1h(tenant, ag, null)
                  : await gerarMensagemLembrete(tenant, ag, null, maisde24h)
                if (!mensagemLembrete) {
                  console.warn(`[Lembretes] Template vazio ag ${ag.id} — pulando.`)
                  continue
                }
                const enviou = await enviarMensagemComLog(
                  tenant,
                  ag,
                  mensagemLembrete,
                  'lembreteEnviadoEm',
                  lembreteEhPedidoConfirmacao ? 'Confirmacao' : 'Lembrete',
                  {
                    atualizarAgendamento: false,
                    interativo: lembreteEhPedidoConfirmacao ? montarPayloadInterativoConfirmacao(mensagemLembrete) : null,
                  }
                )
                if (!enviou) continue

                const enviadosAtualizados = [...lembretesEnviados, minutosAntes].sort((a, b) => b - a)
                await banco.agendamento.update({
                  where: { id: ag.id },
                  data: {
                    lembreteEnviadoEm: ag.lembreteEnviadoEm || new Date(),
                    lembretesConfiguradosEnviados: enviadosAtualizados,
                  },
                })

                const tempoAntecedencia = minutosAntes >= 1440 ? `${Math.round(minutosAntes / 1440)}d` : `${minutosAntes}min`
                console.log(`[Lembretes] Enviado template (${tempoAntecedencia} antes) → ${telefoneNorm} — ${ag.servico.nome}`)
              } catch (errEnvio) {
                console.error(`[Lembretes] Erro ao enviar para ${telefoneNorm}:`, errEnvio.message)
              }
            }
          }
        }

        // ── Ciclo 2: confirmação 1h antes para tenants SEM lembretes configurados ──
        // Regra de negócio: se o barbeiro configurou lembretes no painel,
        // o sistema deve respeitar EXATAMENTE essa quantidade e essa janela.
        // Portanto, este ciclo extra só roda quando não há nenhum lembrete configurado.
        const JANELA_CONFIRMACAO_MS = 60 * 60 * 1000        // 1h antes do horário
        const ANTECEDENCIA_MINIMA_MS = 2 * 60 * 60 * 1000   // criado com 2h+ de antecedência

        const lembretesConfiguradosTenant = obterLembretesConfigurados(tenant)
        if (lembretesConfiguradosTenant.length > 0) {
          console.log(`[Confirmacao1h] Tenant ${tenant.id} possui lembretes configurados (${lembretesConfiguradosTenant.join(', ')} min) — ciclo extra desativado.`)
        } else {
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

              const mensagem = await gerarMensagemConfirmacao1h(tenant, ag, historicoMensagens)
              if (!mensagem) {
                console.warn(`[Confirmacao1h] Template vazio ag ${ag.id} — reprocessa no próximo ciclo.`)
                continue
              }

              await enviarMensagemComLog(tenant, ag, mensagem, 'lembrete2hEnviadoEm', 'Confirmacao1h', {
                interativo: montarPayloadInterativoConfirmacao(mensagem),
              })
            } catch (errEnvio) {
              console.error(`[Confirmacao1h] Erro ao enviar para ${telefoneNorm}:`, errEnvio.message)
            }
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

              try {
                await processarEvento({
                  evento: 'RENOVACAO_PLANO',
                  tenantId: tenant.id,
                  cliente: assinatura.cliente,
                  extra: { 
                    planoNome: assinatura.planoAssinatura.nome,
                    vencimentoAntecipado: true
                  }
                })
                console.log(`[PlanoMensal] Lembrete vencimento orquestrado para ${telefoneNorm}`)
              } catch (errEnvio) {
                console.warn(`[PlanoMensal] Falha ao orquestrar lembrete vencimento para ${telefoneNorm}:`, errEnvio.message)
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
 * Inicia o cron de lembretes (roda a cada 1 minuto).
 */
const iniciarCronLembretes = () => {
  const INTERVALO_MS = INTERVALO_CRON_MINUTOS * 60 * 1000

  // Primeira execução poucos segundos após o startup para não segurar o primeiro ciclo.
  setTimeout(() => {
    enviarLembretes()
    setInterval(enviarLembretes, INTERVALO_MS)
  }, 5 * 1000)

  console.log(`[Lembretes] Cron de lembretes iniciado (intervalo: ${INTERVALO_CRON_MINUTOS}min)`)
}

module.exports = { iniciarCronLembretes, enviarLembretes }

/**
 * Automações enterprise do Don.
 *
 * Crons independentes:
 *   A. Lembrete 2h antes  (a cada 15min)
 *   B. Auto-cancelamento por não confirmação  (a cada 15min)
 *   C. Retorno pós-serviço  (diário 09:00)
 *   D. Reativação de clientes sumidos  (diário 10:00)
 *   E. Parabéns de aniversário  (diário 08:00)
 */

const OpenAI = require('openai')
const configIA = require('../../config/ia')
const banco = require('../../config/banco')
const whatsappServico = require('./whatsapp.servico')
const filaEsperaServico = require('../filaEspera/filaEspera.servico')
const fidelidadeServico = require('../fidelidade/fidelidade.servico')
const { obterLembretesConfigurados } = require('../../utils/lembretes')
const { processarEvento } = require('./messageOrchestrator')

const openai = new OpenAI({ apiKey: configIA.apiKey, baseURL: configIA.baseURL })

const formatarData = (data, tz) =>
  new Date(data).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: tz || 'America/Sao_Paulo',
  })

// Formata data usando "hoje" ou "amanhã" quando aplicável
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

// Salva mensagem enviada na conversa do cliente (para manter contexto)
// Usa mesma lógica de prioridade do buscarOuCriarConversa:
//   1. Conversa ativa/escalonada dos últimos 30min
//   2. Qualquer conversa não-cancelada das últimas 48h
//   3. Cria nova
const salvarMensagemNaConversa = async (tenantId, clienteId, mensagem) => {
  try {
    const limiteInatividade = new Date(Date.now() - 30 * 60 * 1000)
    const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000)

    let conversa = await banco.conversa.findFirst({
      where: { tenantId, clienteId, status: { in: ['ATIVA', 'ESCALONADA'] }, atualizadoEm: { gte: limiteInatividade } },
      orderBy: { atualizadoEm: 'desc' },
    })

    if (!conversa) {
      conversa = await banco.conversa.findFirst({
        where: { tenantId, clienteId, status: { not: 'CANCELADA' }, atualizadoEm: { gte: limite48h } },
        orderBy: { atualizadoEm: 'desc' },
      })
    }

    if (!conversa) {
      conversa = await banco.conversa.create({
        data: { tenantId, clienteId, canal: 'WHATSAPP', status: 'ATIVA' },
      })
    } else if (conversa.status !== 'ATIVA') {
      await banco.conversa.update({ where: { id: conversa.id }, data: { status: 'ATIVA' } })
    }

    await banco.mensagem.create({
      data: { conversaId: conversa.id, remetente: 'ia', conteudo: mensagem },
    })
    await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
  } catch (err) {
    console.error('[Automações] Erro ao salvar msg na conversa:', err.message)
  }
}

const normalizarTelefone = (telefone) => {
  if (!telefone) return null
  const digitos = String(telefone).replace(/\D/g, '')
  if (!digitos) return null
  // Detecta LID do WhatsApp: mais de 13 dígitos sem DDI Brasil → não é telefone real
  if (!digitos.startsWith('55') && digitos.length > 13) return null
  const normalizado = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  // Valida tamanho: telefone BR com DDI = 12 ou 13 dígitos (55 + 10 ou 11)
  if (normalizado.length < 12 || normalizado.length > 13) return null
  return normalizado
}

const enviarWhatsApp = async (tenant, telefone, mensagem) => {
  if (!tenant?.configWhatsApp) return
  const telNormalizado = normalizarTelefone(telefone)
  if (!telNormalizado) return

  const { processarEvento } = require('./messageOrchestrator')
  processarEvento({
    evento: 'NOTIFICACAO_INTERNA',
    tenantId: tenant.id,
    cliente: { nome: 'Admin/Profissional', telefone: telNormalizado },
    extra: { 
      contexto: mensagem,
      destinoDireto: telNormalizado
    }
  })
}

const gerarMensagemIA = async (systemPrompt) => {
  try {
    const resp = await openai.chat.completions.create({
      model: configIA.modelo,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Gere a mensagem agora.' },
      ],
    })
    return resp.choices[0].message.content?.trim() || null
  } catch {
    return null
  }
}

const montarMensagemAniversarioFallback = ({ primeiroNome, tenantNome, beneficio }) => (
  `Feliz aniversário, ${primeiroNome}! 🎉\n` +
  `Que seu dia seja leve e especial.\n` +
  `Hoje você ganhou: ${beneficio}.\n` +
  `Se quiser usar, é só responder por aqui. — ${tenantNome}`
)

// ─── A. Lembrete 2h antes ─────────────────────────────────────────────────────

const enviarLembretes2h = async () => {
  try {
    const agora = new Date()
    const em2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000)
    const em2h30 = new Date(agora.getTime() + 2.5 * 60 * 60 * 1000)

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true, tomDeVoz: true, lembreteMinutosAntes: true, lembretesMinutosAntes: true },
    })

    for (const tenant of tenants) {
      // Se o tenant tem lembrete configurável ativo, o lembretes.servico.js já cuida disso — evita duplicidade
      if (obterLembretesConfigurados(tenant).length > 0) continue

      const agendamentos = await banco.agendamento.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ['AGENDADO', 'CONFIRMADO'] },
          inicioEm: { gte: em2h, lte: em2h30 },
          lembrete2hEnviadoEm: null,
        },
        include: { cliente: true, servico: true, profissional: true },
      })

      for (const ag of agendamentos) {
        if (!ag.cliente?.telefone) continue
        try {
          const tz = tenant.timezone || 'America/Sao_Paulo'
          const dataInteligente = formatarDataInteligente(ag.inicioEm, tz)
          const primeiroNome = ag.cliente.nome?.split(' ')[0] || 'cliente'

          processarEvento({
            evento: 'LEMBRETE',
            agendamento: ag,
            tenantId: tenant.id,
            cliente: ag.cliente,
            extra: { tempoAntecedencia: '2h' }
          })

          await banco.agendamento.update({
            where: { id: ag.id },
            data: { lembrete2hEnviadoEm: new Date() },
          })
          console.log(`[Automações] Lembrete 2h orquestrado → ${ag.cliente.telefone}`)
        } catch (err) {
          console.error(`[Automações] Erro lembrete 2h:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[Automações] Erro geral lembrete 2h:', err.message)
  }
}

// ─── B. Auto-cancelamento por não confirmação ─────────────────────────────────

const autoCancelarNaoConfirmados = async () => {
  try {
    const agora = new Date()

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, autoCancelarNaoConfirmados: true, configWhatsApp: { not: null } },
      select: {
        id: true, nome: true, configWhatsApp: true,
        timezone: true, horasAutoCancelar: true,
      },
    })

    for (const tenant of tenants) {
      const limite = new Date(agora.getTime() + tenant.horasAutoCancelar * 60 * 60 * 1000)
      // Nunca cancela agendamentos com menos de 30 min de antecedência — o cliente pode estar a caminho
      const limite30min = new Date(agora.getTime() + 30 * 60 * 1000)

      const agendamentos = await banco.agendamento.findMany({
        where: {
          tenantId: tenant.id,
          status: 'AGENDADO', // só AGENDADO — CONFIRMADO fica
          inicioEm: { gte: limite30min, lte: limite },
        },
        include: { cliente: true, servico: true, profissional: true },
      })

      for (const ag of agendamentos) {
        try {
          await banco.agendamento.update({
            where: { id: ag.id },
            data: {
              status: 'CANCELADO',
              canceladoEm: new Date(),
              motivoCancelamento: 'Cancelado automaticamente: não houve confirmação no prazo',
            },
          })

          const tz = tenant.timezone || 'America/Sao_Paulo'
          const dataInteligente = formatarDataInteligente(ag.inicioEm, tz)
          const primeiroNome = ag.cliente?.nome?.split(' ')[0] || 'cliente'

          // Notifica cliente
          // Notifica cliente via Orquestrador
          if (ag.cliente?.telefone) {
            processarEvento({
              evento: 'AUTO_CANCELAMENTO',
              agendamento: ag,
              tenantId: tenant.id,
              cliente: ag.cliente
            })
          }

          // Notifica profissional
          if (ag.profissional?.telefone) {
            const msgProf =
              `Agendamento cancelado (sem confirmação)\n` +
              `${ag.cliente?.nome || 'Cliente'} — ${ag.servico.nome} em ${dataInteligente}.`
            await enviarWhatsApp(tenant, ag.profissional.telefone, msgProf)
          }

          // Notifica fila de espera
          filaEsperaServico.notificarFilaParaSlot(tenant.id, {
            servicoId: ag.servicoId,
            profissionalId: ag.profissionalId,
            dataHoraLiberada: ag.inicioEm,
          }).catch(() => {})

          console.log(`[Automações] Auto-cancelado agendamento ${ag.id}`)
        } catch (err) {
          console.error(`[Automações] Erro auto-cancel ${ag.id}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[Automações] Erro geral auto-cancel:', err.message)
  }
}

// ─── C. Retorno pós-serviço ───────────────────────────────────────────────────

const enviarLembretesRetorno = async () => {
  try {
    const agora = new Date()

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true, tomDeVoz: true, mensagemRetorno: true },
    })

    for (const tenant of tenants) {
      // Busca agendamentos concluídos onde fimEm caiu exatamente há retornoEmDias dias
      // Usa subquery via join: busca todos concluídos com serviço que tem retornoEmDias
      const agendamentos = await banco.agendamento.findMany({
        where: {
          tenantId: tenant.id,
          status: 'CONCLUIDO',
          retornoEnviadoEm: null,
          servico: { retornoEmDias: { gt: 0 } },
        },
        include: { cliente: true, servico: true, profissional: true },
      })

      // "Hoje" no timezone do tenant — evita envio no dia errado quando servidor está em UTC
      const tz = tenant.timezone || 'America/Sao_Paulo'
      const hojeStr = agora.toLocaleDateString('en-CA', { timeZone: tz })

      for (const ag of agendamentos) {
        if (!ag.servico.retornoEmDias || !ag.cliente?.telefone) continue

        // Data de retorno calculada no timezone do tenant (ALTO 2: era calculada no TZ do servidor)
        const fimEmStr = new Date(ag.fimEm).toLocaleDateString('en-CA', { timeZone: tz })
        const [ano, mes, dia] = fimEmStr.split('-').map(Number)
        const dataRetorno = new Date(ano, mes - 1, dia)
        dataRetorno.setDate(dataRetorno.getDate() + ag.servico.retornoEmDias)
        const dataRetornoStr = dataRetorno.toLocaleDateString('en-CA')

        if (dataRetornoStr !== hojeStr) continue

        try {
          processarEvento({
            evento: 'RETORNO_POS_SERVICO',
            agendamento: ag,
            tenantId: tenant.id,
            cliente: ag.cliente,
            extra: { dias: ag.servico.retornoEmDias }
          })

          await banco.agendamento.update({
            where: { id: ag.id },
            data: { retornoEnviadoEm: new Date() },
          })
          console.log(`[Automações] Retorno orquestrado → ${ag.cliente.telefone}`)
        } catch (err) {
          console.error(`[Automações] Erro retorno ${ag.id}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[Automações] Erro geral retorno:', err.message)
  }
}

// ─── D. Reativação de clientes sumidos ────────────────────────────────────────

const reativarClientesSumidos = async () => {
  try {
    const agora = new Date()
    const limite60dias = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000)
    const limite90dias = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000)

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true },
    })

    for (const tenant of tenants) {
      // Clientes com último agendamento concluído há mais de 60 dias
      // e que não receberam reativação nos últimos 90 dias
      const clientes = await banco.cliente.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { reativacaoEnviadaEm: null },
            { reativacaoEnviadaEm: { lt: limite90dias } },
          ],
          agendamentos: {
            some: {
              status: 'CONCLUIDO',
              inicioEm: { lt: limite60dias },
            },
          },
        },
        include: {
          agendamentos: {
            where: { status: 'CONCLUIDO' },
            orderBy: { inicioEm: 'desc' },
            take: 1,
            include: { servico: true },
          },
        },
        take: 50, // processa em lotes
      })

      for (const cliente of clientes) {
        if (!cliente.telefone) continue

        // Garante que não tem agendamento futuro (cliente ainda ativo)
        const futuro = await banco.agendamento.count({
          where: {
            clienteId: cliente.id,
            status: { in: ['AGENDADO', 'CONFIRMADO'] },
            inicioEm: { gte: agora },
          },
        })
        if (futuro > 0) continue

        try {
          processarEvento({
            evento: 'REATIVACAO',
            tenantId: tenant.id,
            cliente,
            agendamento: cliente.agendamentos[0] // usa o último como referência se houver
          })

          await banco.cliente.update({
            where: { id: cliente.id },
            data: { reativacaoEnviadaEm: new Date() },
          })
          console.log(`[Automações] Reativação orquestrada → ${cliente.telefone}`)
        } catch (err) {
          console.error(`[Automações] Erro reativação cliente ${cliente.id}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[Automações] Erro geral reativação:', err.message)
  }
}

// ─── E. Parabéns de aniversário ───────────────────────────────────────────────

const enviarParabens = async () => {
  try {
    const agora = new Date()
    const diaHoje = agora.getDate()
    const mesHoje = agora.getMonth() + 1
    const anoHoje = agora.getFullYear()

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true, aniversarianteAtivo: true },
    })

    for (const tenant of tenants) {
      if (!tenant.aniversarianteAtivo) continue

      const configFidelidade = await fidelidadeServico.obterConfig(tenant.id)
      if (!configFidelidade?.aniversarioAtivo) continue

      // Busca clientes com aniversário hoje (ignora o ano de nascimento)
      const clientes = await banco.cliente.findMany({
        where: {
          tenantId: tenant.id,
          dataNascimento: { not: null },
          OR: [
            { parabensEnviadoEm: null },
            {
              parabensEnviadoEm: {
                lt: new Date(`${anoHoje}-01-01T00:00:00`),
              },
            },
          ],
        },
      })

      // Filtra por dia/mês no JavaScript (Prisma não tem função de dia/mês nativamente)
      const aniversariantes = clientes.filter((c) => {
        if (!c.dataNascimento) return false
        const nasc = new Date(c.dataNascimento)
        return nasc.getDate() === diaHoje && (nasc.getMonth() + 1) === mesHoje
      })

      for (const cliente of aniversariantes) {
        if (!cliente.telefone) continue
        let mensagemEnviada = false
        let beneficioRegistrado = false
        try {
          const primeiroNome = cliente.nome?.split(' ')[0] || 'cliente'
          const beneficio = fidelidadeServico.obterDescricaoBeneficioAniversario(configFidelidade)

          try {
            const registro = await fidelidadeServico.registrarBeneficioAniversario(tenant.id, cliente.id, beneficio)
            beneficioRegistrado = Boolean(registro?.historico?.id)
          } catch (err) {
            console.error(`[Automações] Erro ao registrar benefício de aniversário ${cliente.id}:`, err.message)
            continue
          }

          processarEvento({
            evento: 'ANIVERSARIO',
            tenantId: tenant.id,
            cliente,
            extra: { beneficio }
          })
          mensagemEnviada = true
          console.log(`[Automações] Parabéns orquestrado → ${cliente.telefone}`)
        } catch (err) {
          console.error(`[Automações] Erro parabéns cliente ${cliente.id}:`, err.message)
        } finally {
          if (beneficioRegistrado) {
            await banco.cliente.update({
              where: { id: cliente.id },
              data: { parabensEnviadoEm: new Date() },
            }).catch(() => {})
          }
          if (!mensagemEnviada && beneficioRegistrado) {
            console.log(`[Automações] Parabéns processado sem envio final → ${cliente.telefone}`)
          }
        }
      }
    }
  } catch (err) {
    console.error('[Automações] Erro geral parabéns:', err.message)
  }
}

// ─── F. NPS pós-atendimento ───────────────────────────────────────────────────
// Disparado 1h após o agendamento ser marcado CONCLUIDO (via cron a cada 30min)

const enviarNpsPosAtendimento = async () => {
  try {
    const agora = new Date()
    const h1Atras = new Date(agora.getTime() - 1 * 60 * 60 * 1000)
    const h2Atras = new Date(agora.getTime() - 2 * 60 * 60 * 1000)

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, npsAtivo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true },
    })

    for (const tenant of tenants) {
      const agendamentos = await banco.agendamento.findMany({
        where: {
          tenantId: tenant.id,
          status: 'CONCLUIDO',
          feedbackNota: null,   // ainda sem avaliação
          npsEnviadoEm: null,   // ainda não enviou NPS — evita duplicata
          // Usa concluidoEm (quando o barbeiro realmente finalizou) como referência principal.
          // Fallback para fimEm em agendamentos antigos sem concluidoEm (retrocompatibilidade).
          OR: [
            { concluidoEm: { gte: h2Atras, lte: h1Atras } },
            { concluidoEm: null, fimEm: { gte: h2Atras, lte: h1Atras } },
          ],
        },
        include: { cliente: true, profissional: { select: { nome: true } }, servico: { select: { nome: true } } },
      })

      for (const ag of agendamentos) {
        if (!ag.cliente?.telefone) continue
        try {
          processarEvento({
            evento: 'NPS',
            agendamento: ag,
            tenantId: tenant.id,
            cliente: ag.cliente
          })

          await banco.agendamento.update({
            where: { id: ag.id },
            data: { npsEnviadoEm: new Date() },
          })
          console.log(`[Automações] NPS orquestrado → ${ag.cliente.telefone}`)
        } catch (err) {
          console.error(`[NPS] Erro ao enviar para ${ag.cliente?.telefone}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[NPS] Erro geral:', err.message)
  }
}

// ─── G. Relatório diário para o gestor ────────────────────────────────────────

const enviarRelatorioDiario = async () => {
  try {
    const agora = new Date()
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0)
    const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59)

    const tenants = await banco.tenant.findMany({
      where: { ativo: true, relatorioDiarioAtivo: true, configWhatsApp: { not: null } },
      select: { id: true, nome: true, configWhatsApp: true, timezone: true },
    })

    for (const tenant of tenants) {
      const config = tenant.configWhatsApp
      const numeroAdmin = config?.numeroAdministrador
      if (!numeroAdmin) continue

      try {
        const [agendamentos, profissionais] = await Promise.all([
          banco.agendamento.findMany({
            where: { tenantId: tenant.id, inicioEm: { gte: inicioHoje, lte: fimHoje } },
            include: { servico: { select: { precoCentavos: true } } },
          }),
          banco.profissional.findMany({
            where: { tenantId: tenant.id, ativo: true },
            select: { nome: true },
          }),
        ])

        const concluidos = agendamentos.filter((a) => a.status === 'CONCLUIDO')
        const cancelados = agendamentos.filter((a) => a.status === 'CANCELADO')
        const agendados = agendamentos.filter((a) => ['AGENDADO', 'CONFIRMADO'].includes(a.status))
        const receitaCentavos = concluidos.reduce((acc, a) => acc + (a.servico?.precoCentavos || 0), 0)
        const receitaFmt = (receitaCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

        const dataFmt = inicioHoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

        // Desempenho baseado em concluídos
        const totalHoje = agendamentos.length
        let desempenho = '📈 Desempenho: Excelente 🔥'
        if (concluidos.length === 0) desempenho = '📈 Desempenho: Sem atendimentos hoje'
        else if (concluidos.length <= 2) desempenho = '📈 Desempenho: Pode melhorar 💪'
        else if (concluidos.length <= 5) desempenho = '📈 Desempenho: Bom 👍'

        // Oportunidade
        const temHorariosLivres = agendados.length < 3 && concluidos.length < 8
        const oportunidade = temHorariosLivres
          ? '\n⚠️ Oportunidade: Você ainda tem horários livres que poderiam gerar mais faturamento'
          : '\n✅ Agenda bem preenchida hoje!'

        // Cancelamentos
        const cancelamentoTexto = cancelados.length === 0
          ? `❌ ${cancelados.length} cancelamentos (excelente!)`
          : `❌ ${cancelados.length} cancelamento(s)`

        let msg = `📊 Relatório do Dia — ${tenant.nome}\n\n`
        msg += `✂️ ${concluidos.length} atendimento(s) realizado(s)\n`
        msg += `📅 ${agendados.length} agendamento(s) futuro(s)\n`
        msg += `💰 ${receitaFmt} faturados hoje\n`
        msg += `${cancelamentoTexto}\n\n`
        msg += `${desempenho}\n`
        msg += `${oportunidade}\n\n`
        msg += `💡 Sugestão do DON:\n`
        msg += `Que tal ativar promoções automáticas ou encaixes rápidos via WhatsApp? Posso fazer isso pra você 😉\n\n`
        msg += `— 🤖 DON`

        await enviarWhatsApp(tenant, numeroAdmin, msg)
        console.log(`[Relatório] Diário enviado → ${numeroAdmin} (${tenant.nome})`)
      } catch (err) {
        console.error(`[Relatório] Erro para tenant ${tenant.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[Relatório] Erro geral:', err.message)
  }
}

// ─── Agendamento dos crons ────────────────────────────────────────────────────

/**
 * Inicia todos os crons de automação enterprise.
 * Chamado no startup da aplicação (app.js).
 */
const iniciarCronAutomacoes = () => {
  const QUINZE_MIN = 15 * 60 * 1000

  // A + B: a cada 15 minutos (junto com lembretes)
  setTimeout(() => {
    enviarLembretes2h()
    autoCancelarNaoConfirmados()
    setInterval(() => {
      enviarLembretes2h()
      autoCancelarNaoConfirmados()
    }, QUINZE_MIN)
  }, 90 * 1000) // 90s após startup (offset em relação aos lembretes 24h que iniciam em 60s)

  // C, D, E: crons diários — calcula ms até o próximo horário alvo
  const agendarDiario = (hora, minuto, fn, nome) => {
    const agora = new Date()
    const alvo = new Date(agora)
    alvo.setHours(hora, minuto, 0, 0)
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
    const msAteAlvo = alvo - agora

    setTimeout(() => {
      fn()
      setInterval(fn, 24 * 60 * 60 * 1000)
    }, msAteAlvo)

    console.log(`[Automações] ${nome} agendado para ${alvo.toLocaleTimeString('pt-BR')}`)
  }

  agendarDiario(8, 0, enviarParabens, 'Parabéns aniversário')
  agendarDiario(9, 0, enviarLembretesRetorno, 'Retorno pós-serviço')
  agendarDiario(10, 0, reativarClientesSumidos, 'Reativação clientes sumidos')
  agendarDiario(9, 30, filaEsperaServico.expirarEntradas, 'Expiração fila de espera')
  agendarDiario(20, 0, enviarRelatorioDiario, 'Relatório diário gestor')

  // NPS: a cada 30 minutos
  const TRINTA_MIN = 30 * 60 * 1000
  setTimeout(() => {
    enviarNpsPosAtendimento()
    setInterval(enviarNpsPosAtendimento, TRINTA_MIN)
  }, 3 * 60 * 1000) // inicia 3min após startup

  console.log('[Automações] Crons enterprise iniciados (2h, auto-cancel, retorno, reativação, parabéns, fila, NPS, relatório)')
}

module.exports = {
  iniciarCronAutomacoes,
  enviarLembretes2h,
  autoCancelarNaoConfirmados,
  enviarLembretesRetorno,
  reativarClientesSumidos,
  enviarParabens,
  enviarNpsPosAtendimento,
  enviarRelatorioDiario,
}

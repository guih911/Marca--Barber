const { OpenAI } = require('openai')
const Anthropic = require('@anthropic-ai/sdk')
const configIA = require('../../config/ia')
const whatsappServico = require('./whatsapp.servico')
const banco = require('../../config/banco')
const vozServico = require('./voz.servico')

// OpenAI (fallback quando não há Anthropic)
const openai = new OpenAI({ apiKey: configIA.apiKey || process.env.OPENAI_API_KEY, baseURL: configIA.baseURL })
const anthropic = configIA.anthropicApiKey ? new Anthropic({ apiKey: configIA.anthropicApiKey }) : null

const limparMarkdownWhatsapp = (texto = '') => (
  String(texto || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .trim()
)

/**
 * messageOrchestrator
 * O Cérebro Central para disparar mensagens baseadas em evento.
 * Decide Tom de Voz, Usa Histórico e Gera Gatilhos Comerciais.
 */
const processarEvento = async ({ evento, agendamento, tenantId, cliente, origemViaPainel = false, extra = {} }) => {
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant?.configWhatsApp || !cliente?.telefone) return
    const timeZone = tenant.timezone || 'America/Sao_Paulo'

    if (evento === 'NPS' && tenant.npsAtivo === false) {
      return { sucesso: true, suprimido: true, motivo: 'NPS_DESABILITADO_NO_TENANT' }
    }
    const conversaMaisRecente = cliente?.id
      ? await banco.conversa.findFirst({
          where: { tenantId, clienteId: cliente.id, canal: 'WHATSAPP' },
          orderBy: { atualizadoEm: 'desc' },
          select: { id: true, status: true },
        })
      : null

    // Se a equipe encerrou a conversa no chat, não enviamos automações
    // até o cliente voltar e reabrir o atendimento.
    if (conversaMaisRecente?.status === 'ENCERRADA') {
      return { sucesso: true, suprimido: true, motivo: 'CONVERSA_ENCERRADA_PELA_EQUIPE' }
    }

    // Deduplicação do pós-atendimento:
    // quando o cliente conclui mais de um serviço no mesmo dia, envia apenas 1 mensagem.
    if (evento === 'CONCLUIR') {
      const ultimaMensagemConcluir = await banco.mensagem.findFirst({
        where: {
          remetente: 'sistema',
          conteudo: { startsWith: '[ORQ] CONCLUIR_ENVIADO' },
          conversa: { tenantId, clienteId: cliente.id },
        },
        orderBy: { criadoEm: 'desc' },
      })

      if (ultimaMensagemConcluir) {
        const dataEvento = agendamento?.concluidoEm || new Date()
        const diaEvento = new Date(dataEvento).toLocaleDateString('en-CA', { timeZone })
        const diaUltimoEnvio = new Date(ultimaMensagemConcluir.criadoEm).toLocaleDateString('en-CA', { timeZone })
        if (diaEvento === diaUltimoEnvio) {
          return { sucesso: true, suprimido: true, motivo: 'CONCLUIR_JA_ENVIADO_NO_DIA' }
        }
      }
    }

    // 1. Coleta de Contexto Rápido (Histórico)
    const ultimoAgendamento = await banco.agendamento.findFirst({
      where: { 
        clienteId: cliente.id, 
        tenantId, 
        id: { not: agendamento?.id || '0' },
        status: 'CONCLUIDO'
      },
      orderBy: { inicioEm: 'desc' },
      include: { servico: true }
    })

    let contextoFrequencia = 'Cliente novo ou sem histórico recente.'
    if (ultimoAgendamento && ultimoAgendamento.inicioEm) {
      const diasUltimaVisita = Math.floor((new Date() - ultimoAgendamento.inicioEm) / (1000 * 60 * 60 * 24))
      const servicoAnterior = ultimoAgendamento.servico?.nome || 'serviço'
      
      if (diasUltimaVisita > 60) {
        contextoFrequencia = `Cliente sumido. Última visita há ${diasUltimaVisita} dias (fez ${servicoAnterior}). Foco em reativação.`
      } else if (diasUltimaVisita <= 20) {
        contextoFrequencia = `Cliente muito fiel, vem com frequência alta. Última visita há ${diasUltimaVisita} dias (fez ${servicoAnterior}).`
      } else {
        contextoFrequencia = `Cliente regular. Última visita há ${diasUltimaVisita} dias (fez ${servicoAnterior}).`
      }
    }

    // 2. Coleta de Contexto de Agenda (Ocupação)
    const hoje = extra.dataReferencia ? new Date(extra.dataReferencia) : new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)

    const totalAgendamentosHoje = await banco.agendamento.count({
      where: { tenantId, inicioEm: { gte: hoje, lt: amanha }, status: { in: ['AGENDADO', 'CONFIRMADO'] } }
    })

    let contextoAgenda = 'Agenda com disponibilidade regular.'
    if (totalAgendamentosHoje > 15) {
      contextoAgenda = 'Agenda hoje está MUITO CHEIA. Use isso como gatilho de escassez leve.'
    } else if (totalAgendamentosHoje > 8) {
      contextoAgenda = 'Agenda hoje está com boa movimentação.'
    }

    const tom = tenant.tomDeVoz || 'DESCONTRALIDO'

    // 3. Montar Prompt Específico para o Evento
    const nomeBarbearia = tenant.nome || 'Barbearia'
    const linkAgendamento = `${process.env.APP_URL || 'https://app.barbermark.com.br'}/b/${tenant.hashPublico || tenant.slug}`
    const dataFmt = agendamento?.inicioEm
      ? new Date(agendamento.inicioEm).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone,
        })
      : ''
    const horaFmt = agendamento?.inicioEm
      ? new Date(agendamento.inicioEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        })
      : ''
    const dataHoraExtensoFmt = agendamento?.inicioEm
      ? new Date(agendamento.inicioEm).toLocaleString('pt-BR', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        })
      : ''
    const servicoNome = agendamento?.servico?.nome || 'atendimento'
    const profNome = agendamento?.profissional?.nome || 'nossa equipe'

    let prompt = `Você é Don, o cérebro comercial e concierge da barbearia ${nomeBarbearia}.\n`
    prompt += `Perfil: ${tom}. Regra: Fale como um humano sênior, sem clichês de robô. Curto, magnético e direto.\n`
    prompt += `Cliente: ${cliente.nome || '(não cadastrado)'}.\n`
    prompt += `Histórico: ${contextoFrequencia}.\n`
    prompt += `Contexto Agenda: ${contextoAgenda}.\n\n`
    const incluirLinkAgenda = tenant.iaIncluirLinkAgendamento !== false
    prompt += incluirLinkAgenda
      ? `DIRETRIZES: NUNCA use placeholders como [Nome]. Use o link padrão ${linkAgendamento} apenas quando fizer sentido vender ou facilitar o retorno.\n`
      : 'DIRETRIZES: NUNCA use placeholders como [Nome]. O salão desativou o envio do link público de agendamento pela IA: NUNCA inclua URLs do app, link da agenda online nem o texto "segue o link" convencional.\n'
    prompt += 'PORTUGUÊS: use português do Brasil, com acentuação e ortografia corretas (não, você, está, ainda, nós, por favor, obrigado).\n\n'

    switch (evento) {
      case 'CONFIRMAR':
        prompt += `EVENTO: Agendamento CONFIRMADO (${origemViaPainel ? 'pela equipe no painel' : 'pelo cliente'}).\n`
        if (extra?.confirmadoPor) {
          prompt += `Origem da confirmação: ${extra.confirmadoPor}.\n`
        }
        prompt += `Detalhes: ${servicoNome} com ${profNome} em ${dataFmt} às ${horaFmt}.\n`
        break;
      
      case 'CANCELAR':
        prompt += `EVENTO: Agendamento para ${dataFmt} às ${horaFmt} foi CANCELADO (origemPainel: ${origemViaPainel}).\n`
        break;

      case 'CONCLUIR':
        prompt += `EVENTO: Serviço (${servicoNome}) FINALIZADO agora.\n`
        break;

      case 'WALK_IN':
        prompt += `EVENTO: O cliente veio sem marcar (Walk-in) e acabou de finalizar.\n`
        break;

      case 'REMARCAR':
        prompt += `EVENTO: Agendamento remarcado (ex.: ajuste manual no app em +30 min ou outro horário). Novo horário OFICIAL: ${dataFmt} às ${horaFmt}.\n`
        prompt += `Serviço: ${servicoNome}. Profissional: ${profNome}.\n`
        prompt += 'REGRA: Mencione só essa data e hora, de forma clara. Não diga "daqui a 30 minutos" ou intervalos relativos, a não ser que coincidam exatamente com o horário acima. Não fale de "buffer" nem de adiar "os outros" agendamentos.\n'
        break

      case 'NAO_COMPARECEU':
        prompt += `EVENTO: O cliente faltou ao horário das ${horaFmt} e não avisou.\n`
        break;

      case 'CONFIRMAR_PRESENCA':
        prompt += `EVENTO: O cliente ACABOU DE CHEGAR na barbearia.\n`
        break;

      case 'RENOVACAO_PLANO':
        prompt += `EVENTO: O plano mensal de assinatura (${extra.planoNome}) foi renovado.\n`
        break;

      case 'ASSINATURA_NOVA':
        prompt += `EVENTO: O cliente acaba de aderir ao plano: ${extra.planoNome}.\n`
        prompt += `Detalhes: Benefícios: ${extra.resumoCreditos}.\n`
        break;

      case 'FILA_ESPERA':
        prompt += `EVENTO: Abrimos um horário (vaga) que o cliente queria na Fila de Espera!\n`
        prompt += `Vaga: ${dataFmt} às ${horaFmt} com ${profNome}.\n`
        prompt += 'Ação obrigatória: ofereça a vaga em formato de pergunta e peça confirmação explícita para encaixar. Nunca diga que já reservou.\n'
        break;
      case 'FILA_ESPERA_FIM_DIA':
        prompt += 'EVENTO: Encerramento do dia sem vaga para cliente da fila de espera.\n'
        prompt += 'Ação obrigatória: faça pergunta aberta para seguir o atendimento amanhã ou em outro dia, sem sugerir horários prontos.\n'
        break;

      case 'ANIVERSARIO':
        prompt += `EVENTO: É aniversário do cliente hoje! 🎉\n`
        prompt += `Benefício: ${extra.beneficio || 'Mimo especial'}.\n`
        break;

      case 'REATIVACAO':
        prompt += `EVENTO: Cliente sumido há mais de 60 dias.\n`
        break;

      case 'LEMBRETE':
        prompt += `EVENTO: Lembrete de agendamento em breve (${extra.tempoAntecedencia || '2h'}).\n`
        break;

      case 'AUTO_CANCELAMENTO':
        prompt += `EVENTO: Agendamento para ${dataFmt} às ${horaFmt} foi cancelado por FALTA DE CONFIRMAÇÃO.\n`
        break;

      case 'RETORNO_POS_SERVICO':
        prompt += `EVENTO: Lembrete de retorno após ${extra.dias} dias da última visita (${servicoNome}).\n`
        break;

      case 'NPS':
        prompt += `EVENTO: Pesquisa de satisfação pós-atendimento.\n`
        break;

      case 'FIDELIDADE_PONTOS':
        prompt += `EVENTO: O cliente acaba de ganhar ${extra.pontosGanhos} pontos!\n`
        prompt += `Saldo Atual: ${extra.saldoAtual} pontos.\n`
        prompt += `Meta: Faltam ${extra.pontosFaltantes} para ganhar ${extra.recompensa}.\n`
        break;

      case 'FIDELIDADE_RESGATE':
        prompt += `EVENTO: O cliente resgatou um prêmio: ${extra.recompensa}.\n`
        break;

      case 'COMANDA_RECIBO':
        prompt += `EVENTO: Envio de recibo digital após o pagamento.\n`
        prompt += `Resumo: ${extra.resumoFinanceiro}.\n`
        prompt += `Total: ${extra.total}.\n`
        break;

      case 'PEDIDO_NOVO_ADMIN':
        prompt += `EVENTO: Notificação para o DONO da barbearia sobre um novo pedido de delivery.\n`
        prompt += `Pedido: ${extra.resumoPedido}.\n`
        prompt += `Cliente: ${cliente.nome || '(não cadastrado)'}.\n`
        break;

      case 'PEDIDO_STATUS':
        prompt += `EVENTO: Atualização de status do pedido de delivery (${extra.status}).\n`
        break;

      case 'CANCELAR_PERIODO':
        prompt += `EVENTO: Cancelamento em massa por motivo administrativo (ex: barbeiro ausente).\n`
        prompt += `Agendamento: ${servicoNome} em ${dataFmt} às ${horaFmt}.\n`
        prompt += `Mensagem Personalizada do Dono: ${extra.motivoDono || 'Motivo de força maior'}.\n`
        break;

      case 'CAMPANHA_MARKETING':
        prompt += `EVENTO: Envio de campanha promocional ou aviso de novidade.\n`
        prompt += `Mensagem Base: ${extra.mensagemBase}.\n`
        break;

      case 'CHECK_IN':
        prompt += `EVENTO: O cliente acabou de fazer Check-in (confirmou presença pelo link/QR).\n`
        break;

      case 'ESTOQUE_BAIXO_ADMIN':
        prompt += `EVENTO: Alerta de estoque baixo para o administrador.\n`
        prompt += `Produto: ${extra.produtoNome}.\n`
        prompt += `Qtd Atual: ${extra.qtdAtual}.\n`
        break;

      case 'ENVIAR_LINK_AGENDA':
        prompt += `EVENTO: O administrador enviou manualmente o link de agendamento para o cliente.\n`
        prompt += `Ação: Convide-o calorosamente a marcar um horário e lembre que você (o Don) também pode ajudar por aqui.\n`
        break;

      case 'NOTIFICACAO_INTERNA':
        prompt += `EVENTO: Notificação interna para o PROFISSIONAL ou ADMIN.\n`
        prompt += `Contexto: ${extra.contexto}.\n`
        prompt += `Ação: Seja profissional, direto e informativo. Informe o que aconteceu.\n`
        break;

      case 'BEM_VINDO':
        prompt += `EVENTO: O cliente ACABA DE SER CADASTRADO manualmente no sistema pela recepção.\n`
        prompt += incluirLinkAgenda
          ? `Ação: Dê as boas-vindas oficiais, apresente-se como o conciliador digital da barbearia e convide-o a conhecer a facilidade de agendar por aqui ou pelo link.\n`
          : 'Ação: Dê as boas-vindas oficiais, apresente-se como o conciliador digital da barbearia e convide a agendar por aqui no WhatsApp (o salão desativou o link público pela IA).\n'
        break

      default:
        return;
    }

    // 4. IA gera o texto (mesmo modelo da recepcionista no chat: Claude Sonnet; fallback: OpenAI)
    const systemOrchestrator = 'Você escreve mensagens de WhatsApp para clientes de barbearia. Curto, natural, em português do Brasil, com acentos corretos. Sem título, sem "Prezado cliente".'

    let textoResposta
    if (evento === 'FILA_ESPERA' && agendamento?.inicioEm) {
      const primeiroNome = String(cliente?.nome || '').trim().split(/\s+/)[0]
      const saudacao = primeiroNome && primeiroNome.toLowerCase() !== 'cliente' ? `Oi, ${primeiroNome}!` : 'Oi!'
      textoResposta = `${saudacao} Abrimos uma vaga que você estava esperando.\n${dataHoraExtensoFmt} com ${profNome}.\nSe quiser, eu te encaixo nesse horário.`
    } else if (evento === 'FILA_ESPERA_FIM_DIA') {
      const primeiroNome = String(cliente?.nome || '').trim().split(/\s+/)[0]
      const saudacao = primeiroNome && primeiroNome.toLowerCase() !== 'cliente' ? `Oi, ${primeiroNome}!` : 'Oi!'
      const servico = extra?.servicoNome || servicoNome || 'o atendimento'
      textoResposta = `${saudacao} Hoje não abriu vaga para ${servico}.\nQuer tentar amanhã ou prefere outro dia?\nSe já tiver um horário em mente, me fala que eu verifico para você.`
    } else if (evento === 'RETORNO_POS_SERVICO' && tenant.mensagemRetorno && String(tenant.mensagemRetorno).trim()) {
      const { preencherPlaceholders } = require('../../utils/mensagensDonTemplates')
      const primeiroNome = (cliente.nome || '').split(' ')[0]
      const nomeValido = primeiroNome && primeiroNome.toLowerCase() !== 'cliente' ? primeiroNome : ''
      textoResposta = preencherPlaceholders(tenant.mensagemRetorno, {
        nome: nomeValido,
        servico: servicoNome,
        dias: String(extra.dias != null ? extra.dias : ''),
        salao: nomeBarbearia,
        data: dataFmt,
        hora: horaFmt,
      })
    } else if (evento === 'AUTO_CANCELAMENTO') {
      const primeiroNome = String(cliente?.nome || '').trim().split(/\s+/)[0]
      const saudacao = primeiroNome && primeiroNome.toLowerCase() !== 'cliente' ? `Oi, ${primeiroNome}!` : 'Oi!'
      const horarioExtenso = dataFmt && horaFmt
        ? `${dataFmt} às ${horaFmt}`
        : (dataHoraExtensoFmt || 'o horário combinado')
      textoResposta = incluirLinkAgenda
        ? `${saudacao} Tudo bem?\nSeu horário de ${horarioExtenso} foi cancelado porque não recebemos a confirmação a tempo.\nSe quiser remarcar, é só acessar ${linkAgendamento}`
        : `${saudacao} Tudo bem?\nSeu horário de ${horarioExtenso} foi cancelado porque não recebemos a confirmação a tempo.\nSe quiser, me chama aqui que eu te ajudo a remarcar.`
    } else if (anthropic) {
      try {
        const msg = await anthropic.messages.create({
          model: configIA.modeloAnthropic || 'claude-sonnet-4-6',
          max_tokens: 400,
          temperature: 0.45,
          system: systemOrchestrator,
          messages: [{ role: 'user', content: prompt }],
        })
        const bloco = msg.content?.find((b) => b.type === 'text')
        textoResposta = typeof bloco?.text === 'string' ? bloco.text.trim() : ''
      } catch (e) {
        console.warn('[MessageOrchestrator] Anthropic falhou, tentando OpenAI:', e?.message || e)
      }
    }
    if (!textoResposta && configIA.apiKey) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `${systemOrchestrator}\n\n${prompt}` },
        ],
        temperature: 0.55,
        max_tokens: 350,
      })
      textoResposta = completion.choices[0]?.message?.content?.trim()
    }
    if (!textoResposta && evento === 'REMARCAR' && agendamento?.inicioEm) {
      textoResposta = `Ei! Teu horário foi ajustado: ${dataFmt} às ${horaFmt} (${servicoNome} com ${profNome}). Até lá!`
    }
    if (!textoResposta) return
    textoResposta = limparMarkdownWhatsapp(textoResposta)

    // 5. Orquestração de Canal (Interactive vs Audio vs Texto)
    const premiumAudioEvents = ['WALK_IN', 'CONCLUIR', 'RENOVACAO_PLANO', 'CONFIRMAR_PRESENCA', 'ANIVERSARIO', 'REATIVACAO', 'RETORNO_POS_SERVICO', 'FIDELIDADE_RESGATE', 'FIDELIDADE_PONTOS', 'CHECK_IN', 'ASSINATURA_NOVA', 'ENVIAR_LINK_AGENDA']
    const interactiveEvents = ['BEM_VINDO']
    const isInternal = ['PEDIDO_NOVO_ADMIN', 'ESTOQUE_BAIXO_ADMIN', 'NOTIFICACAO_INTERNA'].includes(evento)
    
    let mensagemEnviada = false
    const telNorm = cliente.telefone.replace(/\D/g, '')
    const telEnvio = telNorm.startsWith('55') && telNorm.length >= 12 ? telNorm : `55${telNorm}`
    const destinoFinal = extra.destinoDireto || telEnvio

    // interactive menu (prioridade máxima para boas vindas)
    if (interactiveEvents.includes(evento)) {
      try {
        const payload = {
          type: 'button',
          body: { text: textoResposta.slice(0, 1024) },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'AGENDAR', title: 'Agendar agora' } },
              { type: 'reply', reply: { id: 'VER_SERVICOS', title: 'Serviços' } },
            ],
          },
        }
        await whatsappServico.enviarMensagemInterativa(tenant.configWhatsApp, destinoFinal, payload, tenantId)
        mensagemEnviada = true
      } catch (errInter) {
        console.warn('[Orchestrator] Falha Interactive, fallback para texto.', errInter.message)
      }
    }

    // audio (premium events)
    if (!mensagemEnviada && premiumAudioEvents.includes(evento) && tenant.vozAtiva !== false && !isInternal) {
      try {
        const audioData = await vozServico.sintetizarAudio(textoResposta, { estilo: 'caloroso' })
        if (audioData?.buffer) {
          await whatsappServico.enviarAudio(tenant.configWhatsApp, destinoFinal, audioData.buffer, tenantId)
          mensagemEnviada = true
        }
      } catch (errAudio) {
        console.warn('[Orchestrator] Falha TTS, fallback para texto.', errAudio.message)
      }
    }

    // final fallback (texto puro)
    if (!mensagemEnviada) {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, destinoFinal, textoResposta, tenantId)
    }

    // 6. Log de Conversa
    if (!isInternal) {
      try {
        const conversa = conversaMaisRecente || await banco.conversa.create({
          data: { tenantId, clienteId: cliente.id, canal: 'WHATSAPP', status: 'ATIVA' },
          select: { id: true },
        })
        await banco.mensagem.create({
          data: { 
            conversaId: conversa.id, 
            remetente: 'ia', 
            conteudo: (mensagemEnviada && premiumAudioEvents.includes(evento) ? `[Áudio] ${textoResposta}` : textoResposta) 
          },
        })
        if (evento === 'CONCLUIR') {
          await banco.mensagem.create({
            data: {
              conversaId: conversa.id,
              remetente: 'sistema',
              conteudo: `[ORQ] CONCLUIR_ENVIADO ${new Date().toISOString()} agendamento=${agendamento?.id || 'n/a'}`,
            },
          })
        }
        await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
      } catch (errConversa) {
          console.warn('[Orchestrator] Erro ao salvar log:', errConversa.message)
      }
    }

    return { sucesso: true, texto: textoResposta, enviado: true }

  } catch (err) {
    console.error(`[MessageOrchestrator] Erro no evento ${evento}:`, err.message)
  }
}

module.exports = {
  processarEvento
}

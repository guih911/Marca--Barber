const { OpenAI } = require('openai')
const configIA = require('../../config/ia')
const whatsappServico = require('./whatsapp.servico')
const banco = require('../../config/banco')
const vozServico = require('./voz.servico')

// Decide whether to use OpenAI or Anthropic depending on env, but we'll stick to OpenAI since it handles context well
const openai = new OpenAI({ apiKey: configIA.apiKey || process.env.OPENAI_API_KEY, baseURL: configIA.baseURL })

/**
 * messageOrchestrator
 * O Cérebro Central para disparar mensagens baseadas em evento.
 * Decide Tom de Voz, Usa Histórico e Gera Gatilhos Comerciais.
 */
const processarEvento = async ({ evento, agendamento, tenantId, cliente, origemViaPainel = false }) => {
  try {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant?.configWhatsApp || !cliente?.telefone) return

    // 1. Coleta de Contexto Rápido
    const ultimoAgendamento = await banco.agendamento.findFirst({
      where: { 
        clienteId: cliente.id, 
        tenantId, 
        id: { not: agendamento?.id || '0' },
        status: { in: ['CONCLUIDO', 'CONFIRMADO'] }
      },
      orderBy: { inicioEm: 'desc' }
    })

    let contextoFrequencia = 'Cliente comum.'
    if (ultimoAgendamento && ultimoAgendamento.inicioEm) {
      const diasUltimaVisita = Math.floor((new Date() - ultimoAgendamento.inicioEm) / (1000 * 60 * 60 * 24))
      if (diasUltimaVisita > 45) {
        contextoFrequencia = `Cliente sumido. Última visita há ${diasUltimaVisita} dias.`
      } else if (diasUltimaVisita <= 15) {
        contextoFrequencia = `Cliente muito fiel, vem com frequência. Última visita há ${diasUltimaVisita} dias.`
      } else {
        contextoFrequencia = `Cliente regular. Última visita há ${diasUltimaVisita} dias.`
      }
    } else {
      contextoFrequencia = 'Cliente novo ou sem histórico recente.'
    }

    const perfis = ['CONCIERGE PREMIUM', 'BARBEIRO DE CONFIANÇA', 'CONSULTOR DE IMAGEM']
    const tom = perfis[Math.floor(Math.random() * perfis.length)] // Pode ser extraído da Tenant

    // 2. Montar Prompt Específico para o Evento
    const nomeBarbearia = tenant.nome || 'Barbearia'
    const linkAgendamento = `${process.env.APP_URL || 'https://app.marcai.com.br'}/b/${tenant.hashPublico || tenant.slug}`
    const dataFmt = agendamento?.inicioEm ? new Date(agendamento.inicioEm).toLocaleDateString('pt-BR') : ''
    const horaFmt = agendamento?.inicioEm ? new Date(agendamento.inicioEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
    const servicoNome = agendamento?.servico?.nome || 'atendimento'
    const profNome = agendamento?.profissional?.nome || 'nossa equipe'

    let prompt = `Você é Don, um assistente virtual/vendedor nível Sênior da barbearia ${nomeBarbearia}.\n`
    prompt += `Tom de voz: ${tom}.\n`
    prompt += `Nome do cliente: ${cliente.nome}.\n`
    prompt += `Histórico: ${contextoFrequencia}.\n\n`
    prompt += `DIRETRIZES GERAIS: NUNCA USE PLACEHOLDERS como [Nome]. Seja natural, escreva como um humano no WhatsApp. Mantenha curto e magnético.\n\n`

    switch (evento) {
      case 'CONFIRMAR':
        prompt += `O cliente acabou de ter um agendamento CRIADO COM SUCESSO para o dia ${dataFmt} às ${horaFmt} para ${servicoNome} com ${profNome}.\n`
        prompt += `Escreva uma mensagem premium confirmando. Se for um cliente regular, seja leve. Se for cliente novo, acolha. Sempre inclua o link padrão de agendamento (${linkAgendamento}) para facilitar futuras reservas.`
        break;
      
      case 'CANCELAR':
        prompt += `O agendamento do cliente para ${dataFmt} às ${horaFmt} foi CANCELADO (origemPainel: ${origemViaPainel}).\n`
        prompt += `Reaja naturalmente ao cancelamento. Mostre que está tudo bem e que a agenda está disponível caso queira remarcar depois pelo link: ${linkAgendamento}. Não seja robótico.`
        break;

      case 'CONCLUIR':
        prompt += `O cliente acabou de finalizar o serviço (${servicoNome}) presencialmente.\n`
        prompt += `Agradeça a visita hoje. Use inteligência comercial para sugerir indiretamente o retorno ideal (ex.: 'qualquer coisa já sabe onde marcar manutenção'). Link: ${linkAgendamento}.`
        break;

      case 'WALK_IN':
        prompt += `O cliente fez o serviço (${servicoNome}) presencialmente hoje sem agendar antes (Walk-in).\n`
        prompt += `Agradeça a presença. O foco aqui é educar o cliente para que da próxima vez ele agende sozinho pelo link ${linkAgendamento} e não pegue fila.`
        break;

      case 'REMARCAR':
        prompt += `O agendamento do cliente mudou. Novo horário: ${dataFmt} às ${horaFmt} para ${servicoNome} com ${profNome}.\n`
        prompt += `Confirme a mudança de forma fluida. Sem burocracia.`
        break;

      default:
        return;
    }

    // 3. IA Gera o Texto (Contextual, dinâmico)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
    })

    const textoResposta = completion.choices[0]?.message?.content?.trim()
    if (!textoResposta) return

    // 4. Decide se manda Audio (apenas um exemplo: podemos mandar audio 10% das vezes ou flag)
    // Para 10/10: se for concluído, talvez mande um audio do TTS?
    const mandarAudio = evento === 'WALK_IN' || evento === 'CONCLUIR'; 
    let audioEnviado = false;

    const telNorm = cliente.telefone.replace(/\D/g, '')
    const telEnvio = telNorm.startsWith('55') && telNorm.length >= 12 ? telNorm : `55${telNorm}`

    if (mandarAudio && tenant.vozAtiva !== false) { // Se a feature estiver false desativa
      try {
        const audioData = await vozServico.sintetizarAudio(textoResposta, { estilo: 'caloroso' });
        if (audioData?.buffer) {
          await whatsappServico.enviarAudio(tenant.configWhatsApp, telEnvio, audioData.buffer, tenantId);
          audioEnviado = true;
        }
      } catch (errAudio) {
        console.warn('[Orchestrator] Falha ao sintetizar/enviar audio TTS, degradando para texto.', errAudio.message)
      }
    }

    // 5. Fallback/Envio Texto
    if (!audioEnviado) {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, telEnvio, textoResposta, tenantId)
    }

    // 6. Salvar no histórico de conversa
    try {
      const conversasServico = require('../conversas/conversas.servico')
      const conversa = await conversasServico.buscarOuCriarConversa(tenantId, cliente.id, 'WHATSAPP')
      await banco.mensagem.createMany({
        data: [
          { conversaId: conversa.id, remetente: 'ia', conteudo: (audioEnviado ? `[Áudio] ${textoResposta}` : textoResposta) },
        ],
      })
      await banco.conversa.update({ where: { id: conversa.id }, data: { atualizadoEm: new Date() } })
    } catch (errConversa) {
        console.warn('[Orchestrator] Erro ao salvar log na conversa:', errConversa.message)
    }

    return { sucesso: true, texto: textoResposta }

  } catch (err) {
    console.error(`[MessageOrchestrator] Erro fatal no evento ${evento} para o cliente ${cliente?.id}:`, err.message)
  }
}

module.exports = {
  processarEvento
}

const banco = require('../../config/banco')
const erroTemCampoLidWhatsapp = (erro) => String(erro?.message || erro || '').includes('lidWhatsapp')

const PERFIS_TESTE = {
  NOVO_LEAD: {
    id: 'NOVO_LEAD',
    label: 'Novo lead',
    telefone: '+5511900000001',
    nome: '',
    lidWhatsapp: null,
  },
  LEAD_LID: {
    id: 'LEAD_LID',
    label: 'Lead com LID',
    telefone: '120363267180894554',
    nome: '',
    lidWhatsapp: '120363267180894554',
  },
  CLIENTE_CONHECIDO: {
    id: 'CLIENTE_CONHECIDO',
    label: 'Cliente conhecido',
    telefone: '+5511900000002',
    nome: 'Matheus',
    lidWhatsapp: null,
  },
  BARBEIRO_AVALIANDO: {
    id: 'BARBEIRO_AVALIANDO',
    label: 'Barbeiro avaliando',
    telefone: '+5511900000003',
    nome: 'Carlos',
    lidWhatsapp: null,
  },
}

const CENARIOS_WHATSAPP_BR = [
  // ── G1: Primeiros contatos ───────────────────────────────────────────────
  {
    nome: 'lead_lid_urgente',
    perfil: 'LEAD_LID',
    passos: ['oi', 'Matheus', 'quero um corte para hoje ainda'],
    tags: ['sem_telefone_cedo', 'sem_link_cedo', 'urgencia'],
  },
  {
    nome: 'nome_solto_sem_vagueza',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Matheus'],
    tags: ['sem_vagueza_pos_nome'],
  },
  {
    nome: 'lead_sem_nome_pedindo_horario',
    perfil: 'NOVO_LEAD',
    passos: ['quero um corte hoje ainda', 'Matheus', 'mais pro fim do dia tem?'],
    tags: ['sem_link_cedo', 'urgencia'],
  },
  {
    nome: 'agenda_premium_sem_link_jogado',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['quero agendar um corte hoje às 15h'],
    tags: ['urgencia', 'premium_consultivo', 'sem_link_cedo'],
  },
  {
    nome: 'cliente_estressado',
    perfil: 'NOVO_LEAD',
    passos: ['mano responde ai tem horario hj ou n', 'Matheus', 'depois das 18'],
    tags: ['urgencia'],
  },
  {
    nome: 'mensagens_picadas',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Matheus', 'corte', 'hj', '17h'],
    tags: ['urgencia'],
  },
  // ── G2: Preço e objeção comercial ────────────────────────────────────────
  {
    nome: 'preco_combo_objecao',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Matheus', 'quanto fica corte e barba?', 'ta caro', 'tem algo melhor?'],
    tags: ['preco'],
  },
  {
    nome: 'preco_servico_simples_caro',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Pedro', 'quanto custa o corte?', 'nossa, ta caro isso'],
    tags: ['preco'],
  },
  {
    nome: 'pedido_desconto',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Joao', 'tem desconto pra hoje?'],
    tags: [],
  },
  // ── G3: Agendamento ──────────────────────────────────────────────────────
  {
    nome: 'estrutura_pagamento_e_agenda',
    perfil: 'NOVO_LEAD',
    passos: ['aceita cartao? e tem horario amanha pra corte?'],
    tags: ['objetivo_direto'],
  },
  {
    nome: 'agendamento_semana_que_vem',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Felipe', 'preciso de um corte na semana que vem', 'pode ser segunda ou terca'],
    tags: ['urgencia'],
  },
  {
    nome: 'agendamento_outra_pessoa',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Carlos', 'quero agendar um corte pro meu filho'],
    tags: [],
  },
  {
    nome: 'rejeicao_multiplos_slots',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Bruno', 'corte amanha', 'nao posso de manha, tem a tarde?', 'esse horario nao da, outro?'],
    tags: ['urgencia'],
  },
  // ── G4: NPS e feedback ───────────────────────────────────────────────────
  // Aquecimento: "oi" estabelece contexto (primeiroContato=false no T2), então dígito NPS é reconhecido
  {
    nome: 'nps_nota_5_positiva',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['oi', '5'],
    tags: [],
  },
  {
    nome: 'nps_nota_1_escalona',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['oi', '1'],
    tags: ['escalacao'],
  },
  {
    nome: 'nps_nota_3_neutro',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['oi', '3'],
    tags: [],
  },
  // ── G5: Mídia (áudio, figurinha, doc) ────────────────────────────────────
  {
    nome: 'audio_sem_texto',
    perfil: 'NOVO_LEAD',
    passos: ['[ÁUDIO]'],
    tags: ['midia'],
  },
  {
    nome: 'figurinha_enviada',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['[FIGURINHA]'],
    tags: ['midia'],
  },
  {
    nome: 'figurinha_recusa_encerramento',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['[FIGURINHA]', 'n vlw'],
    tags: ['midia', 'encerramento_limpo'],
  },
  {
    nome: 'documento_enviado',
    perfil: 'NOVO_LEAD',
    passos: ['[DOCUMENTO]'],
    tags: ['midia'],
  },
  // ── G6: CAPS LOCK / frustração ───────────────────────────────────────────
  {
    nome: 'caps_urgencia',
    perfil: 'NOVO_LEAD',
    passos: ['TEM HORARIO HOJE OU NAO TEM', 'Rodrigo'],
    tags: ['caps'],
  },
  {
    nome: 'caps_reclamacao',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['QUERO CANCELAR MINHA CONSULTA AGORA'],
    tags: ['caps'],
  },
  {
    nome: 'cliente_impaciente',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Lucas', 'ja perguntei isso antes nao e?', 'corte hoje, simples assim'],
    tags: ['urgencia'],
  },
  // ── G7: Cancelamento e remarcação ────────────────────────────────────────
  {
    nome: 'cancelar_com_remarcacao',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['preciso cancelar meu corte de amanha', 'consegue outro dia pra corte?', 'pode ser depois de amanha'],
    tags: [],
  },
  {
    nome: 'remarcar_horario',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['quero remarcar meu agendamento pra outra data'],
    tags: [],
  },
  {
    nome: 'mantem_agendamento',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['cancelar meu corte de amanha', 'na verdade vou manter'],
    tags: [],
  },
  // ── G8: Reclamações e escalamento ────────────────────────────────────────
  {
    nome: 'reclamacao_grave_atendimento',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['fui atendido pessimamente, quero falar com o dono'],
    tags: ['escalacao'],
  },
  {
    nome: 'pedido_humano',
    perfil: 'NOVO_LEAD',
    passos: ['quero falar com humano'],
    tags: ['escalacao'],
  },
  {
    nome: 'mensagem_incompreensivel',
    perfil: 'NOVO_LEAD',
    passos: ['asdfjkl; xyz 123 !!!'],
    tags: [],
  },
  // ── G9: FAQ e informações ────────────────────────────────────────────────
  {
    nome: 'localizacao_e_pagamento',
    perfil: 'NOVO_LEAD',
    passos: ['onde voces ficam? aceita pix?'],
    tags: ['objetivo_direto'],
  },
  {
    nome: 'corte_infantil',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Ana', 'faz corte infantil?'],
    tags: [],
  },
  {
    nome: 'produto_barba',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['tem produto pra barba?'],
    tags: [],
  },
  {
    nome: 'plano_mensal_existente',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['tem plano mensal?'],
    tags: [],
  },
  {
    nome: 'combo_existente',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['tem combo ou pacote?'],
    tags: [],
  },
  {
    nome: 'fidelidade_pontos',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['tenho pontos de fidelidade?'],
    tags: [],
  },
  // ── G10: Serviços e consulta ─────────────────────────────────────────────
  {
    nome: 'pede_link_agenda',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['me manda o link da agenda pra eu ver sozinho'],
    tags: ['link_agenda'],
  },
  {
    nome: 'consultoria_complementar_servico',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['vou fazer um corte pra um casamento, o que combina junto?'],
    tags: ['consultoria_servico'],
  },
  {
    nome: 'recusa_sem_insistencia',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['nao, so o corte mesmo'],
    tags: ['sem_insistencia'],
  },
  // ── G11: Identidade e modo barbeiro ─────────────────────────────────────
  {
    nome: 'identidade_ia',
    perfil: 'NOVO_LEAD',
    passos: ['voce e ia mesmo?'],
    tags: ['identidade'],
  },
  {
    nome: 'barbeiro_demo',
    perfil: 'BARBEIRO_AVALIANDO',
    passos: ['sou barbeiro e to avaliando o sistema pra minha barbearia'],
    tags: ['modo_barbeiro'],
  },
  // ── G12: Edge cases ──────────────────────────────────────────────────────
  {
    nome: 'tchau_encerrar',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['vlw', 'tchau'],
    tags: [],
  },
  {
    nome: 'pergunta_fora_contexto',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Gabriel', 'qual o melhor shampoo pra cabelo?'],
    tags: [],
  },
  {
    nome: 'numero_como_nome',
    perfil: 'NOVO_LEAD',
    passos: ['oi', '12345'],
    tags: [],
  },
  // ── G13: Confirmação de slot ─────────────────────────────────────────────
  {
    nome: 'confirmacao_slot_sim',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Diego', 'quero um corte amanha', 'sim, fecha ai'],
    tags: [],
  },
  {
    nome: 'confirmacao_slot_nao',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Renato', 'corte segunda', 'nao, esse nao serve, outro?'],
    tags: [],
  },
  // ── G14: Horários e data específica ──────────────────────────────────────
  {
    nome: 'horario_especifico_pedido',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Vitor', 'tem horario pra corte amanha as 15h?'],
    tags: [],
  },
  {
    nome: 'data_especifica_pedido',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Rafael', 'quero agendar corte pro dia 5'],
    tags: [],
  },
  {
    nome: 'horario_funcionamento',
    perfil: 'NOVO_LEAD',
    passos: ['qual o horario de voces?'],
    tags: [],
  },
  // ── G15: Multi-serviço (combo 3) ─────────────────────────────────────────
  {
    nome: 'combo_tres_servicos',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Henrique', 'quero corte, barba e sobrancelha'],
    tags: [],
  },
  // ── G16: Preços individuais ───────────────────────────────────────────────
  {
    nome: 'preco_servico_individual',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Marco', 'quanto custa a sobrancelha?'],
    tags: ['preco'],
  },
  {
    nome: 'comparar_precos',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Julio', 'qual e o servico mais barato de voces?'],
    tags: [],
  },
  // ── G17: Fidelidade ──────────────────────────────────────────────────────
  {
    nome: 'fidelidade_como_funciona',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['como funciona o programa de fidelidade?'],
    tags: [],
  },
  // ── G18: Cancelamento determinístico ─────────────────────────────────────
  {
    nome: 'cancelar_com_motivo',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['preciso cancelar, tive um compromisso de ultima hora'],
    tags: [],
  },
  // ── G19: Saudações variadas ───────────────────────────────────────────────
  {
    nome: 'saudacao_bom_dia',
    perfil: 'NOVO_LEAD',
    passos: ['bom dia, tudo bem?'],
    tags: [],
  },
  {
    nome: 'urgencia_agora',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Igor', 'preciso de um corte urgente'],
    tags: ['urgencia'],
  },
  // ── G20: Respostas inteligentes ───────────────────────────────────────────
  {
    nome: 'encerrar_sem_agendar',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Alex', 'vou pensar e te aviso depois'],
    tags: [],
  },
  {
    nome: 'multiplas_perguntas',
    perfil: 'NOVO_LEAD',
    passos: ['aceita pix, fica onde, e faz barba?'],
    tags: ['objetivo_direto'],
  },
  {
    nome: 'preferencia_qualquer_dia',
    perfil: 'NOVO_LEAD',
    passos: ['oi', 'Samuel', 'pode ser qualquer dia pra corte'],
    tags: [],
  },
  {
    nome: 'confirmacao_via_lembrete',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['confirmo meu horario'],
    tags: [],
  },
  {
    nome: 'unificar_combo_mesmo_dia',
    perfil: 'CLIENTE_CONHECIDO',
    passos: ['quero agendar um corte hoje às 17h', 'sim', 'quero agendar barba amanhã às 12:30', 'sim', 'da para fazer tudo no mesmo dia?', 'pode ser tudo hoje entao'],
    tags: ['combo_contextual'],
  },
  {
    nome: 'duracao_servico',
    perfil: 'NOVO_LEAD',
    passos: ['quanto tempo leva um corte?'],
    tags: [],
  },
]

const FRASES_ROBOTICAS = [
  'se precisar de mais alguma coisa',
  'por favor, selecione uma das opcoes',
  'infelizmente nao ha disponibilidade',
  'estou a sua disposicao',
]

const normalizarTexto = (texto = '') =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s:/?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

const temIntencaoObjetiva = (textoNormalizado = '') => (
  /\b(corte|barba|combo|degrade|agendar|agenda|horario|horarios|hora|vaga|preco|valor|quanto|cancelar|remarcar|plano|produto|cartao|pix|amanha|hoje|hj)\b/.test(textoNormalizado)
)

const contarLinhasVisiveis = (texto = '') =>
  String(texto || '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .length

const analisarResposta = ({ cenario, ultimaMensagemCliente, resposta, mensagemProativa, passoIndex }) => {
  const alertas = []
  // Considera mensagemProativa como resposta válida (card de boas-vindas)
  const respostaEfetiva = resposta || mensagemProativa || ''
  const respostaNorm = normalizarTexto(respostaEfetiva)
  const clienteNorm = normalizarTexto(ultimaMensagemCliente)
  const linhas = contarLinhasVisiveis(respostaEfetiva)
  const clienteTrouxeIntencao = temIntencaoObjetiva(clienteNorm)

  if (!respostaNorm) alertas.push('sem_resposta')
  if (linhas > 7) alertas.push('mensagem_longa')

  const linhasNormalizadas = String(respostaEfetiva || '')
    .split('\n')
    .map((linha) => normalizarTexto(linha))
    .filter((linha) => linha && linha.length > 8)
  const linhasDuplicadas = linhasNormalizadas.filter((linha, index) => linhasNormalizadas.indexOf(linha) !== index)
  if (linhasDuplicadas.length > 0) {
    alertas.push('mensagem_duplicada')
  }

  if (FRASES_ROBOTICAS.some((frase) => respostaNorm.includes(frase))) {
    alertas.push('frase_robotica')
  }

  if (
    clienteTrouxeIntencao
    && /como posso te ajudar|como posso ajudar|o que voce quer fazer hoje/.test(respostaNorm)
  ) {
    alertas.push('pergunta_desnecessaria')
  }

  if (
    clienteTrouxeIntencao
    && /oi pode repetir|nao captei bem|manda de novo|tive um probleminha/.test(respostaNorm)
  ) {
    alertas.push('fallback_intencao_clara')
  }

  if (
    cenario.tags.includes('sem_vagueza_pos_nome')
    && passoIndex >= 1
    && /como posso te ajudar|como posso ajudar|o que voce quer fazer hoje|quer dar um trato/.test(respostaNorm)
  ) {
    alertas.push('resposta_vaga_apos_nome')
  }

  if (
    cenario.tags.includes('sem_telefone_cedo')
    && passoIndex < 2
    && /\b(whatsapp|ddd)\b/.test(respostaNorm)
  ) {
    alertas.push('pediu_telefone_cedo')
  }

  if (
    cenario.tags.includes('sem_link_cedo')
    && passoIndex < 2
    && /app marcai|marcai com br|https?:\/\/|\/b\//.test(respostaNorm)
  ) {
    alertas.push('mandou_link_cedo')
  }

  if (
    cenario.tags.includes('urgencia')
    && /\b(hoje|hj|agora|ainda)\b/.test(clienteNorm)
    && !/\b(hoje|vaga|as |lotado|disputada|sem vaga|horario)\b/.test(respostaNorm)
  ) {
    alertas.push('nao_reconheceu_urgencia')
  }

  if (
    cenario.tags.includes('preco')
    && /\b(quanto|preco|valor|caro)\b/.test(clienteNorm)
    && !/\br\$/i.test(resposta)
    && !/\b(combo|pacote|mais em conta|valor)\b/.test(respostaNorm)
  ) {
    alertas.push('nao_tratou_preco')
  }

  if (
    cenario.tags.includes('link_agenda')
    && !/https?:\/\/|\/b\//.test(resposta)
  ) {
    alertas.push('nao_mandou_link_agenda')
  }

  if (
    cenario.tags.includes('objetivo_direto')
    && /\b(cartao|cartao de credito|cartao de debito|credito|debito|pix|dinheiro)\b/.test(clienteNorm)
    && !/\b(cartao|credito|debito|pix|dinheiro)\b/.test(respostaNorm)
  ) {
    alertas.push('nao_respondeu_pagamento')
  }

  if (
    cenario.tags.includes('produto_inexistente')
    && /\b(produto|pomada|oleo|óleo|balm|cera|kit)\b/.test(respostaNorm)
    && !/\b(nao temos|não temos|no momento nao temos|no momento não temos|confirma com a equipe)\b/.test(respostaNorm)
  ) {
    alertas.push('inventou_produto')
  }

  if (
    cenario.tags.includes('produto_inexistente')
    && /\b(que pena ouvir isso|conectar com a equipe|vou te conectar)\b/.test(respostaNorm)
  ) {
    alertas.push('produto_mal_interpretado')
  }

  if (
    cenario.tags.includes('combo_inexistente')
    && /\b(combo|pacote)\b/.test(respostaNorm)
    && !/\b(nao temos|não temos|sem combo cadastrado|no momento nao temos|no momento não temos|avulso|separado)\b/.test(respostaNorm)
  ) {
    alertas.push('inventou_combo')
  }

  if (
    cenario.tags.includes('plano_inexistente')
    && /\b(plano|mensal|assinatura)\b/.test(respostaNorm)
    && !/\b(nao temos|não temos|no momento nao temos|no momento não temos|confirma com a equipe)\b/.test(respostaNorm)
  ) {
    alertas.push('inventou_plano')
  }

  if (
    cenario.tags.includes('consultoria_servico')
    && /\b(indica|combina|compensa|recomenda)\b/.test(clienteNorm)
    && !/\b(barba|sobrancel|acabamento|pezinho|finaliz)\b/.test(respostaNorm)
  ) {
    alertas.push('consultoria_fraca')
  }

  if (
    cenario.tags.includes('premium_consultivo')
    && !/\b(tenho|consigo|boa|fechado|perfeito|ja vejo|já vejo|deixo reservado|com o)\b/.test(respostaNorm)
  ) {
    alertas.push('postura_premium_fraca')
  }

  if (
    cenario.tags.includes('premium_consultivo')
    && /\b(voce pode agendar pelo link|segue o link|escolher sozinho|\/b\/|https?:\/\/)\b/.test(respostaNorm)
  ) {
    alertas.push('link_jogado_sem_estrategia')
  }

  if (
    cenario.tags.includes('encerramento_limpo')
    && /\b(pode repetir|manda de novo|como posso ajudar)\b/.test(respostaNorm)
  ) {
    alertas.push('encerramento_reaberto')
  }

  if (
    cenario.tags.includes('combo_contextual')
    && /\b(tudo|mesmo dia|os dois)\b/.test(clienteNorm)
    && !/\b(corte|barba|combo|os dois)\b/.test(respostaNorm)
  ) {
    alertas.push('combo_contexto_ignorado')
  }

  if (
    cenario.tags.includes('combo_contextual')
    && /\b(tudo|mesmo dia|os dois)\b/.test(clienteNorm)
    && /✅/.test(resposta)
    && !/\b(corte\b.*\bbarba|\bbarba\b.*\bcorte|combo|os dois)\b/.test(respostaNorm)
  ) {
    alertas.push('combo_fragmentado')
  }

  if (
    cenario.tags.includes('sem_insistencia')
    && /\b(so isso|so o corte|só isso|só o corte|nao precisa|não precisa|deixa assim|ta bom assim)\b/.test(clienteNorm)
    && /\b(barba|sobrancel|acabamento|pomada|oleo|óleo|balm|plano|pacote|combo|fidelidade)\b/.test(respostaNorm)
  ) {
    alertas.push('insistiu_venda')
  }

  if (
    cenario.tags.includes('identidade')
    && !/\b(assistente|ia|virtual|don)\b/.test(respostaNorm)
  ) {
    alertas.push('identidade_opaca')
  }

  if (
    cenario.tags.includes('modo_barbeiro')
    && (/\b(como voce prefere ser chamado|corte|barba|agendar)\b/.test(respostaNorm) || /[👋✂💈✅]/.test(resposta))
  ) {
    alertas.push('modo_barbeiro_fraco')
  }

  // Mídia: verifica se IA respondeu adequadamente
  if (
    cenario.tags.includes('midia')
    && /\[áudio\]|\[audio\]/i.test(ultimaMensagemCliente)
    && !/digitar|pode digitar|nao consigo ouvir|ouvir audio/i.test(respostaNorm)
  ) {
    alertas.push('audio_ignorado')
  }

  if (
    cenario.tags.includes('midia')
    && /\[figurinha\]/i.test(ultimaMensagemCliente)
    && !respostaNorm
  ) {
    alertas.push('figurinha_ignorada')
  }

  // CAPS: verifica se IA não respondeu com CAPS (espelhar tom)
  if (
    cenario.tags.includes('caps')
    && /[A-Z]{4,}/.test(resposta)
  ) {
    alertas.push('ia_respondeu_em_caps')
  }

  // Escalação: verifica se escalonamento foi acionado para pedidos diretos
  if (
    cenario.tags.includes('escalacao')
    && /\b(quero falar com humano|atendente|equipe|reclamac)\b/.test(clienteNorm)
    && !/\b(equipe|humano|atendente|vou te pass|conectar|escal)\b/.test(respostaNorm)
  ) {
    alertas.push('nao_escalonou')
  }

  return alertas
}

const limparDadosTesteCliente = async ({ tenantId, telefone, lidWhatsapp = null }) => {
  if (!telefone && !lidWhatsapp) return

  let cliente = null

  if (telefone) {
    cliente = await banco.cliente.findFirst({
      where: { tenantId, telefone },
      select: { id: true },
    })
  }

  if (!cliente && lidWhatsapp) {
    try {
      cliente = await banco.cliente.findFirst({
        where: { tenantId, lidWhatsapp },
        select: { id: true },
      })
    } catch (erro) {
      if (!erroTemCampoLidWhatsapp(erro)) throw erro
    }
  }

  if (!cliente) return

  const conversas = await banco.conversa.findMany({
    where: { tenantId, clienteId: cliente.id },
    select: { id: true },
  })

  const conversaIds = conversas.map((conversa) => conversa.id)
  if (conversaIds.length > 0) {
    await banco.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } })
    await banco.conversa.deleteMany({ where: { id: { in: conversaIds } } })
  }

  // Deleta agendamentos antes do cliente para evitar FK constraint
  await banco.agendamento.deleteMany({ where: { tenantId, clienteId: cliente.id } })

  await banco.cliente.delete({ where: { id: cliente.id } })
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const montarPayloadPerfil = (perfilId) => {
  const perfil = PERFIS_TESTE[perfilId] || PERFIS_TESTE.NOVO_LEAD
  return {
    perfil: perfil.id,
    label: perfil.label,
    telefone: perfil.telefone,
    nome: perfil.nome,
    lidWhatsapp: perfil.lidWhatsapp,
  }
}

const consolidarResumoAlertas = (resultados = []) => {
  const totais = {}

  for (const resultado of resultados) {
    if (!Array.isArray(resultado.respostas)) continue
    for (const resposta of resultado.respostas) {
      for (const alerta of resposta.alertas || []) {
        totais[alerta] = (totais[alerta] || 0) + 1
      }
    }
  }

  return Object.entries(totais)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, total]) => ({ tipo, total }))
}

const rodarSuiteWhatsAppBrasil = async ({
  tenantId,
  processarTurno,
  filtros = [],
  stepDelayMs = 0,
  scenarioDelayMs = 0,
}) => {
  const cenarios = filtros.length
    ? CENARIOS_WHATSAPP_BR.filter((cenario) => filtros.some((filtro) => cenario.nome.includes(filtro)))
    : CENARIOS_WHATSAPP_BR

  const resultados = []
  let totalTurnos = 0
  let totalAlertas = 0
  let totalEscalonamentos = 0
  let totalErros = 0

  for (let index = 0; index < cenarios.length; index += 1) {
    const cenario = cenarios[index]
    const perfil = montarPayloadPerfil(cenario.perfil)

    try {
      await limparDadosTesteCliente({
        tenantId,
        telefone: perfil.telefone,
        lidWhatsapp: perfil.lidWhatsapp,
      })

      const respostas = []

      for (let passoIndex = 0; passoIndex < cenario.passos.length; passoIndex += 1) {
        const passo = cenario.passos[passoIndex]
        const resultado = await processarTurno({
          telefone: perfil.telefone,
          nome: perfil.nome,
          lidWhatsapp: perfil.lidWhatsapp,
          mensagem: passo,
        })

        const alertas = analisarResposta({
          cenario,
          ultimaMensagemCliente: passo,
          resposta: resultado?.resposta || '',
          mensagemProativa: resultado?.mensagemProativa || '',
          passoIndex,
        })

        // Mostra mensagemProativa (card de boas-vindas) quando resposta está vazia
        const textoIA = resultado?.resposta || resultado?.mensagemProativa || '(sem resposta)'
        respostas.push({
          cliente: passo,
          ia: textoIA,
          mensagemProativa: resultado?.mensagemProativa || null,
          escalonado: Boolean(resultado?.escalonado),
          encerrado: Boolean(resultado?.encerrado),
          alertas,
        })

        totalTurnos += 1
        totalAlertas += alertas.length
        if (resultado?.escalonado) totalEscalonamentos += 1

        if (stepDelayMs > 0) await esperar(stepDelayMs)
      }

      resultados.push({
        nome: cenario.nome,
        perfil: perfil.label,
        respostas,
        totalAlertas: respostas.reduce((soma, item) => soma + item.alertas.length, 0),
      })
    } catch (erro) {
      totalErros += 1
      resultados.push({
        nome: cenario.nome,
        perfil: perfil.label,
        erro: erro?.message || erro?.mensagem || String(erro),
      })
    } finally {
      await limparDadosTesteCliente({
        tenantId,
        telefone: perfil.telefone,
        lidWhatsapp: perfil.lidWhatsapp,
      }).catch(() => {})
    }

    if (scenarioDelayMs > 0 && index < (cenarios.length - 1)) {
      await esperar(scenarioDelayMs)
    }
  }

  const resumo = {
    cenariosExecutados: cenarios.length,
    totalTurnos,
    totalAlertas,
    totalEscalonamentos,
    totalErros,
    distribuicaoAlertas: consolidarResumoAlertas(resultados),
    taxaSucesso: cenarios.length
      ? Number((((cenarios.length - totalErros) / cenarios.length) * 100).toFixed(1))
      : 0,
  }

  return { resumo, resultados, cenarios }
}

module.exports = {
  PERFIS_TESTE,
  CENARIOS_WHATSAPP_BR,
  analisarResposta,
  limparDadosTesteCliente,
  montarPayloadPerfil,
  rodarSuiteWhatsAppBrasil,
  normalizarTelefone,
}

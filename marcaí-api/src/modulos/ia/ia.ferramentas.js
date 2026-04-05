// Definição de todas as tools para o OpenAI API (Function Calling)

const ferramentas = [
  {
    type: 'function',
    function: {
      name: 'verificarDisponibilidade',
      description: 'Verifica os horários disponíveis de um profissional para um serviço de barbearia em uma data específica, já respeitando expediente, intervalos, buffer e antecedência mínima prática.',
      parameters: {
        type: 'object',
        properties: {
          profissionalId: {
            type: 'string',
            description: 'ID do profissional. Se não informado, busca em todos os profissionais.',
          },
          servicoId: {
            type: 'string',
            description: 'ID do serviço desejado.',
          },
          data: {
            type: 'string',
            description: 'Data no formato YYYY-MM-DD.',
          },
          horaDesejada: {
            type: 'string',
            description: 'Hora desejada no formato HH:mm quando o cliente pedir um horário específico, por exemplo 16:30.',
          },
        },
        required: ['servicoId', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificarDisponibilidadeCombo',
      description: 'Verifica o melhor encaixe sequencial para dois ou mais servicos no mesmo atendimento (ex: corte + barba), com o mesmo profissional e na mesma data. Se a resposta disser "SEM VAGAS", voce DEVE chamar esta ferramenta de novo com a data do dia seguinte antes de responder ao cliente.',
      parameters: {
        type: 'object',
        properties: {
          profissionalId: {
            type: 'string',
            description: 'ID do profissional. Se nao informado, busca em todos os profissionais.',
          },
          servicoIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista dos IDs dos servicos na ordem em que devem acontecer no atendimento.',
          },
          data: {
            type: 'string',
            description: 'Data no formato YYYY-MM-DD.',
          },
          horaDesejada: {
            type: 'string',
            description: 'Hora desejada no formato HH:mm quando o cliente pedir um horario especifico.',
          },
        },
        required: ['servicoIds', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criarAgendamento',
      description: 'Cria um novo agendamento para o cliente após confirmar todos os detalhes, inclusive combos como corte + barba.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
          profissionalId: { type: 'string', description: 'ID do profissional.' },
          servicoId: { type: 'string', description: 'ID do serviço.' },
          inicio: { type: 'string', description: 'Data e hora de início no formato ISO 8601.' },
        },
        required: ['clienteId', 'profissionalId', 'servicoId', 'inicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criarAgendamentoCombo',
      description: 'Cria dois ou mais agendamentos sequenciais no mesmo atendimento quando o cliente confirmar um combo como corte + barba.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
          profissionalId: { type: 'string', description: 'ID do profissional.' },
          servicoIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista dos IDs dos servicos na ordem do atendimento.',
          },
          inicio: { type: 'string', description: 'Data e hora de inicio do primeiro servico no formato ISO 8601.' },
        },
        required: ['clienteId', 'profissionalId', 'servicoIds', 'inicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remarcarAgendamento',
      description: 'Remarca um ou mais agendamentos existentes para uma nova data/hora. Para combo (corte+barba), passe todos os agendamentoIds juntos — os servicos serao reagendados sequencialmente.',
      parameters: {
        type: 'object',
        properties: {
          agendamentoId: { type: 'string', description: 'ID do agendamento a remarcar (uso individual).' },
          agendamentoIds: { type: 'array', items: { type: 'string' }, description: 'Lista de IDs para remarcar combo (corte+barba juntos).' },
          novoInicio: { type: 'string', description: 'Nova data e hora no formato ISO 8601.' },
        },
        required: ['novoInicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelarAgendamento',
      description: 'Cancela um agendamento existente e mantém a fila de espera atualizada.',
      parameters: {
        type: 'object',
        properties: {
          agendamentoId: { type: 'string', description: 'ID do agendamento a cancelar.' },
          motivo: { type: 'string', description: 'Motivo do cancelamento.' },
        },
        required: ['agendamentoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscarAgendamentosCliente',
      description: 'Busca os agendamentos futuros de um cliente. OBRIGATORIO chamar esta ferramenta no MESMO INSTANTE em que o cliente usar as palavras "remarcar", "cancelar" ou perguntar "qual meu horario", sem fazer perguntas intermediarias.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
        },
        required: ['clienteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listarServicos',
      description: 'Lista todos os serviços disponíveis na barbearia.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listarProfissionais',
      description: 'Lista os profissionais disponíveis, opcionalmente filtrado por serviço.',
      parameters: {
        type: 'object',
        properties: {
          servicoId: { type: 'string', description: 'Filtrar profissionais que realizam este serviço.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscarCliente',
      description: 'Busca um cliente pelo número de telefone.',
      parameters: {
        type: 'object',
        properties: {
          telefone: { type: 'string', description: 'Número de telefone do cliente.' },
        },
        required: ['telefone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrarCliente',
      description: 'Cadastra um novo cliente ou atualiza o nome de um cliente existente. Use sempre que o cliente informar como prefere ser chamado, inclusive para memória de retorno e fidelização.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome completo do cliente.' },
          telefone: { type: 'string', description: 'Número de telefone.' },
          email: { type: 'string', description: 'E-mail (opcional).' },
        },
        required: ['nome', 'telefone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmarAgendamento',
      description: 'Confirma um agendamento existente quando o cliente responde positivamente ao lembrete ou pede para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          agendamentoId: { type: 'string', description: 'ID do agendamento a confirmar.' },
        },
        required: ['agendamentoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'coletarFeedback',
      description: 'Registra a avaliação do cliente após a conclusão de um serviço. Use após o cliente informar uma nota de 1 a 5.',
      parameters: {
        type: 'object',
        properties: {
          agendamentoId: { type: 'string', description: 'ID do agendamento avaliado.' },
          nota: { type: 'number', description: 'Nota de 1 a 5 estrelas.' },
          comentario: { type: 'string', description: 'Comentário opcional do cliente.' },
        },
        required: ['agendamentoId', 'nota'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvarPreferenciasCliente',
      description: 'Salva preferências detectadas do cliente (horário preferido, profissional favorito, combo corte + barba, etc.) para personalizar atendimentos futuros.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
          preferencias: { type: 'string', description: 'Resumo das preferências detectadas. Ex: "Prefere horários de manhã. Sempre pede a profissional Beatriz."' },
        },
        required: ['clienteId', 'preferencias'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalonarParaHumano',
      description: 'Transfere a conversa para um atendente humano quando necessário.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo da transferência para humano.' },
        },
        required: ['motivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificarSaldoFidelidade',
      description: 'Verifica o saldo de pontos de fidelidade do cliente e a configuração de resgate. Use quando o cliente perguntar sobre pontos, quiser saber quantos pontos tem, ou quando for uma boa hora de lembrar o benefício.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
        },
        required: ['clienteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resgatarFidelidade',
      description: 'Resgata os pontos de fidelidade do cliente quando ele atingiu a quantidade necessaria e pede para resgatar (ex: diz "RESGATAR", "quero resgatar", "usar meus pontos"). O proximo agendamento do servico do resgate sera gratuito.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
        },
        required: ['clienteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ativarPlano',
      description: 'Ativa um plano mensal para o cliente diretamente pelo WhatsApp. Use apenas quando o cliente confirmar explicitamente que quer assinar o plano.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
          planoId: { type: 'string', description: 'ID do plano mensal a ativar.' },
          observacoes: { type: 'string', description: 'Observações opcionais sobre a assinatura.' },
        },
        required: ['clienteId', 'planoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificarCreditosPlano',
      description: 'Verifica os créditos disponíveis do plano mensal do cliente. SEMPRE use esta ferramenta quando o cliente mencionar "plano", "pelo plano", "meu plano" ou "usar o plano" antes de agendar. Retorna os serviços disponíveis e créditos restantes.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
        },
        required: ['clienteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'entrarFilaEspera',
      description: 'Coloca o cliente na fila de espera para um serviço quando não há horário disponível na data desejada. O cliente será notificado pelo WhatsApp assim que abrir um horário.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente.' },
          servicoId: { type: 'string', description: 'ID do serviço desejado.' },
          profissionalId: { type: 'string', description: 'ID do profissional preferido (opcional). Se não informado, aceita qualquer profissional.' },
          dataDesejada: { type: 'string', description: 'Data desejada no formato YYYY-MM-DD.' },
        },
        required: ['clienteId', 'servicoId', 'dataDesejada'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'encerrarConversa',
      description: 'Encerra a conversa quando o cliente se despede, diz que não quer mais ser atendido, agradece e sai, ou após um agendamento concluído com sucesso e o cliente se despedir.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            enum: ['despedida', 'desistencia', 'agendamento_concluido', 'sem_interesse'],
            description: 'Motivo do encerramento.',
          },
        },
        required: ['motivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviarLinkAgendamento',
      description: 'Envia ao cliente um link direto para agendar pelo site, caso prefira fazer sozinho em vez de marcar pelo WhatsApp. Use quando o cliente pedir um link, quiser agendar sozinho pelo site, ou quando for conveniente oferecer essa opção alternativa.',
      parameters: {
        type: 'object',
        properties: {
          mensagem: {
            type: 'string',
            description: 'Mensagem curta e amigável para acompanhar o link. Exemplo: "Claro! Segue o link para você agendar direto:"',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviarLinkPlano',
      description: 'Envia ao cliente um link para ver e assinar o plano mensal do salão, caso queira se inscrever no plano. Use quando o cliente perguntar sobre plano, mensalidade, plano mensal, ou quando for conveniente sugerir o plano.',
      parameters: {
        type: 'object',
        properties: {
          mensagem: {
            type: 'string',
            description: 'Mensagem curta e amigável para acompanhar o link do plano. Exemplo: "Ótima escolha! Aqui está o link para conhecer e assinar o plano:"',
          },
        },
        required: [],
      },
    },
  },
]

module.exports = ferramentas

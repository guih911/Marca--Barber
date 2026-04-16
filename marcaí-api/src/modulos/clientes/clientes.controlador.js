const clientesServico = require('./clientes.servico')
const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')

const listar = async (req, res, next) => {
  try {
    const resultado = await clientesServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, ...resultado })
  } catch (erro) {
    next(erro)
  }
}

const buscarPorId = async (req, res, next) => {
  try {
    const cliente = await clientesServico.buscarPorId(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: cliente })
  } catch (erro) {
    next(erro)
  }
}

const criar = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const cliente = await clientesServico.criar(tenantId, req.body)
    res.status(201).json({ sucesso: true, dados: cliente })

    // Envia mensagem de boas-vindas via WhatsApp (fire-and-forget)
    enviarBoasVindas(tenantId, cliente).catch((err) =>
      console.error('[Clientes] Erro ao enviar boas-vindas WhatsApp:', err.message)
    )
  } catch (erro) {
    next(erro)
  }
}

const enviarBoasVindas = async (tenantId, cliente) => {
  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true, slug: true, configWhatsApp: true, nomeIA: true, enviarMensagemAoCadastrarCliente: true },
  })
  if (!tenant?.enviarMensagemAoCadastrarCliente || !tenant?.configWhatsApp?.provedor || !tenant.slug) return

  const mensagem =
    `💈 ${tenant.nome}\n\n` +
    `Bem-vindo. Aqui você encontra precisão, estilo e um atendimento diferenciado.\n\n` +
    `Eu cuido do seu agendamento de forma rápida e personalizada.\n\n` +
    `O que você deseja agora?`

  const payload = {
    type: 'button',
    body: { text: mensagem.slice(0, 1024) },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'AGENDAR', title: 'Agendar corte' } },
        { type: 'reply', reply: { id: 'VER_HORARIOS', title: 'Horários hoje' } },
        { type: 'reply', reply: { id: 'VER_SERVICOS', title: 'Serviços' } },
      ],
    },
  }

  await whatsappServico.enviarMensagemInterativa(tenant.configWhatsApp, cliente.telefone, payload, tenantId)
  console.log(`[Clientes] Boas-vindas enviada para ${cliente.telefone} — tenant ${tenantId}`)
}

const atualizar = async (req, res, next) => {
  try {
    const cliente = await clientesServico.atualizar(req.usuario.tenantId, req.params.id, req.body)
    res.json({ sucesso: true, dados: cliente })
  } catch (erro) {
    next(erro)
  }
}

const remover = async (req, res, next) => {
  try {
    await clientesServico.remover(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: { mensagem: 'Cliente removido com sucesso' } })
  } catch (erro) {
    next(erro)
  }
}

const desativar = async (req, res, next) => {
  try {
    const cliente = await clientesServico.desativar(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: cliente })
  } catch (erro) {
    next(erro)
  }
}

const reativar = async (req, res, next) => {
  try {
    const cliente = await clientesServico.reativar(req.usuario.tenantId, req.params.id)
    res.json({ sucesso: true, dados: cliente })
  } catch (erro) {
    next(erro)
  }
}

const aniversariantes = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const hoje = new Date()
    const diasFuturos = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoje)
      d.setDate(d.getDate() + i)
      return { mes: d.getMonth() + 1, dia: d.getDate() }
    })

    const clientes = await banco.cliente.findMany({
      where: {
        tenantId,
        ativo: true,
        dataNascimento: { not: null },
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        dataNascimento: true,
      },
    })

    const lista = clientes.filter(c => {
      if (!c.dataNascimento) return false
      const dt = new Date(c.dataNascimento)
      const mes = dt.getUTCMonth() + 1
      const dia = dt.getUTCDate()
      return diasFuturos.some(d => d.mes === mes && d.dia === dia)
    }).map(c => {
      const dt = new Date(c.dataNascimento)
      return {
        ...c,
        mes: dt.getUTCMonth() + 1,
        dia: dt.getUTCDate(),
      }
    }).sort((a, b) => {
      const agora = new Date()
      const toMinutes = (mes, dia) => {
        const next = new Date(agora.getFullYear(), mes - 1, dia)
        if (next < agora) next.setFullYear(agora.getFullYear() + 1)
        return next - agora
      }
      return toMinutes(a.mes, a.dia) - toMinutes(b.mes, b.dia)
    })

    res.json({ sucesso: true, dados: lista })
  } catch (erro) {
    next(erro)
  }
}

const importar = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      throw { status: 400, mensagem: 'Selecione um arquivo CSV para importar.', codigo: 'ARQUIVO_OBRIGATORIO' }
    }

    const resultado = await clientesServico.importarCsv(req.usuario.tenantId, req.file.buffer, { enviarMensagem: false })
    res.json({ sucesso: true, dados: resultado })
  } catch (erro) {
    next(erro)
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, desativar, reativar, aniversariantes, importar }

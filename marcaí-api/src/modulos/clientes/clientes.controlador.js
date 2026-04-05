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
    select: { nome: true, slug: true, configWhatsApp: true, nomeIA: true },
  })
  if (!tenant?.configWhatsApp?.provedor || !tenant.slug) return

  const appUrl = process.env.APP_URL || 'https://barber.xn--marca-3sa.com'
  const nomeIA = tenant.nomeIA || 'Don Barber'
  const linkAgendamento = `${appUrl}/b/${tenant.slug}`
  const mensagem =
    `Olá! 👋\n` +
    `Para melhorar sua experiência, agora a ${tenant.nome} conta com o assistente de IA ${nomeIA} 🤖💈, nosso sistema inteligente de agendamentos.\n\n` +
    `Você pode garantir seu horário em segundos:\n` +
    `🔗 Pelo link: ${linkAgendamento}\n` +
    `💬 Ou falando diretamente comigo aqui\n\n` +
    `Rápido, prático e sem espera 😉`

  const lidJid = cliente.lidWhatsapp ? `${cliente.lidWhatsapp}@lid` : null
  await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, mensagem, tenantId, lidJid)
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

module.exports = { listar, buscarPorId, criar, atualizar, remover, desativar, reativar, aniversariantes }

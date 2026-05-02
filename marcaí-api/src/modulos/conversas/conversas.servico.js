const { Prisma } = require('@prisma/client')
const banco = require('../../config/banco')
const configIA = require('../../config/ia')
const whatsappServico = require('../ia/whatsapp.servico')

const STATUS_CONVERSAS_ABERTAS = ['ATIVA', 'ESCALONADA']

const sincronizarAvataresClientes = async (tenantId, conversas = []) => {
  if (!Array.isArray(conversas) || conversas.length === 0) return conversas

  const faltantes = new Map()
  conversas.forEach((conversa) => {
    const cliente = conversa?.cliente
    if (!cliente?.id || !cliente?.telefone || cliente?.avatarUrl || faltantes.has(cliente.telefone)) return
    faltantes.set(cliente.telefone, cliente)
  })

  if (faltantes.size === 0) return conversas

  const tenant = await banco.tenant.findUnique({
    where: { id: tenantId },
    select: { configWhatsApp: true },
  })
  if (!tenant?.configWhatsApp) return conversas

  const telefones = [...faltantes.keys()].slice(0, 20)
  const fotos = await Promise.allSettled(
    telefones.map((telefone) => whatsappServico.obterFotoPerfil(tenant.configWhatsApp, telefone, tenantId))
  )

  const atualizacoes = []
  fotos.forEach((resultado, index) => {
    const avatarUrl = resultado.status === 'fulfilled' ? resultado.value : null
    if (!avatarUrl) return

    const telefone = telefones[index]
    const cliente = faltantes.get(telefone)
    if (!cliente) return

    atualizacoes.push(
      banco.cliente.update({
        where: { id: cliente.id },
        data: { avatarUrl },
      })
    )

    conversas.forEach((conversa) => {
      if (conversa?.cliente?.telefone === telefone) {
        conversa.cliente.avatarUrl = avatarUrl
      }
    })
  })

  if (atualizacoes.length > 0) {
    await Promise.allSettled(atualizacoes)
  }

  return conversas
}

const manterSomenteUmaConversaAberta = async (tx, conversaMantida) => {
  if (!conversaMantida?.id) return

  await tx.conversa.updateMany({
    where: {
      tenantId: conversaMantida.tenantId,
      clienteId: conversaMantida.clienteId,
      canal: conversaMantida.canal,
      status: { in: STATUS_CONVERSAS_ABERTAS },
      id: { not: conversaMantida.id },
    },
    data: {
      status: 'ENCERRADA',
      escalonadoPara: null,
    },
  })
}

const listar = async (tenantId, { status, canal, pagina = 1, limite = 30 }) => {
  const pular = (Number(pagina) - 1) * Number(limite)

  const where = { tenantId }
  if (status) where.status = status
  if (canal) where.canal = canal

  const conversas = await banco.conversa.findMany({
    where,
    skip: pular,
    take: Number(limite),
    orderBy: { atualizadoEm: 'desc' },
    include: {
      cliente: true,
      mensagens: {
        where: { NOT: { conteudo: { startsWith: '[ORQ]' } } },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      },
      _count: { select: { mensagens: true } },
    },
  })

  await sincronizarAvataresClientes(tenantId, conversas)

  return conversas
}

const buscarPorId = async (tenantId, id) => {
  const conversa = await banco.conversa.findFirst({
    where: { id, tenantId },
    include: {
      cliente: {
        include: {
          agendamentos: {
            include: { servico: true, profissional: true },
            orderBy: { inicioEm: 'desc' },
            take: 10,
          },
        },
      },
      mensagens: { 
        where: { NOT: { conteudo: { startsWith: '[ORQ]' } } },
        orderBy: { criadoEm: 'asc' } 
      },
    },
  })

  if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }
  await sincronizarAvataresClientes(tenantId, [conversa])
  return conversa
}

const enviarMensagem = async (tenantId, conversaId, usuarioId, conteudo) => {
  const conversa = await banco.conversa.findFirst({
    where: { id: conversaId, tenantId },
    include: { cliente: true },
  })
  if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

  const mensagem = await banco.mensagem.create({
    data: { conversaId, remetente: `humano:${usuarioId}`, conteudo },
  })

  await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })

  if (conversa.cliente?.telefone) {
    const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
    if (tenant?.configWhatsApp) {
      await whatsappServico.enviarMensagem(tenant.configWhatsApp, conversa.cliente.telefone, conteudo, tenantId)
    }
  }

  return mensagem
}

const assumir = async (tenantId, conversaId, usuarioId) =>
  banco.$transaction(
    async (tx) => {
      const conversa = await tx.conversa.findFirst({ where: { id: conversaId, tenantId } })
      if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

      const atualizada = await tx.conversa.update({
        where: { id: conversaId },
        data: { status: 'ESCALONADA', escalonadoPara: usuarioId },
      })

      await manterSomenteUmaConversaAberta(tx, atualizada)
      return atualizada
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

const devolver = async (tenantId, conversaId) =>
  banco.$transaction(
    async (tx) => {
      const conversa = await tx.conversa.findFirst({ where: { id: conversaId, tenantId } })
      if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

      await tx.mensagem.create({
        data: { conversaId, remetente: 'sistema', conteudo: 'Conversa devolvida para a IA.' },
      })

      const atualizada = await tx.conversa.update({
        where: { id: conversaId },
        data: { status: 'ATIVA', escalonadoPara: null },
      })

      await manterSomenteUmaConversaAberta(tx, atualizada)
      return atualizada
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

const encerrar = async (tenantId, conversaId) => {
  const conversa = await banco.conversa.findFirst({ where: { id: conversaId, tenantId } })
  if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

  await banco.mensagem.create({
    data: { conversaId, remetente: 'sistema', conteudo: 'Conversa encerrada.' },
  })

  return banco.conversa.update({
    where: { id: conversaId },
    data: { status: 'ENCERRADA', escalonadoPara: null },
  })
}

const reabrir = async (tenantId, conversaId) =>
  banco.$transaction(
    async (tx) => {
      const conversa = await tx.conversa.findFirst({ where: { id: conversaId, tenantId } })
      if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

      await tx.conversa.updateMany({
        where: {
          tenantId: conversa.tenantId,
          clienteId: conversa.clienteId,
          canal: conversa.canal,
          status: { in: STATUS_CONVERSAS_ABERTAS },
          id: { not: conversa.id },
        },
        data: {
          status: 'ENCERRADA',
          escalonadoPara: null,
        },
      })

      await tx.mensagem.create({
        data: { conversaId, remetente: 'sistema', conteudo: 'Conversa reaberta.' },
      })

      const atualizada = await tx.conversa.update({
        where: { id: conversaId },
        data: { status: 'ATIVA', escalonadoPara: null },
      })

      await manterSomenteUmaConversaAberta(tx, atualizada)
      return atualizada
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

const buscarOuCriarConversa = async (tenantId, clienteId, canal = 'WHATSAPP') => {
  return banco.$transaction(
    async (tx) => {
      // 1. Busca a conversa mais recente deste cliente (qualquer status) — histórico único e perpétuo
      const conversaMaisRecente = await tx.conversa.findFirst({
        where: { tenantId, clienteId, canal },
        orderBy: { atualizadoEm: 'desc' },
      })

      if (conversaMaisRecente) {
        // Reativa se estava encerrada, mantém se já estava ativa/escalonada
        if (!STATUS_CONVERSAS_ABERTAS.includes(conversaMaisRecente.status)) {
          return tx.conversa.update({
            where: { id: conversaMaisRecente.id },
            data: { status: 'ATIVA', escalonadoPara: null },
          })
        }
        return conversaMaisRecente
      }

      // 2. Primeira mensagem deste cliente — cria conversa
      try {
        return await tx.conversa.create({
          data: { tenantId, clienteId, canal, status: 'ATIVA' },
        })
      } catch (erro) {
        if (erro?.code === 'P2002') {
          const existente = await tx.conversa.findFirst({
            where: { tenantId, clienteId, canal },
            orderBy: { atualizadoEm: 'desc' },
          })
          if (existente) return existente
        }
        throw erro
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}

/** Garante conversa (cria vazia se necessário) e retorna a conversa completa com mensagens. */
const abrirPorCliente = async (tenantId, clienteId) => {
  const cliente = await banco.cliente.findFirst({ where: { id: clienteId, tenantId } })
  if (!cliente) throw { status: 404, mensagem: 'Cliente nao encontrado', codigo: 'NAO_ENCONTRADO' }
  const conv = await buscarOuCriarConversa(tenantId, clienteId)
  return buscarPorId(tenantId, conv.id)
}

const adicionarNota = async (tenantId, conversaId, usuarioId, conteudo) => {
  const conversa = await banco.conversa.findFirst({ where: { id: conversaId, tenantId } })
  if (!conversa) throw { status: 404, mensagem: 'Conversa nao encontrada', codigo: 'NAO_ENCONTRADO' }

  const nota = await banco.mensagem.create({
    data: { conversaId, remetente: `nota_interna:${usuarioId}`, conteudo },
  })

  await banco.conversa.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } })
  return nota
}

module.exports = {
  listar,
  buscarPorId,
  enviarMensagem,
  assumir,
  devolver,
  encerrar,
  reabrir,
  buscarOuCriarConversa,
  abrirPorCliente,
  adicionarNota,
}

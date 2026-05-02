const clientesServico = require('./clientes.servico')
const banco = require('../../config/banco')
const whatsappServico = require('../ia/whatsapp.servico')
const { processarEvento } = require('../ia/messageOrchestrator')

const FRASE_SEGURANCA_MASSA = 'ENVIAR MENSAGEM EM MASSA'
const parseListaIds = (valor) => {
  if (Array.isArray(valor)) return valor
  if (typeof valor === 'string') {
    const texto = valor.trim()
    if (!texto) return []
    try {
      const json = JSON.parse(texto)
      if (Array.isArray(json)) return json
    } catch (_) {
      // segue fallback csv
    }
    return texto.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

const listar = async (req, res, next) => {
  try {
    const resultado = await clientesServico.listar(req.usuario.tenantId, req.query)
    res.json({ sucesso: true, ...resultado })
  } catch (erro) {
    next(erro)
  }
}

const buscarPorTelefone = async (req, res, next) => {
  try {
    const telefone = String(req.query?.telefone || '').trim()
    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: 'Telefone é obrigatório.', codigo: 'TELEFONE_OBRIGATORIO' },
      })
    }
    const cliente = await clientesServico.buscarPorTelefone(req.usuario.tenantId, telefone)
    res.json({ sucesso: true, dados: cliente || null })
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
  processarEvento({
    evento: 'BEM_VINDO',
    tenantId,
    cliente
  })
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

const enviarMensagemMassa = async (req, res, next) => {
  try {
    const tenantId = req.usuario.tenantId
    const {
      clienteIds: clienteIdsRaw = [],
      tipo = 'TEXTO',
      mensagem = '',
      confirmarEnvio = false,
      fraseConfirmacao = '',
    } = req.body || {}

    const ids = [...new Set(parseListaIds(clienteIdsRaw).map((id) => String(id || '').trim()).filter(Boolean))]
    if (ids.length === 0) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Selecione pelo menos 1 cliente.' } })
    }
    if (ids.length > 300) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Envio em massa limitado a 300 clientes por disparo.' } })
    }

    const tipoNormalizado = String(tipo || 'TEXTO').toUpperCase() === 'AUDIO' ? 'AUDIO' : 'TEXTO'
    const texto = String(mensagem || '').trim()
    if (tipoNormalizado === 'TEXTO') {
      if (!texto || texto.length < 5) {
        return res.status(400).json({ sucesso: false, erro: { mensagem: 'Mensagem muito curta. Revise o conteúdo.' } })
      }
      if (texto.length > 1200) {
        return res.status(400).json({ sucesso: false, erro: { mensagem: 'Mensagem longa demais (máximo de 1200 caracteres).' } })
      }
    }

    const confirmou = confirmarEnvio === true || String(confirmarEnvio).toLowerCase() === 'true'
    if (!confirmou || String(fraseConfirmacao || '').trim() !== FRASE_SEGURANCA_MASSA) {
      return res.status(400).json({
        sucesso: false,
        erro: { mensagem: `Confirmação de segurança inválida. Digite exatamente: ${FRASE_SEGURANCA_MASSA}` },
      })
    }

    const tenant = await banco.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, configWhatsApp: true },
    })
    if (!tenant?.configWhatsApp) {
      return res.status(422).json({ sucesso: false, erro: { mensagem: 'WhatsApp não conectado neste tenant.' } })
    }

    const clientes = await banco.cliente.findMany({
      where: {
        tenantId,
        id: { in: ids },
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
      },
    })

    const clientesComTelefone = clientes.filter((cliente) => String(cliente.telefone || '').trim())
    if (clientesComTelefone.length === 0) {
      return res.status(400).json({ sucesso: false, erro: { mensagem: 'Nenhum cliente ativo com telefone válido encontrado.' } })
    }

    let audioBuffer = null
    let audioMimeType = 'audio/mpeg'
    if (tipoNormalizado === 'AUDIO') {
      if (!req.file?.buffer?.length) {
        return res.status(422).json({
          sucesso: false,
          erro: { mensagem: 'Anexe um áudio para envio em massa.' },
        })
      }
      audioBuffer = req.file.buffer
      audioMimeType = req.file.mimetype || audioMimeType
    }

    const resultados = []
    for (const cliente of clientesComTelefone) {
      try {
        if (tipoNormalizado === 'AUDIO') {
          await whatsappServico.enviarAudio(tenant.configWhatsApp, cliente.telefone, audioBuffer, tenantId, null, {
            mimetype: audioMimeType,
          })
        } else {
          await whatsappServico.enviarMensagem(tenant.configWhatsApp, cliente.telefone, texto, tenantId)
        }
        resultados.push({ clienteId: cliente.id, nome: cliente.nome, sucesso: true })
      } catch (erroEnvio) {
        resultados.push({
          clienteId: cliente.id,
          nome: cliente.nome,
          sucesso: false,
          erro: erroEnvio?.message || 'Falha ao enviar',
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 180))
    }

    const enviadosComSucesso = resultados.filter((item) => item.sucesso).length
    const falhas = resultados.filter((item) => !item.sucesso)

    res.json({
      sucesso: true,
      dados: {
        totalSelecionados: ids.length,
        totalProcessados: resultados.length,
        enviadosComSucesso,
        falhas: falhas.length,
        erros: falhas.slice(0, 50),
      },
    })
  } catch (erro) {
    next(erro)
  }
}

module.exports = {
  listar,
  buscarPorTelefone,
  buscarPorId,
  criar,
  atualizar,
  remover,
  desativar,
  reativar,
  aniversariantes,
  importar,
  enviarMensagemMassa,
}

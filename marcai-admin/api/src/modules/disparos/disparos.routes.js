const express = require('express')
const { db } = require('../../core/db')
const { enviarMensagemMeta, normalizarConfigMeta } = require('../comercial/metaWhatsApp.service')
const { normalizarTelefone } = require('../../utils/http')

const router = express.Router()

// POST /api/admin/disparos — Envio em massa para lista de números
// Body: { tenantId, numeros: [{telefone, nome?}], texto, salvarComoLead?: bool }
router.post('/disparos', async (req, res) => {
  try {
    const {
      tenantId,
      numeros = [],
      texto,
      salvarComoLead = false,
    } = req.body || {}

    if (!tenantId) return res.status(400).json({ erro: 'tenantId é obrigatório' })
    if (!texto || !texto.trim()) return res.status(400).json({ erro: 'texto é obrigatório' })
    if (!Array.isArray(numeros) || numeros.length === 0) return res.status(400).json({ erro: 'Informe ao menos um número' })

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nome: true, configWhatsApp: true },
    })
    if (!tenant) return res.status(404).json({ erro: 'Tenant não encontrado' })

    const metaConfig = normalizarConfigMeta(tenant.configWhatsApp)
    if (!metaConfig.accessToken || !metaConfig.phoneNumberId) {
      return res.status(422).json({ erro: 'Tenant sem integração Meta configurada' })
    }

    const adminRemetente = `humano:${req.admin.id}:${req.admin.nome || req.admin.email}`
    const resultados = []

    for (const item of numeros) {
      const telefone = normalizarTelefone(String(item.telefone || item))
      const nomeContato = item.nome || null

      // Personalizar mensagem com nome se disponível
      const textoFinal = nomeContato
        ? texto.replace(/\{nome\}/gi, nomeContato).replace(/\{name\}/gi, nomeContato)
        : texto.replace(/\{nome\}/gi, '').replace(/\{name\}/gi, '')

      try {
        // Enviar via Meta
        const envio = await enviarMensagemMeta({
          configWhatsApp: tenant.configWhatsApp,
          para: telefone,
          texto: textoFinal,
        })

        // Criar/obter cliente e conversa para registrar a mensagem
        let cliente = await db.cliente.findFirst({ where: { tenantId, telefone } })
        if (!cliente) {
          const tags = salvarComoLead
            ? ['lead', 'origem:DISPARO', 'estagio:NOVO']
            : ['origem:DISPARO']
          cliente = await db.cliente.create({
            data: {
              tenantId,
              telefone,
              nome: nomeContato || `Contato ${telefone.slice(-4)}`,
              tags,
            },
          })
        } else if (salvarComoLead && !(cliente.tags || []).includes('lead')) {
          await db.cliente.update({
            where: { id: cliente.id },
            data: { tags: [...(cliente.tags || []), 'lead', 'origem:DISPARO', 'estagio:NOVO'] },
          })
        }

        // Obter ou criar conversa
        let conversa = await db.conversa.findFirst({
          where: { tenantId, clienteId: cliente.id, status: { not: 'ENCERRADA' } },
        })
        if (!conversa) {
          conversa = await db.conversa.create({
            data: { tenantId, clienteId: cliente.id, canal: 'WHATSAPP', status: 'ATIVA' },
          })
        }

        // Registrar mensagem
        await db.mensagem.create({
          data: { conversaId: conversa.id, remetente: adminRemetente, conteudo: textoFinal },
        })

        resultados.push({ telefone, nome: nomeContato, enviado: true, ...envio })
      } catch (errItem) {
        resultados.push({ telefone, nome: nomeContato, enviado: false, motivo: errItem.message })
      }
    }

    return res.json({
      total: resultados.length,
      enviados: resultados.filter(r => r.enviado).length,
      falhas: resultados.filter(r => !r.enviado).length,
      resultados,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// GET /api/admin/disparos/tenants — lista tenants com Meta configurado para seleção
router.get('/disparos/tenants', async (_req, res) => {
  try {
    const tenants = await db.tenant.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, slug: true, configWhatsApp: true },
      orderBy: { nome: 'asc' },
    })

    const { normalizarConfigMeta } = require('../comercial/metaWhatsApp.service')
    const resultado = tenants.map(t => {
      const meta = normalizarConfigMeta(t.configWhatsApp)
      return {
        id: t.id,
        nome: t.nome,
        slug: t.slug,
        metaConfigurado: Boolean(meta.accessToken && meta.phoneNumberId),
      }
    })

    return res.json(resultado)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { disparosRoutes: router }

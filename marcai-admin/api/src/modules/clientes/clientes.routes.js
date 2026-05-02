const express = require('express')
const { db } = require('../../core/db')
const { obterPaginacao } = require('../../utils/http')

const router = express.Router()

// GET /api/admin/clientes — clientes cross-tenant com busca e paginação
router.get('/clientes', async (req, res) => {
  try {
    const { busca, tenantId } = req.query
    const { pagina, limite, skip } = obterPaginacao(req.query, 20, 100)

    const where = {
      ...(tenantId ? { tenantId: String(tenantId) } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { telefone: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limite,
        include: {
          tenant: { select: { id: true, nome: true } },
          _count: { select: { agendamentos: true, conversas: true } },
        },
      }),
      db.cliente.count({ where }),
    ])

    return res.json({ clientes, total, pagina, limite })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { clientesRoutes: router }

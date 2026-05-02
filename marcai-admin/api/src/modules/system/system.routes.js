const express = require('express')
const os = require('os')
const { execSync } = require('child_process')

const router = express.Router()

router.get('/sistema', async (_req, res) => {
  try {
    const uptime = process.uptime()
    const mem = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    let containers = []

    try {
      const raw = execSync('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"', { timeout: 5000 }).toString()
      containers = raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [nome, status, imagem] = line.split('|')
          return { nome, status, imagem }
        })
    } catch {
      containers = []
    }

    return res.json({
      node: process.version,
      uptime: Math.floor(uptime),
      memoria: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      servidor: {
        totalMem: Math.round(totalMem / 1024 / 1024),
        freeMem: Math.round(freeMem / 1024 / 1024),
        cpus: os.cpus().length,
        platform: os.platform(),
        hostname: os.hostname(),
      },
      containers,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = { systemRoutes: router }

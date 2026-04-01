process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const banco = require('../src/config/banco')
const { processarWebhookInterno } = require('../src/modulos/ia/ia.controlador')
const { rodarSuiteWhatsAppBrasil } = require('../src/modulos/ia/ia.teste.servico')

const tenantId = process.env.TENANT_ID
const stepDelayMs = Number(process.env.STEP_DELAY_MS || 0)
const scenarioDelayMs = Number(process.env.SCENARIO_DELAY_MS || 0)

if (!tenantId) {
  console.error('Defina TENANT_ID para rodar a simulacao.')
  process.exit(1)
}

const filtros = (process.env.SCENARIO_FILTER || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

async function main() {
  const resultado = await rodarSuiteWhatsAppBrasil({
    tenantId,
    filtros,
    stepDelayMs,
    scenarioDelayMs,
    processarTurno: ({ telefone, nome, lidWhatsapp, mensagem }) =>
      processarWebhookInterno({
        tenantId,
        telefone,
        mensagem,
        nome,
        lidWhatsapp,
        canal: 'WHATSAPP',
        configWhatsApp: null,
      }),
  })

  console.log(JSON.stringify(resultado, null, 2))
  await banco.$disconnect()
}

main().catch(async (erro) => {
  console.error(erro)
  try { await banco.$disconnect() } catch (_) {}
  process.exit(1)
})

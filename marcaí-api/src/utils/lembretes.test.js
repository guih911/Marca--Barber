const test = require('node:test')
const assert = require('node:assert/strict')

const {
  obterLembretesConfigurados,
  obterLembretesEnviados,
  estaNaJanelaDeLembrete,
} = require('./lembretes')

test('obterLembretesConfigurados prioriza a lista nova, ordena e remove duplicados', () => {
  const tenant = {
    lembretesMinutosAntes: [60, '15', 60, 1440, 0, 15],
    lembreteMinutosAntes: 30,
  }

  assert.deepEqual(obterLembretesConfigurados(tenant), [1440, 60, 15, 0])
})

test('obterLembretesConfigurados usa o campo legado quando a lista nova não existir', () => {
  assert.deepEqual(obterLembretesConfigurados({ lembreteMinutosAntes: 90 }), [90])
  assert.deepEqual(obterLembretesConfigurados({ lembreteMinutosAntes: 0 }), [])
})

test('obterLembretesEnviados normaliza a lista persistida no agendamento', () => {
  const enviados = obterLembretesEnviados({ lembretesConfiguradosEnviados: ['60', 15, 15] })
  assert.equal(enviados.has(60), true)
  assert.equal(enviados.has(15), true)
  assert.equal(enviados.size, 2)
})

test('estaNaJanelaDeLembrete respeita a janela do cron sem disparar lembretes menores juntos', () => {
  assert.equal(estaNaJanelaDeLembrete(59.5, 60), true)
  assert.equal(estaNaJanelaDeLembrete(44, 60), false)
  assert.equal(estaNaJanelaDeLembrete(9.2, 10), true)
  assert.equal(estaNaJanelaDeLembrete(4.5, 5), true)
  assert.equal(estaNaJanelaDeLembrete(16, 15), false)
})

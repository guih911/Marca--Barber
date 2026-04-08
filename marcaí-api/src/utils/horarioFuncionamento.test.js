const test = require('node:test')
const assert = require('node:assert/strict')

const { resumirHorarioFuncionamento, montarHorarioDetalhado } = require('./horarioFuncionamento')

test('resumirHorarioFuncionamento inclui intervalo de almoço quando padrão é igual', () => {
  const profissionais = [{
    horarioTrabalho: {
      1: { ativo: true, inicio: '09:00', fim: '21:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      2: { ativo: true, inicio: '09:00', fim: '21:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
    },
  }]

  assert.equal(
    resumirHorarioFuncionamento(profissionais),
    'Seg–Ter 09h às 12h e das 14h às 21h'
  )
})

test('montarHorarioDetalhado quebra o dia em faixas úteis', () => {
  const profissionais = [{
    horarioTrabalho: {
      1: { ativo: true, inicio: '09:00', fim: '21:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
    },
  }]

  const detalhado = montarHorarioDetalhado(profissionais)
  const segunda = detalhado.find((item) => item.dia === 'Segunda-feira')

  assert.equal(segunda.fechado, false)
  assert.deepEqual(
    segunda.faixas.map((faixa) => faixa.label),
    ['09:00 às 12:00', '14:00 às 21:00']
  )
})

test('resumirHorarioFuncionamento agrupa dias por faixas e preserva almoço', () => {
  const profissionais = [{
    horarioTrabalho: {
      1: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      2: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      3: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      4: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      5: { ativo: true, inicio: '09:00', fim: '18:00', intervalos: [{ inicio: '12:00', fim: '14:00' }] },
      6: { ativo: true, inicio: '09:00', fim: '13:00', intervalos: [] },
    },
  }]

  assert.equal(
    resumirHorarioFuncionamento(profissionais),
    'Seg–Sex 09h às 12h e das 14h às 18h; Sáb 09h às 13h'
  )
})

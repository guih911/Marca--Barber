const normalizarTelefone = (telefone = '') => String(telefone || '').replace(/\D/g, '')

const resumirCliente = (cliente) => {
  if (!cliente) return null

  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    telefoneNormalizado: normalizarTelefone(cliente.telefone),
    lidWhatsapp: cliente.lidWhatsapp || null,
    totalAgendamentos: cliente?._count?.agendamentos,
    totalConversas: cliente?._count?.conversas,
    criadoEm: cliente.criadoEm instanceof Date ? cliente.criadoEm.toISOString() : cliente.criadoEm,
    atualizadoEm: cliente.atualizadoEm instanceof Date ? cliente.atualizadoEm.toISOString() : cliente.atualizadoEm,
  }
}

const serializar = (payload) => JSON.stringify(
  payload,
  (_, valor) => (valor instanceof Date ? valor.toISOString() : valor),
)

const logClienteTrace = (evento, payload = {}, nivel = 'log') => {
  const destino = typeof console[nivel] === 'function' ? console[nivel] : console.log
  destino(`[ClienteTrace] ${evento} ${serializar(payload)}`)
}

module.exports = {
  logClienteTrace,
  normalizarTelefone,
  resumirCliente,
}

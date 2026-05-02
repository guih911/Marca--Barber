const obterPaginacao = (query = {}, padraoLimite = 20, maximo = 200) => {
  const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1)
  const limite = Math.max(1, Math.min(maximo, Number.parseInt(query.limite, 10) || padraoLimite))
  const skip = (pagina - 1) * limite
  return { pagina, limite, skip }
}

const normalizarTelefone = (valor = '') => String(valor).replace(/\D/g, '')

module.exports = {
  obterPaginacao,
  normalizarTelefone,
}

const banco = require('../config/banco')

// Gera slug único a partir de um texto
const gerarSlugBase = (texto) => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Gera slug único verificando colisões no banco
const gerarSlugUnico = async (nome) => {
  const slugBase = gerarSlugBase(nome)
  let slug = slugBase
  let contador = 1

  while (true) {
    const existente = await banco.tenant.findUnique({ where: { slug } })
    if (!existente) return slug
    slug = `${slugBase}-${contador}`
    contador++
  }
}

module.exports = { gerarSlugBase, gerarSlugUnico }

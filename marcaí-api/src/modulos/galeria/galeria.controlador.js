const banco = require('../../config/banco')
const fs = require('fs')
const path = require('path')

const listar = async (req, res, next) => {
  try {
    const { profissionalId, destaque, limite = 50, pagina = 1 } = req.query
    const where = { tenantId: req.usuario.tenantId }
    if (profissionalId) where.profissionalId = profissionalId
    if (destaque === 'true') where.destaque = true

    const pular = (Number(pagina) - 1) * Number(limite)
    const [fotos, total] = await Promise.all([
      banco.fotoGaleria.findMany({
        where,
        include: { profissional: { select: { id: true, nome: true } } },
        orderBy: [{ destaque: 'desc' }, { criadoEm: 'desc' }],
        skip: pular,
        take: Number(limite),
      }),
      banco.fotoGaleria.count({ where }),
    ])
    res.json({ sucesso: true, dados: fotos, meta: { total, pagina: Number(pagina), limite: Number(limite) } })
  } catch (erro) { next(erro) }
}

const criar = async (req, res, next) => {
  try {
    if (!req.file) throw { status: 400, mensagem: 'Nenhum arquivo enviado', codigo: 'SEM_ARQUIVO' }
    const { profissionalId, titulo, descricao, servicoNome, destaque } = req.body
    const fotoUrl = `/uploads/galeria/${req.file.filename}`
    const foto = await banco.fotoGaleria.create({
      data: {
        tenantId: req.usuario.tenantId,
        profissionalId: profissionalId || null,
        fotoUrl,
        titulo: titulo || null,
        descricao: descricao || null,
        servicoNome: servicoNome || null,
        destaque: destaque === 'true' || destaque === true,
      },
      include: { profissional: { select: { id: true, nome: true } } },
    })
    res.status(201).json({ sucesso: true, dados: foto })
  } catch (erro) { next(erro) }
}

const atualizar = async (req, res, next) => {
  try {
    const foto = await banco.fotoGaleria.findFirst({ where: { id: req.params.id, tenantId: req.usuario.tenantId } })
    if (!foto) throw { status: 404, mensagem: 'Foto não encontrada', codigo: 'NAO_ENCONTRADO' }

    const atualizada = await banco.fotoGaleria.update({
      where: { id: req.params.id },
      data: {
        titulo: req.body.titulo !== undefined ? req.body.titulo : foto.titulo,
        descricao: req.body.descricao !== undefined ? req.body.descricao : foto.descricao,
        servicoNome: req.body.servicoNome !== undefined ? req.body.servicoNome : foto.servicoNome,
        destaque: req.body.destaque !== undefined ? Boolean(req.body.destaque) : foto.destaque,
        profissionalId: req.body.profissionalId !== undefined ? (req.body.profissionalId || null) : foto.profissionalId,
      },
      include: { profissional: { select: { id: true, nome: true } } },
    })
    res.json({ sucesso: true, dados: atualizada })
  } catch (erro) { next(erro) }
}

const remover = async (req, res, next) => {
  try {
    const foto = await banco.fotoGaleria.findFirst({ where: { id: req.params.id, tenantId: req.usuario.tenantId } })
    if (!foto) throw { status: 404, mensagem: 'Foto não encontrada', codigo: 'NAO_ENCONTRADO' }

    // Remove arquivo físico (melhor esforço)
    try {
      const filePath = path.join(__dirname, '../../../../uploads/galeria', path.basename(foto.fotoUrl))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignora */ }

    await banco.fotoGaleria.delete({ where: { id: req.params.id } })
    res.json({ sucesso: true, dados: { mensagem: 'Foto removida' } })
  } catch (erro) { next(erro) }
}

module.exports = { listar, criar, atualizar, remover }

const multer = require('multer')

// Handler global de erros do Express
const tratarErros = (erro, req, res, next) => {
  console.error('Erro capturado:', erro)

  // Erros de upload (Multer)
  if (erro instanceof multer.MulterError || erro.message === 'Apenas imagens são permitidas') {
    const mensagem = erro.code === 'LIMIT_FILE_SIZE'
      ? 'Arquivo muito grande. O limite é 10 MB.'
      : (erro.message || 'Erro no upload do arquivo.')
    return res.status(400).json({
      sucesso: false,
      erro: { mensagem, codigo: 'UPLOAD_INVALIDO' },
    })
  }

  // Erros lançados manualmente pelos serviços (throw { status, mensagem, codigo })
  if (erro.status && erro.mensagem) {
    return res.status(erro.status).json({
      sucesso: false,
      erro: {
        mensagem: erro.mensagem,
        codigo: erro.codigo || 'ERRO_GENERICO',
      },
    })
  }

  // Erros do Prisma
  if (erro.code) {
    switch (erro.code) {
      case 'P2002':
        return res.status(409).json({
          sucesso: false,
          erro: { mensagem: 'Registro duplicado. Esse dado já existe.', codigo: 'DUPLICADO' },
        })
      case 'P2025':
        return res.status(404).json({
          sucesso: false,
          erro: { mensagem: 'Registro não encontrado', codigo: 'NAO_ENCONTRADO' },
        })
      default:
        break
    }
  }

  // Erro genérico
  return res.status(500).json({
    sucesso: false,
    erro: {
      mensagem: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : erro.message,
      codigo: 'ERRO_INTERNO',
    },
  })
}

module.exports = { tratarErros }

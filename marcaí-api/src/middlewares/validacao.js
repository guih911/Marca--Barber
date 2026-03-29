const { validationResult } = require('express-validator')

// Middleware que verifica os resultados do express-validator
// e retorna erros formatados se houver
const validar = (req, res, next) => {
  const erros = validationResult(req)

  if (!erros.isEmpty()) {
    const listaErros = erros.array().map((e) => ({
      campo: e.path,
      mensagem: e.msg,
    }))

    return res.status(422).json({
      sucesso: false,
      erro: {
        mensagem: 'Dados inválidos',
        codigo: 'VALIDACAO_FALHOU',
        campos: listaErros,
      },
    })
  }

  next()
}

module.exports = { validar }

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const banco = require('../../config/banco')
const { jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn, bcryptSaltRounds } = require('../../config/auth')
const { gerarSlugUnico } = require('../../utils/gerarSlug')

// Gera par de tokens JWT (access + refresh)
const gerarTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    tenantId: usuario.tenantId,
    perfil: usuario.perfil,
  }

  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn })
  const refreshToken = jwt.sign(payload, jwtRefreshSecret, { expiresIn: jwtRefreshExpiresIn })

  return { accessToken, refreshToken }
}

// Cadastra novo usuário e cria tenant inicial
const cadastrar = async ({ nome, email, senha }) => {
  const existente = await banco.usuario.findUnique({ where: { email } })
  if (existente) {
    throw { status: 409, mensagem: 'Este e-mail já está cadastrado', codigo: 'EMAIL_DUPLICADO' }
  }

  const senhaHash = await bcrypt.hash(senha, bcryptSaltRounds)
  const slug = await gerarSlugUnico(nome)

  // Cria tenant e usuário em transação
  const resultado = await banco.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        nome,
        slug,
        onboardingCompleto: false,
      },
    })

    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome,
        email,
        senhaHash,
        perfil: 'ADMIN',
      },
    })

    return { tenant, usuario }
  })

  const tokens = gerarTokens(resultado.usuario)

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: resultado.usuario.id,
      nome: resultado.usuario.nome,
      email: resultado.usuario.email,
      tenantId: resultado.tenant.id,
      perfil: resultado.usuario.perfil,
      onboardingCompleto: resultado.tenant.onboardingCompleto,
    },
  }
}

// Autentica usuário e retorna tokens
const login = async ({ email, senha }) => {
  const usuario = await banco.usuario.findUnique({
    where: { email },
    include: { tenant: true },
  })

  if (!usuario || !usuario.senhaHash) {
    throw { status: 401, mensagem: 'E-mail ou senha incorretos', codigo: 'CREDENCIAIS_INVALIDAS' }
  }

  if (!usuario.ativo) {
    throw { status: 403, mensagem: 'Conta desativada', codigo: 'CONTA_DESATIVADA' }
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash)
  if (!senhaValida) {
    throw { status: 401, mensagem: 'E-mail ou senha incorretos', codigo: 'CREDENCIAIS_INVALIDAS' }
  }

  const tokens = gerarTokens(usuario)

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatarUrl,
      tenantId: usuario.tenantId,
      perfil: usuario.perfil,
      onboardingCompleto: usuario.tenant.onboardingCompleto,
    },
  }
}

// Renova access token usando refresh token
const renovarToken = async ({ refreshToken }) => {
  try {
    const payload = jwt.verify(refreshToken, jwtRefreshSecret)
    const usuario = await banco.usuario.findUnique({
      where: { id: payload.id },
      include: { tenant: true },
    })

    if (!usuario || !usuario.ativo) {
      throw { status: 401, mensagem: 'Usuário inválido', codigo: 'USUARIO_INVALIDO' }
    }

    const tokens = gerarTokens(usuario)
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
  } catch (erro) {
    if (erro.status) throw erro
    throw { status: 401, mensagem: 'Refresh token inválido ou expirado', codigo: 'REFRESH_INVALIDO' }
  }
}

// Busca ou cria usuário via Google OAuth
const loginOuCadastrarGoogle = async ({ googleId, email, nome, avatarUrl }) => {
  // Tenta encontrar por googleId ou email
  let usuario = await banco.usuario.findFirst({
    where: { OR: [{ googleId }, { email }] },
    include: { tenant: true },
  })

  if (!usuario) {
    // Novo usuário: cria tenant e usuário
    const slug = await gerarSlugUnico(nome)

    const resultado = await banco.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { nome, slug, onboardingCompleto: false },
      })
      const novoUsuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome,
          email,
          googleId,
          avatarUrl,
          perfil: 'ADMIN',
        },
        include: { tenant: true },
      })
      return novoUsuario
    })
    usuario = resultado
  } else if (!usuario.googleId) {
    // Usuário existente sem googleId: vincula
    usuario = await banco.usuario.update({
      where: { id: usuario.id },
      data: { googleId, avatarUrl: avatarUrl || usuario.avatarUrl },
      include: { tenant: true },
    })
  }

  const tokens = gerarTokens(usuario)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatarUrl,
      tenantId: usuario.tenantId,
      perfil: usuario.perfil,
      onboardingCompleto: usuario.tenant.onboardingCompleto,
    },
  }
}

// Gera token de reset de senha e "envia" por email
const recuperarSenha = async ({ email }) => {
  const usuario = await banco.usuario.findUnique({ where: { email } })
  // Não revela se o email existe ou não (segurança)
  if (!usuario) return { mensagem: 'Se o e-mail existir, você receberá o link em breve.' }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

  await banco.tokenResetSenha.create({ data: { email, token, expiresAt } })

  // Em produção: enviar email com link
  console.log(`Link de reset: ${process.env.FRONTEND_URL}/redefinir-senha/${token}`)

  return { mensagem: 'Se o e-mail existir, você receberá o link em breve.' }
}

// Redefine senha usando token
const redefinirSenha = async ({ token, novaSenha }) => {
  const registro = await banco.tokenResetSenha.findUnique({ where: { token } })

  if (!registro || registro.usado || registro.expiresAt < new Date()) {
    throw { status: 400, mensagem: 'Token inválido ou expirado', codigo: 'TOKEN_INVALIDO' }
  }

  const senhaHash = await bcrypt.hash(novaSenha, bcryptSaltRounds)

  await banco.$transaction(async (tx) => {
    await tx.usuario.update({ where: { email: registro.email }, data: { senhaHash } })
    await tx.tokenResetSenha.update({ where: { token }, data: { usado: true } })
  })

  return { mensagem: 'Senha redefinida com sucesso' }
}

module.exports = {
  cadastrar,
  login,
  renovarToken,
  loginOuCadastrarGoogle,
  recuperarSenha,
  redefinirSenha,
}
